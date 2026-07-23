// offline/syncEngine.js
//
// Drains the offline action queue whenever connectivity is available.
// Runs sequentially (one action at a time, oldest first) rather than in
// parallel — this matters because two actions for the same booking must
// apply in the order the driver performed them (e.g. "picked up" must
// land before "delivered", never the reverse).
//
// Failure handling:
//   - Network/timeout errors  → retry with exponential backoff, action
//     stays in the queue.
//   - Server said "no" for a real reason (e.g. IMMUTABLE_DELIVERY,
//     REVERT_FORBIDDEN, 4xx validation) → mark permanently_failed and
//     surface it; retrying a request the server has already rejected for
//     a business reason will never succeed, so it shouldn't be retried
//     forever or silently dropped.
//
// The `client_action_id` on every queued action makes replay safe even if
// this flush is interrupted mid-way and re-run from the top later.

import { ACTION_TYPES, getQueue, getPhotoBlob, markSyncing, markSucceeded, markFailed, getBufferedLocations, clearLocationPings } from "./offlineQueueManager";
import { isOnline, watchConnectivity } from "./network";
import { flushStatusBatch } from "./batchSync";

const MAX_RETRIES_BEFORE_GIVING_UP = 8;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

let apiRef = null; // injected driverApi instance, set via init()
let isFlushing = false;
let flushQueuedAgain = false; // if a flush is requested while one is running
let stopWatching = null;

const listeners = new Set();

function emit(event) {
  listeners.forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      // Never let a listener error break the sync loop.
      console.error("[SyncEngine] listener error", e);
    }
  });
}

/** Subscribe to sync lifecycle events. Returns an unsubscribe function. */
export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function backoffDelay(retryCount) {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS);
  // +/- 20% jitter so a batch of actions that failed together don't all
  // retry in the same instant.
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.max(500, delay + jitter);
}

/** Classify an error thrown by the raw API call. */
function isPermanentFailure(error) {
  const httpStatus = error?.status || error?.response?.status;
  // 4xx (other than 408/429) means the server made a decision we should
  // respect, not a transient network blip.
  return httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429;
}

async function applyAction(action) {
  const { type, bookingId, payload, clientActionId, localId, hasPhoto } = action;

  switch (type) {
    case ACTION_TYPES.STATUS_UPDATE:
      return apiRef._updateJobStatusRaw(bookingId, payload.status, payload.driver_location, clientActionId);

    case ACTION_TYPES.POD_SUBMIT: {
      const photo = hasPhoto ? await getPhotoBlob(localId) : null;
      return apiRef._submitProofOfDeliveryRaw(bookingId, { ...payload, photo }, clientActionId);
    }

    case ACTION_TYPES.REPORT_FAILURE:
      return apiRef._recordFailureRaw(bookingId, payload, clientActionId);

    case ACTION_TYPES.REPORT_ISSUE:
      return apiRef._reportJobIssueRaw(bookingId, payload, clientActionId);

    default:
      throw new Error(`Unknown queued action type: ${type}`);
  }
}

async function flushLocationPings() {
  const pings = await getBufferedLocations(200);
  if (pings.length === 0) return;

  try {
    await apiRef._sendLocationBatchRaw(
      pings.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        speed_kmh: p.speed_kmh ?? null,
        heading_degrees: p.heading_degrees ?? null,
        accuracy_meters: p.accuracy_meters ?? null,
        recorded_at: new Date(p.createdAt).toISOString(),
      }))
    );
    await clearLocationPings(pings.map((p) => p.localId));
    emit({ type: "locations_flushed", count: pings.length });
  } catch (err) {
    // Leave pings buffered — they're harmless to retry wholesale next time
    // since duplicate GPS rows are not a correctness problem.
    emit({ type: "locations_flush_failed", error: err?.message });
  }
}

/**
 * Drains the action queue sequentially, then flushes buffered GPS pings.
 * Safe to call repeatedly/concurrently — re-entrant calls coalesce into a
 * single extra pass rather than running in parallel.
 */
export async function flush() {
  if (isFlushing) {
    flushQueuedAgain = true;
    return;
  }
  isFlushing = true;
  emit({ type: "flush_started" });

  try {
    const online = await isOnline({ force: true });
    if (!online) {
      emit({ type: "flush_skipped_offline" });
      return;
    }

    // Drain STATUS transitions through the batch endpoint first — one request,
    // server-enforced per-booking ordering, per-event applied/duplicate/conflict
    // reconciliation. Resolved + conflicted items are removed from the queue
    // here; a network-level batch failure re-queues them so the per-action loop
    // below retries them individually. POD/failure/issue actions are never
    // batched (they carry blobs / distinct endpoints) and flow through the loop.
    try {
      await flushStatusBatch(apiRef, emit);
    } catch (err) {
      // flushStatusBatch already re-queues on network failure; a throw here is
      // unexpected but must not abort the per-action fallback below.
      emit({ type: "batch_sync_error", error: err?.message });
    }

    const queue = await getQueue();
    let succeeded = 0;
    let failed = 0;

    for (const action of queue) {
      // Re-check connectivity between items — a flaky connection can drop
      // mid-flush, and we'd rather stop cleanly than burn through retries.
      if (!(await isOnline())) {
        emit({ type: "flush_interrupted_offline" });
        break;
      }

      await markSyncing(action.localId);
      try {
        await applyAction(action);
        await markSucceeded(action.localId);
        succeeded += 1;
        emit({ type: "action_synced", action });
      } catch (err) {
        failed += 1;
        if (isPermanentFailure(err)) {
          await markFailed(action.localId, err?.message || "Rejected by server", {
            permanent: true,
          });
          emit({ type: "action_permanently_failed", action, error: err });
        } else if (action.retryCount + 1 >= MAX_RETRIES_BEFORE_GIVING_UP) {
          await markFailed(action.localId, err?.message || "Max retries exceeded", {
            permanent: true,
          });
          emit({ type: "action_permanently_failed", action, error: err });
        } else {
          await markFailed(action.localId, err?.message || "Network error");
          emit({ type: "action_retry_scheduled", action, error: err });
          // Stop this pass — wait for backoff before trying the rest of
          // the queue, rather than hammering a backend that just failed.
          setTimeout(() => flush(), backoffDelay(action.retryCount));
          break;
        }
      }
    }

    await flushLocationPings();

    emit({ type: "flush_completed", succeeded, failed });
  } finally {
    isFlushing = false;
    if (flushQueuedAgain) {
      flushQueuedAgain = false;
      flush();
    }
  }
}

/**
 * Starts the sync engine: watches connectivity and flushes automatically.
 * Call once at app/dashboard mount. `driverApiInstance` must expose the
 * `_*Raw` methods used in applyAction() above.
 */
export function init(driverApiInstance) {
  apiRef = driverApiInstance;
  if (stopWatching) stopWatching();

  stopWatching = watchConnectivity((online) => {
    emit({ type: "connectivity_changed", online });
    if (online) flush();
  });

  // Also flush on a slow interval as a safety net (e.g. if the
  // connectivity-change event was missed for some reason).
  const safetyInterval = setInterval(() => flush(), 45000);

  const prevStop = stopWatching;
  stopWatching = () => {
    prevStop();
    clearInterval(safetyInterval);
  };

  return () => {
    if (stopWatching) stopWatching();
    stopWatching = null;
  };
}
