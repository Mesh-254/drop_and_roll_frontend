// offline/db.js
//
// Local IndexedDB store (via Dexie) backing the driver app's offline queue.
// This is the single source of truth for anything that needs to survive a
// dropped connection, a closed tab, or a force-quit app — the in-memory
// React state never holds anything that can't be lost safely.
//
// Tables:
//   actionQueue  — pending mutations (status changes, POD, notes) waiting
//                  to reach the backend, in the order they were created.
//   podPhotos    — POD photo Blobs, keyed by the same localId used in the
//                  matching actionQueue row (kept separate so we don't
//                  pull large binary blobs into every queue read).
//   locationPings— buffered GPS points awaiting a batch flush.
//   cachedReads  — last-known-good response for read endpoints (current
//                  route, job list) so the UI has something to show when
//                  a GET fails outright.
//   workOfflineMode — the single row tracking the manual "Work Offline"
//                  toggle's state and expiry.
//
// Install: `npm install dexie`

import Dexie from "dexie";

export const db = new Dexie("dropnroll-driver-offline");

db.version(1).stores({
  // ++localId = auto-incrementing local primary key (never sent to the
  // server). `status` is one of: 'pending' | 'syncing' | 'failed'.
  actionQueue:
    "++localId, status, type, bookingId, clientActionId, createdAt",
  podPhotos: "localId",
  locationPings: "++localId, createdAt",
  cachedReads: "key",
  workOfflineMode: "id",
});

export default db;
