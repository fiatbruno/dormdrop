import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .refine(
      (email) => email.toLowerCase().endsWith(".edu"),
      "Campus email must end with .edu",
    ),
  password: z.string().min(1, "Password is required"),
});
