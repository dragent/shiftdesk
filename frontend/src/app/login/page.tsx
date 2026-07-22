"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Identifiants invalides.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      {/* Formes décoratives de marque (bleu/rouge), purement visuelles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--cf-blue)] opacity-[0.10] blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[var(--cf-red)] opacity-[0.08] blur-3xl" />
        <div className="bg-grid-overlay absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>

      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-white/60 bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
        <div className="cf-brand-stripe h-1.5 w-full" />
        <div className="p-6">
          <div className="mb-6 flex flex-col items-center gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--cf-blue)] to-[var(--cf-blue-dark)] text-xl font-bold text-white shadow-md">
              C
            </span>
            <h1 className="text-lg font-semibold text-slate-800">Carrefour Accueil</h1>
            <p className="text-center text-sm text-slate-500">
              Connectez-vous pour accéder à la gestion de l&apos;accueil.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[var(--cf-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-blue)]/20"
                placeholder="prenom.nom@carrefour-accueil.local"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[var(--cf-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--cf-blue)]/20"
                placeholder="••••••••"
              />
            </div>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" disabled={loading} className="mt-2 w-full justify-center">
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600">Comptes de démonstration :</p>
            <p>admin@carrefour-accueil.local</p>
            <p>direction@carrefour-accueil.local</p>
            <p>hote@carrefour-accueil.local</p>
            <p className="mt-1">Mot de passe : Password123!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
