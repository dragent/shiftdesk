"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fullName, matchesName, normalize, positionLabel, sortByName } from "@/lib/employees";
import type { User } from "@/lib/types";

const MAX_SUGGESTIONS = 8;

/**
 * Search field with a custom suggestion list: the native `<datalist>` is
 * rendered by the operating system and clashes with the rest of the
 * interface. Keyboard navigation (arrows, Enter, Escape) included.
 */
export function EmployeeSearch({
  value,
  onChange,
  employees,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  employees: User[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const term = normalize(value.trim());
    return sortByName(employees.filter((user) => matchesName(user, term))).slice(
      0,
      MAX_SUGGESTIONS,
    );
  }, [employees, value]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // The list shrinks as the user types: the highlighted index is clamped.
  const activeIndex = highlighted < matches.length ? highlighted : 0;

  // Keeps the current suggestion visible during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function select(user: User) {
    onChange(fullName(user));
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (matches.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((index) => (index + step + matches.length) % matches.length);
      return;
    }
    if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      select(matches[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
      </span>

      <input
        ref={inputRef}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls="employes-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[activeIndex] ? `employe-option-${matches[activeIndex].id}` : undefined
        }
        aria-label="Rechercher un employé par nom"
        placeholder="Rechercher un employé…"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-(--cf-radius-sm) border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cf-blue focus:outline-none"
      />

      {value && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => {
            onChange("");
            setHighlighted(0);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {open && matches.length > 0 && (
        <ul
          ref={listRef}
          id="employes-suggestions"
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-(--cf-radius-sm) border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.map((user, index) => (
            <li
              key={user.id}
              id={`employe-option-${user.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(user)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 ${
                index === activeIndex ? "bg-cf-blue-light" : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                {fullName(user)}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {user.active ? positionLabel(user) : `${positionLabel(user)} · licencié`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
