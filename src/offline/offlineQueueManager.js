// offline/offlineQueueManager.js
//
// Persists driver actions locally when they can't (or shouldn't, per
// "Work Offline" mode) go straight to the server. Every entry gets a
// client-generated UUID the moment it's queued — this is what backend
// idempotency (ClientActionRecord) keys off, so replaying the queue after
// a crash/duplicate-flush can never double-apply an action.
//
// This module knows nothing about HTTP — that's syncEngine.js. It only
// knows how to durably store and retrieve queued work.

import { db } from "./db";

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 for older browsers/webviews.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const ACTION_TYPES = {
  STATUS_UPDATE: "status_update",
  POD_SUBMIT: "pod_submit",
  REPORT_FAILURE: "report_failure",
  REPORT_ISSUE: "report_issue",
};

/**
 * Queue a mutating action for later sync.
 * @param {Object} action
 * @param {string} action.type - one of ACTION_TYPES
 * @param {string} action.bookingId
 * @param {Object} action.payload - JSON-serializable request body
 * @param {Blob}   [action.photoBlob] - stored separately for POD photos
 * @returns {Promise<{localId: number, clientActionId: string}>}
 */
export async function enqueueAction({ type, bookingId, payload, photoBlob }) {
  const clientActionId = generateId();
  const createdAt = Date.now();

  const localId = await db.actionQueue.add({
    type,
    bookingId,
    payload,
    clientActionId,
    status: "pending",
    retryCount: 0,
    hasPhoto: !!photoBlob,
    createdAt,
    lastError: null,
  });

  if (photoBlob) {
    await db.podPhotos.put({ localId, blob: photoBlob });
  }

  return { localId, clientActionId };
}

/** All queued actions, oldest first (FIFO). */
export async function getQueue() {
  return db.actionQueue.orderBy("createdAt").toArray();
}

/** Count of actions still waiting to sync (pending or failed-but-retryable). */
export async function getPendingCount() {
  return db.actionQueue.where("status").anyOf(["pending", "syncing", "failed"]).count();
}

export async function getPhotoBlob(localId) {
  const row = await db.podPhotos.get(localId);
  return row?.blob ?? null;
}

export async function markSyncing(localId) {
  await db.actionQueue.update(localId, { status: "syncing" });
}

export async function markSucceeded(localId) {
  await db.actionQueue.delete(localId);
  await db.podPhotos.delete(localId);
}

export async function markFailed(localId, errorMessage, { permanent = false } = {}) {
  const row = await db.actionQueue.get(localId);
  const retryCount = (row?.retryCount || 0) + 1;
  await db.actionQueue.update(localId, {
    status: permanent ? "permanently_failed" : "failed",
    retryCount,
    lastError: errorMessage,
  });
}

/** Actions that failed permanently (e.g. server rejected as immutable) and
 * need a human to acknowledge them rather than being retried forever. */
export async function getPermanentFailures() {
  return db.actionQueue.where("status").equals("permanently_failed").toArray();
}

export async function discardAction(localId) {
  await db.actionQueue.delete(localId);
  await db.podPhotos.delete(localId);
}

// ── GPS location buffering (separate, higher-volume, lower-stakes) ──────

export async function bufferLocationPing(pingData) {
  await db.locationPings.add({
    ...pingData,
    createdAt: Date.now(),
  });
}

export async function getBufferedLocationCount() {
  return db.locationPings.count();
}

export async function getBufferedLocations(limit = 200) {
  return db.locationPings.orderBy("createdAt").limit(limit).toArray();
}

export async function clearLocationPings(localIds) {
  await db.locationPings.bulkDelete(localIds);
}
