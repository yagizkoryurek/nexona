/**
 * Validation rules for the auth forms, mirroring the web app's
 * `src/components/auth/auth-schemas.ts` rule-for-rule and message-for-message so
 * the two clients cannot drift into telling users different things.
 *
 * Written as plain functions rather than Zod schemas: `zod` is not a dependency
 * of the mobile project, and pulling one in for four field checks is not worth
 * it here. That is safe precisely because — as the web codebase already
 * documents — client validation is a convenience, not a trust boundary. Supabase
 * enforces the real password policy, and the /api/mobile/* routes re-validate
 * everything server-side.
 *
 * The 8-character minimum matches the web's placeholder policy. If a real
 * password policy is ever introduced, both files change together.
 */

const MIN_PASSWORD_LENGTH = 8;

/** Field name -> first error for that field. Absent key means the field is fine. */
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

/**
 * Same shape of check as the web's Zod `.email()`: a single @ with something
 * either side and a dotted domain. Deliberately not an RFC-complete pattern —
 * the authoritative check is Supabase accepting the address.
 */
function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateEmail(email: string): string | undefined {
  if (email.trim().length === 0) return 'Email is required';
  if (!isValidEmail(email.trim())) return 'Enter a valid email address';
  return undefined;
}

function validateNewPassword(password: string): string | undefined {
  if (password.length === 0) return 'Password is required';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return undefined;
}

function validateConfirmation(
  password: string,
  confirmPassword: string
): string | undefined {
  if (confirmPassword.length === 0) return 'Confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return undefined;
}

export type SignInField = 'email' | 'password';

export function validateSignIn(values: {
  email: string;
  password: string;
}): FieldErrors<SignInField> {
  const errors: FieldErrors<SignInField> = {};

  const email = validateEmail(values.email);
  if (email) errors.email = email;

  // Length is deliberately NOT restated here, matching the web: an existing
  // account may predate any policy change, and telling someone their saved
  // password is "too short" at the sign-in screen is misleading.
  if (values.password.length === 0) errors.password = 'Password is required';

  return errors;
}

export type SignUpField =
  | 'name'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'terms';

export function validateSignUp(values: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}): FieldErrors<SignUpField> {
  const errors: FieldErrors<SignUpField> = {};

  if (values.name.trim().length === 0) errors.name = 'Name is required';

  const email = validateEmail(values.email);
  if (email) errors.email = email;

  const password = validateNewPassword(values.password);
  if (password) errors.password = password;

  const confirmPassword = validateConfirmation(
    values.password,
    values.confirmPassword
  );
  if (confirmPassword) errors.confirmPassword = confirmPassword;

  if (!values.terms) errors.terms = 'Accept the terms to continue';

  return errors;
}

export type ForgotPasswordField = 'email';

export function validateForgotPassword(values: {
  email: string;
}): FieldErrors<ForgotPasswordField> {
  const errors: FieldErrors<ForgotPasswordField> = {};

  const email = validateEmail(values.email);
  if (email) errors.email = email;

  return errors;
}

export type ResetPasswordField = 'password' | 'confirmPassword';

export function validateResetPassword(values: {
  password: string;
  confirmPassword: string;
}): FieldErrors<ResetPasswordField> {
  const errors: FieldErrors<ResetPasswordField> = {};

  const password = validateNewPassword(values.password);
  if (password) errors.password = password;

  const confirmPassword = validateConfirmation(
    values.password,
    values.confirmPassword
  );
  if (confirmPassword) errors.confirmPassword = confirmPassword;

  return errors;
}

/** Supabase emails a 6-digit numeric token for both signup and recovery. */
export const OTP_LENGTH = 6;

export function validateOtp(token: string): string | undefined {
  const trimmed = token.trim();
  if (trimmed.length === 0) return 'Enter the code from your email';
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(trimmed)) {
    return `Enter the ${OTP_LENGTH}-digit code from your email`;
  }
  return undefined;
}

export function hasErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}
