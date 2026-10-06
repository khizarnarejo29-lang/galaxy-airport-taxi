import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS: the logo mark on the brand background. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#090d27" }}>
        <svg width="140" height="140" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="15" fill="#121a44" />
          <ellipse cx="16" cy="16" rx="11" ry="5" fill="none" stroke="#6d7cff" strokeWidth="1.6" transform="rotate(-25 16 16)" />
          <circle cx="16" cy="16" r="4.2" fill="#ffb23f" />
          <circle cx="25" cy="10.5" r="1.4" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
