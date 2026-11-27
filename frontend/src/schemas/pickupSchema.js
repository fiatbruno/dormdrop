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

export const pickupSchema = z.object({
  location: z.string().trim()
    .min(1, "Meeting place is required")
    .max(200, "Meeting place must be 200 characters or fewer"),
  pickupDateTime: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a pickup date and time")
    .pipe(z.iso.datetime({ local: true, precision: -1 }))
    .refine((value) => value > campusNow(), "Choose a future pickup time in Central Time."),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer"),
});
