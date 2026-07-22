export function Card({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200/80 bg-white/95 p-5 shadow-sm shadow-slate-900/[0.03] backdrop-blur-sm">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const BADGE_COLORS: Record<string, string> = {
  // Statuts génériques
  NOUVELLE: "bg-blue-100 text-blue-700",
  EN_COURS: "bg-amber-100 text-amber-700",
  TRAITEE: "bg-emerald-100 text-emerald-700",
  ANNULEE: "bg-slate-200 text-slate-600",
  VUE: "bg-amber-100 text-amber-700",
  IGNOREE: "bg-slate-200 text-slate-600",
  // Sévérités IA
  INFO: "bg-sky-100 text-sky-700",
  ATTENTION: "bg-amber-100 text-amber-700",
  CRITIQUE: "bg-red-100 text-red-700",
  // Statuts planning
  PLANIFIE: "bg-blue-100 text-blue-700",
  CONFIRME: "bg-emerald-100 text-emerald-700",
  ANNULE: "bg-slate-200 text-slate-600",
};

export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const cls = (tone && BADGE_COLORS[tone]) || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--cf-blue)] text-white hover:bg-[var(--cf-blue-dark)] disabled:bg-[var(--cf-blue)]/40 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100",
    danger:
      "bg-[var(--cf-red)] text-white hover:bg-[var(--cf-red-dark)] disabled:bg-[var(--cf-red)]/40 shadow-sm",
  };

  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "success" }) {
  const cls =
    tone === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <div className={`rounded-md border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
