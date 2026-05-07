import { siteFooter } from "@/lib/site-footer";

export function SiteFooter() {
  return (
    <footer
      aria-label="Site credit"
      style={{
        alignItems: "center",
        bottom: 14,
        display: "flex",
        gap: 8,
        justifyContent: "flex-end",
        pointerEvents: "none",
        position: "fixed",
        right: 16,
        zIndex: 50,
      }}
    >
      <span
        style={{
          alignItems: "center",
          background: "rgba(16, 17, 20, 0.84)",
          border: "1px solid rgba(255, 204, 48, 0.28)",
          borderRadius: 999,
          boxShadow: "0 14px 44px rgba(0, 0, 0, 0.26)",
          color: "rgba(255, 248, 232, 0.78)",
          display: "inline-flex",
          fontSize: 13,
          fontWeight: 800,
          gap: 6,
          lineHeight: 1,
          padding: "10px 14px",
          pointerEvents: "auto",
        }}
      >
        <span>{siteFooter.text}</span>
        <span aria-label="love" role="img">
          {siteFooter.heart}
        </span>
        <span>by</span>
        <a
          href={siteFooter.href}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#ffcc30",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          {siteFooter.handle}
        </a>
      </span>
    </footer>
  );
}
