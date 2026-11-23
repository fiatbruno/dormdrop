import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "../Button/Button";
import { pickupSchema } from "../../schemas/pickupSchema";
import "./PickupForm.css";

export default function PickupForm({ onClose, onSubmit }) {
  const dialog = useRef(null);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(pickupSchema),
    defaultValues: { location: "", pickupDate: "", pickupTime: "" },
  });

  useEffect(() => {
    const previous = document.activeElement;
    const node = dialog.current;
    node.showModal();
    return () => {
      node.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);

  async function submit(data) {
    setServerError("");
    try {
      await onSubmit(data);
      setSent(true);
    } catch (error) {
      setServerError(
        error.response?.data?.message ||
          error.response?.data?.detail ||
          (error.response?.status === 400
            ? "Check the location and choose a future pickup time, then try again."
            : error.response?.status === 403
              ? "You no longer have access to this conversation."
              : error.response?.status === 404
                ? "This conversation could not be found."
                : null) ||
          "Could not confirm the proposal was sent. Check the conversation before trying again.",
      );
    }
  }

  return (
    <dialog
      ref={dialog}
      className="pickup-dialog"
      aria-labelledby="pickup-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!isSubmitting) onClose();
      }}
    >
      {sent ? (
        <div className="pickup-confirmation">
          <span>Done</span>
          <h2 id="pickup-dialog-title">Proposal sent</h2>
          <p>Your pickup proposal is now in the conversation.</p>
          <Button type="button" className="pickup-primary" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)} noValidate>
          <h2 id="pickup-dialog-title">Propose a pickup</h2>
          <p>
            Choose a public campus location, date, and time. Times are in campus
            time.
          </p>
          {[
            ["location", "Location", "text"],
            ["pickupDate", "Date", "date"],
            ["pickupTime", "Time", "time"],
          ].map(([name, label, type]) => (
            <div className="pickup-field" key={name}>
              <label htmlFor={`pickup-${name}`}>{label}</label>
              <input
                id={`pickup-${name}`}
                type={type}
                {...register(name)}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={
                  errors[name] ? `pickup-${name}-error` : undefined
                }
              />
              {errors[name] && (
                <p id={`pickup-${name}-error`} role="alert">
                  {errors[name].message}
                </p>
              )}
            </div>
          ))}
          {serverError && (
            <p className="pickup-error" role="alert">
              {serverError}
            </p>
          )}
          <div className="pickup-actions">
            <Button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="pickup-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send proposal"}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
