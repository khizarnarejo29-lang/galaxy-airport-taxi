/**
 * Hero backdrop: a soft navy glow, a city skyline and a road, drawn with plain
 * SVG shapes and lines. Decorative only, and static (nothing to animate).
 */

// [x, width, height] along a 1440-wide strip; the skyline sits on y = 250.
const far: [number, number, number][] = [
  [0, 70, 120], [64, 52, 168], [112, 80, 104], [186, 46, 190], [228, 92, 132],
  [316, 58, 176], [370, 74, 112], [440, 40, 206], [476, 96, 140], [566, 62, 184],
  [624, 88, 118], [708, 48, 198], [752, 84, 146], [832, 60, 172], [888, 98, 110],
  [982, 44, 214], [1022, 80, 150], [1098, 66, 180], [1160, 90, 124], [1246, 50, 196],
  [1292, 82, 138], [1370, 70, 170],
];
const near: [number, number, number][] = [
  [-10, 96, 78], [82, 64, 112], [142, 110, 64], [248, 72, 96], [316, 120, 72],
  [432, 58, 124], [486, 104, 82], [586, 76, 104], [658, 128, 68], [782, 66, 118],
  [844, 112, 80], [952, 70, 100], [1018, 124, 70], [1138, 60, 128], [1194, 108, 84],
  [1298, 78, 106], [1372, 90, 74],
];

const BASE = 250;

export function RoadSkyline({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 85% -10%, rgb(63 95 149 / 0.45), transparent 60%)," +
            "radial-gradient(44rem 22rem at 0% 100%, rgb(36 70 126 / 0.35), transparent 65%)",
        }}
      />
      <svg
        viewBox="0 0 1440 320"
        preserveAspectRatio="xMidYMax slice"
        className={`absolute inset-x-0 bottom-0 w-full ${compact ? "h-32 sm:h-40 lg:h-48" : "h-56 sm:h-72 lg:h-80"}`}
      >
        <defs>
          <linearGradient id="rs-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12264a" stopOpacity="0.55" />
            <stop offset="1" stopColor="#0b1a33" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="rs-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12264a" />
            <stop offset="1" stopColor="#0b1a33" />
          </linearGradient>
          <linearGradient id="rs-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#071226" stopOpacity="0" />
            <stop offset="1" stopColor="#071226" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <g fill="url(#rs-far)" stroke="#1b3866" strokeWidth="1">
          {far.map(([x, w, h]) => (
            <rect key={`f${x}`} x={x} y={BASE - h} width={w} height={h} />
          ))}
        </g>
        <g fill="url(#rs-near)" stroke="#24467e" strokeWidth="1">
          {near.map(([x, w, h]) => (
            <rect key={`n${x}`} x={x} y={BASE - h} width={w} height={h} />
          ))}
        </g>
        <rect x="0" y="120" width="1440" height="130" fill="url(#rs-fade)" />

        {/* Road: surface, kerb lines and a dashed centre line. */}
        <path d="M0 258 C 480 250 960 248 1440 254 V 320 H 0 Z" fill="#071226" />
        <path d="M0 258 C 480 250 960 248 1440 254" fill="none" stroke="#3f5f95" strokeWidth="1.5" />
        <path
          d="M0 292 C 480 280 960 274 1440 276"
          fill="none"
          stroke="#6e95d4"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeDasharray="22 16"
          strokeLinecap="round"
        />
        <path d="M0 318 C 480 306 960 300 1440 302" fill="none" stroke="#24467e" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
