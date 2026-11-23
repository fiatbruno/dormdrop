import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "../Button/Button";
import ExchangeDialog from "../ExchangeDialog/ExchangeDialog";
import { pickupSchema } from "../../schemas/pickupSchema";
import "./PickupForm.css";

export default function PickupForm({ onClose, onSubmit }) {
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
    <ExchangeDialog
      title={sent ? "Proposal sent" : "Propose a pickup"}
      badge={sent ? "Done" : undefined}
      busy={isSubmitting}
      onClose={onClose}
    >
      {sent ? (
        <>
          <p>Your pickup proposal is now in the conversation.</p>
          <div className="exchange-dialog__actions exchange-dialog__actions--stacked">
            <Button type="button" className="exchange-primary" onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit(submit)} noValidate>
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
            <p className="exchange-error" role="alert">
              {serverError}
            </p>
          )}
          <div className="exchange-dialog__actions">
            <Button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="exchange-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send proposal"}
            </Button>
          </div>
        </form>
      )}
    </ExchangeDialog>
  );
}
