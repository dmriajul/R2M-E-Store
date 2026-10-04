import { ImageResponse } from "next/og";

/**
 * Default social card — 1200×630, rendered at build time by next/og.
 *
 * Notes on the artwork: Satori only speaks flexbox, so the layout is a few
 * flex columns; the gold/lavender glows are blurred circles. We deliberately
 * avoid emoji and the ৳ glyph here — this card renders with Satori's embedded
 * Noto Sans subset, which has no emoji or Bengali coverage, and a tofu box on
 * every share is worse than plain words.
 */
export const alt = "Little Luxe — Premium Kids Fashion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 72,
          backgroundColor: "#0A0A0A",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ---------- Ambient glows ---------- */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -140,
            width: 660,
            height: 660,
            borderRadius: "50%",
            backgroundColor: "rgba(212,175,55,0.20)",
            filter: "blur(120px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -240,
            right: -160,
            width: 620,
            height: 620,
            borderRadius: "50%",
            backgroundColor: "rgba(167,139,250,0.16)",
            filter: "blur(130px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 6,
            backgroundColor: "#D4AF37",
          }}
        />

        {/* ---------- Brand row ---------- */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 76,
              height: 76,
              borderRadius: 22,
              border: "2px solid rgba(212,175,55,0.65)",
              backgroundColor: "#111111",
              color: "#D4AF37",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            LL
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                color: "#D4AF37",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: 10,
              }}
            >
              LITTLE LUXE
            </div>
            <div style={{ color: "#A1A1AA", fontSize: 20, letterSpacing: 2 }}>
              littleluxe.com
            </div>
          </div>
        </div>

        {/* ---------- Headline ---------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: 80,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            Premium Kids Fashion
          </div>
          <div style={{ color: "#D4AF37", fontSize: 34 }}>
            Ages 0–14 · Free shipping over BDT 500
          </div>
          <div style={{ color: "#A1A1AA", fontSize: 26 }}>
            COD · bKash · Nagad · Rocket
          </div>
        </div>

        {/* ---------- Footer ---------- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "1px solid rgba(212,175,55,0.35)",
          }}
        >
          <div style={{ color: "#A1A1AA", fontSize: 22 }}>
            Dresses · Tops · Bottoms · Shoes · Outerwear · Accessories
          </div>
          <div style={{ color: "#D4AF37", fontSize: 22 }}>Made for small ones</div>
        </div>
      </div>
    ),
    size,
  );
}
