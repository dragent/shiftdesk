import { describe, expect, it, vi, beforeEach } from "vitest";
import { saveOwnContact, saveJobAndContract } from "./profile";
import { api, setToken } from "./api";
import type { User } from "./types";

vi.mock("./api", () => ({
  api: { patch: vi.fn() },
  setToken: vi.fn(),
}));

const USER: User = {
  id: 4,
  email: "lea.nouveau@carrefour.local",
  firstName: "Léa",
  lastName: "Martin",
  roles: ["ROLE_HOTE"],
  active: true,
  phone: "07 00 00 00 00",
};

describe("saveOwnContact", () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
    vi.mocked(setToken).mockReset();
  });

  it("enregistre les coordonnées et remplace le jeton si l'email change", async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...USER, token: "jwt-new" });

    const saved = await saveOwnContact({
      email: USER.email,
      phone: USER.phone ?? null,
    });

    expect(api.patch).toHaveBeenCalledWith("/api/me", {
      email: USER.email,
      phone: USER.phone,
    });
    expect(setToken).toHaveBeenCalledWith("jwt-new");
    expect(saved).toEqual(USER);
    expect(saved).not.toHaveProperty("token");
  });

  it("ne change pas le jeton si l'email reste le même", async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...USER });

    await saveOwnContact({ email: USER.email, phone: USER.phone ?? null });

    expect(setToken).not.toHaveBeenCalled();
  });
});

describe("saveJobAndContract", () => {
  it("met à jour le poste et le contrat via l'API utilisateurs", async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...USER, roles: ["ROLE_LAD"], contractMinutes: 1800 });

    await saveJobAndContract(4, { role: "LAD", contractMinutes: 1800 });

    expect(api.patch).toHaveBeenCalledWith("/api/users/4", {
      role: "LAD",
      contractMinutes: 1800,
    });
  });
});
