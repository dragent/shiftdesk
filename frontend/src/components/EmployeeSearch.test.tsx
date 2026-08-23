import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeSearch } from "./EmployeeSearch";
import type { User, UserRole } from "@/lib/types";

let nextId = 1;

function employee(
  lastName: string,
  firstName: string,
  role: UserRole,
  overrides: Partial<User> = {},
): User {
  return {
    id: nextId++,
    email: `${firstName}.${lastName}@test.local`.toLowerCase(),
    firstName,
    lastName,
    roles: [role],
    active: true,
    ...overrides,
  };
}

const TEAM = [
  employee("Durand", "Sophie", "ROLE_CAISSIER"),
  employee("Lefèvre", "Amélie", "ROLE_HOTE"),
  employee("Bernard", "Hugo", "ROLE_RAYON"),
  employee("Petit", "Marc", "ROLE_LAD", { active: false }),
];

/** The field is controlled: the test holds the state, like the page does. */
function Harness({ employees = TEAM, onChange }: { employees?: User[]; onChange?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <EmployeeSearch
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      employees={employees}
    />
  );
}

function suggestions() {
  return within(screen.getByRole("listbox")).getAllByRole("option");
}

describe("EmployeeSearch", () => {
  it("n'ouvre la liste qu'une fois le champ actif", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(suggestions()).toHaveLength(TEAM.length);
  });

  it("propose les employés triés par nom", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));

    expect(suggestions().map((option) => option.textContent)).toEqual([
      "Bernard HugoRayon",
      "Durand SophieCaisse",
      "Lefèvre AmélieAccueil",
      "Petit MarcLAD · licencié",
    ]);
  });

  it("filtre sans tenir compte des accents ni de la casse", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("combobox"), "amelie lefevre");

    expect(suggestions()).toHaveLength(1);
    expect(suggestions()[0]).toHaveTextContent("Lefèvre Amélie");
  });

  it("ferme la liste quand aucun employé ne correspond", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("combobox"), "zzz");

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navigue au clavier et sélectionne avec Entrée", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");

    expect(suggestions()[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", "employe-option-1");

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenLastCalledWith("Durand Sophie");
    expect(input).toHaveValue("Durand Sophie");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("boucle sur la dernière suggestion avec la flèche du haut", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowUp}");

    expect(suggestions()[TEAM.length - 1]).toHaveAttribute("aria-selected", "true");
  });

  it("sélectionne aussi à la souris", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Bernard Hugo/ }));

    expect(screen.getByRole("combobox")).toHaveValue("Bernard Hugo");
  });

  it("ferme la liste avec Échap sans vider le champ", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("combobox"), "sophie");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox")).toHaveValue("sophie");
  });

  it("efface la recherche et rend le focus au champ", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox");
    await user.type(input, "sophie");
    await user.click(screen.getByRole("button", { name: "Effacer la recherche" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Effacer la recherche" })).toBeNull();
  });

  it("limite la liste à huit suggestions", async () => {
    const user = userEvent.setup();
    const crowd = Array.from({ length: 12 }, (_, index) =>
      employee(`Nom${String(index).padStart(2, "0")}`, "Test", "ROLE_CAISSIER"),
    );
    render(<Harness employees={crowd} />);

    await user.click(screen.getByRole("combobox"));

    expect(suggestions()).toHaveLength(8);
  });
});
