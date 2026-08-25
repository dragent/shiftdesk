import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectionNotesCard, formatNoteDate, truncateNote } from "./DirectionNotesCard";
import type { DirectionNote } from "@/lib/types";

const refreshUnreadCount = vi.fn(async () => undefined);

vi.mock("@/lib/UnreadNotesContext", () => ({
  useUnreadNotes: () => ({
    unreadCount: 0,
    refreshUnreadCount,
    toastMessage: null,
    dismissToast: () => undefined,
  }),
}));

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: apiMock,
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));

function note(overrides: Partial<DirectionNote> = {}): DirectionNote {
  return {
    id: 1,
    channel: "DIRECTION_ACCUEIL",
    body: "Message court",
    priority: "NORMAL",
    author: {
      id: 9,
      email: "direction@test.local",
      firstName: "Dir",
      lastName: "Ection",
      roles: ["ROLE_DIRECTION"],
      active: true,
    },
    createdAt: "2026-08-25T08:00:00+00:00",
    seenByMe: false,
    seenCount: 0,
    ...overrides,
  };
}

describe("truncateNote / formatNoteDate", () => {
  it("truncates long bodies", () => {
    const long = "a".repeat(250);
    expect(truncateNote(long).endsWith("…")).toBe(true);
    expect(truncateNote("court")).toBe("court");
  });

  it("formats french dates", () => {
    expect(formatNoteDate("not-a-date")).toBe("not-a-date");
    expect(formatNoteDate("2026-08-25T10:30:00+02:00")).toMatch(/25/);
  });
});

describe("DirectionNotesCard", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
    refreshUnreadCount.mockClear();
    apiMock.get.mockResolvedValue([note()]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists notes and confirms before closing", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    apiMock.patch.mockResolvedValue(note({ closedAt: "2026-08-25T09:00:00+00:00" }));
    apiMock.get
      .mockResolvedValueOnce([note()])
      .mockResolvedValueOnce([]);

    render(
      <DirectionNotesCard
        title="Accueil"
        channel="DIRECTION_ACCUEIL"
        canWrite
        canManage
        emptyLabel="vide"
      />,
    );

    expect(await screen.findByText("Message court")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clore/i }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiMock.patch).toHaveBeenCalledWith("/api/direction-notes/1/close", {});
    });
  });

  it("expands long notes", async () => {
    const user = userEvent.setup();
    const longBody = "L".repeat(240);
    apiMock.get.mockResolvedValue([note({ body: longBody })]);

    render(
      <DirectionNotesCard
        title="Accueil"
        channel="DIRECTION_ACCUEIL"
        canWrite={false}
        canManage={false}
        emptyLabel="vide"
      />,
    );

    expect(await screen.findByRole("button", { name: /lire la suite/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /lire la suite/i }));
    expect(screen.getByText(longBody)).toBeInTheDocument();
  });

  it("creates an urgent note", async () => {
    const user = userEvent.setup();
    apiMock.post.mockResolvedValue(note({ priority: "URGENT" }));
    apiMock.get.mockResolvedValueOnce([]).mockResolvedValueOnce([note({ priority: "URGENT" })]);

    render(
      <DirectionNotesCard
        title="Accueil"
        channel="DIRECTION_ACCUEIL"
        canWrite
        canManage
        emptyLabel="vide"
      />,
    );

    await screen.findByText("vide");
    await user.type(screen.getByPlaceholderText(/écrire une note/i), "Alerte stock");
    await user.click(screen.getByLabelText(/urgente/i));
    await user.click(screen.getByRole("button", { name: /ajouter la note/i }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith("/api/direction-notes", {
        channel: "DIRECTION_ACCUEIL",
        body: "Alerte stock",
        priority: "URGENT",
      });
    });
  });
});
