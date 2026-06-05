import { ADMIN_STATUSES, FISH_SPECIES } from "../../domain/constants";
import { DateField, SelectField } from "./filter-fields";
import type { AdminFilterState, AdminUser } from "./types";

type AdminFiltersProps = {
  filters: AdminFilterState;
  sellers: Array<AdminUser>;
  buyers: Array<AdminUser>;
  onChange: (filters: AdminFilterState) => void;
  onClear: () => void;
};

export function AdminFilters({ buyers, filters, onChange, onClear, sellers }: AdminFiltersProps) {
  const update = (field: keyof AdminFilterState, value: string) =>
    onChange({ ...filters, [field]: value });

  return (
    <section className="card" style={{ marginBottom: "1rem" }}>
      <details className="admin-filters-details">
        <summary>Filters</summary>
        <form className="form">
          <div className="grid">
            <SelectField
              label="Status"
              value={filters.status}
              emptyLabel="All statuses"
              options={ADMIN_STATUSES}
              onChange={(value) => update("status", value)}
            />
            <SelectField
              label="Species"
              value={filters.species}
              emptyLabel="All species"
              options={FISH_SPECIES}
              onChange={(value) => update("species", value)}
            />
            <SelectField
              label="Seller"
              value={filters.sellerId}
              emptyLabel="All sellers"
              options={sellers.map((seller) => ({ value: seller.id, label: seller.displayName }))}
              onChange={(value) => update("sellerId", value)}
            />
            <SelectField
              label="Buyer"
              value={filters.buyerId}
              emptyLabel="All buyers"
              options={buyers.map((buyer) => ({ value: buyer.id, label: buyer.displayName }))}
              onChange={(value) => update("buyerId", value)}
            />
            <DateField
              label="From"
              value={filters.fromDate}
              onChange={(value) => update("fromDate", value)}
            />
            <DateField
              label="To"
              value={filters.toDate}
              onChange={(value) => update("toDate", value)}
            />
          </div>
          <button className="button secondary" onClick={onClear} type="button">
            Clear filters
          </button>
        </form>
      </details>
    </section>
  );
}
