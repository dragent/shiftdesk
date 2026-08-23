"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  // `useSearchParams` (used to detect a redirect after session expiry) requires
  // a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Message shown when the user is sent back here after their session expired
  // (see the global 401 handling in `api.ts`): without it, there is no way to
  // tell why the login page appeared, nor why the action in progress (e.g.
  // saving a schedule slot) failed.
  const [error, setError] = useState<string | null>(
    searchParams.get("expired") ? "Session expirée. Veuillez vous reconnecter." : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace(user.mustChangePassword ? "/changer-mot-de-passe" : "/dashboard");
    }
  }, [user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const me = await login(email, password);
      router.replace(me.mustChangePassword ? "/changer-mot-de-passe" : "/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        // The backend returns "Invalid credentials." (in English) for a 401:
        // display it in French, consistent with the rest of the UI.
        setError(err.status === 401 ? "Identifiants invalides." : err.message);
      } else {
        // E.g. the server is unreachable (stopped, network issue...): `fetch`
        // throws a generic error unrelated to invalid credentials, so it must
        // not be reported as such.
        setError("Impossible de contacter le serveur. Réessayez dans quelques instants.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      {/* Decorative brand shapes (blue/red), purely visual */}
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
            <h1 className="text-lg font-semibold text-slate-800">ShiftDesk</h1>
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
