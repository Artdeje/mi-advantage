import React from "react";
import { Shop } from "../types";

/* Compact service labels for the counter standee badge. */
export const SERVICE_LABELS: Record<string, string> = {
  retail: "FASHION SHOP",
  restaurant: "RESTO",
  cafe: "CAFE",
  hotel: "HOTEL",
  services: "SERVICES",
  other: "OTHER",
};

const GREEN = "#00e6a6";
const GOLD = "#e8b13a";

function svgEsc(s: string | number): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function qrUrlFor(value: string, size = 520): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&color=0a1a2b&margin=1&data=${encodeURIComponent(value)}`;
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "BP"
  );
}

/** Wraps a name into max-2 lines of <=16 chars for the standee headline. */
function splitName(name: string): string[] {
  const words = name.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 16 && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  return lines.slice(0, 2);
}

/**
 * Portrait counter standee for a partner shop, referencing the member card
 * artwork (dark navy body, neon border, light arcs) but wearing its own
 * emerald/green identity — clearly the same system, clearly not the card.
 *
 * Shows: company logo, company name, service badge, counter code, the
 * counter QR (staff sign-in deep link) and the SCAN TO SIGN IN headline.
 */
export function buildShopQrSvg(shop: Shop, qrValue: string, systemTitle: string): string {
  const name = (shop.shop_name || "Partner Shop").trim();
  const lines = splitName(name);
  const service = SERVICE_LABELS[shop.business_type || "other"] || (shop.business_type || "OTHER").toUpperCase();
  const logo = (shop.profile_picture || "").trim();
  const code = (shop.qr_code || shop.id || "").trim();
  const brand = (systemTitle || "BP DISCOUNT SYSTEM").toUpperCase().trim();

  const nameYs = lines.length === 2 ? [288, 338] : [314];

  const logoGroup = logo
    ? `<clipPath id="sq-logo-clip"><circle cx="320" cy="140" r="72"/></clipPath>
       <circle cx="320" cy="140" r="76" fill="#08131f"/>
       <circle cx="320" cy="140" r="76" fill="none" stroke="${GREEN}" stroke-width="3" opacity="0.9"/>
       <circle cx="320" cy="140" r="88" fill="none" stroke="${GREEN}" stroke-width="1.4" opacity="0.45"/>
       <image href="${svgEsc(logo)}" x="248" y="68" width="144" height="144" preserveAspectRatio="xMidYMid slice" clip-path="url(#sq-logo-clip)"/>`
    : `<circle cx="320" cy="140" r="76" fill="#08131f" stroke="${GREEN}" stroke-width="3" opacity="0.9"/>
       <circle cx="320" cy="140" r="88" fill="none" stroke="${GREEN}" stroke-width="1.4" opacity="0.45"/>
       <text x="320" y="164" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="56" fill="${GREEN}">${svgEsc(initials(name))}</text>`;

  const tl = Array.from({ length: 6 }, (_, i) => {
    return `<path d="M ${20 + i * 8} 0 C ${100 + i * 14} ${60 - i * 6}, ${180 + i * 18} ${
      110 - i * 8
    }, ${260 + i * 20} ${150 - i * 10}" stroke="url(#sq-arc)" stroke-width="1.3" fill="none" opacity="${
      0.55 - i * 0.07
    }"/>`;
  }).join("\n");
  const br = Array.from({ length: 7 }, (_, i) => {
    return `<path d="M ${626 + i * 2} ${800 - i * 10} C ${540 - i * 16} ${740 - i * 10}, ${
      480 - i * 18
    } ${700 - i * 8}, ${430 - i * 20} ${660 - i * 8}" stroke="url(#sq-arc-gold)" stroke-width="1.2" fill="none" opacity="${
      0.5 - i * 0.06
    }"/>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800" width="640" height="800">
<defs>
  <linearGradient id="sq-bg" x1="0%" y1="0%" x2="70%" y2="100%">
    <stop offset="0%" stop-color="#0c2437"/>
    <stop offset="55%" stop-color="#071a2c"/>
    <stop offset="100%" stop-color="#04101d"/>
  </linearGradient>
  <linearGradient id="sq-arc" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#064e3b" stop-opacity="0.90"/>
    <stop offset="60%" stop-color="${GREEN}" stop-opacity="0.75"/>
    <stop offset="100%" stop-color="#d2fff0" stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="sq-arc-gold" x1="0%" y1="100%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#7a5510" stop-opacity="0.25"/>
    <stop offset="60%" stop-color="${GOLD}" stop-opacity="0.65"/>
    <stop offset="100%" stop-color="#fff0c4" stop-opacity="0.95"/>
  </linearGradient>
  <linearGradient id="sq-title" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#34d399"/>
    <stop offset="100%" stop-color="#d8fff1"/>
  </linearGradient>
  <radialGradient id="sq-glow-green">
    <stop offset="0%" stop-color="#8effdd" stop-opacity="0.6"/>
    <stop offset="45%" stop-color="${GREEN}" stop-opacity="0.26"/>
    <stop offset="100%" stop-color="${GREEN}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="sq-glow-gold">
    <stop offset="0%" stop-color="#fff3d0" stop-opacity="0.75"/>
    <stop offset="45%" stop-color="${GOLD}" stop-opacity="0.3"/>
    <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
  </radialGradient>
  <filter id="sq-neon" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="10"/>
  </filter>
</defs>
<rect width="640" height="800" fill="url(#sq-bg)"/>
${tl}
${br}
<ellipse cx="510" cy="360" rx="150" ry="240" fill="url(#sq-glow-green)" opacity="0.4"/>
<ellipse cx="110" cy="640" rx="120" ry="140" fill="url(#sq-glow-gold)" opacity="0.35"/>
<rect x="8" y="8" width="624" height="784" rx="30" fill="none" stroke="${GREEN}" stroke-width="9" opacity="0.5" filter="url(#sq-neon)"/>
<rect x="5" y="5" width="630" height="790" rx="30" fill="none" stroke="${GREEN}" stroke-width="3"/>

<text x="320" y="54" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="18" letter-spacing="6" fill="#9fe8d4" opacity="0.95">${svgEsc(brand)}</text>

${logoGroup}

<g font-family="Arial Black, Arial, sans-serif" font-weight="900" text-anchor="middle">
${lines.map((l) => `<text x="320" y="${nameYs[lines.indexOf(l)]}" font-size="40" fill="#ffffff">${svgEsc(l)}</text>`).join("\n")}
</g>

<g>
  <rect x="200" y="382" width="240" height="46" rx="23" fill="rgba(0,230,166,0.10)" stroke="${GREEN}" stroke-width="1.6"/>
  <text x="320" y="413" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="21" letter-spacing="3" fill="${GREEN}">${svgEsc(service)}</text>
</g>

<text x="320" y="472" text-anchor="middle" font-family="Courier New, monospace" font-weight="700" font-size="17" letter-spacing="5" fill="${GOLD}">COUNTER ${svgEsc(code)}</text>

<g>
  <rect x="205" y="496" width="230" height="230" rx="18" fill="#ffffff"/>
  <rect x="197" y="488" width="246" height="246" rx="22" fill="none" stroke="${GREEN}" stroke-width="5" opacity="0.95"/>
  <rect x="189" y="480" width="262" height="262" rx="26" fill="none" stroke="${GREEN}" stroke-width="2" opacity="0.45"/>
  <image href="${svgEsc(qrUrlFor(qrValue, 520))}" x="215" y="506" width="210" height="210" preserveAspectRatio="xMidYMid meet"/>
</g>

<text x="320" y="768" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="33" letter-spacing="2" fill="url(#sq-title)">SCAN TO SIGN IN</text>
<text x="320" y="792" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="14" fill="#9fe8d4" opacity="0.9">Counter staff entrance — enter your password</text>
</svg>`;
}

/** Renders the counter standee as an inline SVG block. */
export default function ShopCounterQr({
  shop,
  qrValue,
  systemTitle,
  className = "",
}: {
  shop: Shop;
  qrValue: string;
  systemTitle: string;
  className?: string;
}) {
  const svg = React.useMemo(
    () => buildShopQrSvg(shop, qrValue, systemTitle),
    [shop, qrValue, systemTitle]
  );
  return (
    <div
      className={className}
      data-testid="shop-counter-standee"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Save the standee artwork as an .svg file. */
export function downloadShopQrSvg(shop: Shop, qrValue: string, systemTitle: string): void {
  const svg = buildShopQrSvg(shop, qrValue, systemTitle);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${shop.qr_code || shop.id || "shop"}-counter-standee.svg`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

/** Open a print window with the standee sized for a counter card. */
export function printShopQrSvg(shop: Shop, qrValue: string, systemTitle: string): void {
  const svg = buildShopQrSvg(shop, qrValue, systemTitle);
  const w = window.open("", "_blank", "width=520,height=680");
  if (!w) return;
  w.document.open();
  w.document.write(
    `<html><head><title>${shop.shop_name || "Shop"} Counter QR</title></head>` +
      `<body style="margin:0;display:flex;align-items:flex-start;justify-content:center;background:#fff">` +
      `<div style="width:340px">${svg.replace(
        /width="640" height="800"/,
        'width="340" height="425"'
      )}</div>` +
      `</body></html>`
  );
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* user can print manually */
    }
  }, 800);
}
