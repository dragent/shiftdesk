import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom implements no layout, hence no scrolling: the suggestion list of the
// employee search calls scrollIntoView on each keyboard move.
Element.prototype.scrollIntoView = vi.fn();

afterEach(cleanup);
