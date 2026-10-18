import { Aircraft, BeamGradient, Vehicle } from "./art";
import { InView } from "./InView";

/**
 * Hero backdrop: a soft navy glow, a city skyline and a road, drawn with plain
 * SVG shapes and lines. Decorative only. On load a taxi drives in, brakes and
 * pulls in at the kerb; traffic keeps passing on both lanes (driving on the
 * left, as in the UK), with street lamps, lit windows and (per scene) an
 * aircraft. With reduced motion the taxi is simply parked and the looping
 * parts are hidden.
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

const lamps = [150, 510, 870, 1230];

// Typical London traffic colours: silver, black, white, dark blue, red.
const farTraffic = [
  { cls: "art-traffic-far-a", shape: "estate" as const, body: "#9aa6b8" },
  { cls: "art-traffic-far-b", shape: "minibus" as const, body: "#d7dde6" },
  { cls: "art-traffic-far-c", shape: "saloon" as const, body: "#7a2730" },
];
const nearTraffic = [
  { cls: "art-traffic-near-a", shape: "saloon" as const, body: "#c4cbd6" },
  { cls: "art-traffic-near-b", shape: "mpv" as const, body: "#1d2330" },
  { cls: "art-traffic-near-c", shape: "estate" as const, body: "#2b4a7a" },
];

// Lit windows: [x, y] on the near buildings, each with its own twinkle delay.
const windows: [number, number][] = [
  [98, 160], [160, 202], [266, 176], [336, 200], [452, 150], [500, 190], [606, 170],
  [676, 196], [800, 156], [866, 192], [972, 172], [1040, 200], [1154, 146], [1214, 190],
  [1316, 168], [1390, 200],
];

/** city: skyline only. takeoff / landing: an aircraft climbs away or comes in over the skyline. */
export type RoadScene = "city" | "takeoff" | "landing";

export function RoadSkyline({ compact = false, scene = "city" }: { compact?: boolean; scene?: RoadScene }) {
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
      <InView className="absolute inset-x-0 bottom-0">
        <svg
          viewBox="0 0 1440 320"
          preserveAspectRatio="xMidYMax slice"
          className={`block w-full ${compact ? "h-32 sm:h-40 lg:h-48" : "h-56 sm:h-72 lg:h-80"}`}
        >
          <defs>
            <BeamGradient />
            <linearGradient id="rs-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#12264a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#0b1a33" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="rs-near" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#12264a" />
              <stop offset="1" stopColor="#0b1a33" />
            </linearGradient>
            <radialGradient id="rs-lamp">
              <stop offset="0" stopColor="#ffe6a6" stopOpacity="0.28" />
              <stop offset="1" stopColor="#ffe6a6" stopOpacity="0" />
            </radialGradient>
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

          <g fill="#8eaee2">
            {windows.map(([x, y], i) => (
              <rect key={x} className="art-twinkle" style={{ animationDelay: `${(i * 0.7) % 5}s` }} x={x} y={y} width="6" height="8" rx="1" />
            ))}
          </g>

          {scene !== "city" && (
            <g className={`art-loop ${scene === "takeoff" ? "art-plane-takeoff" : "art-plane-landing"}`}>
              <Aircraft />
            </g>
          )}

          {/* Road, straight so traffic stays in lane: far pavement, two lanes split by a dashed line, near kerb. */}
          <rect x="0" y="236" width="1440" height="84" fill="#0a1428" />
          <rect x="0" y="230" width="1440" height="7" fill="#12264a" />
          <path d="M0 237 H1440" stroke="#3f5f95" strokeWidth="1.5" />
          <path d="M0 281 H1440" stroke="#c9d8f0" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="26 22" />
          <path d="M0 318 H1440" stroke="#3f5f95" strokeWidth="1.5" />

          {/* Street lamps on the far pavement, each throwing a pool of light on the road. */}
          {lamps.map((x) => (
            <g key={x}>
              <ellipse cx={x + 20} cy="262" rx="74" ry="18" fill="url(#rs-lamp)" />
              <path d={`M${x} 234 V160 Q${x} 152 ${x + 8} 152 H${x + 22}`} fill="none" stroke="#3f5f95" strokeWidth="3" />
              <rect x={x + 16} y="150" width="14" height="5" rx="2" fill="#24467e" />
              <ellipse cx={x + 23} cy="156" rx="6" ry="2.5" fill="#ffe6a6" />
            </g>
          ))}

          {/* UK traffic keeps left: the far lane runs left to right, the near lane right to left. */}
          {farTraffic.map((car) => (
            <g key={car.cls} transform="translate(0 268) scale(0.52)">
              <g className={`art-loop ${car.cls}`}>
                <Vehicle shape={car.shape} body={car.body} glass="#0b1a33" wheelClass="art-wheel-spin" beamClass="art-beam-on" />
              </g>
            </g>
          ))}
          {nearTraffic.map((car) => (
            <g key={car.cls} transform="translate(1440 298) scale(-0.64 0.64)">
              <g className={`art-loop ${car.cls}`}>
                <Vehicle mirrored shape={car.shape} body={car.body} glass="#0b1a33" wheelClass="art-wheel-spin" beamClass="art-beam-on" />
              </g>
            </g>
          ))}

          {/* The taxi comes down the near lane, brakes, pulls in at the kerb and puts its hazards on.
              Scaled to match the traffic: a little bigger only because it is nearest. */}
          <g transform="translate(780 316) scale(-0.74 0.74)">
            <g className="art-taxi-in">
              <Vehicle
                mirrored
                taxi
                wheelClass="art-wheel"
                beamClass="art-beam-on"
                brakeClass="art-brake"
                blinkClass="art-indicate"
                bodyClass="art-settle"
              />
            </g>
          </g>
        </svg>
      </InView>
    </div>
  );
}
