import ListingImage from "../../components/ListingImage";
import { useState } from "react";
import { Link } from "react-router-dom";
import "./SavedItems.css";
import Footer from "../../components/Footer/Footer";
import useSavedItems from "../../hooks/useSavedItems";
import Navbar from "../../components/Navbar/Navbar";

const filters = ["All saved", "Available", "No longer available"];








function SavedItemsView({
  items = [],
  loading = false,
  error = "",
  onRetry,
  onUnsave,
  getListingPath,
  navigation,
  links = {},
  initials = "AM",
  onSearch,
}) {
  const [filter, setFilter] = useState("All saved");
  const [removedIds, setRemovedIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());
  const [actionError, setActionError] = useState("");
  const saved = items.filter((item) => !removedIds.has(item.id));
  const visible = saved.filter((item) =>
    filter === "All saved"
      ? true
      : filter === "Available"
        ? item.available === true
        : item.available === false,
  );

  async function unsave(id) {
    if (!onUnsave || pendingIds.has(id)) return;
    setActionError("");
    setPendingIds((previous) => new Set(previous).add(id));
    try {
      await onUnsave(id);
      setRemovedIds((previous) => new Set(previous).add(id));
    } catch {
      setActionError("Couldn't unsave this item. Please try again.");
    } finally {
      setPendingIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }
  

  return (
    <div className="saved-shell">
      <Navbar showSearch={false} />
      <main className="saved-page">
        <header className="saved-heading">
          <div>
            <h1>Your saved finds</h1>
            <p>Keep your favorites close while you decide.</p>
          </div>
          {!loading && !error && (
            <span className="saved-count" aria-live="polite">
              {saved.length} saved {saved.length === 1 ? "item" : "items"}
            </span>
          )}
        </header>

        <div
          className="saved-filters"
          role="group"
          aria-label="Filter saved items"
        >
          {filters.map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={filter === label}
              onClick={() => setFilter(label)}
            >
              {label}
            </button>
          ))}
        </div>

        {actionError && (
          <p className="saved-error" role="alert">
            {actionError}
          </p>
        )}

        {loading ? (
          <div className="saved-state" role="status">
            Loading your saved items…
          </div>
        ) : error ? (
          <div className="saved-state" role="alert">
            <h2>Couldn't load saved items</h2>
            <p>{error}</p>
            {onRetry && (
              <button type="button" className="saved-primary" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <div className="saved-state">
            <Bookmark />
            <h2>
              {saved.length === 0
                ? "No saved items yet"
                : "No items in this filter"}
            </h2>
            <p>
              {saved.length === 0
                ? "Save an item while browsing and it will appear here."
                : "Try another filter to see your saved items."}
            </p>
          </div>
        ) : (
          <div className="saved-grid">
            {visible.map((item) => {
              const pending = pendingIds.has(item.id);
              const path = getListingPath?.(item.id);
              return (
                <article className="saved-card" key={item.id}>
                  <PageLink to={path} className="saved-image-wrap">
                    {item.imageUrl ? (
                      <ListingImage
                        src={item.imageUrl}
                        alt={item.title}
                        loading="lazy"
                      />
                    ) : null}
                    <span
                      className="saved-image-placeholder"
                      aria-hidden="true"
                    >
                      DormDrop
                    </span>
                  </PageLink>
                  <div className="saved-card-body">
                    <p className="saved-category">
                      {item.category || "Uncategorized"}
                    </p>
                    <h2><PageLink to={path}>{item.title}</PageLink></h2>
                    <div className="saved-card-meta">
                      <strong>
                        {typeof item.price === "number"
                          ? new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 2,
                              minimumFractionDigits: 0,
                            }).format(item.price)
                          : item.price || "Price unavailable"}
                      </strong>
                      <span
                        className={`saved-status ${item.available === true ? "is-available" : ""}`}
                      >
                        {item.available === true
                          ? "Available"
                          : item.available === false
                            ? "No longer available"
                            : "Status unavailable"}
                      </span>
                    </div>
                  </div>
                  <div className="saved-card-actions">
                    {path ? (
                      <Link className="saved-view" to={path}>
                        View listing
                      </Link>
                    ) : (
                      <button className="saved-view" type="button" disabled>
                        View listing
                      </button>
                    )}
                    <button
                      type="button"
                      className="saved-bookmark"
                      aria-label={`Unsave ${item.title}`}
                      disabled={pending || !onUnsave}
                      aria-busy={pending}
                      onClick={() => unsave(item.id)}
                    >
                      <Bookmark />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <aside className="saved-note">
          <h2>Saved doesn't reserve an item</h2>
          <p>
            Listings can sell quickly. Message the seller when you're ready and
            agree on a campus pickup spot.
          </p>
        </aside>
        <PageLink to="/home" className="saved-more">
          Find more campus drops
        </PageLink>
      </main>
      <Footer />
    </div>
  );
}

function Bookmark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
      <path d="M3 21 21 3" />
    </svg>
  );
}

function PageLink({ to, children, className }) {
  return to ? (
    <Link to={to} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}
export default function SavedItems() {
  const savedItems = useSavedItems();

  return <SavedItemsView {...savedItems} />;
}
