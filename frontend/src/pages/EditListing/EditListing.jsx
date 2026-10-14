import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Upload, ShieldCheck } from "lucide-react";

import {
  getListingById,
  updateListing,
  uploadListingImage,
} from "../../api/marketplaceApi";
import ListingImage from "../../components/ListingImage";
import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import "../ListItem/ListItem.css";

const categories = [
  "Electronics",
  "Furniture",
  "Textbooks",
  "School Supplies",
  "Clothing",
  "Shoes",
  "Accessories",
  "Dorm Essentials",
  "Kitchen & Appliances",
  "Bikes & Scooters",
  "Sports & Fitness",
  "Gaming",
  "Musical Instruments",
  "Art & Craft Supplies",
  "Other",
];

const pickupSpots = [
  "Gerber Center / Main entrance",
  "Thomas Tredway Library / 2nd Floor Entrance",
  "Brew by the Slough / Lounge",
  "Olin Center / Main entrance",
  "The Quad / Viking Plaza",
  "Hanson Hall of Science / Main entrance",
  "Centennial Hall / Main entrance",
  "Bergendoff Hall / Main entrance",
  "Brunner Theatre Center / Main entrance",
  "Carver P.E. Center / Main entrance",
  "Denkmann Memorial Building / Main entrance",
  "Evald Hall / Main entrance",
  "Andreen Hall / Outside main entrance",
  "Erickson Residence Hall / Outside main entrance",
  "Westerlin Residence Hall / Outside main entrance",
];

const emptyForm = {
  title: "",
  category: "",
  customCategory: "",
  condition: "",
  description: "",
  listingType: "For sale",
  price: "",
  pickupLocation: "",
};

function Photo({ photo, className, alt }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!photo.file) return;
    const objectUrl = URL.createObjectURL(photo.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);
  return photo.file ? (
    <img src={url} className={className} alt={alt} />
  ) : (
    <ListingImage src={photo.url} className={className} alt={alt} />
  );
}

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const submitting = useRef(false);

  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [status, setStatus] = useState("AVAILABLE");

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setLoaded(false);
    setError("");
    setPhotoError("");
    setForm(emptyForm);
    setPhotos([]);

    getListingById(id)
      .then((data) => {
        if (controller.signal.aborted) return;
        const knownCategory = categories.includes(data.category);

        setForm({
          title: data.title || "",
          category: knownCategory ? data.category : "Other",
          customCategory: knownCategory ? "" : data.category || "",
          condition: data.condition || "",
          description: data.description || "",
          listingType: data.listingType || "For sale",
          price: String(data.price ?? ""),
          pickupLocation: data.pickupLocation || "",
        });

        setPhotos(data.image ? [{ key: "existing", url: data.image }] : []);
        setStatus(data.status || "AVAILABLE");
        setLoaded(true);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        setError(
          err.response?.data?.detail ||
            err.response?.data?.message ||
            "Could not load this listing. Check your login and try again.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function chooseType(listingType) {
    setForm((previous) => ({
      ...previous,
      listingType,
      price: listingType === "Free / Donate" ? "0" : previous.price,
    }));
  }

  function addPhotos(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";

    if (!selected.length) return;

    if (photos.length + selected.length > 1) {
      setPhotoError(
        "Replace the existing photo before adding a new one. One photo is supported.",
      );
      return;
    }

    const invalid = selected.some(
      (file) =>
        !["image/jpeg", "image/png"].includes(file.type) ||
        file.size === 0 ||
        file.size > 5 * 1024 * 1024,
    );

    if (invalid) {
      setPhotoError("Choose JPG or PNG photos, up to 5 MB each.");
      return;
    }

    setPhotos((previous) => [
      ...previous,
      ...selected.map((file) => ({
        key: crypto.randomUUID(),
        file,
      })),
    ]);

    setPhotoError("");
  }

  function removePhoto(key) {
    setPhotos((previous) => previous.filter((photo) => photo.key !== key));
    setPhotoError("");
  }

  async function saveChanges(event) {
    event.preventDefault();

    if (submitting.current || !loaded) return;
    setError("");

    if (!localStorage.getItem("token")) {
      setError("Please log in before saving changes.");
      return;
    }

    const category =
      form.category === "Other" ? form.customCategory.trim() : form.category;

    const price =
      form.listingType === "Free / Donate" ? "0" : form.price.trim();

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !category ||
      !form.condition ||
      !form.pickupLocation.trim()
    ) {
      setError("Please complete all listing details.");
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) > 999999.99) {
      setError("Enter a valid price with up to two decimal places.");
      return;
    }

    if (photos.length === 0) {
      setPhotoError(
        "Please add a photo before saving. To replace a photo, remove it and select a new one.",
      );
      return;
    }
    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      category,
      condition: form.condition,
      listingType: form.listingType,
      price,
      pickupLocation: form.pickupLocation.trim(),
    };

    submitting.current = true;
    setSaving(true);

    try {
      await updateListing(id, data);
      if (photos[0]?.file) {
        try {
          await uploadListingImage(id, photos[0].file);
        } catch {
          setError(
            "Your listing details were saved, but the photo upload failed. Save again to retry the photo upload.",
          );
          return;
        }
      }

      navigate("/profile#my-listings");
    } catch (err) {
      const responseStatus = err.response?.status;

      const messages = {
        401: "Please log in again to save your changes.",
        403: "You do not have permission to edit this listing.",
        404: "This listing could not be found.",
        409: "This listing changed elsewhere. Reload before saving.",
        413: "The upload is too large. Each photo must be under 5 MB.",
      };

      setError(
        messages[responseStatus] ||
          err.response?.data?.detail ||
          err.response?.data?.message ||
          "Could not save your changes. Please try again.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const previewCategory =
    form.category === "Other" ? form.customCategory : form.category;

  const previewPrice =
    form.listingType === "Free / Donate"
      ? "Free"
      : form.listingType === "Trade"
        ? "Trade"
        : `$${Number(form.price || 0).toFixed(2)}`;

  const pickupOptions =
    form.pickupLocation && !pickupSpots.includes(form.pickupLocation)
      ? [form.pickupLocation, ...pickupSpots]
      : pickupSpots;

  return (
    <main className="listing-page">
      <Navbar showSearch={false} />

      <div className="listing-container">
        <header className="listing-header">
          <h1>Edit your listing</h1>
          <p>Update the details, photos, and information for your listing.</p>
        </header>

        {loading && <p role="status">Loading your listing…</p>}
        {error && (
          <p className="listing-error" role="alert">
            {error}
          </p>
        )}

        {loaded && (
          <div className="listing-layout">
            <form className="listing-form" onSubmit={saveChanges}>
              <fieldset disabled={saving}>
                <h2>Photos</h2>

                <div className="photo-box">
                  <div className="photo-thumbnails">
                    {photos.map((photo, index) => (
                      <div className="photo-entry" key={photo.key}>
                        <Photo
                          photo={photo}
                          className="photo-thumb"
                          alt={`Listing photo ${index + 1}`}
                        />

                        <button
                          type="button"
                          aria-label={`Remove photo ${index + 1}`}
                          onClick={() => removePhoto(photo.key)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="photo-details">
                    <button
                      type="button"
                      className="photo-button"
                      onClick={() => fileInput.current?.click()}
                      disabled={photos.length >= 1}
                    >
                      <span className="upload-icon">
                        <Upload size={18} aria-hidden="true" />
                      </span>
                      {photos.length ? "Add another photo" : "Upload a photo"}
                    </button>

                    <p>
                      {photos.length} of 1 photo added · JPG or PNG · Up to 5 MB
                      each
                    </p>
                  </div>

                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png"
                    hidden
                    onChange={addPhotos}
                  />
                </div>

                {photoError && (
                  <p className="listing-error" role="alert">
                    {photoError}
                  </p>
                )}

                <div className="field">
                  <label htmlFor="title">Listing title</label>
                  <input
                    id="title"
                    name="title"
                    value={form.title}
                    onChange={updateField}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="category">Category</label>
                    <select
                      id="category"
                      name="category"
                      value={form.category}
                      onChange={updateField}
                      required
                    >
                      <option value="">Choose a category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="condition">Condition</label>
                    <select
                      id="condition"
                      name="condition"
                      value={form.condition}
                      onChange={updateField}
                      required
                    >
                      <option value="">Choose a condition</option>
                      <option value="New">New</option>
                      <option value="Like new">Like new</option>
                      <option value="Good">Good condition</option>
                      <option value="Fair">Fair condition</option>
                    </select>
                  </div>
                </div>

                {form.category === "Other" && (
                  <div className="field">
                    <label htmlFor="customCategory">Your category</label>
                    <input
                      id="customCategory"
                      name="customCategory"
                      value={form.customCategory}
                      onChange={updateField}
                      maxLength={100}
                      required
                    />
                  </div>
                )}

                <div className="field">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    maxLength={2000}
                    aria-describedby="description-help"
                    required
                  />
                  <p className="field-help" id="description-help">
                    Tell buyers about condition, what’s included, and pickup
                    details.
                  </p>
                </div>

                <div className="field">
                  <span className="field-label" id="listing-type-label">
                    Listing type
                  </span>

                  <div
                    className="type-buttons"
                    role="group"
                    aria-labelledby="listing-type-label"
                  >
                    {["For sale", "Free / Donate", "Trade"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={form.listingType === type ? "active" : ""}
                        aria-pressed={form.listingType === type}
                        onClick={() => chooseType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="price">
                      {form.listingType === "Trade"
                        ? "Item value (USD)"
                        : "Price (USD)"}
                    </label>
                    <input
                      id="price"
                      name="price"
                      type="number"
                      min="0"
                      max="999999.99"
                      step="0.01"
                      value={form.price}
                      onChange={updateField}
                      disabled={form.listingType === "Free / Donate"}
                      required={form.listingType !== "Free / Donate"}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="pickupLocation">Campus pickup spot</label>
                    <select
                      id="pickupLocation"
                      name="pickupLocation"
                      value={form.pickupLocation}
                      onChange={updateField}
                      required
                    >
                      <option value="">Choose a pickup spot</option>
                      {pickupOptions.map((spot) => (
                        <option key={spot} value={spot}>
                          {spot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-buttons">
                  <button className="publish-button" type="submit">
                    {saving ? "Saving changes…" : "Save changes"}
                  </button>

                  <button
                    className="draft-button"
                    type="button"
                    onClick={() => navigate("/profile")}
                  >
                    Cancel
                  </button>
                </div>
              </fieldset>
            </form>

            <aside className="listing-preview">
              <h2>Preview</h2>
              <p className="preview-help">
                This is how your listing will appear.
              </p>

              <article className="preview-card">
                {photos.length ? (
                  <Photo
                    photo={photos[0]}
                    className="preview-photo"
                    alt={form.title || "Listing preview"}
                  />
                ) : (
                  <div className="preview-placeholder">
                    Your photo will appear here
                  </div>
                )}

                <div className="preview-details">
                  <span className="preview-category">
                    {previewCategory || "Category"}
                  </span>

                  <h3>{form.title || "Your item title"}</h3>

                  <div className="preview-bottom">
                    <strong>{previewPrice}</strong>
                    <span className="available">
                      {status === "SOLD" ? "Sold" : "Available"}
                    </span>
                  </div>
                </div>
              </article>

              <div className="campus-note">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>Need to update your pickup details?</strong>
                  <p>
                    Make sure your campus pickup spot and other details are
                    accurate so buyers can reach you.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}

        {!loading && !loaded && (
          <button
            className="draft-button"
            type="button"
            onClick={() => navigate("/profile")}
          >
            Back to profile
          </button>
        )}
      </div>

      <Footer />
    </main>
  );
}
