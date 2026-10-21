import React from "react";

/**
 * Default landing page artwork.
 *
 * Used when the admin selects the "image" background type but has not
 * uploaded a file yet. It mirrors the member card artwork (dark navy,
 * cyan light arcs, gold flare) so the home page and the card look like
 * one product.
 */
export default function LandingBackground({ className = "" }: { className?: string }) {
  const arcs = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="lb-bg" cx="72%" cy="18%" r="95%">
            <stop offset="0%" stopColor="#102a46" />
            <stop offset="45%" stopColor="#0a1526" />
            <stop offset="100%" stopColor="#050a16" />
          </radialGradient>
          <linearGradient id="lb-arc-cyan" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0b3a5e" stopOpacity="0.10" />
            <stop offset="45%" stopColor="#00c8f0" stopOpacity="0.40" />
            <stop offset="100%" stopColor="#9defff" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="lb-arc-gold" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7a5510" stopOpacity="0.15" />
            <stop offset="55%" stopColor="#e8b13a" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#fff0c4" stopOpacity="1" />
          </linearGradient>
          <radialGradient id="lb-gold-glow">
            <stop offset="0%" stopColor="#fff3d0" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#e8b13a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#e8b13a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lb-cyan-glow">
            <stop offset="0%" stopColor="#bff3ff" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#00c8f0" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00c8f0" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lb-card" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d2237" />
            <stop offset="100%" stopColor="#081120" />
          </linearGradient>
          <filter id="lb-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <rect width="1920" height="1080" fill="url(#lb-bg)" />

        {/* sweeping light arcs */}
        {arcs.map((i) => {
          const isGold = i === 6 || i === 7;
          return (
            <path
              key={i}
              d={`M ${-40 + i * 30} 1120 C ${420 + i * 34} 760, ${980 + i * 26} 470, ${
                1990 - i * 18
              } ${-40 + i * 30}`}
              stroke={isGold ? "url(#lb-arc-gold)" : "url(#lb-arc-cyan)"}
              strokeWidth={isGold ? 3 : 1.4}
              fill="none"
              opacity={isGold ? 0.9 : 0.32}
            />
          );
        })}
        <ellipse cx="1250" cy="430" rx="300" ry="120" fill="url(#lb-gold-glow)" transform="rotate(-24 1250 430)" />
        <ellipse cx="1560" cy="250" rx="280" ry="220" fill="url(#lb-cyan-glow)" opacity="0.5" />

        {/* glowing nodes */}
        <circle cx="1740" cy="300" r="13" fill="url(#lb-cyan-glow)" />
        <circle cx="1740" cy="300" r="4" fill="#9defff" />
        <circle cx="1600" cy="560" r="10" fill="url(#lb-cyan-glow)" />
        <circle cx="1600" cy="560" r="3" fill="#9defff" />
        <circle cx="1700" cy="660" r="8" fill="url(#lb-cyan-glow)" />
        <circle cx="1700" cy="660" r="2.4" fill="#9defff" />

        {/* member card mock-up */}
        <g transform="translate(1150 290) rotate(-11) scale(0.86)">
          <rect
            x="-12"
            y="-12"
            width="644"
            height="404"
            rx="40"
            fill="none"
            stroke="#00c8f0"
            strokeWidth="6"
            opacity="0.35"
            filter="url(#lb-blur)"
          />
          <rect width="620" height="380" rx="32" fill="url(#lb-card)" stroke="#00c8f0" strokeWidth="2" opacity="0.92" />
          <text x="44" y="76" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="30" fill="#ffffff" letterSpacing="1.5">
            THE <tspan fill="#00c8f0">BE</tspan>YOND
          </text>
          <rect x="44" y="94" width="150" height="2" fill="#e8b13a" opacity="0.85" />
          <text x="44" y="160" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="36" fill="#00c8f0" letterSpacing="2">
            THE BP
          </text>
          <text x="44" y="204" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="36" fill="#00c8f0" letterSpacing="2">
            DISCOUNT CARD
          </text>
          <text x="40" y="316" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="78" fill="#e8b13a">
            BP
          </text>
          {/* sweeping arc + glow nodes (front-face artwork) */}
          <path d="M 470 330 C 560 250, 590 170, 560 60" stroke="url(#lb-arc-cyan)" strokeWidth="2.4" fill="none" opacity="0.75" />
          <circle cx="560" cy="60" r="9" fill="url(#lb-cyan-glow)" />
          <circle cx="560" cy="60" r="3" fill="#9defff" />
          <ellipse cx="360" cy="90" rx="130" ry="46" fill="url(#lb-cyan-glow)" opacity="0.35" />
        </g>

        {/* subtle grid */}
        <g opacity="0.07" fill="#ffffff">
          {Array.from({ length: 26 }, (_, r) =>
            Array.from({ length: 48 }, (_, c) => (
              <circle key={`${r}-${c}`} cx={c * 40 + 20} cy={r * 40 + 20} r="1.4" />
            )),
          )}
        </g>
      </svg>
    </div>
  );
}
