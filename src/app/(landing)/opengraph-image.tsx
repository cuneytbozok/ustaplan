import { ImageResponse } from "next/og";

/** Share preview for the landing page only (this route group); brand and slogan, no data. */
export const alt = "UstaPlan · Ustalar için iş ve randevu defteri";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 36, padding: 96, background: "#F7F8F5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: "#19745A", color: "#FFFFFF", fontSize: 64, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            U
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, color: "#1C2923" }}>UstaPlan</div>
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, color: "#1C2923", lineHeight: 1.1, maxWidth: 960 }}>İşlerini ve verdiğin sözleri unutma.</div>
        <div style={{ fontSize: 36, color: "#68766E" }}>Ustalar için iş, randevu ve müşteri defteri</div>
      </div>
    ),
    size,
  );
}
