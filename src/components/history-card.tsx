import type { ReactNode } from "react";
import { formatMoney } from "../domain/money";

type HistoryCardProps<TItem> = {
  className: string;
  title: ReactNode;
  items: readonly TItem[];
  emptyMessage: string;
  getKey: (item: TItem) => string;
  renderLeading: (item: TItem) => ReactNode;
  renderTitle: (item: TItem) => ReactNode;
  renderSubtitle: (item: TItem) => ReactNode;
  getAmountCents: (item: TItem) => number;
};

export function HistoryCard<TItem>({
  className,
  title,
  items,
  emptyMessage,
  getKey,
  renderLeading,
  renderTitle,
  renderSubtitle,
  getAmountCents,
}: HistoryCardProps<TItem>) {
  return (
    <article className={`card ${className}`}>
      <h2>{title}</h2>
      <div className="list">
        {items.map((item) => (
          <div className="row" key={getKey(item)}>
            <div className="name-wrap">
              {renderLeading(item)}
              <div>
                <strong>{renderTitle(item)}</strong>
                <div className="sub">{renderSubtitle(item)}</div>
              </div>
            </div>
            <span className="amount">{formatMoney(getAmountCents(item))}</span>
          </div>
        ))}
        {items.length === 0 && <p className="muted">{emptyMessage}</p>}
      </div>
    </article>
  );
}
