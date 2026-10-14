import useListingImage from "../../hooks/useListingImage";
import { useState } from "react";
import { Bookmark, ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import "./ProductCard.css";

/** product: { id, title, category, description, image, price, listingType }.
 * Supply detailsPath when a real detail route is available.
 */
function ProductCard({ product, saved = false, onToggleSave, detailsPath = `/items/${encodeURIComponent(product.id)}` }) {
  const image = useListingImage(product.image);
  const [failedImage, setFailedImage] = useState(null);
  const price =
    product.listingType === "Free / Donate"
      ? "Free"
      : product.listingType === "Trade"
        ? "Trade"
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(product.price);
  return (
    <article className="product-card">
      <div className="product-card__media">
        <Link className="product-card__image-link" to={detailsPath} aria-label={`View ${product.title}`}>
        {image && failedImage !== image ? (
          <img
            src={image}
            alt={product.title}
            loading="lazy"
            onError={() => setFailedImage(image)}
          />
        ) : (
          <div className="product-card__placeholder">
            <ImageOff size={28} aria-hidden="true" />
            <span>Photo coming soon</span>
          </div>
        )}
        </Link>
        {onToggleSave && (
          <button
            className="product-card__save"
            type="button"
            aria-label={`${saved ? "Unsave" : "Save"} ${product.title}`}
            aria-pressed={saved}
            onClick={() => onToggleSave(product.id)}
          >
            <Bookmark
              size={16}
              fill={saved ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      <div className="product-card__body">
        <span className="product-card__category">
          {product.listingType === "Free / Donate"
            ? "Free donation"
            : product.category}
        </span>
        <h3>
          {detailsPath ? (
            <Link to={detailsPath}>{product.title}</Link>
          ) : (
            product.title
          )}
        </h3>
        <p>{product.description}</p>
        <strong className="product-card__price">{price}</strong>
      </div>
    </article>
  );
}
export default ProductCard;
