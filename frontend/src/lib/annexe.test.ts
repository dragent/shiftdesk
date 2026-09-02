import { describe, expect, it } from "vitest";
import { ANNEXE_ACCESS_JOBS, annexeJobLabel } from "./annexe";

describe("annexe job labels", () => {
  it("couvre les métiers opérationnels", () => {
    const roles = ANNEXE_ACCESS_JOBS.map((job) => job.role);
    expect(roles).toEqual([
      "ROLE_DIRECTEUR",
      "ROLE_DIRECTION",
      "ROLE_HOTE",
      "ROLE_CAISSIER",
      "ROLE_LAD",
      "ROLE_RAYON",
      "ROLE_SECURITE",
    ]);
    expect(annexeJobLabel("ROLE_HOTE")).toBe("Hôte(sse) d'accueil");
    expect(annexeJobLabel("ROLE_INCONNU")).toBe("ROLE_INCONNU");
  });
});
