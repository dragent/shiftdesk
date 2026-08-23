/**
 * Client-side password strength helpers (mirrored by PasswordSecurityChecker
 * on the backend). The API remains the source of truth on submit.
 */

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordStrengthLevel = "empty" | "weak" | "medium" | "strong" | "very-strong";

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  /** 0–4 for the meter bar. */
  score: number;
  label: string;
  /** True when the password meets the policy accepted by the API. */
  isAcceptable: boolean;
  hints: string[];
}

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*+-=?";

function hasLower(value: string): boolean {
  return /[a-z]/.test(value);
}
function hasUpper(value: string): boolean {
  return /[A-Z]/.test(value);
}
function hasDigit(value: string): boolean {
  return /[0-9]/.test(value);
}
function hasSpecial(value: string): boolean {
  return /[^a-zA-Z0-9]/.test(value);
}

/**
 * Evaluates password strength for the UI meter. Acceptance matches the
 * backend policy (length + 4 character classes).
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      level: "empty",
      score: 0,
      label: "Saisissez ou générez un mot de passe",
      isAcceptable: false,
      hints: [],
    };
  }

  const hints: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    hints.push(`Au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }
  if (!hasLower(password)) hints.push("Une minuscule");
  if (!hasUpper(password)) hints.push("Une majuscule");
  if (!hasDigit(password)) hints.push("Un chiffre");
  if (!hasSpecial(password)) hints.push("Un caractère spécial (!@#$…)");

  const classes =
    Number(hasLower(password)) +
    Number(hasUpper(password)) +
    Number(hasDigit(password)) +
    Number(hasSpecial(password));

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 16) score += 1;
  if (classes >= 3) score += 1;
  if (classes === 4) score += 1;
  score = Math.min(4, score);

  const isAcceptable = hints.length === 0;
  if (!isAcceptable) {
    score = Math.min(score, 2);
  } else if (score < 3) {
    score = 3;
  }

  let level: PasswordStrengthLevel;
  let label: string;
  if (!isAcceptable) {
    if (score <= 1) {
      level = "weak";
      label = "Faible — renforcez votre mot de passe";
    } else {
      level = "medium";
      label = "Moyen — pas encore assez sécurisé";
    }
  } else if (password.length >= 16 && classes === 4) {
    level = "very-strong";
    label = "Très fort — excellent choix";
    score = 4;
  } else {
    level = "strong";
    label = "Fort — conforme à la politique de sécurité";
    score = Math.max(3, score);
  }

  return { level, score, label, isAcceptable, hints };
}

/**
 * Cryptographically random password that always satisfies the security policy.
 */
export function generateSecurePassword(length = 16): string {
  const size = Math.max(length, PASSWORD_MIN_LENGTH);
  const alphabet = LOWER + UPPER + DIGITS + SPECIAL;
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);

  // Guarantee each required class is present (overwrite distinct slots).
  const required = [
    LOWER[bytes[0] % LOWER.length],
    UPPER[bytes[1] % UPPER.length],
    DIGITS[bytes[2] % DIGITS.length],
    SPECIAL[bytes[3] % SPECIAL.length],
  ];
  for (let i = 0; i < required.length; i++) {
    chars[i] = required[i];
  }

  // Fisher–Yates shuffle with fresh entropy.
  const shuffle = new Uint8Array(chars.length);
  crypto.getRandomValues(shuffle);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
