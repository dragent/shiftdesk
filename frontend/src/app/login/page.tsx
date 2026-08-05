"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  // `useSearchParams` (utilisé pour détecter une redirection après expiration
  // de session) exige une frontière Suspense dans l'App Router.
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
  // Message affiché quand l'utilisateur est renvoyé ici après l'expiration
  // de sa session (cf. gestion globale du 401 dans `api.ts`) : sans ça, on
  // ne comprend pas pourquoi on se retrouve sur la connexion, ni pourquoi
  // l'action en cours (ex. sauvegarder un créneau de planning) a échoué.
  const [error, setError] = useState<string | null>(
    searchParams.get("expired") ? "Votre session a expiré. Veuillez vous reconnecter." : null,
  );
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
      if (err instanceof ApiError) {
        // Le backend renvoie "Invalid credentials." (en anglais) pour un
        // 401 : on l'affiche en français, cohérent avec le reste de l'UI.
        setError(err.status === 401 ? "Identifiants invalides." : err.message);
      } else {
        // Ex. le serveur est inaccessible (arrêté, réseau...) : `fetch` lève
        // une erreur générique qui n'a rien à voir avec des identifiants
        // erronés, il ne faut donc pas l'afficher comme telle.
        setError("Impossible de contacter le serveur. Réessayez dans quelques instants.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      {/* Formes décoratives de marque (bleu/rouge), purement visuelles */}
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
