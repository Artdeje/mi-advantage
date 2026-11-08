import React, { useEffect, useState } from "react";
import { RefreshCw } from "./AdminIcons";
import type { LiveRefreshState } from "../lib/useLiveRefresh";

/**
 * Small live-data indicator for dashboards.
 * Shows a pulsing dot, the poll interval, and how long ago the data changed.
 * Clicking toggles the user pause; the refresh icon forces an immediate poll.
 */
export default function LiveBadge({
  live,
  compact = false,
}: {
  live: LiveRefreshState;
  compact?: boolean;
}) {
  const { lastUpdated, isRefreshing, error, paused, userPaused, toggleUserPause, refreshNow } = live;
  const [, tick] = useState(0);

  // Keep "x s ago" honest even when a poll returned identical data.
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secondsAgo = lastUpdated ? Math.max(0, Math.round((Date.now() - lastUpdated) / 1000)) : null;
  const tone = error
    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900"
    : paused
      ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900";

  const label = error
    ? "Reconnecting"
    : userPaused
      ? "Paused"
      : secondsAgo === null
        ? "Live"
        : secondsAgo <= 2
          ? "Live"
          : `Live · ${secondsAgo}s`;

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleUserPause}
        title={
          userPaused
            ? "Resume the 2-second live refresh"
            : error
              ? `Live refresh error: ${error}. Click to pause.`
              : `Live data · refreshed ${secondsAgo ?? 0}s ago. Click to pause.`
        }
        aria-label={userPaused ? "Resume live refresh" : "Pause live refresh"}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${tone}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          {!paused && !error && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              error ? "bg-amber-500" : paused ? "bg-slate-400" : "bg-emerald-500"
            }`}
          />
        </span>
        {!compact && <span>{label}</span>}
      </button>
      <button
        type="button"
        onClick={refreshNow}
        title="Refresh now"
        aria-label="Refresh data now"
        className="p-1 rounded-full text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
      </button>
    </span>
  );
}
