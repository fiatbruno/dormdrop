
import api from "./client";

const offerPath = (id) =>
  `/offers/${encodeURIComponent(id)}`;

export async function createOffer(listingId, amount) {
  const response = await api.post("/offers", {
    listingId,
    amount,
  });

  return response.data;
}

export async function getOfferById(offerId) {
  const response = await api.get(offerPath(offerId));
  return response.data;
}

export async function acceptOffer(offerId) {
  const response = await api.post(
    `${offerPath(offerId)}/accept`
  );

  return response.data;
}

export async function rejectOffer(offerId) {
  const response = await api.post(
    `${offerPath(offerId)}/reject`
  );

  return response.data;
}
