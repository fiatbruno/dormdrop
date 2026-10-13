
import { useEffect, useState } from "react";
import {
  getProfile,
  getMyListings,
  saveProfile,
  updateListingStatus,
  resetPassword,
} from "./profileApi";

export default function useProfile() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileData, listingData] = await Promise.all([
          getProfile(),
          getMyListings(),
        ]);

        setUser(profileData);
        setListings(listingData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleSaveProfile(data) {
    const updated = await saveProfile(data);
    setUser(updated || { ...user, ...data });
  }

  async function handleUpdateStatus(id, status) {
    await updateListingStatus(id, status);

    setListings((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );
  }

  return {
    user,
    listings,
    loading,
    error,
    onSaveProfile: handleSaveProfile,
    onMarkSold: (id) => handleUpdateStatus(id, "SOLD"),
    onRelist: (id) => handleUpdateStatus(id, "AVAILABLE"),
    onResetPassword: () => resetPassword(user.email),
  };
}
