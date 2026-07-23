import Image from "next/image";

/**
 * Écran de chargement plein écran, utilisé pendant la résolution de
 * l'authentification (avant de savoir si l'utilisateur doit être redirigé
 * vers /login ou /dashboard).
 */
export function LoadingScreen({ label = "Chargement..." }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-16">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-4 border-(--cf-blue)/15" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-cf-blue border-r-cf-blue" />
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white p-2 shadow-md ring-1 ring-slate-100">
          <Image
            src="/carrefour-logo.png"
            alt="Carrefour"
            width={28}
            height={28}
            className="h-full w-full object-contain"
            priority
          />
        </span>
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}
