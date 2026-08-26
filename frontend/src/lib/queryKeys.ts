export const queryKeys = {
  me: ["me"] as const,
  unreadNotes: ["direction-notes", "unread"] as const,
  employeesPage: ["employees-page"] as const,
  caissiersPage: ["caissiers-page"] as const,
  demandesPage: ["demandes-page"] as const,
  categories: ["categories"] as const,
  utilisateursPage: ["utilisateurs-page"] as const,
  pauses: (date: string) => ["pauses", date] as const,
  myPlanning: (from: string, to: string) => ["plannings", "mine", from, to] as const,
  directionPlanning: (from: string, to: string) => ["plannings", "direction", from, to] as const,
  planDeCaisse: (from: string, to: string) => ["plan-de-caisse", from, to] as const,
  insights: ["ai-insights"] as const,
  directionNotesOpen: (channel: string, limit: number) =>
    ["direction-notes", channel, "open", limit] as const,
  directionNotesClosed: (channel: string, limit: number) =>
    ["direction-notes", channel, "closed", limit] as const,
};
