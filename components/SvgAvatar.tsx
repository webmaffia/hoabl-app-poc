// The fallback avatar: an illustrated advisor drawn in the same frame and
// position as the live video, so a dropped stream reads as a bad connection
// rather than a broken app. The mouth animates while speech is playing.

import { Contours } from "@/components/Contours";

export function SvgAvatar({ speaking, compact = false }: { speaking: boolean; compact?: boolean }) {
  return (
    <div className={`relative h-full w-full overflow-hidden bg-site text-site-ink ${speaking ? "speaking" : ""}`}>
      <Contours className="absolute inset-0 h-full w-full" opacity={0.22} />
      <svg viewBox="0 0 300 360" className="absolute inset-x-0 bottom-0 mx-auto h-[92%]" role="img" aria-label="Land Advisor">
        <g className="svg-body">
          {/* shoulders and blazer */}
          <path d="M40 360 C44 290 92 262 150 262 C208 262 256 290 260 360 Z" fill="#3a1c6b" />
          <path d="M150 262 L126 300 L150 360 L174 300 Z" fill="#E6EDE9" />
          <path d="M150 272 L140 292 L150 330 L160 292 Z" fill="#A8761A" />
          <path d="M112 270 L150 262 L130 318 Z M188 270 L150 262 L170 318 Z" fill="#261247" />
          {/* neck */}
          <path d="M132 214 L132 262 C140 272 160 272 168 262 L168 214 Z" fill="#A5704D" />
          {/* head */}
          <ellipse cx="150" cy="170" rx="56" ry="66" fill="#B57C56" />
          <ellipse cx="94" cy="176" rx="9" ry="14" fill="#A5704D" />
          <ellipse cx="206" cy="176" rx="9" ry="14" fill="#A5704D" />
          {/* hair */}
          <path d="M92 164 C88 110 118 92 152 92 C190 92 214 116 208 166 C200 138 184 126 152 124 C124 124 104 134 92 164 Z" fill="#1F1A17" />
          {/* brows */}
          <path d="M118 150 Q130 143 142 149" stroke="#1F1A17" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M158 149 Q170 143 182 150" stroke="#1F1A17" strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* eyes */}
          <ellipse className="svg-eye" cx="130" cy="166" rx="6" ry="7" fill="#1F1A17" />
          <ellipse className="svg-eye" cx="170" cy="166" rx="6" ry="7" fill="#1F1A17" />
          {/* nose */}
          <path d="M150 170 Q146 190 142 196 Q150 200 157 196" stroke="#8E5C3E" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* mouth */}
          <path d="M132 211 Q150 219 168 211" stroke="#6E3B2A" strokeWidth="3" fill="none" strokeLinecap="round" opacity={speaking ? 0 : 1} />
          <ellipse className="svg-mouth" cx="150" cy="213" rx="14" ry="8" fill="#6E3B2A" opacity={speaking ? 1 : 0} />
        </g>
      </svg>
      {!compact && (
        <div className="absolute bottom-3 left-3 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium tracking-wide text-site-ink/90 backdrop-blur">
          Lightweight avatar
        </div>
      )}
    </div>
  );
}
