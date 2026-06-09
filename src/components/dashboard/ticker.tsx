import { useState } from "react";
import { formatMoney } from "../../domain/money";
import type { TickerEntry } from "../../server/auction-types";

export function Ticker({ series }: { series: Array<TickerEntry> }) {
  const [paused, setPaused] = useState(false);

  if (series.length === 0) return null;

  // Duplicate for seamless loop
  const items = [...series, ...series];

  return (
    <div className="ticker">
      <button
        aria-label={paused ? "Play ticker" : "Pause ticker"}
        aria-pressed={paused}
        className="ticker-toggle"
        onClick={() => setPaused((p) => !p)}
        type="button"
      >
        {paused ? "▶" : "⏸"}
      </button>
      <div className="ticker-viewport">
        <div className={`track${paused ? " paused" : ""}`}>
          {items.map((entry, idx) => (
            <span key={`${entry.species}-${idx}`} aria-hidden={idx >= series.length || undefined}>
              {entry.species.toUpperCase()} <b>{formatMoney(entry.latestPriceCents)}</b>
              {entry.deltaPct !== null && (
                <span className={entry.deltaPct >= 0 ? "up" : undefined}>
                  {entry.deltaPct >= 0 ? " ▲ +" : " ▼ "}
                  {Math.abs(entry.deltaPct).toFixed(1)}%
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
