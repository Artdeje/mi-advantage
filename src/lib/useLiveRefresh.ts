import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Silent, self-scheduling refresh loop for dashboards.
 *
 * Design goals:
 *  - Never overlap requests (single-flight).
 *  - Pause while the tab is hidden and refresh immediately when it returns.
 *  - Back off on failure so a cold/down server is not hammered.
 *  - Never expose a loading state to the caller's first paint — the caller's
 *    refresh function is expected to update data arrays only.
 */
export interface LiveRefreshState {
  /** Timestamp (ms) of the last successful refresh, or null before the first. */
  lastUpdated: number | null;
  /** True only while a manual (user-triggered) refresh is running. */
  isRefreshing: boolean;
  /** Last error message, cleared on the next success. */
  error: string | null;
  /** True when the loop is paused (hidden tab, user pause, or an interlock). */
  paused: boolean;
  /** User-controlled pause toggle (does not stop the visibility listener). */
  userPaused: boolean;
  toggleUserPause: () => void;
  /** Run a refresh now (single-flight). */
  refreshNow: () => void;
}

interface Options {
  /** Base interval in ms. Defaults to 2000. */
  intervalMs?: number;
  /** Set false to stop the loop entirely (e.g. a tab with no live data). */
  enabled?: boolean;
  /** External interlock: pause while a modal / submit is in flight. */
  pause?: boolean;
}

export function useLiveRefresh(
  refresh: () => Promise<void> | void,
  { intervalMs = 2000, enabled = true, pause = false }: Options = {},
): LiveRefreshState {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const backoff = useRef(intervalMs);
  const mounted = useRef(true);

  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Always points at the newest `run` so a timer scheduled in an older render
  // still uses the current enabled/interval values.
  const runRef = useRef<(manual: boolean) => void>(() => {});
  // Live gate snapshot so an in-flight run does not reschedule itself after a
  // modal opened or the tab was hidden.
  const gateRef = useRef({ enabled, hidden, pause, userPaused });
  gateRef.current = { enabled, hidden, pause, userPaused };

  const schedule = useCallback(
    (delay: number) => {
      clearTimer();
      if (!mounted.current) return;
      timer.current = window.setTimeout(() => runRef.current(false), delay);
    },
    [clearTimer],
  );

  const run = useCallback(
    async (manual: boolean) => {
      if (!mounted.current || !enabled) return;
      if (!manual) {
        const gate = gateRef.current;
        if (gate.hidden || gate.pause || gate.userPaused) return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      if (manual) setIsRefreshing(true);
      try {
        await refreshRef.current();
        if (!mounted.current) return;
        backoff.current = intervalMs;
        setLastUpdated(Date.now());
        setError(null);
      } catch (err: any) {
        if (!mounted.current) return;
        backoff.current = Math.min(backoff.current * 2, 30000);
        setError(err?.message || "Refresh failed");
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          if (manual) setIsRefreshing(false);
          const gate = gateRef.current;
          if (gate.enabled && !gate.hidden && !gate.pause && !gate.userPaused) {
            schedule(backoff.current);
          }
        }
      }
    },
    [enabled, intervalMs, schedule],
  );

  runRef.current = (manual: boolean) => {
    void run(manual);
  };

  // Visibility tracking — pause in background, refresh on return.
  useEffect(() => {
    const onVisibility = () => {
      const nowHidden = document.hidden;
      setHidden(nowHidden);
      gateRef.current = { ...gateRef.current, hidden: nowHidden };
      if (!nowHidden && enabled && !pause && !userPaused) {
        // Catch up immediately instead of waiting for the next tick.
        backoff.current = intervalMs;
        void run(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, intervalMs, pause, userPaused, run]);

  // Main loop lifecycle. Restarts when any gate changes.
  useEffect(() => {
    const stopped = !enabled || hidden || pause || userPaused;
    if (stopped) {
      clearTimer();
      return;
    }
    // First tick waits one interval: the caller has just loaded data.
    schedule(intervalMs);
    return clearTimer;
  }, [enabled, hidden, pause, userPaused, intervalMs, schedule, clearTimer]);

  useEffect(() => {
    return () => {
      mounted.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const refreshNow = useCallback(() => {
    void run(true);
  }, [run]);

  const toggleUserPause = useCallback(() => setUserPaused((v) => !v), []);

  return {
    lastUpdated,
    isRefreshing,
    error,
    paused: !enabled || hidden || pause || userPaused,
    userPaused,
    toggleUserPause,
    refreshNow,
  };
}
