import { z } from "zod";

const CURRENT_YEAR = 2026;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    passwordConfirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Passwords don't match",
    path: ["passwordConfirm"],
  });
export type RegisterFormData = z.infer<typeof registerSchema>;

// kidProfileSchema messages are translation KEYS (namespace onboarding.kid),
// resolved at render via next-intl — the onboarding form is the only consumer.
export const kidProfileSchema = z.object({
  avatar_id: z.string().min(1, "err_avatar"),
  nickname: z
    .string()
    .min(2, "err_nickname_min")
    .max(20, "err_nickname_max")
    // Unicode-aware: accept letters/numbers from ANY script (Persian, Arabic,
    // etc.) plus space, underscore and hyphen. The old /[a-zA-Z0-9]/ rejected
    // non-ASCII names like "کاوشگر".
    .regex(/^[\p{L}\p{N} _-]+$/u, "err_nickname_chars"),
  birth_year: z
    .number()
    .int()
    .min(CURRENT_YEAR - 20, "err_birth_max_age")
    .max(CURRENT_YEAR - 4, "err_birth_min_age"),
  parent_email: z.string().email("err_parent_email"),
  // A child never sets a password, so these four digits are how they sign back
  // in on another device — the same shape as the class PIN they may meet at
  // school. Optional in the schema because a parent adding a child can leave it
  // and set one later from their dashboard; the kid's own sign-up asks for it.
  login_pin: z.string().regex(/^\d{4}$/u, "err_pin").optional(),
});
export type KidProfileFormData = z.infer<typeof kidProfileSchema>;

/** The child's way back in: their parent's email, their name, their PIN. */
export const childLoginSchema = z.object({
  parent_email: z.string().email("err_parent_email"),
  nickname: z.string().min(1, "err_nickname_min"),
  pin: z.string().regex(/^\d{4}$/u, "err_pin"),
});
export type ChildLoginFormData = z.infer<typeof childLoginSchema>;

export const createClassSchema = z.object({
  name: z
    .string()
    .min(2, "Class name must be at least 2 characters")
    .max(80, "Class name must be 80 characters or less"),
});
export type CreateClassFormData = z.infer<typeof createClassSchema>;
