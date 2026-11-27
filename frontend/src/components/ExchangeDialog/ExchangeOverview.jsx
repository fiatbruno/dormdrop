import ListingImage from "../ListingImage";
import ExchangeFlow from "./ExchangeFlow";

const pickupStatuses = {
  PENDING: "Awaiting response",
  ACCEPTED: "Time accepted",
  REJECTED: "Declined",
};

export default function ExchangeOverview({
  offerId, item, price, partner, partnerRole, pickup, pickupLabel, proposedBy, pickupActions,
  pickupLoading, pickupError, onRetryPickup, onProposePickup, onBack, onComplete,
}) {
  return (
    <main className="exchange-overview">
      <header className="exchange-overview__heading">
        <h1>Your exchange</h1>
        <p>Keep pickup details and your agreed price together.</p>
      </header>
      <div className="exchange-overview__layout">
        <div className="exchange-overview__details">
          <section className="exchange-overview__card" aria-label="Pickup details">
            <div className="exchange-overview__card-header">
              <h2>Pickup details</h2>
              {pickup && <span className="exchange-overview__badge" data-status={pickup.status}>{pickupStatuses[pickup.status]}</span>}
            </div>
            {pickupError && <p role="alert">{pickupError} <button type="button" onClick={onRetryPickup}>Try again</button></p>}
            {pickupLoading ? <p role="status">Loading pickup details…</p> : pickup ? (
              <>
                <dl className="exchange-overview__pickup">
                  <div><dt>Location</dt><dd>{pickup.meetingPlace}</dd></div>
                  <div><dt>When</dt><dd>{pickupLabel} · Central Time</dd></div>
                  <div><dt>Proposed by</dt><dd>{proposedBy}</dd></div>
                </dl>
                {pickup.meetingNote && <p>{pickup.meetingNote}</p>}
                <p>Meet in a public place on campus. Confirm with {partner} if anything changes.</p>
                {pickupActions}
              </>
            ) : (
              <>
                {!pickupError && <p>No pickup has been proposed yet.</p>}
                <div className="exchange-overview__actions">
                  <button type="button" className="exchange-primary" onClick={onProposePickup}>Propose pickup</button>
                </div>
              </>
            )}
          </section>
          {offerId && <ExchangeFlow key={offerId} offerId={offerId} pickup={pickup} itemTitle={item?.title || "Listing unavailable"}
            price={price} partner={partner} onComplete={onComplete} />}
        </div>
        <aside className="exchange-overview__card exchange-overview__item" aria-label="Exchange listing">
          {item && <ListingImage className="exchange-overview__image" src={item.imageUrl} alt={item.title} />}
          <h2>{item?.title || "Listing unavailable"}</h2>
          {price && <p className="exchange-overview__price">Agreed price <strong>{price}</strong></p>}
          {item?.status && <span className="exchange-overview__badge exchange-overview__listing-status">{item.status.toLowerCase()}</span>}
          <p>{partnerRole && `${partnerRole} · `}{partner}</p>
          <button type="button" onClick={onBack}>View conversation</button>
        </aside>
      </div>
    </main>
  );
}
