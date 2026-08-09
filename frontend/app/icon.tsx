import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Rendered on demand rather than at build time: @vercel/og's static prerender
// path calls fileURLToPath on the module URL, which throws on Windows drive
// letters. Vercel caches the result at the edge, so there's no real cost.
export const dynamic = "force-dynamic";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0F0F1A 0%, #0A0A0F 100%)",
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#FAFAFA" strokeWidth="1.5" opacity="0.85" />
          <path
            d="M8.2 14.2c1.1 1.3 2.4 2 3.8 2s2.7-.7 3.8-2"
            stroke="#F5B942"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <circle cx="9" cy="9.8" r="1.2" fill="#E85D8C" />
          <circle cx="15" cy="9.8" r="1.2" fill="#2DD4BF" />
        </svg>
      </div>
    ),
    size,
  );
}
