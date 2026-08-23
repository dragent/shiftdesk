"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Alert, Button } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { api, ApiError } from "@/lib/api";
import {
  evaluatePasswordStrength,
  generateSecurePassword,
  PASSWORD_MIN_LENGTH,
  type PasswordStrengthLevel,
} from "@/lib/passwordSecurity";
import type { User } from "@/lib/types";

const STRENGTH_BAR: Record<PasswordStrengthLevel, string> = {
  empty: "bg-slate-200",
  weak: "bg-red-500",
  medium: "bg-amber-500",
  strong: "bg-emerald-500",
  "very-strong": "bg-[var(--cf-blue)]",
};

/**
 * First-login screen after recruitment: the temporary password from the
 * welcome email must be replaced before the rest of the app opens.
 */
export default function ChangePasswordPage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const strength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.mustChangePassword) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  function handleGenerate() {
    const generated = generateSecurePassword(16);
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!strength.isAcceptable) {
      setError(
        strength.hints.length > 0
          ? `Mot de passe insuffisant : ${strength.hints.join(", ").toLowerCase()}.`
          : "Le mot de passe n'est pas assez sécurisé.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.post<User>("/api/me/password", {
        newPassword,
        confirmPassword,
      });
      await refreshUser(updated);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer le mot de passe. Réessayez.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !user.mustChangePassword) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-[var(--cf-blue)] opacity-25 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-[var(--cf-red)] opacity-20 blur-3xl" />
        <div className="bg-grid-overlay absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>

      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-white bg-white shadow-2xl shadow-blue-950/15">
        <div className="cf-brand-stripe h-2 w-full" />
        <div className="p-6">
          <div className="mb-6 flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white p-2 shadow-md ring-1 ring-slate-100">
              <Image
                src="/carrefour-logo.png"
                alt="Carrefour"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                priority
              />
            </span>
            <h1 className="text-lg font-semibold text-slate-800">Choisissez votre mot de passe</h1>
            <p className="text-center text-sm text-slate-500">
              Bonjour {user.firstName}, définissez un mot de passe personnel sécurisé (au moins{" "}
              {PASSWORD_MIN_LENGTH} caractères, majuscule, minuscule, chiffre et caractère spécial).
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">
                  Nouveau mot de passe
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-xs font-semibold text-[var(--cf-blue)] hover:underline"
                >
                  Générer un mot de passe sécurisé
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[var(--cf-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-blue)]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? "Masquer" : "Voir"}
                </button>
              </div>

              <div className="mt-2" aria-live="polite">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        strength.score >= step ? STRENGTH_BAR[strength.level] : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p
                  className={`mt-1.5 text-xs ${
                    strength.level === "weak"
                      ? "text-red-600"
                      : strength.level === "medium"
                        ? "text-amber-700"
                        : strength.level === "strong" || strength.level === "very-strong"
                          ? "text-emerald-700"
                          : "text-slate-500"
                  }`}
                >
                  {strength.label}
                  {strength.hints.length > 0 ? ` · Manque : ${strength.hints.join(", ").toLowerCase()}` : ""}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirmation</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[var(--cf-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-blue)]/20"
              />
            </div>
            {error && <Alert>{error}</Alert>}
            <Button
              type="submit"
              disabled={saving || !strength.isAcceptable}
              className="mt-2 w-full justify-center"
            >
              {saving ? "Enregistrement…" : "Enregistrer et continuer"}
            </Button>
          </form>

          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full text-center text-sm text-slate-500 underline hover:text-slate-700"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
