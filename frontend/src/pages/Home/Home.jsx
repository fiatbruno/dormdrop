import "./Home.css";
import { useState } from "react";
import MarketplaceFilters from "../../components/MarketplaceFilters/MarketplaceFilters";
import ProductCard from "../../components/ProductCard/ProductCard";
import { emptyFilters, filterProducts, sampleProducts } from "../../data/marketplace";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import { Link } from "react-router-dom";
import marketplaceImage from "../../assets/marketplace.png";

const categoryTabs = [
  { label: "All items", category: "" },
  { label: "Textbooks", category: "Textbooks" },
  { label: "Furniture", category: "Furniture" },
  { label: "Donations", listingType: "Free / Donate" },
  { label: "Appliances", category: "Kitchen & Appliances" },
  { label: "Electronics", category: "Electronics" },
];

function Home() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [visibleCount, setVisibleCount] = useState(9);
  const [savedIds, setSavedIds] = useState([]);
  const results = filterProducts(sampleProducts, filters, search);
  function changeFilters(next) {
    setFilters(next);
    setVisibleCount(9);
  }
  function toggleSave(id) {
    setSavedIds((previous) => previous.includes(id) ? previous.filter((savedId) => savedId !== id) : [...previous, id]);
  }
  return (
    <div className="home-page">
      <Navbar searchValue={search} onSearchChange={(value) => { setSearch(value); setVisibleCount(9); }} />
      <main>
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-hero__inner">
            <div className="home-hero__content">
              <h1 id="home-hero-title">
                Find what you need<br />right down the hall
              </h1>
              <p>
                Buy, sell and trade textbooks, dorm decor, and electronics securely
                with fellow students.
              </p>
              <div className="home-hero__actions">
                <a href="#marketplace">Browse items</a>
                <Link to="/list-an-item">Sell items</Link>
              </div>
            </div>
            <img
              className="home-hero__image"
              src={marketplaceImage}
              alt=""
              width="464"
              height="260"
            />
          </div>
        </section>
        <section className="home-marketplace" id="marketplace">
          <MarketplaceFilters filters={filters} onChange={changeFilters} />
          <div className="home-results">
            <div className="home-category-tabs" role="group" aria-label="Quick marketplace filters">
              {categoryTabs.map((tab) => {
                const active = tab.listingType
                  ? filters.listingType === tab.listingType && !filters.category
                  : filters.category === tab.category && !filters.listingType;
                return (
                  <button key={tab.label} type="button" aria-pressed={active} onClick={() => changeFilters({ ...filters, category: tab.category || "", listingType: tab.listingType || "" })}>{tab.label}</button>
                );
              })}
            </div>
            <p className="home-result-count" role="status">{results.length} campus drops · Sample listings</p>
            {results.length > 0 ? (
              <div className="home-listing-grid">
                {results.slice(0, visibleCount).map((product) => <ProductCard key={product.id} product={product} saved={savedIds.includes(product.id)} onToggleSave={toggleSave} />)}
              </div>
            ) : (
              <p className="home-empty">No items match. Try adjusting your search or clearing filters.</p>
            )}
            {visibleCount < results.length && <button className="home-load-more" type="button" onClick={() => setVisibleCount((count) => count + 9)}>Load more campus drops</button>}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default Home;
