
import "./Home.css";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import MarketplaceFilters from "../../components/MarketplaceFilters/MarketplaceFilters";
import ProductCard from "../../components/ProductCard/ProductCard";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

import {
  emptyFilters,
  filterProducts
} from "../../data/marketplace";

import {
  getListings,
  getFavorites,
  addFavorite,
  removeFavorite
} from "../../services/marketplaceApi";

import marketplaceImage from "../../assets/marketplace.png";

const categoryTabs = [
  { label: "All items", category: "" },
  { label: "Textbooks", category: "Textbooks" },
  { label: "Furniture", category: "Furniture" },
  { label: "Donations", listingType: "Free / Donate" },
  { label: "Appliances", category: "Kitchen & Appliances" },
  { label: "Electronics", category: "Electronics" }
];

function Home() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    ...emptyFilters
  });

  const [products, setProducts] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [visibleCount, setVisibleCount] = useState(9);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadListings() {
      try {
        setLoading(true);
        setError("");

        const data = await getListings();

        if (!cancelled) {
          setProducts(data);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError("Unable to load listings.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadListings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      if (!localStorage.getItem("token")) {
        return;
      }

      try {
        const ids = await getFavorites();

        if (!cancelled) {
          setSavedIds(ids);
        }
      } catch (err) {
        console.error(err);
      }
    }

    loadFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  const results = filterProducts(
    products,
    filters,
    search
  );

  function changeFilters(next) {
    setFilters(next);
    setVisibleCount(9);
  }

  async function toggleSave(id) {
    if (!localStorage.getItem("token")) {
      setFavoriteError("Please log in to save listings.");
      return;
    }

    setFavoriteError("");

    try {
      if (savedIds.includes(id)) {
        await removeFavorite(id);

        setSavedIds(previous =>
          previous.filter(savedId => savedId !== id)
        );
      } else {
        await addFavorite(id);

        setSavedIds(previous =>
          previous.includes(id)
            ? previous
            : [...previous, id
            ]
        );
      }
    } catch (err) {
      console.error(err);
      setFavoriteError("Could not update saved listings.");
    }
  }

  return (
    <div className="home-page">
      <Navbar
        searchValue={search}
        onSearchChange={value => {
          setSearch(value);
          setVisibleCount(9);
        }}
      />

      <main>
        <section
          className="home-hero"
          aria-labelledby="home-hero-title"
        >
          <div className="home-hero__inner">
            <div className="home-hero__content">
              <h1 id="home-hero-title">
                Find what you need
                <br />
                right down the hall
              </h1>

              <p>
                Buy, sell and trade textbooks,
                dorm decor, and electronics securely
                with fellow students.
              </p>

              <div className="home-hero__actions">
                <a href="#marketplace">
                  Browse items
                </a>

                <Link to="/list-an-item">
                  Sell items
                </Link>
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

        <section
          className="home-marketplace"
          id="marketplace"
        >
          <MarketplaceFilters
            filters={filters}
            onChange={changeFilters}
          />

          <div className="home-results">
            <div
              className="home-category-tabs"
              role="group"
              aria-label="Quick marketplace filters"
            >
              {categoryTabs.map(tab => {
                const active = tab.listingType
                  ? filters.listingType === tab.listingType
                    && !filters.category
                  : filters.category === tab.category
                    && !filters.listingType;

                return (
                  <button
                    key={tab.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      changeFilters({
                        ...filters,
                        category: tab.category || "",
                        listingType: tab.listingType || ""
                      })
                    }
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {loading && (
              <p role="status">
                Loading campus listings...
              </p>
            )}

            {error && (
              <p className="home-empty" role="alert">
                {error}
              </p>
            )}

            {favoriteError && (
              <p role="alert">
                {favoriteError}
              </p>
            )}

            {!loading && !error && (
              <>
                <p
                  className="home-result-count"
                  role="status"
                >
                  {results.length} campus drops
                </p>

                {results.length > 0 ? (
                  <div className="home-listing-grid">
                    {results
                      .slice(0, visibleCount)
                      .map(product => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          saved={savedIds.includes(product.id)}
                          onToggleSave={toggleSave}
                        />
                      ))}
                  </div>
                ) : (
                  <p className="home-empty">
                    No listings found. Try adjusting
                    your search or filters.
                  </p>
                )}

                {visibleCount < results.length && (
                  <button
                    className="home-load-more"
                    type="button"
                    onClick={() =>
                      setVisibleCount(count => count + 9)
                    }
                  >
                    Load more campus drops
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Home;
