// components/driver/offline/OfflineStatusBar.jsx
//
// Single banner that covers both halves of the offline story:
//   1. Manual "Work Offline" toggle (30/60/90 min) — for drivers heading
//      into a known dead zone who'd rather queue everything up front.
//   2. Live sync status — pending action count, last sync time, and any
//      actions that failed permanently and need the driver's attention.
//
// Deliberately one component, not two: a driver should see "am I in
// offline mode" and "is anything waiting to sync" in the same glance,
// since they're the same underlying question ("is my data safe").

import { useState, useEffect, useCallback } from "react";
import { WifiOff, Wifi, Clock, AlertTriangle, X, ChevronDown } from "lucide-react";
import { toast } from "react-hot-toast";
import { workOfflineMode } from "../../../offline/workOfflineMode";
import { watchConnectivity } from "../../../offline/network";
import * as syncEngine from "../../../offline/syncEngine";
import {
  getPendingCount,
  getPermanentFailures,
  discardAction,
} from "../../../offline/offlineQueueManager";

function formatRemaining(ms) {
  if (ms == null) return "";
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function OfflineStatusBar() {
  const [manualUntil, setManualUntil] = useState(null);
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [permanentFailures, setPermanentFailures] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [showFailuresPanel, setShowFailuresPanel] = useState(false);

  const refreshQueueState = useCallback(async () => {
    setPendingCount(await getPendingCount());
    setPermanentFailures(await getPermanentFailures());
  }, []);

  useEffect(() => {
    const unsubscribeMode = workOfflineMode.subscribe(setManualUntil);
    const unsubscribeConn = watchConnectivity(setIsConnected);
    const unsubscribeSync = syncEngine.subscribe((event) => {
      if (
        [
          "action_synced",
          "action_permanently_failed",
          "flush_completed",
          "locations_flushed",
        ].includes(event.type)
      ) {
        refreshQueueState();
      }
      if (event.type === "flush_completed" && event.succeeded > 0) {
        setLastSyncedAt(Date.now());
      }
    });
    refreshQueueState();

    return () => {
      unsubscribeMode();
      unsubscribeConn();
      unsubscribeSync();
    };
  }, [refreshQueueState]);

  const handleEnable = (minutes) => {
    workOfflineMode.enable(minutes);
    setShowDurationMenu(false);
    toast(`Work Offline mode on for ${minutes} min — actions will be queued and synced later.`, {
      icon: "📶",
      duration: 4000,
    });
  };

  const handleDisableNow = () => {
    workOfflineMode.disable();
    toast.success("Back online — syncing now.");
    syncEngine.flush();
  };

  const handleDiscardFailure = async (localId) => {
    await discardAction(localId);
    await refreshQueueState();
  };

  const manualActive = manualUntil !== null;
  const remainingMs = manualActive ? manualUntil - Date.now() : null;

  // Nothing to show: online, no manual mode, nothing queued, no failures.
  if (isConnected && !manualActive && pendingCount === 0 && permanentFailures.length === 0) {
    return (
      <div className="flex items-center justify-end px-2">
        <button
          onClick={() => setShowDurationMenu((s) => !s)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Wifi className="h-3.5 w-3.5 text-green-600" />
          Work Offline
          <ChevronDown className="h-3 w-3" />
        </button>
        {showDurationMenu && (
          <DurationMenu onSelect={handleEnable} onClose={() => setShowDurationMenu(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`w-full px-4 py-2 flex flex-wrap items-center gap-3 text-sm ${
          manualActive
            ? "bg-amber-50 border border-amber-200 text-amber-900"
            : !isConnected
            ? "bg-red-50 border border-red-200 text-red-900"
            : "bg-blue-50 border border-blue-200 text-blue-900"
        }`}
      >
        {manualActive ? (
          <>
            <Clock className="h-4 w-4 shrink-0" />
            <span className="font-medium">
              Work Offline mode — {formatRemaining(remainingMs)} remaining
            </span>
            <button
              onClick={handleDisableNow}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Go online now
            </button>
          </>
        ) : !isConnected ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="font-medium">No connection — actions are being saved locally</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 shrink-0 text-green-600" />
            <span>Online{lastSyncedAt ? ` — last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : ""}</span>
          </>
        )}

        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-white/70 text-xs font-semibold">
            {pendingCount} waiting to sync
          </span>
        )}

        {permanentFailures.length > 0 && (
          <button
            onClick={() => setShowFailuresPanel((s) => !s)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold"
          >
            <AlertTriangle className="h-3 w-3" />
            {permanentFailures.length} need attention
          </button>
        )}

        {!manualActive && isConnected && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShowDurationMenu((s) => !s)}
              className="text-xs underline hover:no-underline flex items-center gap-1"
            >
              Work Offline <ChevronDown className="h-3 w-3" />
            </button>
            {showDurationMenu && (
              <DurationMenu onSelect={handleEnable} onClose={() => setShowDurationMenu(false)} />
            )}
          </div>
        )}
      </div>

      {showFailuresPanel && permanentFailures.length > 0 && (
        <div className="w-full border border-t-0 border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-semibold text-red-900 mb-2">
            These actions couldn't be applied and won't retry automatically:
          </p>
          <ul className="space-y-2">
            {permanentFailures.map((action) => (
              <li
                key={action.localId}
                className="flex items-center justify-between gap-3 bg-white rounded-md px-3 py-2 border border-red-100"
              >
                <div>
                  <span className="font-medium">{action.type.replace("_", " ")}</span>
                  {" — booking "}
                  <span className="font-mono text-xs">{String(action.bookingId).slice(0, 8)}</span>
                  <p className="text-xs text-red-700 mt-0.5">{action.lastError}</p>
                </div>
                <button
                  onClick={() => handleDiscardFailure(action.localId)}
                  className="text-red-600 hover:text-red-800"
                  title="Discard — the server's state is authoritative"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DurationMenu({ onSelect, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest("[data-duration-menu]")) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      data-duration-menu
      className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40"
    >
      <p className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">Work Offline for</p>
      {[30, 60, 90].map((minutes) => (
        <button
          key={minutes}
          onClick={() => onSelect(minutes)}
          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
        >
          {minutes} minutes
        </button>
      ))}
    </div>
  );
}

export default OfflineStatusBar;
