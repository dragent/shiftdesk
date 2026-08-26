import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { useEffectLoad } from "./useEffectLoad";

describe("useEffectLoad", () => {
  it("invokes the loader after mount", async () => {
    const load = vi.fn(async () => undefined);

    function Probe() {
      useEffectLoad(load);
      return <span>ready</span>;
    }

    render(<Probe />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it("skips the loader while disabled, then runs when enabled", async () => {
    const load = vi.fn(async () => undefined);

    function Probe({ enabled }: { enabled: boolean }) {
      useEffectLoad(load, enabled);
      return <span>{enabled ? "on" : "off"}</span>;
    }

    const { rerender } = render(<Probe enabled={false} />);
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();

    rerender(<Probe enabled={true} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it("allows the loader to set state after mount", async () => {
    function Probe() {
      const [value, setValue] = useState("idle");
      const load = useCallback(async () => {
        setValue("loaded");
      }, []);
      useEffectLoad(load);
      return <span>{value}</span>;
    }

    const { findByText } = render(<Probe />);
    expect(await findByText("loaded")).toBeInTheDocument();
  });
});
