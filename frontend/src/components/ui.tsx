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
    <section className="min-w-0 rounded-[var(--cf-radius)] border border-[var(--border)] bg-[var(--surface)]/95 p-4 shadow-[var(--cf-shadow-sm)] backdrop-blur-sm sm:p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>}
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
  const cls = (tone && BADGE_COLORS[tone]) || "bg-[var(--surface-muted)] text-[var(--muted)]";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${cls}`}>
      {children}
    </span>
  );
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const variantClass =
    variant === "secondary"
      ? "cf-btn--secondary"
      : variant === "danger"
        ? "cf-btn--danger"
        : variant === "success"
          ? "cf-btn--success"
          : variant === "ghost"
            ? "cf-btn--ghost"
            : "cf-btn--primary";
  const sizeClass = size === "sm" ? "cf-btn--sm" : size === "lg" ? "cf-btn--lg" : "";

  return (
    <button className={`cf-btn ${variantClass} ${sizeClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

/** Numéro de semaine ISO (lundi = début de semaine). */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Barre de navigation de semaine (style partagé) : Précédente / Semaine N + dates / Suivante,
 * avec actions optionnelles à droite (ex. « Caisse auto »).
 */
export function WeekNavigator({
  weekStart,
  onWeekChange,
  actions,
}: {
  weekStart: Date;
  onWeekChange: (next: Date) => void;
  actions?: React.ReactNode;
}) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekNum = isoWeekNumber(weekStart);

  function shift(days: number) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + days);
    onWeekChange(next);
  }

  return (
    <div className="cf-week">
      <div className="cf-week__nav">
        <button
          type="button"
          aria-label="Semaine précédente"
          className="cf-seg__btn shrink-0 px-3 sm:min-w-[9rem]"
          onClick={() => shift(-7)}
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">Précédente</span>
        </button>
        <div className="cf-week__label">
          <span className="cf-week__eyebrow">Semaine {weekNum}</span>
          <span className="cf-week__dates">
            {weekStart.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
            {" – "}
            {weekEnd.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>
        <button
          type="button"
          aria-label="Semaine suivante"
          className="cf-seg__btn shrink-0 px-3 sm:min-w-[9rem]"
          onClick={() => shift(7)}
        >
          <span className="hidden sm:inline">Suivante</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {actions && <div className="cf-week__actions">{actions}</div>}
    </div>
  );
}

/**
 * Champ de saisie d'heure au format français 24h ("07:30", "20:15"), qui
 * n'affiche jamais AM/PM. Contrairement à `<input type="time">`, dont le
 * rendu 12h/24h dépend des réglages régionaux du système d'exploitation
 * (et non de la langue de la page), ce champ masque la saisie en un simple
 * texte "HH:mm" pour garantir un format 24h quel que soit l'environnement
 * de l'utilisateur.
 *
 * `min`/`max` (au format "HH:mm") bornent la saisie à une amplitude donnée
 * (ex. la demi-journée matin/après-midi, ou les bornes d'un créneau) : une
 * fois l'heure complète saisie, elle est automatiquement ramenée à la borne
 * la plus proche plutôt que d'être simplement rejetée.
 */
export function TimeField({
  value,
  onChange,
  required,
  autoFocus,
  disabled,
  min,
  max,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    let next = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(next)) {
      if (min && next < min) next = min;
      if (max && next > max) next = max;
    }
    onChange(next);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      required={required}
      disabled={disabled}
      pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
      title={
        min && max
          ? `Heure au format 24h, entre ${min} et ${max}.`
          : "Heure au format 24h (ex. 07:30 ou 20:15), sans AM/PM."
      }
      placeholder="HH:mm"
      maxLength={5}
      value={value}
      onChange={handleChange}
      className={className}
    />
  );
}

export function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "success" }) {
  const cls =
    tone === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <div className={`rounded-[var(--cf-radius-sm)] border px-3 py-1.5 text-xs leading-snug ${cls}`}>
      {children}
    </div>
  );
}
