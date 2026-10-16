import { ImageResponse } from "next/og";
import { airports } from "@/lib/domain/airports";
import { site } from "@/config/site";

export const ogSize = { width: 1200, height: 630 };

/** Branded 1200×630 social preview image. Uses the built-in font: no font files to fetch. */
export function renderOgImage({ eyebrow, title }: { eyebrow: string; title: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "white",
          backgroundColor: "#071226",
          backgroundImage:
            "radial-gradient(circle at 88% 0%, rgba(63,95,149,0.55), transparent 55%), radial-gradient(circle at 0% 100%, rgba(36,70,126,0.45), transparent 50%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="15" fill="#12264a" />
            <ellipse cx="16" cy="16" rx="11" ry="5" fill="none" stroke="#6e95d4" strokeWidth="1.6" transform="rotate(-25 16 16)" />
            <circle cx="16" cy="16" r="4.2" fill="#ffffff" />
            <circle cx="25" cy="10.5" r="1.4" fill="#fff" />
          </svg>
          <div style={{ fontSize: 34, fontWeight: 700, display: "flex" }}>{site.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 28, color: "#8eaee2", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            {eyebrow}
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>{title}</div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {airports.map((a) => (
            <div
              key={a.code}
              style={{
                display: "flex",
                fontSize: 24,
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {a.shortName}
            </div>
          ))}
        </div>
      </div>
    ),
    ogSize,
  );
}
