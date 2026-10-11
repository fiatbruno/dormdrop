import { useEffect, useRef, useState } from "react";
import { Upload, ShieldCheck, ChevronDown } from "lucide-react";
import api from "../../api/backendApi";
import Footer from "../../components/Footer/Footer";
import "./ListItem.css";

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

function Dropdown({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return;

    function closeOutside(event) {
      if (!container.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const buttons = menu.current?.querySelectorAll("button");
    const selected = options.indexOf(value);
    buttons?.[selected >= 0 ? selected : 0]?.focus();
  }, [open, options, value]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function selectOption(option) {
    onChange(option);
    setOpen(false);
    trigger.current?.focus();
  }

  function handleKeys(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }

    const buttons = Array.from(menu.current?.querySelectorAll("button") || []);

    const current = buttons.indexOf(document.activeElement);
    let next;

    if (event.key === "ArrowDown") next = (current + 1) % buttons.length;
    if (event.key === "ArrowUp") {
      next = (current - 1 + buttons.length) % buttons.length;
    }
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;

    if (next !== undefined && buttons.length) {
      event.preventDefault();
      buttons[next]?.focus();
    }
  }

  return (
    <div
      ref={container}
      className="field dropdown"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>

      <button
        ref={trigger}
        id={id}
        type="button"
        className="dropdown-button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          id={`${id}-value`}
          className={value ? "" : "dropdown-placeholder"}
        >
          {value || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={open ? "dropdown-arrow open" : "dropdown-arrow"}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          ref={menu}
          id={`${id}-options`}
          className="dropdown-menu"
          role="group"
          aria-labelledby={`${id}-label`}
          onKeyDown={handleKeys}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={value === option ? "selected" : ""}
              aria-pressed={value === option}
              onClick={() => selectOption(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ListItem() {
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [success, setSuccess] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  const fileInput = useRef(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (!photos.length) {
      setPhotoUrl("");
      return;
    }

    const url = URL.createObjectURL(photos[0]);
    setPhotoUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [photos]);

  // Restore saved text details when returning to this page.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dormdrop-listing-draft");
      if (!saved) return;

      const draft = JSON.parse(saved);

      if (!draft || typeof draft !== "object") return;

      const restored = { ...emptyForm };

      Object.keys(emptyForm).forEach((key) => {
        if (typeof draft[key] === "string") {
          restored[key] = draft[key];
        }
      });

      if (!categories.includes(restored.category)) restored.category = "";
      if (!pickupSpots.includes(restored.pickupLocation)) {
        restored.pickupLocation = "";
      }

      if (!["New", "Like new", "Good", "Fair"].includes(restored.condition)) {
        restored.condition = "";
      }

      if (
        !["For sale", "Free / Donate", "Trade"].includes(restored.listingType)
      ) {
        restored.listingType = "For sale";
      }

      setForm(restored);
    } catch {
      setError("Could not restore your saved draft.");
    }
  }, []);

  function setField(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setSuccess("");
  }

  function updateField(event) {
    setField(event.target.name, event.target.value);
  }

  function choosePhotos(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";

    if (!selected.length) return;

    if (photos.length + selected.length > 5) {
      setPhotoError("You can upload up to 5 photos.");
      return;
    }

    const invalid = selected.some(
      (photo) =>
        !["image/jpeg", "image/png"].includes(photo.type) ||
        photo.size === 0 ||
        photo.size > 5 * 1024 * 1024,
    );

    if (invalid) {
      setPhotoError("Choose JPG or PNG photos, up to 5 MB each.");
      return;
    }

    setPhotos((previous) => [...previous, ...selected]);
    setPhotoError("");
    setSuccess("");
  }

  function selectType(listingType) {
    setForm((previous) => ({
      ...previous,
      listingType,
      price: listingType === "Free / Donate" ? "0" : previous.price,
    }));
    setSuccess("");
  }

  function saveDraft() {
    try {
      localStorage.setItem("dormdrop-listing-draft", JSON.stringify(form));
      setError("");
      setSuccess(
        "Draft saved on this device. Select your photos again when you return.",
      );
    } catch {
      setError("Could not save your draft.");
    }
  }

  async function publishListing(event) {
    event.preventDefault();
    if (!form.description.trim()) {
      setDescriptionError("A description is required to list your item.");
      document.getElementById("description")?.focus();
      return;
    }

    setDescriptionError("");
    if (submitting.current) return;

    setError("");
    setSuccess("");

    if (!localStorage.getItem("token")) {
      setError("Please log in before publishing a listing.");
      return;
    }

    const category =
      form.category === "Other" ? form.customCategory.trim() : form.category;

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !categories.includes(form.category) ||
      !category ||
      !form.condition ||
      !pickupSpots.includes(form.pickupLocation)
    ) {
      setError(
        "Please complete all listing details, including category and pickup spot.",
      );
      return;
    }

    const price =
      form.listingType === "Free / Donate" ? "0" : form.price.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) > 999999.99) {
      setError("Enter a valid price with up to two decimal places.");
      return;
    }

    const data = new FormData();
    data.append("title", form.title.trim());
    data.append("description", form.description.trim());
    data.append("category", category);
    data.append("condition", form.condition);
    data.append("listingType", form.listingType);
    data.append("price", price);
    data.append("pickupLocation", form.pickupLocation);
    photos.forEach((photo) => data.append("images", photo));

    submitting.current = true;
    setLoading(true);

    try {
      await api.post("/listings", data, {
        headers: { "Content-Type": undefined },
      });

      setForm(emptyForm);
      setPhotos([]);
      setPhotoError("");
      setSuccess("Your listing has been published!");

      // A draft cleanup failure must not report publishing as failed.
      try {
        localStorage.removeItem("dormdrop-listing-draft");
      } catch {
        // Listing was already published successfully.
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.response?.data?.detail;

      if (status === 401) {
        setError("Please log in again to publish your listing.");
      } else if (status === 403) {
        setError(
          "Your account does not have permission to post. Check your email verification.",
        );
      } else if (status === 413) {
        setError("The upload is too large. Each photo must be under 5 MB.");
      } else {
        setError(
          typeof message === "string"
            ? message
            : "Could not publish your listing. Please try again.",
        );
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  const previewCategory =
    form.category === "Other" ? form.customCategory : form.category;

  const previewPrice =
    form.listingType === "Free / Donate"
      ? "Free"
      : form.listingType === "Trade"
        ? "Trade"
        : form.price && Number.isFinite(Number(form.price))
          ? `$${Number(form.price).toFixed(2)}`
          : "$0.00";

  return (
    <main className="listing-page">
      <div className="listing-container">
        <header className="listing-header">
          <h1>List a campus find</h1>
          <p>
            Add a few details, upload a photo, and share it with your campus.
          </p>
        </header>

        <div className="listing-layout">
          <form className="listing-form" onSubmit={publishListing} noValidate>
            <fieldset disabled={loading}>
              <h2>Photos</h2>

              <div className="photo-box">
                {photoUrl && (
                  <img
                    className="photo-thumb"
                    src={photoUrl}
                    alt="First selected photo"
                  />
                )}

                <div className="photo-details">
                  <button
                    type="button"
                    className="photo-button"
                    onClick={() => fileInput.current?.click()}
                    disabled={photos.length >= 5}
                  >
                    <span className="upload-icon">
                      <Upload size={18} aria-hidden="true" />
                    </span>
                    {photos.length ? "Add another photo" : "Upload a photo"}
                  </button>

                  <p>
                    {photos.length} of 5 photos added · JPG or PNG · Up to 5 MB
                    each
                  </p>

                  {photos.length > 0 && (
                    <button
                      type="button"
                      className="remove-photos"
                      onClick={() => {
                        setPhotos([]);
                        setPhotoError("");
                      }}
                    >
                      Remove photos
                    </button>
                  )}
                </div>

                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  hidden
                  onChange={choosePhotos}
                />
              </div>

              {photoError && (
                <p className="listing-error" role="alert">
                  {photoError}
                </p>
              )}

              <div className="field">
                <label htmlFor="title">Display name</label>
                <input
                  id="title"
                  name="title"
                  placeholder="Enter a name for your item"
                  value={form.title}
                  onChange={updateField}
                  maxLength={100}
                  required
                />
              </div>

              <div className="field-row">
                <Dropdown
                  id="category"
                  label="Category"
                  placeholder="Choose a category"
                  options={categories}
                  value={form.category}
                  onChange={(value) => setField("category", value)}
                  disabled={loading}
                />

                <div className="field">
                  <label htmlFor="condition">Condition</label>
                  <select
                    id="condition"
                    name="condition"
                    value={form.condition}
                    onChange={updateField}
                    required
                  >
                    <option value="New">New</option>
                    <option value="Like new">Used (Like new)</option>
                    <option value="Good">Used (Good)</option>
                    <option value="Fair">Used (Fair)</option>
                  </select>
                </div>
              </div>

              {form.category === "Other" && (
                <div className="field">
                  <label htmlFor="customCategory">Your category</label>
                  <input
                    id="customCategory"
                    name="customCategory"
                    placeholder="Enter the category"
                    value={form.customCategory}
                    onChange={updateField}
                    maxLength={60}
                    required
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="description">Description</label>

                <textarea
                  id="description"
                  name="description"
                  placeholder="Describe your item and what is included."
                  value={form.description}
                  onChange={(event) => {
                    updateField(event);
                    setDescriptionError("");
                  }}
                  maxLength={2000}
                  required
                  aria-invalid={Boolean(descriptionError)}
                  aria-describedby="description-help"
                />

                <p
                  id="description-help"
                  className={descriptionError ? "field-error" : "field-help"}
                  role={descriptionError ? "alert" : undefined}
                >
                  {descriptionError ||
                    "Tell buyers about condition, what’s included, and pickup details."}
                </p>
              </div>

              <div className="field">
                <span className="field-label" id="type-label">
                  Listing type
                </span>
                <div
                  className="type-buttons"
                  role="group"
                  aria-labelledby="type-label"
                >
                  {["For sale", "Free / Donate", "Trade"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={form.listingType === type ? "active" : ""}
                      aria-pressed={form.listingType === type}
                      onClick={() => selectType(type)}
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
                    placeholder="120.00"
                    value={form.price}
                    onChange={updateField}
                    disabled={form.listingType === "Free / Donate"}
                    required={form.listingType !== "Free / Donate"}
                  />
                </div>

                <Dropdown
                  id="pickupLocation"
                  label="Campus pickup spot"
                  placeholder="Choose a pickup spot"
                  options={pickupSpots}
                  value={form.pickupLocation}
                  onChange={(value) => setField("pickupLocation", value)}
                  disabled={loading}
                />
              </div>

              <div className="form-buttons">
                <button className="publish-button" type="submit">
                  {loading ? "Publishing..." : "Publish listing"}
                </button>
                <button
                  className="draft-button"
                  type="button"
                  onClick={saveDraft}
                >
                  Save draft
                </button>
              </div>
            </fieldset>

            {error && (
              <p className="listing-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="listing-success" role="status">
                {success}
              </p>
            )}
          </form>

          <aside className="listing-preview">
            <h2>Preview</h2>
            <p className="preview-help">
              This is how your listing will appear.
            </p>

            <article className="preview-card">
              {photoUrl ? (
                <img
                  className="preview-photo"
                  src={photoUrl}
                  alt="Your listing"
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
                  <span className="available">Available</span>
                </div>
              </div>
            </article>

            <details className="preview-more">
              <summary>Preview listing</summary>
              <p>{form.description || "Your description will appear here."}</p>
              <p>{form.condition || "Item condition"}</p>
              <p>{form.pickupLocation || "Campus pickup spot"}</p>
            </details>

            <div className="campus-note">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>Meet on campus</strong>
                <p>
                  Choose a public pickup spot and confirm the details in
                  Messages.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default ListItem;
