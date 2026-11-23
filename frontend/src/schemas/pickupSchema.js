import { z } from "zod";

export const campusNow = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
};

export const pickupSchema = z
  .object({
    location: z
      .string()
      .trim()
      .min(1, "Location is required")
      .max(200, "Location must be 200 characters or fewer"),
    pickupDate: z
      .string()
      .min(1, "Date is required")
      .pipe(z.iso.date("Enter a valid date")),
    pickupTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time"),
  })
  .refine(
    ({ pickupDate, pickupTime }) => `${pickupDate}T${pickupTime}` > campusNow(),
    {
      message: "Choose a future date and time (campus time).",
      path: ["pickupTime"],
    },
  );
