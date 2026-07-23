// offline/batchSync.js
//
// Part 3 — flush queued offline STATUS transitions through the batch endpoint
// POST /api/driver/sync. This complements the per-action fallback in
// syncEngine.js: STATUS_UPDATE actions go out together in ONE request, the
// server applies each independently and atomically, and we reconcile the local
// queue from the per-event results.
//
// Why a batch path at all: the server enforces per-booking ordering by client
// sequence number, so a driver's queued "picked up" then "at hub" always apply
// in that order even if the network reorders them — and one round-trip drains
// the whole shift's backlog instead of N sequential requests.
//
// The two core steps are pure functions (buildStatusEvents / reconcileBatch) so
// they can be unit-tested without IndexedDB or the network.

import { ACTION_TYPES, getQueue, markFailed, markSucceeded, markSyncing } from "./offlineQueueManager";

/**
 * Build the `events` array for /driver/sync from queued STATUS_UPDATE actions,
 * assigning each a per-booking sequence number from queue order (oldest first),
 * plus a lookup from client_action_id back to the local action for reconcile.
 *
 * Pure — no side effects.
 */
export function buildStatusEvents(actions) {
  const seqByBooking = new Map();
  const events = [];
  const byClientActionId = new Map();

  for (const action of actions) {
    const nextSeq = (seqByBooking.get(action.bookingId) ?? 0) + 1;
    seqByBooking.set(action.bookingId, nextSeq);
    events.push({
      client_action_id: action.clientActionId,
      booking_id: action.bookingId,
      target_status: action.payload?.status,
      sequence: nextSeq,
      // Informational only — the server treats server_received_at as
      // authoritative and never trusts the device clock for ordering/SLA.
      client_timestamp: action.createdAt
        ? new Date(action.createdAt).toISOString()
        : new Date().toISOString(),
    });
    byClientActionId.set(action.clientActionId, action);
  }

  return { events, byClientActionId };
}

/**
 * Classify each server result against the local actions.
 *   applied | duplicate_ignored → resolved (drop from queue)
 *   conflict                    → surfaced (permanent-fail + dispatcher review)
 *   anything else / unknown key → left for the per-action fallback
 *
 * Pure — no side effects.
 */
export function reconcileBatch(results, byClientActionId) {
  const resolved = [];
  const conflicts = [];
  const unknown = [];

  for (const result of results || []) {
    const action = byClientActionId.get(result.client_action_id);
    if (!action) {
      unknown.push(result);
      continue;
    }
    if (result.result === "applied" || result.result === "duplicate_ignored") {
      resolved.push({ action, result });
    } else if (result.result === "conflict") {
      conflicts.push({ action, result });
    } else {
      unknown.push(result);
    }
  }

  return { resolved, conflicts, unknown };
}

/**
 * Flush all queued STATUS_UPDATE actions via the batch endpoint and reconcile
 * the local queue. Returns a summary. A network-level failure re-queues the
 * actions (non-permanent) so the per-action fallback in syncEngine.flush() can
 * retry them individually — nothing is dropped.
 *
 * @param {object} api   driverApi instance exposing `_syncStatusBatchRaw`
 * @param {function} [emit] optional sync-event emitter
 */
export async function flushStatusBatch(api, emit) {
  const queue = await getQueue();
  const statusActions = queue.filter((a) => a.type === ACTION_TYPES.STATUS_UPDATE);
  if (statusActions.length === 0) {
    return { applied: 0, conflicts: 0, skipped: true };
  }

  const { events, byClientActionId } = buildStatusEvents(statusActions);
  await Promise.all(statusActions.map((a) => markSyncing(a.localId)));

  let data;
  try {
    data = await api._syncStatusBatchRaw(events);
  } catch (err) {
    // Never reached the server (or a 5xx) — re-queue for the per-action
    // fallback rather than losing the actions.
    await Promise.all(
      statusActions.map((a) => markFailed(a.localId, err?.message || "Batch sync network error")),
    );
    emit?.({ type: "batch_sync_failed", error: err?.message });
    return { applied: 0, conflicts: 0, failed: statusActions.length };
  }

  const { resolved, conflicts } = reconcileBatch(data?.results, byClientActionId);

  for (const { action } of resolved) {
    await markSucceeded(action.localId);
  }
  for (const { action, result } of conflicts) {
    // A server-side conflict will never succeed on retry — mark permanent and
    // surface it (the Sync Issues panel + the dispatcher SyncConflict queue).
    await markFailed(action.localId, result.detail || `Conflict: ${result.reason}`, {
      permanent: true,
    });
    emit?.({ type: "action_conflict", action, result });
  }

  emit?.({ type: "batch_synced", applied: resolved.length, conflicts: conflicts.length });
  return { applied: resolved.length, conflicts: conflicts.length };
}
