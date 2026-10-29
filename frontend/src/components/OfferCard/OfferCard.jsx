
import { Tag } from "lucide-react";
import "./OfferCard.css";

export default function OfferCard({
  offer,
  onMakeAnotherOffer,
  onArrangePickup,
}) {
  if (!offer) return null;

  const status = offer.status?.toUpperCase();

  if (status !== "ACCEPTED" && status !== "DECLINED") {
    return null;
  }

  const accepted = status === "ACCEPTED";

  const amount = Number(offer.amount);
  const listingPrice = Number(offer.listingPrice);

  return (
    <div
      className={`offer-card ${
        accepted ? "offer-card--accepted" : "offer-card--declined"
      }`}
    >
      <div className="offer-card__status">
        <Tag size={18} />
        <span>
          {accepted ? "Offer accepted" : "Offer declined"}
        </span>
      </div>

      <h3>${amount.toFixed(2)}</h3>

      {Number.isFinite(listingPrice) && (
        <p>
          Listing price ${listingPrice.toFixed(2)} · Campus pickup
        </p>
      )}

      <p>
        {accepted
          ? `You and the seller agreed on $${amount.toFixed(2)}. Arrange pickup in chat.`
          : `The seller declined your $${amount.toFixed(2)} offer. You can try another price.`}
      </p>

      <p className="offer-card__note">
        {accepted
          ? "Accepting an offer does not mark the item as sold."
          : "Declined · You can make a new offer."}
      </p>

      <button
        type="button"
        onClick={accepted ? onArrangePickup : onMakeAnotherOffer}
      >
        {accepted ? "Arrange pickup" : "Make another offer"}
      </button>
    </div>
  );
}
