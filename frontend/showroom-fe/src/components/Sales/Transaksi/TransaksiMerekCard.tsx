import React from "react";
export type Brand = { id: string; name: string; logo?: string; accent?: string };
import "./TransaksiMerekCard.css";
import "../../ui/animations.css"; // shared entrance animation (safe to import here)

export default function TransaksiMerekCard({
  brand,
  onClick,
  animate,
  delay,
}: {
  brand: Brand;
  onClick?: (b: Brand) => void;
  animate?: boolean;
  delay?: number;
}) {
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(brand);
    }
  }

  return (
    <div
      className={`transaksi-merek-card${animate ? " animate-entrance" : ""}`}
      style={typeof delay === "number" ? { animationDelay: `${delay}ms` } : undefined}
      role="group"
      aria-label={`Merek ${brand.name}`}
      data-filterable-card
      data-brand-name={brand.name}
    >
      <div className="transaksi-merek-logo-wrap"
        tabIndex={0}
        role="button"
        onClick={() => onClick?.(brand)}
        onKeyDown={handleKey}
      >
        {brand.logo ? (
          <img src={brand.logo} alt={brand.name} className="transaksi-merek-logo" loading="lazy" />
        ) : (
          <div className="transaksi-merek-logo-placeholder">{(brand.name || "").charAt(0).toUpperCase()}</div>
        )}
      </div>
    </div>
  );
}
