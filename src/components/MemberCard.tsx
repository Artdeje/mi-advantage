import React from "react";
import { Customer } from "../types";

/**
 * The Mi Advantage member card.
 *
 * Two faces, both driven by the same branding so they can be printed,
 * shown in the admin portal and on the member's own account page:
 *
 *   FRONT — brand wordmark, "THE <BRAND> DISCOUNT CARD", gold monogram.
 *   BACK  — "SCAN TO SAVE", the member QR code, card number and expiry.
 *
 * The QR encodes the member deep link, so it works on our own terminal
 * (reads the Card ID) and on an external phone camera (opens the link
 * and authenticates to the partner directory).
 */

export type CardFace = "front" | "back";

export const CARD_BG = "#080d18";
export const CARD_CYAN = "#00c8f0";
export const CARD_CYAN_LIGHT = "#6ee7ff";
export const CARD_GOLD = "#e8b13a";
export const CARD_GOLD_LIGHT = "#ffe0a0";
export const CARD_TEXT = "#ffffff";

/** Gold metallic gradient used for the monogram and the wordmark. */
export const GOLD_GRADIENT =
  "linear-gradient(135deg, #fff2cf 0%, #e8b13a 32%, #b07c1c 62%, #ffd98a 100%)";

/** Short monogram printed on the card — falls back to the brand initials. */
export function deriveCardBrand(title?: string, cardBrand?: string): string {
  const explicit = (cardBrand || "").trim();
  if (explicit) return explicit.toUpperCase();
  const words = (title || "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "MA";
  // "BP-Discount Card" -> "BP" (the first word is already an abbreviation)
  if (words[0].length >= 2 && words[0].length <= 4) return words[0].slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "CUST-001" -> "001" (the number printed next to the brand prefix). */
export function deriveCardNumber(qrCode?: string): string {
  const digits = (qrCode || "").replace(/\D/g, "");
  if (!digits) return "000";
  return digits.slice(-3).padStart(3, "0");
}

/** "2027-01-11" -> "11/01/2027" */
export function formatCardExpiry(validUntil?: string): string {
  if (!validUntil) return "NEVER";
  const d = new Date(validUntil);
  if (isNaN(d.getTime())) return "NEVER";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** The QR payload — a deep link that works on both scanner types. */
export function cardQrPayload(qrCode: string): string {
  const base = `${window.location.origin}/scan`;
  return `${base}?card=${encodeURIComponent(qrCode)}`;
}

export function cardQrImageUrl(qrCode: string, size = 480): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    cardQrPayload(qrCode),
  )}&margin=0`;
}

/* ------------------------------------------------------------------ */
/* Shared system logo fallback (matches the card monogram artwork)      */
/* ------------------------------------------------------------------ */

/**
 * The brand monogram used across the system UI when no logo file is
 * uploaded. It mirrors the gold monogram printed on the card face.
 */
export function BrandMonogram({
  brand,
  className = "",
}: {
  brand: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center font-black italic leading-none shrink-0 ${className}`}
      style={{
        background: GOLD_GRADIENT,
        color: "#1b1206",
        WebkitTextFillColor: "#1b1206",
        textShadow: "0 1px 0 rgba(255,255,255,0.35)",
      }}
    >
      {brand}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Static SVG exports (used by the "Download SVG Card" action)         */
/* ------------------------------------------------------------------ */

const SVG_DEFS = `
  <defs>
    <radialGradient id="cx-bg" cx="82%" cy="22%" r="130%">
      <stop offset="0%" stop-color="#0d2a45"/><stop offset="42%" stop-color="#0a1526"/><stop offset="100%" stop-color="#080d18"/>
    </radialGradient>
    <radialGradient id="cx-bg2" cx="78%" cy="12%" r="140%">
      <stop offset="0%" stop-color="#0c2c4a"/><stop offset="45%" stop-color="#0a1729"/><stop offset="100%" stop-color="#080d18"/>
    </radialGradient>
    <linearGradient id="cx-gold-line" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e8b13a" stop-opacity="0"/><stop offset="38%" stop-color="#e8b13a" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="#fff4d2" stop-opacity="1"/><stop offset="62%" stop-color="#e8b13a" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#e8b13a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="cx-gold-text" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff2cf"/><stop offset="32%" stop-color="#e8b13a"/>
      <stop offset="62%" stop-color="#b07c1c"/><stop offset="100%" stop-color="#ffd98a"/>
    </linearGradient>
    <linearGradient id="cx-scan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00c8f0"/><stop offset="100%" stop-color="#7ce8ff"/>
    </linearGradient>
    <linearGradient id="cx-arc-cyan" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0b3a5e" stop-opacity="0.15"/><stop offset="45%" stop-color="#00c8f0" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#9defff" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="cx-arc-gold" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7a5510" stop-opacity="0.2"/><stop offset="50%" stop-color="#e8b13a" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#fff0c4" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="cx-gold-glow">
      <stop offset="0%" stop-color="#fff3d0" stop-opacity="0.95"/><stop offset="35%" stop-color="#e8b13a" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#e8b13a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cx-cyan-glow">
      <stop offset="0%" stop-color="#bff3ff" stop-opacity="0.9"/><stop offset="40%" stop-color="#00c8f0" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#00c8f0" stop-opacity="0"/>
    </radialGradient>
    <filter id="cx-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="cx-neon" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>`;

const svgEsc = (s: string) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** FRONT face as a standalone SVG document. */
export function buildCardFrontSvg(opts: {
  brand: string;
  wordmark: string;
  logoUrl?: string;
  name: string;
  phone: string;
  number: string;
  expiry: string;
}): string {
  const mark = splitWordmark(opts.wordmark || "THE BEYOND");
  const arcs = Array.from({ length: 9 }, (_, i) => {
    const isGold = i === 3 || i === 4;
    return `<path d="M ${400 + i * 14} 580 C ${500 + i * 20} 430, ${660 + i * 16} 310, 1010 ${
      140 - i * 22
    }" stroke="${isGold ? "url(#cx-arc-gold)" : "url(#cx-arc-cyan)"}" stroke-width="${
      isGold ? 2.6 : 1.2
    }" fill="none" opacity="${isGold ? 1 : 0.55}"/>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 580" width="1000" height="580">
${SVG_DEFS}
  <rect width="1000" height="580" fill="url(#cx-bg)"/>
  <ellipse cx="800" cy="250" rx="220" ry="190" fill="url(#cx-cyan-glow)" opacity="0.35"/>
  ${arcs}
  <path d="M 470 580 C 570 425, 700 320, 1010 96" stroke="url(#cx-arc-gold)" stroke-width="7" fill="none" opacity="0.55" filter="url(#cx-soft)"/>
  <ellipse cx="742" cy="278" rx="70" ry="16" fill="url(#cx-gold-glow)" transform="rotate(-28 742 278)"/>
  <circle cx="985" cy="238" r="9" fill="url(#cx-cyan-glow)"/><circle cx="985" cy="238" r="2.6" fill="#9defff"/>
  <circle cx="848" cy="392" r="7" fill="url(#cx-cyan-glow)"/><circle cx="848" cy="392" r="2" fill="#9defff"/>
  <circle cx="905" cy="452" r="6" fill="url(#cx-cyan-glow)"/><circle cx="905" cy="452" r="1.7" fill="#9defff"/>

  <g font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900">
    <text x="48" y="82" font-size="36" letter-spacing="1.6" fill="#ffffff">${svgEsc(
      mark.plain,
    )}<tspan fill="#00c8f0">${svgEsc(mark.accent)}</tspan>${svgEsc(mark.rest)}</text>
  </g>
  <rect x="48" y="104" width="300" height="2" fill="url(#cx-gold-line)"/>
  <ellipse cx="198" cy="105" rx="46" ry="9" fill="url(#cx-gold-glow)"/>

  <g font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" fill="#00c8f0" letter-spacing="-1">
    <text x="48" y="184" font-size="58">THE ${svgEsc(opts.brand)}</text>
    <text x="48" y="246" font-size="58">DISCOUNT CARD</text>
  </g>

  ${
    opts.logoUrl
      ? `<image href="${svgEsc(opts.logoUrl)}" x="48" y="300" height="120" width="240" preserveAspectRatio="xMinYMid meet"/>`
      : `<text x="44" y="430" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-style="italic" font-size="140" letter-spacing="-10" fill="url(#cx-gold-text)">${svgEsc(
          opts.brand.slice(0, 2),
        )}</text>`
  }
  <text x="48" y="482" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-style="italic" font-size="26" letter-spacing="1.2" fill="#e8b13a">DISCOUNT CARD</text>
  <text x="952" y="482" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="16" fill="#7f8ea3">${svgEsc(
    opts.name.toUpperCase(),
  )}</text>
</svg>`;
}

/** BACK face as a standalone SVG document (with the QR code). */
export function buildCardBackSvg(opts: {
  brand: string;
  number: string;
  expiry: string;
  qrUrl: string;
}): string {
  const tr = Array.from({ length: 6 }, (_, i) => {
    return `<path d="M ${1000 - i * 4} 0 C ${930 - i * 18} ${60 + i * 6}, ${
      900 - i * 22
    } ${90 + i * 10}, ${860 - i * 26} ${120 + i * 14}" stroke="url(#cx-arc-cyan)" stroke-width="1.1" fill="none" opacity="${
      0.5 - i * 0.05
    }"/>`;
  }).join("\n");
  const bl = Array.from({ length: 7 }, (_, i) => {
    return `<path d="M 0 ${580 - i * 6} C ${70 + i * 20} ${540 - i * 12}, ${
      120 + i * 26
    } ${500 - i * 18}, ${170 + i * 30} ${455 - i * 22}" stroke="url(#cx-arc-gold)" stroke-width="1.2" fill="none" opacity="${
      0.7 - i * 0.07
    }"/>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 580" width="1000" height="580">
${SVG_DEFS}
  <rect width="1000" height="580" fill="url(#cx-bg2)"/>
  ${tr}
  ${bl}
  <ellipse cx="120" cy="500" rx="70" ry="24" fill="url(#cx-gold-glow)" opacity="0.55" transform="rotate(-32 120 500)"/>

  <rect x="8" y="8" width="984" height="564" rx="26" fill="none" stroke="#00c8f0" stroke-width="9" opacity="0.5" filter="url(#cx-neon)"/>
  <rect x="5" y="5" width="990" height="570" rx="26" fill="none" stroke="#00c8f0" stroke-width="3"/>

  <g font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" letter-spacing="-1">
    <text x="72" y="210" font-size="88" fill="url(#cx-scan)">SCAN</text>
    <text x="72" y="300" font-size="88" fill="#ffffff">TO SAVE</text>
  </g>
  <rect x="72" y="336" width="300" height="2" fill="url(#cx-gold-line)"/>
  <ellipse cx="222" cy="337" rx="46" ry="9" fill="url(#cx-gold-glow)"/>
  <text x="72" y="404" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="26" fill="#ffffff">Scan the QR code to check</text>
  <text x="72" y="440" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="26" fill="#ffffff">where the card can be used</text>

  <rect x="524" y="120" width="1.6" height="300" fill="url(#cx-gold-line)" opacity="0.75"/>
  <ellipse cx="525" cy="272" rx="12" ry="70" fill="url(#cx-gold-glow)" opacity="0.75"/>

  <rect x="586" y="92" width="330" height="330" rx="18" fill="#ffffff" stroke="#00c8f0" stroke-width="7"/>
  <rect x="596" y="102" width="310" height="310" rx="12" fill="none" stroke="#00c8f0" stroke-width="2" opacity="0.6"/>
  <image href="${svgEsc(opts.qrUrl)}" x="606" y="112" width="290" height="290" preserveAspectRatio="xMidYMid meet"/>

  <g font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900">
    <rect x="360" y="462" width="180" height="74" rx="10" fill="none" stroke="#e8b13a" stroke-width="2"/>
    <text x="376" y="488" font-size="19" fill="#00c8f0" letter-spacing="4">${svgEsc(opts.brand)}</text>
    <text x="376" y="520" font-size="31" fill="#ffffff" letter-spacing="2">${svgEsc(opts.number)}</text>
    <rect x="556" y="462" width="360" height="74" rx="10" fill="none" stroke="#e8b13a" stroke-width="2"/>
    <text x="572" y="488" font-size="19" fill="#e8b13a" letter-spacing="4">EXPIRES</text>
    <text x="572" y="520" font-size="31" fill="#ffffff" letter-spacing="2">${svgEsc(opts.expiry)}</text>
  </g>
  <rect x="546" y="458" width="2" height="82" fill="#e8b13a"/>
</svg>`;
}

/**
 * Splits the wordmark so the two leading letters of the second word can be
 * highlighted in cyan — "THE BEYOND" -> "THE **BE**YOND".
 */
export function splitWordmark(wordmark: string): { plain: string; accent: string; rest: string } {
  const parts = wordmark.trim().split(/\s+/);
  if (parts.length >= 2) {
    const second = parts[1];
    return {
      plain: parts[0] + " ",
      accent: second.slice(0, 2),
      rest: second.slice(2),
    };
  }
  return { plain: "", accent: wordmark.trim().slice(0, 2), rest: wordmark.trim().slice(2) };
}

/* ------------------------------------------------------------------ */
/* Decorative light-streak artwork (shared by both faces)               */
/* ------------------------------------------------------------------ */

function StreakDefs() {
  return (
    <defs>
      <linearGradient id="mc-gold-line" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#e8b13a" stopOpacity="0" />
        <stop offset="38%" stopColor="#e8b13a" stopOpacity="0.85" />
        <stop offset="50%" stopColor="#fff4d2" stopOpacity="1" />
        <stop offset="62%" stopColor="#e8b13a" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#e8b13a" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="mc-cyan-line" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#00c8f0" stopOpacity="0" />
        <stop offset="50%" stopColor="#9defff" stopOpacity="1" />
        <stop offset="100%" stopColor="#00c8f0" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="mc-gold-glow">
        <stop offset="0%" stopColor="#fff3d0" stopOpacity="0.95" />
        <stop offset="35%" stopColor="#e8b13a" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#e8b13a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="mc-cyan-glow">
        <stop offset="0%" stopColor="#bff3ff" stopOpacity="0.9" />
        <stop offset="40%" stopColor="#00c8f0" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#00c8f0" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="mc-arc-cyan" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0b3a5e" stopOpacity="0.15" />
        <stop offset="45%" stopColor="#00c8f0" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#9defff" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id="mc-arc-gold" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#7a5510" stopOpacity="0.2" />
        <stop offset="50%" stopColor="#e8b13a" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#fff0c4" stopOpacity="1" />
      </linearGradient>
    </defs>
  );
}

/** Horizontal gold "lens flare" line used under the wordmark / headline. */
function GoldStreak({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none ${className}`}
      viewBox="0 0 300 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <StreakDefs />
      <rect x="0" y="10.4" width="300" height="3.2" fill="url(#mc-gold-line)" />
      <ellipse cx="150" cy="12" rx="58" ry="11" fill="url(#mc-gold-glow)" />
      <ellipse cx="150" cy="12" rx="9" ry="6" fill="url(#mc-gold-glow)" />
      <ellipse cx="150" cy="12" rx="3" ry="2.4" fill="#fffdf5" />
    </svg>
  );
}

/** The sweeping cyan + gold arcs with glowing nodes on the card front. */
function FrontArcs() {
  const arcs = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 580"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <StreakDefs />
      <defs>
        <filter id="mc-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* soft cyan haze behind the arcs */}
      <ellipse cx="800" cy="250" rx="220" ry="190" fill="url(#mc-cyan-glow)" opacity="0.35" />

      {arcs.map((i) => {
        const isGold = i === 3 || i === 4;
        return (
          <path
            key={i}
            d={`M ${400 + i * 14} 580 C ${500 + i * 20} 430, ${660 + i * 16} 310, 1010 ${
              140 - i * 22
            }`}
            stroke={isGold ? "url(#mc-arc-gold)" : "url(#mc-arc-cyan)"}
            strokeWidth={isGold ? 2.6 : 1.2}
            fill="none"
            opacity={isGold ? 1 : 0.55}
          />
        );
      })}

      {/* bright gold flare riding the arcs */}
      <path
        d="M 470 580 C 570 425, 700 320, 1010 96"
        stroke="url(#mc-arc-gold)"
        strokeWidth="7"
        fill="none"
        opacity="0.55"
        filter="url(#mc-soft)"
      />
      <ellipse cx="742" cy="278" rx="70" ry="16" fill="url(#mc-gold-glow)" transform="rotate(-28 742 278)" />

      {/* glowing nodes */}
      <circle cx="985" cy="238" r="9" fill="url(#mc-cyan-glow)" />
      <circle cx="985" cy="238" r="2.6" fill="#9defff" />
      <circle cx="848" cy="392" r="7" fill="url(#mc-cyan-glow)" />
      <circle cx="848" cy="392" r="2" fill="#9defff" />
      <circle cx="905" cy="452" r="6" fill="url(#mc-cyan-glow)" />
      <circle cx="905" cy="452" r="1.7" fill="#9defff" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Card faces                                                          */
/* ------------------------------------------------------------------ */

export function MemberCard({
  customer,
  face = "front",
  brand,
  wordmark,
  cardLogoUrl,
  systemLogoUrl,
  className = "",
}: {
  customer: Customer;
  face?: CardFace;
  brand: string;
  wordmark?: string;
  cardLogoUrl?: string;
  systemLogoUrl?: string;
  className?: string;
}) {
  const number = deriveCardNumber(customer.qr_code);
  const expiry = formatCardExpiry(customer.valid_until);
  const qr = cardQrImageUrl(customer.qr_code, 480);
  const mark = splitWordmark(wordmark || "THE BEYOND");
  const monogram = brand.split("").slice(0, 2);

  /* ------------------------------- FRONT ------------------------------- */
  if (face === "front") {
    return (
      <div
        className={`relative w-full aspect-[1.72/1] overflow-hidden ${className}`}
        style={{
          background: `radial-gradient(130% 160% at 82% 22%, #0d2a45 0%, #0a1526 42%, ${CARD_BG} 100%)`,
          borderRadius: "18px",
          boxShadow:
            "0 22px 48px rgba(0,0,0,0.55), inset 0 0 80px rgba(0,110,180,0.10)",
        }}
      >
        <FrontArcs />

        <div className="relative h-full w-full" style={{ containerType: "inline-size" }}>
          <div className="absolute inset-0 flex flex-col" style={{ padding: "7% 5%" }}>
            {/* Wordmark */}
            <div className="flex items-center gap-2">
              {systemLogoUrl ? (
                <img
                  src={systemLogoUrl}
                  alt="Brand logo"
                  className="h-[4.6cqw] w-auto object-contain"
                />
              ) : null}
              <span
                className="font-extrabold tracking-[0.06em] leading-none whitespace-nowrap"
                style={{ fontSize: "3.55cqw", color: CARD_TEXT }}
              >
                {mark.plain}
                <span style={{ color: CARD_CYAN }}>{mark.accent}</span>
                {mark.rest}
              </span>
            </div>

            {/* Gold streak under the wordmark */}
            <GoldStreak className="mt-[2.2%] h-[3.4cqw] w-[30%]" />

            {/* THE <BRAND> / DISCOUNT CARD */}
            <div className="mt-[3.4%] leading-[0.9]">
              <p
                className="font-black tracking-[-0.02em] whitespace-nowrap"
                style={{ fontSize: "5.6cqw", color: CARD_CYAN }}
              >
                THE {brand}
              </p>
              <p
                className="font-black tracking-[-0.02em] whitespace-nowrap"
                style={{ fontSize: "5.6cqw", color: CARD_CYAN }}
              >
                DISCOUNT CARD
              </p>
            </div>

            {/* Gold monogram + caption */}
            <div className="mt-auto flex flex-col items-start">
              {cardLogoUrl ? (
                <img
                  src={cardLogoUrl}
                  alt="Card logo"
                  className="h-[10.5cqw] w-auto object-contain"
                  style={{ filter: "drop-shadow(0 4px 10px rgba(232,177,58,0.45))" }}
                />
              ) : (
                <div
                  className="flex items-start font-black italic leading-[0.72] tracking-[-0.1em]"
                  style={{
                    fontSize: "11.4cqw",
                    background: GOLD_GRADIENT,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 4px 10px rgba(232,177,58,0.40))",
                  }}
                >
                  {monogram.map((ch, i) => (
                    <span key={i} style={i > 0 ? { marginLeft: "-0.14em", position: "relative", zIndex: 10 } : undefined}>
                      {ch}
                    </span>
                  ))}
                </div>
              )}
              <p
                className="font-bold italic tracking-[0.05em] mt-[1.2%]"
                style={{ fontSize: "2.5cqw", color: CARD_GOLD }}
              >
                DISCOUNT CARD
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------- BACK -------------------------------- */
  return (
    <div
      className={`relative w-full aspect-[1.72/1] overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(140% 180% at 78% 12%, #0c2c4a 0%, #0a1729 45%, ${CARD_BG} 100%)`,
        borderRadius: "18px",
        border: "2.5px solid #00c8f0",
        boxShadow:
          "0 0 0 1px rgba(0,200,240,0.45), 0 0 26px rgba(0,200,240,0.45), 0 0 70px rgba(0,160,220,0.25), inset 0 0 60px rgba(0,110,180,0.14)",
      }}
    >
      {/* corner light arcs */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 580"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <StreakDefs />
        {Array.from({ length: 6 }, (_, i) => (
          <path
            key={`tr${i}`}
            d={`M ${1000 - i * 4} 0 C ${930 - i * 18} ${60 + i * 6}, ${900 - i * 22} ${
              90 + i * 10
            }, ${860 - i * 26} ${120 + i * 14}`}
            stroke="url(#mc-arc-cyan)"
            strokeWidth="1.1"
            fill="none"
            opacity={0.5 - i * 0.05}
          />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <path
            key={`bl${i}`}
            d={`M 0 ${580 - i * 6} C ${70 + i * 20} ${540 - i * 12}, ${120 + i * 26} ${
              500 - i * 18
            }, ${170 + i * 30} ${455 - i * 22}`}
            stroke="url(#mc-arc-gold)"
            strokeWidth={1.6}
            fill="none"
            opacity={0.95 - i * 0.1}
          />
        ))}
        <ellipse cx="120" cy="500" rx="78" ry="26" fill="url(#mc-gold-glow)" opacity="0.8" transform="rotate(-32 120 500)" />
        <ellipse cx="150" cy="470" rx="30" ry="10" fill="url(#mc-gold-glow)" opacity="0.9" transform="rotate(-32 150 470)" />
      </svg>

      <div className="relative h-full w-full" style={{ containerType: "inline-size" }}>
        <div className="absolute inset-0 flex" style={{ padding: "6.5% 6%" }}>
          {/* -------------------------- LEFT: headline -------------------------- */}
          <div className="flex flex-col justify-center" style={{ width: "50%" }}>
            <div className="leading-[0.86]">
              <p
                className="font-black tracking-[-0.01em] whitespace-nowrap"
                style={{
                  fontSize: "8.4cqw",
                  background: "linear-gradient(120deg, #00c8f0 0%, #7ce8ff 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                }}
              >
                SCAN
              </p>
              <p
                className="font-black tracking-[-0.01em] whitespace-nowrap"
                style={{ fontSize: "8.4cqw", color: CARD_TEXT }}
              >
                TO SAVE
              </p>
            </div>

            <GoldStreak className="mt-[4%] h-[2.6cqw] w-[58%]" />

            <p
              className="mt-[4%] font-medium leading-snug"
              style={{ fontSize: "2.45cqw", color: "rgba(255,255,255,0.92)" }}
            >
              Scan the QR code to check
              <br />
              where the card can be used
            </p>
          </div>

          {/* --------------------- RIGHT: QR in a glowing box --------------------- */}
          <div className="flex items-start justify-end" style={{ width: "50%" }}>
            <div
              className="rounded-[1.4cqw] p-[0.9cqw]"
              style={{
                background: "#ffffff",
                boxShadow:
                  "0 0 0 2px #00c8f0, 0 0 24px rgba(0,200,240,0.65), 0 0 60px rgba(0,160,220,0.4)",
              }}
            >
              <img
                src={qr}
                alt={`Member card QR ${customer.qr_code}`}
                className="block"
                style={{ width: "24cqw", height: "24cqw" }}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* vertical gold flare divider */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1000 580"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <StreakDefs />
          <rect x="524" y="120" width="1.6" height="300" fill="url(#mc-gold-line)" opacity="0.75" />
          <ellipse cx="525" cy="272" rx="12" ry="70" fill="url(#mc-gold-glow)" opacity="0.75" />
        </svg>

        {/* ------------------- BOTTOM: card number + expiry ------------------- */}
        <div
          className="absolute flex items-stretch"
          style={{ right: "5.5%", bottom: "7%", gap: "2.2%" }}
        >
          <div
            className="flex flex-col justify-center rounded-[0.8cqw] px-[2.2cqw] py-[0.8cqw]"
            style={{ border: "1.4px solid rgba(232,177,58,0.9)" }}
          >
            <span
              className="font-black uppercase"
              style={{
                fontSize: "1.55cqw",
                letterSpacing: "0.28em",
                color: CARD_CYAN,
                marginBottom: "0.55cqw",
              }}
            >
              {brand}
            </span>
            <span
              className="font-black tracking-[0.08em]"
              style={{ fontSize: "3.1cqw", color: CARD_TEXT, lineHeight: 1 }}
            >
              {number}
            </span>
          </div>

          <div style={{ width: "1.4px", background: "rgba(232,177,58,0.85)" }} />

          <div
            className="flex flex-col justify-center rounded-[0.8cqw] px-[2.2cqw] py-[0.8cqw]"
            style={{ border: "1.4px solid rgba(232,177,58,0.9)" }}
          >
            <span
              className="font-black uppercase"
              style={{
                fontSize: "1.55cqw",
                letterSpacing: "0.28em",
                color: CARD_GOLD,
                marginBottom: "0.55cqw",
              }}
            >
              EXPIRES
            </span>
            <span
              className="font-black tracking-[0.06em]"
              style={{ fontSize: "3.1cqw", color: CARD_TEXT, lineHeight: 1 }}
            >
              {expiry}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
