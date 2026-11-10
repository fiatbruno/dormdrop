export function notificationTitle(type) {
  switch (type) {
    case "OFFER_COUNTERED":
      return "New counteroffer";
    case "OFFER_ACCEPTED":
      return "Offer accepted — agreement only";
    case "OFFER_REJECTED":
      return "Offer declined";
    case "OFFER_RECEIVED":
    case "OFFER_CREATED":
    case "OFFER_SUBMITTED":
      return "New offer received";
    case "OFFER_SENT":
      return "You sent an offer";
    case "OFFER_EXPIRED":
      return "Offer expired";
    case "MESSAGE_CREATED":
      return "New message";
    default:
      return "DormDrop update";
  }
}

export function notificationBody(notification) {
  const type = String(notification?.type || "").toUpperCase();
  const price = Number(notification?.payload?.price);
  const priceLabel = Number.isFinite(price)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(price)
    : "";
  if (type === "OFFER_ACCEPTED") {
    return `Agreement recorded${priceLabel ? ` at ${priceLabel}` : ""}. Payment and pickup are arranged separately.`;
  }
  if (type === "OFFER_REJECTED") {
    return `Your offer was declined${priceLabel ? ` at ${priceLabel}` : ""}.`;
  }
  if (type === "OFFER_COUNTERED") {
    return `A new proposal${priceLabel ? ` for ${priceLabel}` : ""} is waiting for your response.`;
  }
  return (
    notification?.payload?.message ||
    (type === "OFFER_RECEIVED"
      ? "A buyer sent an offer on your listing."
      : "There’s an update about your DormDrop activity.")
  );
}

export function notificationTarget(notification) {
  // Old moderation notices contain an API self-link, not a page a user can visit.
  if (["MODERATION_NOTICE", "MODERATION_SELLER_NOTICE"].includes(notification?.type)) {
    return "/profile";
  }
  if (["REPORT_UPDATE", "MODERATION_REPORT_UPDATE"].includes(notification?.type)) {
    return "/my-reports";
  }
  const link = notification?.payload?.link;
  if (typeof link === "string" && link.startsWith("/") && !link.startsWith("//") && !link.startsWith("/\\")) {
    return link;
  }
  if (notification?.offerId) {
    return `/offers/${encodeURIComponent(notification.offerId)}`;
  }
  if (notification?.conversationId) {
    return `/messages/${encodeURIComponent(notification.conversationId)}`;
  }
  if (notification?.listingId) {
    return `/items/${encodeURIComponent(notification.listingId)}`;
  }
  return "/notifications";
}
