import { ImageResponse } from "next/og";

export const alt = "EmotionSense — real-time emotion intelligence for text";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Edge runtime: this is where @vercel/og is designed to run. It also keeps the
// route out of the static prerender, whose Node path calls fileURLToPath on the
// module URL and throws on Windows drive letters.
export const runtime = "edge";

const EMOTIONS = [
  { label: "joy", color: "#F5B942", height: 168 },
  { label: "love", color: "#E85D8C", height: 96 },
  { label: "surprise", color: "#2DD4BF", height: 58 },
  { label: "sadness", color: "#4A7FE0", height: 122 },
  { label: "fear", color: "#8B5CF6", height: 74 },
  { label: "anger", color: "#E5484D", height: 44 },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0A0A0F",
          backgroundImage:
            "radial-gradient(900px 500px at 20% -10%, rgba(139,92,246,0.22), transparent 65%), radial-gradient(700px 420px at 95% 105%, rgba(232,93,140,0.16), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "1px solid #27272A",
              background: "#14141F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
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
          <span style={{ fontSize: 26, color: "#FAFAFA", letterSpacing: -0.5 }}>EmotionSense</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 82,
              color: "#FAFAFA",
              letterSpacing: -3,
              lineHeight: 1.02,
              maxWidth: 880,
            }}
          >
            Read the emotion behind the words.
          </span>
          <span style={{ marginTop: 22, fontSize: 30, color: "#A1A1AA", maxWidth: 760 }}>
            Six emotions scored in milliseconds, with the full confidence breakdown.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <span style={{ fontSize: 24, color: "#71717A" }}>
            DistilBERT · 16,000 labelled examples · 6 classes
          </span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
            {EMOTIONS.map((e) => (
              <div
                key={e.label}
                style={{
                  width: 34,
                  height: e.height,
                  borderRadius: 10,
                  background: e.color,
                  opacity: 0.92,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
