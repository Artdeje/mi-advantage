import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { db } from "../lib/supabase";
import { Customization } from "../types";
import {
  LogIn,
  BadgeCheck,
} from "./AdminIcons";
import ThemeToggle from "./ThemeToggle";
import { deriveCardBrand } from "./MemberCard";
import LandingBackground from "./LandingBackground";
import PartnerCarousel from "./PartnerCarousel";

export default function WelcomePage() {
  const [cust, setCust] = useState<Customization | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    db.getCustomization().then(setCust).catch(() => setCust(null));
  }, []);

  const title = cust?.title || "";
  const subtitle = cust?.subtitle || "";
  const logoUrl = cust?.logo_url || "";
  const h1 = cust?.home_h1 || "";
  const h2 = cust?.home_h2 || "";
  const p = cust?.home_p || "";
  const footerText = cust?.footer_text || "";
  const footerSubtext = cust?.footer_subtext || "";

  // Landing page background (image / gradient / none).
  //   "image"  → the uploaded artwork, or the built-in card-themed artwork
  //   "gradient" → the CSS gradient string
  //   "none"   → the default artwork is still shown so the page never
  //               renders as a blank screen
  const bgType = cust?.home_background_type || "image";
  const bgValue = cust?.home_background_value || "";
  const useUploadedImage = bgType === "image" && !!bgValue;
  const useDefaultArtwork = bgType === "image" ? !bgValue : bgType === "none";
  const useGradient = bgType === "gradient" && !!bgValue;

  const pageBackground = React.useMemo(() => {
    if (useUploadedImage) {
      return {
        backgroundImage: `url("${bgValue}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed" as const,
      };
    }
    if (useGradient) {
      return { backgroundImage: bgValue, backgroundSize: "cover", backgroundPosition: "center" };
    }
    return {};
  }, [useUploadedImage, useGradient, bgValue]);

  const showArtwork = useDefaultArtwork || useUploadedImage;

  useEffect(() => {
    const root = document.documentElement;
    return () => {
      root.style.backgroundImage = "";
      root.style.backgroundSize = "";
      root.style.backgroundPosition = "";
      root.style.backgroundRepeat = "";
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={pageBackground}
    >
      {/* Built-in card-themed artwork — nothing is layered on top of it */}
      {useDefaultArtwork && <LandingBackground />}

      {/* Uploaded artwork is applied via the wrapper's background-image */}

      {/* Scrim — keeps the hero copy readable without hiding the artwork */}
      {showArtwork && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-slate-950/70 via-slate-950/40 to-slate-950/70" />
      )}

      {/* NAV BAR */}
      <header className="relative z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2.5 min-w-0 shrink-0" onClick={() => setMenuOpen(false)}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0"
                style={{
                  background: "linear-gradient(135deg, #fff2cf 0%, #e8b13a 40%, #b07c1c 70%, #ffd98a 100%)",
                  color: "#1b1206",
                  fontStyle: "italic",
                }}
              >
                {deriveCardBrand(cust?.title, cust?.card_brand)}
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
              href="/login"
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
              <a href="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors">
                <LogIn className="w-4 h-4" />
                Sign In
              </a>
            </div>
          </nav>
        )}
      </header>

      {/* HERO — the background artwork stays fully visible, nothing is layered on top of it */}
      <main className="relative z-10 flex-1 flex items-center w-full px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-xl mx-auto lg:mx-0 lg:ml-[7%] text-center lg:text-left space-y-5">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-1 backdrop-blur"
            style={{
              background: "rgba(0,200,240,0.14)",
              color: "#9defff",
              boxShadow: "0 0 0 1px rgba(0,200,240,0.3)",
            }}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            Official Member Card Terminal
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {h1}
            <span
              className="block mt-1"
              style={{ color: "#00c8f0", textShadow: "0 0 26px rgba(0,200,240,0.45)" }}
            >
              {h2}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-lg mx-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
            {p}
          </p>
        </div>
      </main>

      <PartnerCarousel overArtwork={showArtwork} />

      {/* FOOTER */}
      <footer className="relative z-20 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">{footerText}</p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{footerSubtext}</span>
            <a href="/login" className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider hover:underline">
              Admin / Shop Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
