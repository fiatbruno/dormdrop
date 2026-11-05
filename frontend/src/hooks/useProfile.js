
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProfile,
  getMyListings,
  saveProfile,
  updateListingStatus,
  relistItem,
  resetPassword,
} from "../api/profileApi";

export default function useProfile() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const refreshProfile = useCallback(async (showLoading = false) => {
    const requestId = ++requestIdRef.current;

    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const [profileData, listingData] = await Promise.all([
        getProfile(),
        getMyListings(),
      ]);

      if (
        !mountedRef.current ||
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setUser(profileData);
      setListings(
        Array.isArray(listingData) ? listingData : []
      );
    } catch (err) {
      if (
        mountedRef.current &&
        requestId === requestIdRef.current
      ) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Unable to load your profile."
        );
      }
    } finally {
      if (
        mountedRef.current &&
        requestId === requestIdRef.current
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Synchronize the profile with the server on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfile(true);

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, [refreshProfile]);

  async function handleSaveProfile(data) {
    const updated = await saveProfile(data);

    setUser((previous) =>
      updated || { ...previous, ...data }
    );

    return updated;
  }

  async function handleUpdateStatus(id, status) {
    await updateListingStatus(id, status);

    setListings((previous) =>
      previous.map((item) =>
        String(item.id) === String(id)
          ? { ...item, status }
          : item
      )
    );
  }

  async function handleResetPassword() {
    if (!user?.email) {
      throw new Error("Your email address is unavailable.");
    }

    return resetPassword(user.email);
  }

  return {
    user,
    listings,
    loading,
    refreshing,
    error,
    refreshProfile,
    onSaveProfile: handleSaveProfile,
    onMarkSold: (id) => handleUpdateStatus(id, "SOLD"),
    onRelist: async (id) => {
      const listing = await relistItem(id);
      setListings((previous) => [listing, ...previous]);
    },
    onResetPassword: handleResetPassword,
  };
}
