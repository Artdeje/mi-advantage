import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { db } from "../lib/supabase";
import { Customization } from "../types";
import {
  Camera,
  Store,
  ShoppingBag,
  LogIn,
  TrendingUp,
  BadgeCheck,
} from "./AdminIcons";
import ThemeToggle from "./ThemeToggle";

export default function WelcomePage() {
  const [cust, setCust] = useState<Customization | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    db.getCustomization().then(setCust).catch(() => setCust(null));
  }, []);

  const title = cust?.title || "Mi Advantage QR Card Scan & Shop";
  const subtitle = cust?.subtitle || "Kigali Premium Privilege";
  const logoUrl = cust?.logo_url || "";
  const h1 = cust?.home_h1 || "";
  const h2 = cust?.home_h2 || "";
  const p = cust?.home_p || "";
  const footerText = cust?.footer_text || "";
  const footerSubtext = cust?.footer_subtext || "";
  const f1Title = cust?.feature1_title || "";
  const f1Desc = cust?.feature1_desc || "";
  const f2Title = cust?.feature2_title || "";
  const f2Desc = cust?.feature2_desc || "";
  const f3Title = cust?.feature3_title || "";
  const f3Desc = cust?.feature3_desc || "";

  // Default embedded background: person scanning a member card (SVG data URI)
  // Used when admin selects image background but hasn't uploaded a custom image.
  const DEFAULT_BG_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080' viewBox='0 0 1920 1080'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:%23059669;stop-opacity:1'/><stop offset='100%' style='stop-color:%230d9488;stop-opacity:1'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/><circle cx='960' cy='420' r='110' fill='%23ffffff' opacity='0.12'/><path d='M850 420 L960 300 L1070 420 Z' fill='%23ffffff' opacity='0.18'/><rect x='700' y='500' width='520' height='120' rx='24' fill='%23ffffff' opacity='0.15'/><text x='960' y='545' font-family='Arial, sans-serif' font-size='52' fill='%23ffffff' text-anchor='middle' font-weight='bold'>Mi Advantage</text><text x='960' y='600' font-family='Arial, sans-serif' font-size='20' fill='%23ffffff' opacity='0.85' text-anchor='middle'>Member Card Scanning Terminal</text></svg>";

  // Apply landing page background (image / gradient / none) via inline style
  const bgType = cust?.home_background_type || "image";
  const bgValue = cust?.home_background_value || "";
  const effectiveBgValue = bgType === "image" && !bgValue ? DEFAULT_BG_SVG : bgValue;

  useEffect(() => {
    const root = document.documentElement;
    if (bgType === "image" && effectiveBgValue) {
      root.style.backgroundImage = `url("${effectiveBgValue}")`;
      root.style.backgroundSize = "cover";
      root.style.backgroundPosition = "center";
      root.style.backgroundRepeat = "no-repeat";
      // Remove default gradient classes' effect by overriding
      root.style.backgroundColor = "";
    } else if (bgType === "gradient" && bgValue) {
      root.style.backgroundImage = bgValue;
      root.style.backgroundSize = "cover";
    } else {
      root.style.backgroundImage = "";
    }
  }, [bgType, effectiveBgValue, bgValue]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 dark:from-slate-950 via-emerald-50/40 dark:via-emerald-950/20 to-teal-50/40 dark:to-teal-950/20 flex flex-col">
      {/* NAV BAR */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <a href="#/" className="flex items-center gap-2.5 min-w-0 shrink-0" onClick={() => setMenuOpen(false)}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                MA
              </div>
            )}
            <div className="min-w-0">
              <span className="font-black text-slate-800 dark:text-slate-100 text-sm truncate block">{title.slice(0, 22)}</span>
              <span className="text-[9px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold block hidden min-[400px]:block">
                {subtitle}
              </span>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <a
              href="#/scan"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Card Scan</span>
              <span className="sm:hidden">Scan</span>
            </a>
            <a
              href="#/login"
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </a>
          </nav>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="px-4 py-3 flex flex-col gap-1.5">
              <a href="#/scan" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors">
                <Camera className="w-4 h-4" />
                Card Scan
              </a>
              <a href="#/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors">
                <LogIn className="w-4 h-4" />
                Sign In
              </a>
            </div>
          </nav>
        )}
      </header>

      {/* HERO */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded-full text-[10px] font-black uppercase tracking-widest">
            <BadgeCheck className="w-3.5 h-3.5" />
            Official Member Card Terminal
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 leading-tight">
            {h1}
            <span className="block text-emerald-600 dark:text-emerald-400 mt-1">{h2}</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto">{p}</p>
        </div>

        {/* FEATURE STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400"><Store className="w-5 h-5" /></div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{f1Title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{f1Desc}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{f2Title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{f2Desc}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"><ShoppingBag className="w-5 h-5" /></div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{f3Title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{f3Desc}</p>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">{footerText}</p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{footerSubtext}</span>
            <a href="#/login" className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider hover:underline">
              Admin / Shop Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
