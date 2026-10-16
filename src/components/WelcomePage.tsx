import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { db } from "../lib/supabase";
import { Customization } from "../types";
import {
  Camera,
  Store,
  ShoppingBag,
  LogIn,
  UserPlus,
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
  const h1 = cust?.home_h1 || "Instant Merchant Discounts";
  const h2 = cust?.home_h2 || "QR Member Advantage System";
  const p =
    cust?.home_p ||
    "Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges.";
  const footerText = cust?.footer_text || "© 2026 Mi Advantage • Partner Merchant Terminals Kigali, Rwanda";
  const footerSubtext = cust?.footer_subtext || "Encrypted Connection • Kigali, Rwanda";

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
              href="#/join"
              className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Get a Card</span>
              <span className="sm:hidden">Join</span>
            </a>
            <a
              href="#/login"
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </a>
            <a
              href="#/register-shop"
              className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden md:inline">Register Shop</span>
              <span className="md:hidden">Shop</span>
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
              <a href="#/join" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors">
                <UserPlus className="w-4 h-4" />
                Get a Card
              </a>
              <a href="#/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors">
                <LogIn className="w-4 h-4" />
                Sign In
              </a>
              <a href="#/register-shop" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors">
                <UserPlus className="w-4 h-4" />
                Register Shop
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
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Partner Outlets</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Approved merchants across Kigali offer exclusive member discounts.</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Instant Savings</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Discounts are computed in real-time at the checkout terminal.</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"><ShoppingBag className="w-5 h-5" /></div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Member Cards</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Every member gets unique QR credentials.</p>
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
