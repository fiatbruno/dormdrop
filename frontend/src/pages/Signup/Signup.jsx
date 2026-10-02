import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { signupSchema } from "../schemas/signupSchema";
import { registerUser } from "../services/authApi";

export default function SignUpPage() {
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
  });

  async function onSubmit(data) {
    setServerError("");

    try {
      await registerUser({
        displayName: data.displayName,
        email: data.email,
        password: data.password,
      });

      setSuccess(true);
    } catch (error) {
      setServerError(error.message || "Something went wrong");
    }
  }

  if (success) {
    return (
      <div>
        <h1>Check your email</h1>
        <p>
          We sent you a verification link to activate your DormDrop account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="displayName">Display name</label>

        <input
          id="displayName"
          type="text"
          placeholder="Alex Morgan"
          {...register("displayName")}
        />

        {errors.displayName && <p>{errors.displayName.message}</p>}
      </div>

      <div>
        <label htmlFor="email">Campus email (.edu)</label>

        <input
          id="email"
          type="email"
          placeholder="you@college.edu"
          {...register("email")}
        />

        <small>We'll send a link to verify this email.</small>

        {errors.email && <p>{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="password">Password</label>

        <input id="password" type="password" {...register("password")} />

        <small>Use at least 12 characters.</small>

        {errors.password && <p>{errors.password.message}</p>}
      </div>

      <div>
        <label htmlFor="confirmPassword">Confirm password</label>

        <input
          id="confirmPassword"
          type="password"
          {...register("confirmPassword")}
        />

        {errors.confirmPassword && <p>{errors.confirmPassword.message}</p>}
      </div>

      {serverError && <p role="alert">{serverError}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
