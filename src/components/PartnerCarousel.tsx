import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../lib/supabase";
import { Shop } from "../types";
import { ChevronLeft, ChevronRight, Store, X } from "./AdminIcons";

const AUTOPLAY_MS = 5000;

function perViewForWidth(width: number): number {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

function monogramStyle(name: string): React.CSSProperties {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hash} 75% 93%), hsl(${(hash + 42) % 360} 68% 82%))`,
    color: `hsl(${hash} 55% 26%)`,
  };
}

/**
 * Partner logo carousel. Advances one tile every 5 seconds, pauses on
 * hover/focus and when the tab is hidden, and falls back to a static grid for
 * users who prefer reduced motion.
 */
export default function PartnerCarousel() {
  const [partners, setPartners] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [perViewBase, setPerViewBase] = useState(() =>
    typeof window === "undefined" ? 4 : perViewForWidth(window.innerWidth),
  );
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [detail, setDetail] = useState<Shop | null>(null);
  const touchStart = useRef<number | null>(null);

  // Load the sanitized public partner directory. Landing data does not need
  // 2-second polling; a minute is plenty for logos.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const rows = await db.getPartners();
      if (cancelled) return;
      setPartners(rows.filter((s) => !!s.shop_name));
      setLoading(false);
    };
    void load();
    const id = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const onResize = () => setPerViewBase(perViewForWidth(window.innerWidth));
    const onVisibility = () => setHidden(document.hidden);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(motion.matches);
    onMotion();
    onResize();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener?.("change", onMotion);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener?.("change", onMotion);
    };
  }, []);

  // Never leave empty slots: if there are fewer partners than the breakpoint
  // allows, show them all at their natural size so the strip can still slide.
  const perView = Math.max(1, Math.min(perViewBase, partners.length || perViewBase));
  const maxIndex = partners.length > 1 ? partners.length - 1 : 0;
  const paused = hovered || focused || hidden || reducedMotion;

  useEffect(() => {
    if (index > maxIndex) setIndex(0);
  }, [index, maxIndex]);

  useEffect(() => {
    if (paused || maxIndex === 0) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, maxIndex]);

  const go = (dir: -1 | 1) => {
    setIndex((i) => {
      const next = i + dir;
      if (next < 0) return maxIndex;
      if (next > maxIndex) return 0;
      return next;
    });
  };

  // Duplicate the list so the window at the last index is always full.
  const tiles = useMemo(
    () => (partners.length > 1 ? [...partners, ...partners] : partners),
    [partners],
  );

  if (!loading && tiles.length === 0) return null;

  return (
    <section
      aria-label="Partner shops"
      className="relative z-10 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur border-y border-slate-200 dark:border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Our partner network
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {loading ? "Loading partner shops…" : `${partners.length} partner shop${partners.length === 1 ? "" : "s"}`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Show your member card at any of these outlets and save instantly.
            </p>
          </div>

          {partners.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous partner shops"
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next partner shops"
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div
          className="overflow-hidden -mx-2"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={() => setFocused(false)}
          onTouchStart={(e) => {
            touchStart.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return;
            const delta = (e.changedTouches[0]?.clientX ?? 0) - touchStart.current;
            if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
            touchStart.current = null;
          }}
        >
          <div
            className={`flex ${reducedMotion ? "" : "transition-transform duration-700 ease-out"}`}
            style={{ transform: `translateX(-${index * (100 / perView)}%)` }}
          >
            {loading
              ? Array.from({ length: perView }).map((_, i) => (
                  <div key={`sk-${i}`} style={{ flex: `0 0 ${100 / perView}%` }} className="px-2">
                    <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  </div>
                ))
              : tiles.map((shop, tileIndex) => (
                  <div
                    key={`${shop.id}-${tileIndex}`}
                    style={{ flex: `0 0 ${100 / perView}%` }}
                    className="px-2"
                  >
                    <button
                      type="button"
                      onClick={() => setDetail(shop)}
                      title={`${shop.shop_name} — ${shop.discount_percent}% discount`}
                      className="group w-full h-24 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all flex flex-col items-center justify-center gap-2 px-3 cursor-pointer"
                    >
                      {shop.profile_picture ? (
                        <img
                          src={shop.profile_picture}
                          alt={`${shop.shop_name} logo`}
                          loading="lazy"
                          decoding="async"
                          className="h-10 w-10 rounded-xl object-contain"
                        />
                      ) : (
                        <span
                          className="h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                          style={monogramStyle(shop.shop_name)}
                        >
                          {shop.shop_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="w-full text-center">
                        <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                          {shop.shop_name}
                        </span>
                        <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {shop.discount_percent}% off
                        </span>
                      </span>
                    </button>
                  </div>
                ))}
          </div>
        </div>

        {partners.length > 1 && partners.length <= 12 && (
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {Array.from({ length: maxIndex + 1 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to partner slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === index
                    ? "w-6 bg-emerald-600 dark:bg-emerald-400"
                    : "w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              {detail.profile_picture ? (
                <img
                  src={detail.profile_picture}
                  alt={`${detail.shop_name} logo`}
                  className="h-14 w-14 rounded-2xl object-contain border border-slate-200 dark:border-slate-800"
                />
              ) : (
                <span
                  className="h-14 w-14 rounded-2xl flex items-center justify-center font-black text-lg shrink-0"
                  style={monogramStyle(detail.shop_name)}
                >
                  {detail.shop_name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                  {detail.shop_name}
                </h3>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {detail.discount_percent}% member discount
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close partner details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detail.description && (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {detail.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {detail.business_type && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                  {detail.business_type}
                </span>
              )}
              {detail.discount_scope && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 px-2 py-1 rounded-full">
                  {detail.discount_scope === "all" ? "All items" : detail.discount_scope}
                </span>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span>Show your Mi Advantage member card at the counter to claim it.</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
