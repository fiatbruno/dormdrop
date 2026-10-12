import { useId } from "react";
import { categories, pickupSpots, emptyFilters } from "../../data/marketplace";
import "./MarketplaceFilters.css";

function MarketplaceFilters({ filters, onChange }) {
  const id = useId();
  const update = (name, value) => onChange({ ...filters, [name]: value });
  const select = (name, label, options) => (
    <div className="marketplace-filters__field">
      <label htmlFor={`${id}-${name}`}>{label}</label>
      <select
        id={`${id}-${name}`}
        value={filters[name]}
        onChange={(event) => update(name, event.target.value)}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
  function setDateRange(period) {
    const today = new Date();
    const start = new Date(today);
    if (period === "week")
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    if (period === "month") start.setDate(1);
    const format = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange({ ...filters, dateFrom: format(start), dateTo: format(today) });
  }
  return (
    <aside className="marketplace-filters" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Filters</h2>
      <p>Select the filters for what you want.</p>
      {select("category", "Category", categories)}
      <div className="marketplace-filters__row">
        {[
          ["dateFrom", "Listed from"],
          ["dateTo", "Listed to"],
        ].map(([name, label]) => (
          <div className="marketplace-filters__field" key={name}>
            <label htmlFor={`${id}-${name}`}>{label}</label>
            <input
              id={`${id}-${name}`}
              type="date"
              value={filters[name]}
              onChange={(event) => update(name, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div
        className="marketplace-filters__presets"
        role="group"
        aria-label="Listing date shortcuts"
      >
        <button type="button" onClick={() => setDateRange("day")}>
          Today
        </button>
        <button type="button" onClick={() => setDateRange("week")}>
          This week
        </button>
        <button type="button" onClick={() => setDateRange("month")}>
          This month
        </button>
      </div>
      <div className="marketplace-filters__row">
        {[
          ["minPrice", "Min price ($)"],
          ["maxPrice", "Max price ($)"],
        ].map(([name, label]) => (
          <div className="marketplace-filters__field" key={name}>
            <label htmlFor={`${id}-${name}`}>{label}</label>
            <input
              id={`${id}-${name}`}
              type="number"
              min="0"
              step="0.01"
              placeholder="Any"
              value={filters[name]}
              onChange={(event) => update(name, event.target.value)}
            />
          </div>
        ))}
      </div>
      {select("condition", "Condition", ["New", "Like new", "Good", "Fair"])}
      {select("pickupLocation", "Pickup area", pickupSpots)}
      <fieldset className="marketplace-filters__types">
        <legend>Listing type</legend>
        <div>
          {[
            ["Free / Donate", "Free"],
            ["Trade", "Trade"],
            ["For sale", "For sale"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.listingType === value}
              onClick={() =>
                update(
                  "listingType",
                  filters.listingType === value ? "" : value,
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <button
        className="marketplace-filters__clear"
        type="button"
        onClick={() => onChange({ ...emptyFilters })}
      >
        Clear filters
      </button>
    </aside>
  );
}
export default MarketplaceFilters;
