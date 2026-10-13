
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import Navbar from "../../components/Navbar/Navbar";
import {
  getListingById,
  updateListing,
  uploadListingImage,
} from "../../services/marketplaceApi";

import "./EditListing.css";

const categories = [
  "Electronics",
  "Furniture",
  "Clothing",
  "Books",
  "School Supplies",
  "Dorm Essentials",
  "Other",
];

const conditions = [
  "New",
  "Like new",
  "Good",
  "Fair",
];

const pickupSpots = [
  "Gerber Center / Main entrance",
  "Library",
  "Olin Center",
  "Carver Center",
  "Other",
];

const initialForm = {
  title: "",
  category: "",
  customCategory: "",
  condition: "",
  description: "",
  listingType: "For sale",
  price: "",
  pickupLocation: "",
};

const API_ORIGIN = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080/api/v1"
).replace(/\/api\/v1\/?$/, "");

function getImageUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [originalImage, setOriginalImage] = useState("");
  const [newPhoto, setNewPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadListing() {
      try {
        setLoading(true);
        setError("");

        if (!localStorage.getItem("token")) {
          navigate("/login");
          return;
        }

        const listing = await getListingById(id);
        if (cancelled) return;

        const isKnownCategory = categories.includes(
          listing.category
        );

        setForm({
          title: listing.title || "",
          category: isKnownCategory
            ? listing.category
            : "Other",
          customCategory: isKnownCategory
            ? ""
            : listing.category || "",
          condition: listing.condition || "",
          description: listing.description || "",
          listingType: listing.listingType || "For sale",
          price: String(listing.price ?? ""),
          pickupLocation:
            listing.pickupArea ||
            listing.pickupLocation ||
            "",
        });

        setOriginalImage(
          getImageUrl(listing.imageUrl)
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message === "HTTP 404"
              ? "Listing not found."
              : "Unable to load this listing."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadListing();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!newPhoto) {
      setPreviewUrl(originalImage);
      return;
    }

    const url = URL.createObjectURL(newPhoto);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [newPhoto, originalImage]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function choosePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (
      !["image/jpeg", "image/png"].includes(file.type)
    ) {
      setError("Only JPG and PNG images are supported.");
      return;
    }

    if (file.size > 5 * 1024 * 1024 || file.size === 0) {
      setError("The image must be under 5 MB.");
      return;
    }

    setNewPhoto(file);
    setError("");
    setSuccess("");
  }

  async function saveChanges(event) {
    event.preventDefault();

    if (saving) return;

    setError("");
    setSuccess("");

    const category =
      form.category === "Other"
        ? form.customCategory.trim()
        : form.category;

    const price =
      form.listingType === "Free / Donate"
        ? "0"
        : form.price.trim();

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !category ||
      !form.condition ||
      !form.pickupLocation
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (
      !/^\d+(\.\d{1,2})?$/.test(price) ||
      Number(price) > 999999.99
    ) {
      setError("Enter a valid price.");
      return;
    }

    setSaving(true);

    try {
      await updateListing(id, {
        title: form.title.trim(),
        description: form.description.trim(),
        category,
        condition: form.condition,
        listingType: form.listingType,
        price,
        pickupLocation: form.pickupLocation,
      });

      if (newPhoto) {
        try {
          const result = await uploadListingImage(
            id,
            newPhoto
          );

          setOriginalImage(getImageUrl(result.imageUrl));
          setNewPhoto(null);
        } catch {
          setError(
            "Listing details saved, but the new photo could not be uploaded."
          );
          return;
        }
      }

      setSuccess("Your listing has been updated successfully!");
    } catch (err) {
      if (err.message === "HTTP 403") {
        setError("You do not have permission to edit this listing.");
      } else if (err.message === "HTTP 401") {
        setError("Please log in again.");
      } else {
        setError("Unable to save changes. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="edit-loading">
          Loading your listing...
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="edit-page">
        <div className="edit-heading">
          <Link to="/home" className="edit-back">
            <ArrowLeft size={16} />
            Back to marketplace
          </Link>

          <h1>Edit your listing</h1>
          <p>
            Update your item details, change the photo,
            and keep your campus listing up to date.
          </p>
        </div>

        {error && (
          <div className="edit-alert edit-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="edit-alert edit-success" role="status">
            {success}
          </div>
        )}

        <div className="edit-layout">
          <form
            className="edit-form"
            onSubmit={saveChanges}
          >
            <section className="edit-section">
              <h3>Photos</h3>

              <div className="edit-photo-box">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Listing preview"
                    className="edit-photo"
                  />
                ) : (
                  <div className="edit-photo-placeholder">
                    <Upload size={28} />
                    <span>No photo uploaded</span>
                  </div>
                )}

                <div className="edit-photo-actions">
                  <label
                    htmlFor="edit-photo-input"
                    className="edit-upload-label"
                  >
                    <Upload size={18} />
                    {previewUrl
                      ? "Change photo"
                      : "Upload photo"}
                  </label>

                  <p>JPG or PNG · Up to 5 MB</p>

                  {newPhoto && (
                    <button
                      type="button"
                      className="edit-text-button"
                      onClick={() => setNewPhoto(null)}
                    >
                      Cancel photo change
                    </button>
                  )}
                </div>

                <input
                  id="edit-photo-input"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={choosePhoto}
                  hidden
                />
              </div>
            </section>

            <div className="edit-field">
              <label htmlFor="edit-title">
                Listing title
              </label>
              <input
                id="edit-title"
                name="title"
                value={form.title}
                onChange={updateField}
                placeholder="What are you selling?"
                maxLength={100}
                required
              />
            </div>

            <div className="edit-two-columns">
              <div className="edit-field">
                <label htmlFor="edit-category">
                  Category
                </label>
                <select
                  id="edit-category"
                  name="category"
                  value={form.category}
                  onChange={updateField}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="edit-field">
                <label htmlFor="edit-condition">
                  Condition
                </label>
                <select
                  id="edit-condition"
                  name="condition"
                  value={form.condition}
                  onChange={updateField}
                  required
                >
                  <option value="">Select condition</option>
                  {conditions.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.category === "Other" && (
              <div className="edit-field">
                <label htmlFor="edit-custom-category">
                  Custom category
                </label>
                <input
                  id="edit-custom-category"
                  name="customCategory"
                  value={form.customCategory}
                  onChange={updateField}
                  required
                />
              </div>
            )}

            <div className="edit-field">
              <label htmlFor="edit-description">
                Description
              </label>
              <textarea
                id="edit-description"
                name="description"
                value={form.description}
                onChange={updateField}
                placeholder="Describe your item..."
                rows={5}
                required
              />
              <small>
                Tell buyers about condition, what's included,
                and pickup details.
              </small>
            </div>

            <section className="edit-section">
              <h3>Listing type</h3>

              <div className="edit-type-buttons">
                {["For sale", "Free / Donate", "Trade"].map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      className={
                        form.listingType === type
                          ? "edit-type active"
                          : "edit-type"
                      }
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          listingType: type,
                          price:
                            type === "Free / Donate"
                              ? "0"
                              : previous.price,
                        }))
                      }
                    >
                      {type}
                    </button>
                  )
                )}
              </div>
            </section>

            <div className="edit-two-columns">
              <div className="edit-field">
                <label htmlFor="edit-price">
                  Price (USD)
                </label>
                <input
                  id="edit-price"
                  name="price"
                  type="number"
                  min="0"
                  max="999999.99"
                  step="0.01"
                  value={
                    form.listingType === "Free / Donate"
                      ? "0"
                      : form.price
                  }
                  onChange={updateField}
                  disabled={
                    form.listingType === "Free / Donate"
                  }
                  required
                />
              </div>

              <div className="edit-field">
                <label htmlFor="edit-pickup">
                  Campus pickup spot
                </label>
                <select
                  id="edit-pickup"
                  name="pickupLocation"
                  value={form.pickupLocation}
                  onChange={updateField}
                  required
                >
                  <option value="">
                    Select pickup location
                  </option>
                  {!pickupSpots.includes(
                    form.pickupLocation
                  ) &&
                    form.pickupLocation && (
                      <option value={form.pickupLocation}>
                        {form.pickupLocation}
                      </option>
                    )}
                  {pickupSpots.map((spot) => (
                    <option key={spot} value={spot}>
                      {spot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="edit-actions">
              <button
                type="submit"
                className="edit-save-button"
                disabled={saving || !!error && error === "Listing not found."}
              >
                <Save size={17} />
                {saving ? "Saving..." : "Save changes"}
              </button>

              <button
                type="button"
                className="edit-cancel-button"
                onClick={() => navigate("/home")}
              >
                Cancel
              </button>
            </div>
          </form>

          <aside className="edit-sidebar">
            <h3>Preview</h3>
            <p className="edit-preview-description">
              This is how your updated listing will appear.
            </p>

            <div className="edit-preview-card">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Product"
                  className="edit-preview-image"
                />
              ) : (
                <div className="edit-preview-empty">
                  No image
                </div>
              )}

              <div className="edit-preview-details">
                <span className="edit-preview-category">
                  {form.category === "Other"
                    ? form.customCategory || "OTHER"
                    : form.category || "CATEGORY"}
                </span>

                <h3>
                  {form.title || "Your listing title"}
                </h3>

                <div className="edit-preview-bottom">
                  <strong>
                    {form.listingType === "Free / Donate"
                      ? "FREE"
                      : `$${Number(form.price || 0).toFixed(2)}`}
                  </strong>
                  <span className="edit-available">
                    Available
                  </span>
                </div>
              </div>
            </div>

            <div className="edit-campus-notice">
              <ShieldCheck size={20} />
              <div>
                <strong>Meet on campus</strong>
                <p>
                  Choose a public pickup spot and confirm
                  the details in Messages.
                </p>
              </div>
            </div>

            <div className="edit-tip">
              <h4>Editing your listing</h4>
              <p>
                Your changes will be saved to MongoDB
                when you click Save changes.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
