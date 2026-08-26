import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { usePageQuery } from "./usePageQuery";
import { renderWithQuery } from "@/test/query";
import { api } from "./api";

vi.mock("./api", () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));

function Probe() {
  const { data, loading, error } = usePageQuery({
    queryKey: ["probe"],
    queryFn: () => api.get<string>("/api/probe"),
  });
  if (loading) return <span>loading</span>;
  if (error) return <span>{error}</span>;
  return <span>{data}</span>;
}

describe("usePageQuery", () => {
  it("exposes fetched data after mount without a manual effect", async () => {
    vi.mocked(api.get).mockResolvedValue("ok");
    renderWithQuery(<Probe />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("ok")).toBeInTheDocument();
  });
});
