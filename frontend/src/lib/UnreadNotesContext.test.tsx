import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnreadNotesProvider, useUnreadNotes } from "@/lib/UnreadNotesContext";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: apiMock,
}));

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, firstName: "Alex", roles: ["ROLE_HOTE"] },
    hasRole: (...roles: string[]) => roles.includes("ROLE_HOTE"),
  }),
}));

function Probe() {
  const { unreadCount, refreshUnreadCount } = useUnreadNotes();
  return (
    <div>
      <span data-testid="count">{unreadCount}</span>
      <button type="button" onClick={() => void refreshUnreadCount()}>
        refresh
      </button>
    </div>
  );
}

describe("UnreadNotesProvider", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    document.title = "ShiftDesk";
  });

  afterEach(() => {
    document.title = "ShiftDesk";
  });

  it("sets the document title and announces unread count", async () => {
    apiMock.get.mockResolvedValue({ count: 3, latestCreatedAt: "2026-08-25T10:00:00+00:00" });

    await act(async () => {
      render(
        <UnreadNotesProvider>
          <Probe />
        </UnreadNotesProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("3");
    });
    expect(document.title).toBe("(3) ShiftDesk");
    expect(screen.getByText(/3 notes non lues/i)).toBeInTheDocument();
  });

  it("shows a toast when unread count increases", async () => {
    const user = userEvent.setup();
    apiMock.get
      .mockResolvedValueOnce({ count: 1, latestCreatedAt: "2026-08-25T10:00:00+00:00" })
      .mockResolvedValueOnce({ count: 2, latestCreatedAt: "2026-08-25T10:05:00+00:00" });

    render(
      <UnreadNotesProvider>
        <Probe />
      </UnreadNotesProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    await user.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("2");
      expect(screen.getByText(/nouvelle note de la direction/i)).toBeInTheDocument();
    });
  });
});
