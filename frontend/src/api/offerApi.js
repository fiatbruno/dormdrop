
import api from "./client";

const offerPath = (id) =>
  `/offers/${encodeURIComponent(id)}`;

export function newOfferRequestKey() {
  return crypto.randomUUID();
}

export async function createOffer(
  listingId,
  amount,
  requestKey
) {
  if (!requestKey) {
    throw new Error(
      "An idempotency key is required for an offer submission."
    );
  }

  return (
    await api.post(
      `/home/${encodeURIComponent(listingId)}/offers`,
      { amount },
      {
        headers: {
          "Idempotency-Key": requestKey,
        },
      }
    )
  ).data;
}

export async function getOfferById(id) {
  return (await api.get(offerPath(id))).data;
}

export async function getMyOffers(
  perspective,
  page = 0,
  size = 20
) {
  return (
    await api.get("/me/offers", {
      params: { perspective, page, size },
    })
  ).data;
}

export async function decideOffer(
  id,
  action,
  expectedVersion,
  requestKey
) {
  if (!["ACCEPT", "REJECT"].includes(action)) {
    throw new Error(
      "Decision must be ACCEPT or REJECT."
    );
  }

  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    throw new Error(
      "A valid offer version is required."
    );
  }

  const storageKey =
    `dormdrop:offer-decision:${id}:${action}:${expectedVersion}`;

  const key =
    requestKey ||
    sessionStorage.getItem(storageKey) ||
    newOfferRequestKey();

  sessionStorage.setItem(storageKey, key);

  const response = await api.post(
    `${offerPath(id)}/decisions`,
    { action, expectedVersion },
    {
      headers: {
        "Idempotency-Key": key,
      },
    }
  );

  sessionStorage.removeItem(storageKey);

  return response.data;
}

export const acceptOffer = (id, version, key) =>
  decideOffer(id, "ACCEPT", version, key);

export const rejectOffer = (id, version, key) =>
  decideOffer(id, "REJECT", version, key);
