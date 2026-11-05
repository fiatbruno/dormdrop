import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { submitReport } from "../../api/reportsApi";
import "./ReportSubmission.css";

const categories = [
  ["SUSPECTED_SCAM", "Suspected scam"],
  ["INAPPROPRIATE_CONTENT", "Inappropriate content"],
  ["MISLEADING_INFORMATION", "Misleading information"],
  ["PROHIBITED_ITEM", "Prohibited item"],
  ["OTHER", "Other"],
];

export default function ReportSubmission({ id, onClose }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [retryAfter, setRetryAfter] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const idempotencyKey = useRef("");

  function updateField(update) {
    update();
    idempotencyKey.current = "";
    setStatus("idle");
    setMessage("");
    setRetryAfter("");
    setValidationMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "pending") return;
    setValidationMessage("");
    if (!category || !description.trim()) {
      setValidationMessage("Choose a category and describe your concern.");
      return;
    }

    setStatus("pending");
    setMessage("");
    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }

    try {
      await submitReport(
        id,
        { category, description: description.trim() },
        idempotencyKey.current,
      );
      setStatus("success");
      setMessage(
        "Your report was submitted. Reports are reviewed by staff and do not guarantee immediate removal of a listing.",
      );
    } catch (error) {
      const code = error.response?.status;
      if (code === 409) {
        setStatus("duplicate");
        setMessage(
          "You have already reported this listing. You can check its review status in your reports.",
        );
      } else if (code === 429) {
        setStatus("error");
        const headers = error.response?.headers;
        const retry =
          headers?.get?.("retry-after") ||
          headers?.["retry-after"] ||
          headers?.["Retry-After"];
        setRetryAfter(
          retry
            ? ` You can try again in ${retry} seconds.`
            : " Please wait before trying again.",
        );
        setMessage("The report limit has been reached.");
      } else {
        setStatus("error");
        setMessage("We couldn't submit your report. Please try again.");
      }
    }
  }

  return (
    <section
      className="report-form"
      id="listing-report-form"
      aria-labelledby="report-form-title"
    >
      <div className="report-form__heading">
        <h2 id="report-form-title">Report this listing</h2>
        <button type="button" onClick={onClose} aria-label="Close report form">
          Close
        </button>
      </div>
      <p className="report-form__notice">
        Reports are reviewed by staff. Submitting a report does not promise an
        immediate takedown.
      </p>
      {status === "success" ? (
        <div className="report-form__feedback" role="status">
          <p>{message}</p>
          <Link to="/my-reports">View your report status</Link>
        </div>
      ) : (
        <>
          {message && (
            <p
              className="report-form__feedback"
              role={status === "duplicate" ? "status" : "alert"}
            >
              {message}
              {retryAfter}
              {status === "duplicate" && (
                <>
                  {" "}
                  <Link to="/my-reports">View your report status</Link>
                </>
              )}
            </p>
          )}
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="report-category">Category</label>
            <select
              id="report-category"
              value={category}
              onChange={(event) =>
                updateField(() => setCategory(event.target.value))
              }
              disabled={status === "pending"}
              required
            >
              <option value="">Choose a reason</option>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label htmlFor="report-description">Reason for report</label>
            <textarea
              id="report-description"
              value={description}
              onChange={(event) =>
                updateField(() => setDescription(event.target.value))
              }
              maxLength={2000}
              rows={4}
              required
              disabled={status === "pending"}
            />
            <p className="report-form__hint">
              Keep your explanation factual. Do not include private information.
            </p>
            {validationMessage && (
              <p className="report-form__error" role="alert">
                {validationMessage}
              </p>
            )}
            <button type="submit" disabled={status === "pending"}>
              {status === "pending" ? "Submitting…" : "Submit report"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
