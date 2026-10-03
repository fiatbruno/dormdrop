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

export const signupSchema = z
  .object({
    displayName: z.string().min(1, "Display name is required"),

    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .refine(
        (email) => email.toLowerCase().endsWith(".edu"),
        "Campus email must end with .edu",
      ),

    password: z.string().min(8, "Password must be at least 8 characters long"),

    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
