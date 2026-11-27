import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import Button from "../Button/Button";
import ExchangeDialog from "../ExchangeDialog/ExchangeDialog";
import { campusNow, pickupSchema } from "../../schemas/pickupSchema";
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
    defaultValues: { location: "", pickupDateTime: "", note: "" },
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
      title={sent ? "Proposal sent" : "Arrange pickup"}
      badge={sent ? "Done" : undefined}
      className={sent ? undefined : "pickup-dialog"}
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
          <Button type="button" className="pickup-dialog__close" aria-label="Close arrange pickup"
            onClick={onClose} disabled={isSubmitting}>
            <X size={20} aria-hidden="true" />
          </Button>
          <p className="pickup-dialog__intro">Choose a future pickup time in Central Time (Rock Island campus).</p>
          <p className="pickup-dialog__notice">
            A new proposal will become the latest arrangement and may require a new acceptance before receipt can be confirmed.
          </p>
          <fieldset disabled={isSubmitting}>
            <PickupField name="location" label="Meeting place" error={errors.location}>
              {(field) => <input {...field} placeholder="e.g. Olin Center entrance" maxLength={200} required {...register("location")} />}
            </PickupField>
            <PickupField name="pickupDateTime" label="Pickup date and time (Central Time)" error={errors.pickupDateTime}>
              {(field) => <input {...field} type="datetime-local" min={campusNow()} required {...register("pickupDateTime")} />}
            </PickupField>
            <PickupField name="note" label="Note (optional)" error={errors.note}>
              {(field) => <textarea {...field} rows={3} maxLength={500} placeholder="Any details about where to meet" {...register("note")} />}
            </PickupField>
          </fieldset>
          {serverError && (
            <p className="exchange-error" role="alert">
              {serverError}
            </p>
          )}
          <div className="pickup-dialog__actions">
            <Button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="exchange-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Propose pickup"}
            </Button>
          </div>
        </form>
      )}
    </ExchangeDialog>
  );
}

function PickupField({ name, label, error, children }) {
  const id = `pickup-${name}`;
  return (
    <div className="pickup-field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined })}
      {error && <p id={`${id}-error`} role="alert">{error.message}</p>}
    </div>
  );
}
