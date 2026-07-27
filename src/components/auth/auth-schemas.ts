import { z } from "zod";

/**
 * Validation rules for every auth form, kept in one place so the schema and the
 * inferred form types can never drift apart.
 *
 * NOTE: the 8-character minimum is a placeholder. A real password policy is a
 * backend/security decision and belongs with the sprint that adds one — this is
 * deliberately not a complexity regex invented here.
 */
const MIN_PASSWORD_LENGTH = 8;

const email = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

const password = z
  .string()
  .min(1, "Password is required")
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`);

export const signInSchema = z.object({
  email,
  // Sign-in must not restate the length rule: an existing account may predate
  // any future policy change, and telling someone their saved password is
  // "too short" at the login screen is misleading.
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email,
    password,
    confirmPassword: z.string().min(1, "Confirm your password"),
    // Zod 4 takes `message` here; the v3 `errorMap` form silently falls back
    // to the default "expected true" text.
    terms: z.literal(true, { message: "Accept the terms to continue" }),
  })
  // Attached to confirmPassword so the message renders under that field
  // rather than floating at form level.
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
