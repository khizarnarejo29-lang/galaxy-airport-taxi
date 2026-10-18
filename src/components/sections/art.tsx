/**
 * Shared SVG pieces for the hero road and the page illustrations: vehicles
 * drawn side-on facing right, and an aircraft. Each piece is drawn around its
 * own origin so callers place it with a transform (mirror with scale(-1 1) to
 * face left). Wheels sit on y = 0. Decorative only.
 */

export type VehicleShape = "saloon" | "estate" | "mpv" | "minibus";

interface ShapeSpec {
  length: number;
  /** Outline from the rear bumper over the roof to the front sill; the sills and arches are added. */
  top: string;
  glass: string[];
  wheels: [number, number];
  /** Door shut lines, as x positions from the window line down to the sill. */
  doors: number[];
  /** Top of the door shut lines (just under the windows). */
  beltY: number;
  mirror: [number, number];
  /** Roof height and the middle of the roof, for the taxi roof sign. */
  roofY: number;
  roofX: number;
}

const shapes: Record<VehicleShape, ShapeSpec> = {
  saloon: {
    length: 160,
    top: "M4 -14 C4 -24 7 -30 16 -31 L30 -33 C40 -47 50 -55 64 -56 L90 -56 C102 -55 112 -48 122 -38 L150 -33 C158 -31 160 -26 160 -20 L160 -12 C160 -9 158 -8 155 -8",
    glass: ["M36 -35 C44 -46 52 -51 64 -52 L75 -52 L75 -35 Z", "M79 -52 L90 -52 C100 -51 108 -45 116 -36 L79 -36 Z"],
    wheels: [34, 126],
    doors: [40, 77, 118],
    beltY: -34,
    mirror: [116, -37],
    roofY: -56,
    roofX: 77,
  },
  estate: {
    length: 162,
    top: "M4 -14 C4 -26 6 -34 12 -36 L16 -52 C18 -56 22 -57 28 -57 L96 -57 C108 -56 118 -48 128 -38 L152 -34 C160 -32 162 -26 162 -20 L162 -12 C162 -9 160 -8 157 -8",
    glass: ["M20 -38 L23 -52 L50 -52 L50 -38 Z", "M54 -52 L82 -52 L82 -38 L54 -38 Z", "M86 -52 L96 -52 C105 -51 113 -45 121 -38 L86 -38 Z"],
    wheels: [36, 128],
    doors: [52, 84, 122],
    beltY: -36,
    mirror: [120, -39],
    roofY: -57,
    roofX: 62,
  },
  mpv: {
    length: 170,
    top: "M4 -14 C4 -34 6 -52 14 -60 C18 -64 24 -66 34 -66 L118 -66 C128 -65 136 -58 146 -44 L160 -38 C168 -35 170 -28 170 -20 L170 -12 C170 -9 168 -8 165 -8",
    glass: ["M14 -44 C15 -54 18 -60 26 -61 L52 -61 L52 -44 Z", "M56 -61 L86 -61 L86 -44 L56 -44 Z", "M90 -61 L116 -61 C125 -60 132 -54 139 -44 L90 -44 Z"],
    wheels: [38, 136],
    doors: [54, 88, 142],
    beltY: -42,
    mirror: [140, -44],
    roofY: -66,
    roofX: 76,
  },
  minibus: {
    length: 196,
    top: "M4 -14 L4 -66 C4 -72 8 -76 16 -76 L156 -76 C166 -76 172 -70 178 -56 L186 -40 C194 -37 196 -30 196 -20 L196 -12 C196 -9 194 -8 191 -8",
    glass: ["M14 -68 L46 -68 L46 -48 L14 -48 Z", "M52 -68 L84 -68 L84 -48 L52 -48 Z", "M90 -68 L122 -68 L122 -48 L90 -48 Z", "M128 -68 L156 -68 C164 -68 168 -63 172 -48 L128 -48 Z"],
    wheels: [40, 160],
    doors: [88, 126, 176],
    beltY: -46,
    mirror: [176, -50],
    roofY: -76,
    roofX: 86,
  },
};

/** The body outline: the roof line, then sills with a round arch over each wheel. */
function bodyPath(s: ShapeSpec) {
  const [rear, front] = s.wheels;
  const arch = (cx: number) => `L${cx + 15} -8 A15 15 0 0 0 ${cx - 15} -8`;
  return `${s.top} ${arch(front)} ${arch(rear)} L8 -8 C5 -8 4 -10 4 -14 Z`;
}

export const vehicleLength = (shape: VehicleShape) => shapes[shape].length;

interface VehicleProps {
  shape?: VehicleShape;
  body?: string;
  glass?: string;
  /** Accent for the taxi's roof sign and door name. */
  trim?: string;
  /** Roof sign and the company name on the doors. */
  taxi?: boolean;
  /** Class for each wheel, e.g. to spin it while the vehicle moves. */
  wheelClass?: string;
  /** Class for the headlight beam; without one there is no beam. */
  beamClass?: string;
  /** Class for the brake-light glow; without one the brake lights stay off. */
  brakeClass?: string;
  /** Class for the amber indicators; without one they stay off. */
  blinkClass?: string;
  /** Class for the body on its springs (everything but the wheels and shadow). */
  bodyClass?: string;
  /** Set when the caller mirrors the vehicle to face left, so its lettering still reads. */
  mirrored?: boolean;
}

export function Vehicle({
  shape = "saloon",
  body = "#f5f7fb",
  glass = "#1b3866",
  trim = "#24467e",
  taxi = false,
  wheelClass,
  beamClass,
  brakeClass,
  blinkClass,
  bodyClass,
  mirrored = false,
}: VehicleProps) {
  const s = shapes[shape];
  const L = s.length;
  const outline = bodyPath(s);
  // Flips lettering back around its own centre when the whole vehicle is mirrored.
  const readable = (x: number) => (mirrored ? `translate(${2 * x} 0) scale(-1 1)` : undefined);
  const nameX = (s.doors[0] + s.doors[s.doors.length - 1]) / 2;
  return (
    <g>
      <defs>
        <linearGradient id="art-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id="art-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx={L / 2} cy="1.5" rx={L / 2 + 4} ry="5" fill="#000" opacity="0.45" />
      {beamClass && <path className={beamClass} d={`M${L - 4} -26 L${L + 150} -48 L${L + 150} 0 Z`} fill="url(#art-beam)" />}

      <g className={bodyClass}>
        {/* Wheel wells: dark under the arches. */}
        {s.wheels.map((cx) => (
          <circle key={`w${cx}`} cx={cx} cy="-10" r="14.5" fill="#05080f" />
        ))}
        <path d={outline} fill={body} />
        <path d={outline} fill="url(#art-shine)" />
        {s.glass.map((d) => (
          <g key={d}>
            <path d={d} fill={glass} />
            <path d={d} fill="url(#art-glass)" />
          </g>
        ))}
        <g stroke="#000" strokeOpacity="0.22" strokeWidth="1.2" fill="none">
          {s.doors.map((x) => (
            <path key={x} d={`M${x} ${s.beltY + 2} V-11`} />
          ))}
          <path d={`M10 -22 H${L - 6}`} strokeOpacity="0.12" />
        </g>
        {/* Door handles. */}
        {s.doors.slice(0, -1).map((x) => (
          <rect key={`h${x}`} x={x + 6} y={s.beltY + 6} width="8" height="2" rx="1" fill="#000" opacity="0.3" />
        ))}
        <path d={`M${s.mirror[0]} ${s.mirror[1]} l6 -3 l2 5 l-7 1 Z`} fill={body} stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />
        {/* Bumpers. */}
        <rect x={L - 10} y="-15" width="10" height="5" rx="2" fill="#000" opacity="0.28" />
        <rect x="3" y="-15" width="10" height="5" rx="2" fill="#000" opacity="0.28" />

        {/* Lights: headlight, tail light, and the optional brake glow and indicators. */}
        <path d={`M${L - 9} -31 L${L - 1} -28 L${L - 1} -22 L${L - 9} -23 Z`} fill="#fff4cc" />
        <rect x="4" y="-30" width="5" height="8" rx="1.5" fill="#b3202a" />
        {brakeClass && <ellipse className={brakeClass} cx="5" cy="-26" rx="10" ry="7" fill="#ff3b3b" opacity="0.85" />}
        {blinkClass && (
          <g className={blinkClass} fill="#ffb020">
            <rect x={L - 4} y="-21" width="4" height="4" rx="1" />
            <rect x="4" y="-21" width="4" height="4" rx="1" />
          </g>
        )}

        {taxi && (
          <g>
            <rect x={s.roofX - 12} y={s.roofY - 9} width="24" height="9" rx="2.5" fill={trim} />
            <text transform={readable(s.roofX)} x={s.roofX} y={s.roofY - 2.4} textAnchor="middle" fontSize="6" fontWeight="800" letterSpacing="0.6" fill="#fff4cc">
              TAXI
            </text>
            <text transform={readable(nameX)} x={nameX} y="-14" textAnchor="middle" fontSize="7.5" fontWeight="800" letterSpacing="1.4" fill={trim}>
              GALAXY
            </text>
          </g>
        )}
      </g>

      {s.wheels.map((cx) => (
        <g key={cx} transform={`translate(${cx} -10)`}>
          <circle r="11.5" fill="#0d1017" />
          <g className={wheelClass}>
            <circle r="7.5" fill="#aab6c8" />
            <circle r="7.5" fill="none" stroke="#5b6678" strokeWidth="1" />
            <g stroke="#5b6678" strokeWidth="1.8" strokeLinecap="round">
              {[0, 72, 144, 216, 288].map((a) => (
                <path key={a} d="M0 0 L0 -6.5" transform={`rotate(${a})`} />
              ))}
            </g>
            <circle r="2.2" fill="#e8eff9" />
          </g>
        </g>
      ))}
    </g>
  );
}

/** A small airliner drawn around (0, 0), nose to the right. */
export function Aircraft({ fill = "#c9d8f0" }: { fill?: string }) {
  return (
    <g>
      <path d="M-34 -2 L18 -4 Q30 -4 36 0 Q30 4 18 4 L-34 2 Z" fill={fill} />
      <path d="M-4 1 L-18 22 L-9 22 L12 2 Z" fill={fill} />
      <path d="M-4 -1 L-13 -15 L-6 -15 L10 -2 Z" fill={fill} opacity="0.8" />
      <path d="M-30 -2 L-38 -15 L-32 -15 L-22 -2 Z" fill={fill} />
      <circle className="art-blink" cx="-16" cy="21" r="1.8" fill="#ff5a5f" />
    </g>
  );
}

/** Gradient used by the headlight beam; include once in any SVG that draws a beam. */
export function BeamGradient() {
  return (
    <linearGradient id="art-beam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#fff4cc" stopOpacity="0.5" />
      <stop offset="1" stopColor="#fff4cc" stopOpacity="0" />
    </linearGradient>
  );
}
