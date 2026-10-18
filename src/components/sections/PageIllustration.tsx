import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import type { ReactNode } from "react";
import { Aircraft, Vehicle } from "./art";
import { InView } from "./InView";

/**
 * A picture for each page's subject. A photo saved as
 * public/images/pages/<name>.jpg is used when present; otherwise a drawn
 * scene in the site's navy palette, which rises in on load and has one small
 * moving part of its own. Server component: no client JS of its own.
 */
export type IllustrationName = "airport" | "fleet" | "meet" | "corporate" | "contact" | "faq" | "london" | "services";

const captions: Record<IllustrationName, string> = {
  airport: "A taxi waiting outside an airport terminal as a plane takes off",
  fleet: "A saloon, a people carrier and a minibus parked side by side",
  meet: "A driver holding a name board in the arrivals hall, greeting a passenger with a suitcase",
  corporate: "An executive car arriving at an office building in the city",
  contact: "A map of east London with a pin on our office",
  faq: "A taxi beneath speech bubbles with a question and an answer",
  london: "A taxi driving past London landmarks",
  services: "A taxi with suitcases ready for the airport",
};

/** Alt text for a photo, which may not show everything the drawing does. */
const photoAlts: Record<IllustrationName, string> = {
  airport: "An airport terminal",
  fleet: "Our vehicles",
  meet: "An airport arrivals hall",
  corporate: "A business traveller and an executive car",
  contact: "London",
  faq: "A taxi in London",
  london: "London",
  services: "Luggage ready for an airport transfer",
};

const photoPath = (name: IllustrationName) => `/images/pages/${name}.jpg`;

/** Checked at build time for static pages, so dropping a photo in needs a rebuild. */
const hasPhoto = (name: IllustrationName) => existsSync(path.join(process.cwd(), "public", photoPath(name)));

function Photo({ name }: { name: IllustrationName }) {
  return (
    <InView>
      <figure className="art-rise relative aspect-[10/7] overflow-hidden rounded-3xl bg-navy-900 shadow-card ring-1 ring-white/10">
        <Image
          src={photoPath(name)}
          alt={photoAlts[name]}
          fill
          sizes="(min-width: 1024px) 28rem, (min-width: 448px) 28rem, 100vw"
          className="art-zoom object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy-950/40 to-transparent" />
      </figure>
    </InView>
  );
}

const GROUND = 236;

function Frame({ name, children }: { name: IllustrationName; children: ReactNode }) {
  const sky = `art-sky-${name}`;
  return (
    <InView>
      <figure className="art-rise overflow-hidden rounded-3xl bg-navy-900 shadow-card ring-1 ring-white/10">
        <svg viewBox="0 0 400 280" role="img" aria-label={captions[name]} className="block h-auto w-full">
          <defs>
            <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1b3866" />
              <stop offset="1" stopColor="#0b1a33" />
            </linearGradient>
          </defs>
          <rect width="400" height="280" fill={`url(#${sky})`} />
          <circle cx="340" cy="46" r="16" fill="#e8eff9" opacity="0.18" />
          <circle cx="340" cy="46" r="9" fill="#e8eff9" opacity="0.5" />
          {children}
        </svg>
      </figure>
    </InView>
  );
}

function Ground() {
  return (
    <g>
      <rect y={GROUND} width="400" height={280 - GROUND} fill="#071226" />
      <path d={`M0 ${GROUND} H400`} stroke="#3f5f95" strokeWidth="1.5" />
      <path d="M0 262 H400" stroke="#6e95d4" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="16 12" />
    </g>
  );
}

/** Windows in a grid inside a building's rectangle. */
function Windows({ x, y, w, h, gap = 14 }: { x: number; y: number; w: number; h: number; gap?: number }) {
  const cells: ReactNode[] = [];
  for (let wy = y + 10; wy < y + h - 12; wy += gap) {
    for (let wx = x + 8; wx < x + w - 10; wx += gap) {
      cells.push(<rect key={`${wx}-${wy}`} x={wx} y={wy} width="6" height="7" rx="1" />);
    }
  }
  return <g fill="#8eaee2" opacity="0.55">{cells}</g>;
}

function Person({ x, suit = "#0b1a33", shirt = "#e8eff9" }: { x: number; suit?: string; shirt?: string }) {
  return (
    <g transform={`translate(${x} ${GROUND})`}>
      <rect x="-9" y="-34" width="7" height="34" rx="3" fill="#12264a" />
      <rect x="2" y="-34" width="7" height="34" rx="3" fill="#12264a" />
      <rect x="-13" y="-74" width="26" height="44" rx="10" fill={suit} />
      <path d="M-4 -74 L0 -60 L4 -74 Z" fill={shirt} />
      <circle cy="-86" r="11" fill="#d9b48f" />
      <path d="M-11 -88 Q-10 -100 0 -99 Q11 -99 11 -88 Q6 -94 -11 -88 Z" fill="#2a2018" />
    </g>
  );
}

function Suitcase({ x, h = 34, color = "#6e95d4" }: { x: number; h?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${GROUND})`}>
      <path d={`M6 ${-h} V${-h - 10} H18 V${-h}`} fill="none" stroke="#c9d8f0" strokeWidth="2.5" />
      <rect y={-h} width="24" height={h - 3} rx="4" fill={color} />
      <path d={`M7 ${-h + 4} V-7 M17 ${-h + 4} V-7`} stroke="#0b1a33" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx="5" cy="-2" r="2.5" fill="#071226" />
      <circle cx="19" cy="-2" r="2.5" fill="#071226" />
    </g>
  );
}

function Airport() {
  return (
    <>
      <g className="art-loop art-plane-sm-takeoff">
        <Aircraft />
      </g>
      {/* Control tower and terminal. */}
      <rect x="112" y="112" width="14" height={GROUND - 112} fill="#12264a" />
      <path d="M100 112 L138 112 L132 94 L106 94 Z" fill="#24467e" />
      <rect x="106" y="98" width="26" height="8" fill="#8eaee2" opacity="0.7" />
      <path d="M144 150 L392 150 L400 140 L136 140 Z" fill="#3f5f95" />
      <rect x="150" y="150" width="236" height={GROUND - 150} fill="#1b3866" />
      <g stroke="#3f5f95" strokeWidth="1.5">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${164 + i * 19} 166 V${GROUND}`} />
        ))}
      </g>
      <rect x="150" y="150" width="236" height="16" fill="#24467e" />
      <text x="268" y="162" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="3" fill="#e8eff9">
        TERMINAL
      </text>
      <Ground />
      <g transform={`translate(26 ${GROUND + 12}) scale(0.8)`}>
        <g className="art-drive-in">
          <Vehicle taxi />
        </g>
      </g>
    </>
  );
}

function Fleet() {
  return (
    <>
      <g fill="#12264a">
        <rect x="10" y="120" width="56" height="116" />
        <rect x="74" y="88" width="44" height="148" />
        <rect x="128" y="138" width="70" height="98" />
        <rect x="206" y="104" width="50" height="132" />
        <rect x="266" y="146" width="62" height="90" />
        <rect x="336" y="96" width="54" height="140" />
      </g>
      <Windows x={74} y={88} w={44} h={148} gap={18} />
      <Windows x={206} y={104} w={50} h={132} gap={18} />
      <Windows x={336} y={96} w={54} h={140} gap={18} />
      <Ground />
      <g transform={`translate(12 ${GROUND + 10}) scale(0.62)`}>
        <g className="art-drive-in">
          <Vehicle taxi />
        </g>
      </g>
      <g transform={`translate(126 ${GROUND + 10}) scale(0.62)`}>
        <g className="art-drive-in-late">
          <Vehicle shape="mpv" />
        </g>
      </g>
      <g transform={`translate(250 ${GROUND + 10}) scale(0.62)`}>
        <g className="art-drive-in-later">
          <Vehicle shape="minibus" />
        </g>
      </g>
      <g fontSize="11" fontWeight="600" fill="#c9d8f0" textAnchor="middle">
        <text x="62" y="272">Saloon</text>
        <text x="178" y="272">People carrier</text>
        <text x="309" y="272">Minibus</text>
      </g>
    </>
  );
}

function MeetAndGreet() {
  return (
    <>
      {/* Arrivals hall: back wall, a window on the runway and the arrivals board. */}
      <rect x="0" y="70" width="400" height={GROUND - 70} fill="#12264a" />
      <rect x="196" y="92" width="188" height="88" rx="6" fill="#0b1a33" />
      <g clipPath="url(#art-meet-window)">
        <g className="art-loop art-plane-sm-landing">
          <Aircraft />
        </g>
      </g>
      <defs>
        <clipPath id="art-meet-window">
          <rect x="196" y="92" width="188" height="88" rx="6" />
        </clipPath>
      </defs>
      <rect x="20" y="22" width="150" height="34" rx="6" fill="#24467e" />
      <text x="95" y="44" textAnchor="middle" fontSize="13" fontWeight="800" letterSpacing="3" fill="#e8eff9">
        ARRIVALS
      </text>
      <rect y={GROUND} width="400" height={280 - GROUND} fill="#0b1a33" />
      <path d={`M0 ${GROUND} H400`} stroke="#3f5f95" strokeWidth="1.5" />
      {/* Driver with a name board, and an arriving passenger. */}
      <Person x={92} />
      <g className="art-bob">
        <path d="M80 160 L72 128 M104 160 L112 128" stroke="#0b1a33" strokeWidth="6" strokeLinecap="round" />
        <rect x="52" y="104" width="80" height="30" rx="4" fill="#f5f7fb" />
        <text x="92" y="124" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="1" fill="#0b1a33">
          WELCOME
        </text>
      </g>
      <Person x={262} suit="#3f5f95" />
      <path d="M272 186 L290 204" stroke="#3f5f95" strokeWidth="6" strokeLinecap="round" />
      <Suitcase x={284} h={40} />
    </>
  );
}

function Corporate() {
  return (
    <>
      <rect x="32" y="60" width="78" height={GROUND - 60} fill="#12264a" />
      <Windows x={32} y={60} w={78} h={GROUND - 60} />
      <rect x="124" y="96" width="96" height={GROUND - 96} fill="#1b3866" />
      <Windows x={124} y={96} w={96} h={GROUND - 96} />
      <path d="M238 236 V40 L292 20 L292 236 Z" fill="#12264a" />
      <rect x="300" y="120" width="74" height={GROUND - 120} fill="#1b3866" />
      <Windows x={300} y={120} w={74} h={GROUND - 120} />
      <Ground />
      <g transform={`translate(100 ${GROUND + 14}) scale(0.9)`}>
        <g className="art-drive-in">
          <Vehicle body="#c9d8f0" glass="#0b1a33" trim="#24467e" />
        </g>
      </g>
    </>
  );
}

function Contact() {
  return (
    <>
      {/* A simple map card: streets, the river and a pin on the office. */}
      <rect x="24" y="24" width="352" height="232" rx="16" fill="#e8eff9" />
      <path d="M24 196 C 110 170 170 236 260 206 S 360 186 376 196 V 240 Q 376 256 360 256 H 40 Q 24 256 24 240 Z" fill="#8eaee2" opacity="0.7" />
      <g stroke="#ffffff" strokeWidth="9" strokeLinecap="round">
        <path d="M24 92 H376" />
        <path d="M150 24 V196" />
        <path d="M60 24 L300 196" />
        <path d="M24 150 H376" />
      </g>
      <g stroke="#c9d8f0" strokeWidth="4" strokeLinecap="round">
        <path d="M250 24 V150" />
        <path d="M330 24 V150" />
        <path d="M24 56 H150" />
      </g>
      <g className="art-bob">
        <path d="M200 132 C 182 108 180 98 180 90 A 20 20 0 0 1 220 90 C 220 98 218 108 200 132 Z" fill="#24467e" />
        <circle cx="200" cy="90" r="8" fill="#e8eff9" />
      </g>
      <ellipse cx="200" cy="134" rx="10" ry="3" fill="#0b1a33" opacity="0.3" />
      <rect x="154" y="140" width="92" height="22" rx="11" fill="#0b1a33" />
      <text x="200" y="155" textAnchor="middle" fontSize="11" fontWeight="700" fill="#e8eff9">
        London E1
      </text>
    </>
  );
}

function Faq() {
  return (
    <>
      <g className="art-bob">
        <path d="M46 40 H190 Q206 40 206 56 V112 Q206 128 190 128 H96 L74 148 L78 128 H46 Q30 128 30 112 V56 Q30 40 46 40 Z" fill="#e8eff9" />
        <text x="118" y="104" textAnchor="middle" fontSize="54" fontWeight="800" fill="#24467e">?</text>
      </g>
      <path d="M226 70 H354 Q370 70 370 86 V136 Q370 152 354 152 H330 L334 170 L310 152 H226 Q210 152 210 136 V86 Q210 70 226 70 Z" fill="#6e95d4" />
      <path d="M268 112 L284 128 L314 96" fill="none" stroke="#0b1a33" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <Ground />
      <g transform={`translate(120 ${GROUND + 14}) scale(0.9)`}>
        <g className="art-drive-in">
          <Vehicle taxi />
        </g>
      </g>
    </>
  );
}

function London() {
  return (
    <>
      {/* The Shard, the London Eye (slowly turning) and the Elizabeth Tower. */}
      <path d="M300 236 L326 40 L352 236 Z" fill="#12264a" />
      <g transform="translate(196 150)">
        <g className="art-spin">
          <circle r="62" fill="none" stroke="#3f5f95" strokeWidth="3" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <g key={i}>
                <path d={`M0 0 L${(62 * Math.cos(a)).toFixed(1)} ${(62 * Math.sin(a)).toFixed(1)}`} stroke="#24467e" strokeWidth="1.5" />
                <circle cx={(62 * Math.cos(a)).toFixed(1)} cy={(62 * Math.sin(a)).toFixed(1)} r="4" fill="#8eaee2" />
              </g>
            );
          })}
        </g>
        <path d="M-30 86 L0 0 L30 86" fill="none" stroke="#3f5f95" strokeWidth="4" />
      </g>
      <rect x="60" y="88" width="34" height={GROUND - 88} fill="#1b3866" />
      <path d="M56 88 L77 40 L98 88 Z" fill="#24467e" />
      <circle cx="77" cy="108" r="11" fill="#e8eff9" opacity="0.85" />
      <path d="M77 108 V101 M77 108 L82 110" stroke="#0b1a33" strokeWidth="2" strokeLinecap="round" />
      <Windows x={60} y={124} w={34} h={GROUND - 124} gap={16} />
      <Ground />
      <g transform={`translate(150 ${GROUND + 14}) scale(0.9)`}>
        <g className="art-drive-in">
          <Vehicle taxi />
        </g>
      </g>
    </>
  );
}

function Services() {
  return (
    <>
      <g className="art-loop art-plane-sm-takeoff">
        <Aircraft />
      </g>
      <path d="M0 196 L80 176 L150 192 L240 168 L320 190 L400 176 V236 H0 Z" fill="#12264a" />
      <Ground />
      <g transform={`translate(36 ${GROUND + 14}) scale(0.95)`}>
        <g className="art-drive-in">
          <Vehicle shape="estate" taxi />
        </g>
      </g>
      <Suitcase x={252} h={46} />
      <Suitcase x={282} h={36} color="#8eaee2" />
      <Suitcase x={312} h={28} color="#3f5f95" />
    </>
  );
}

const scenes: Record<IllustrationName, () => ReactNode> = {
  airport: Airport,
  fleet: Fleet,
  meet: MeetAndGreet,
  corporate: Corporate,
  contact: Contact,
  faq: Faq,
  london: London,
  services: Services,
};

export function PageIllustration({ name }: { name: IllustrationName }) {
  if (hasPhoto(name)) return <Photo name={name} />;
  const Scene = scenes[name];
  return (
    <Frame name={name}>
      <Scene />
    </Frame>
  );
}
