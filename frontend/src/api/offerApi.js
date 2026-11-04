
import api from "./client";

const offerPath = (id) =>
  `/offers/${encodeURIComponent(id)}`;

function idempotencyKey() {
  return crypto.randomUUID();
}

export async function createOffer(listingId, amount) {
  const response = await api.post(
    `/home/${encodeURIComponent(listingId)}/offers`,
    { amount },
    {
      headers: {
        "Idempotency-Key": idempotencyKey(),
      },
    }
  );

  return response.data;
}

export async function getOfferById(offerId) {
  const response = await api.get(offerPath(offerId));
  return response.data;
}

export async function getMyOffers(perspective, page = 0, size = 20) {
  const response = await api.get("/me/offers", {
    params: { perspective, page, size },
  });

  return response.data;
}

export async function decideOffer(offerId, action, expectedVersion) {
  if (!["ACCEPTED", "REJECTED"].includes(action)) {
    throw new Error("Invalid offer decision.");
  }

  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new Error("A valid offer version is required.");
  }

  const response = await api.post(
    `${offerPath(offerId)}/decisions`,
    { action, expectedVersion },
    {
      headers: {
        "Idempotency-Key": idempotencyKey(),
      },
    }
  );

  return response.data;
}

export async function acceptOffer(offerId, expectedVersion) {
  return decideOffer(offerId, "ACCEPTED", expectedVersion);
}

export async function rejectOffer(offerId, expectedVersion) {
  return decideOffer(offerId, "REJECTED", expectedVersion);
}
