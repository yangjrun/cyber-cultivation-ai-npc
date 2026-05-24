import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NpcProfilePanel } from "./NpcProfilePanel";

describe("NpcProfilePanel", () => {
  afterEach(() => cleanup());

  it("shows LLM ONLINE indicator in real mode (default)", () => {
    render(<NpcProfilePanel />);
    expect(screen.getByText("LLM ONLINE")).toBeTruthy();
    expect(screen.queryByText("MOCK MODE")).toBeNull();
  });

  it("shows MOCK MODE indicator when mode=mock", () => {
    render(<NpcProfilePanel mode="mock" />);
    expect(screen.getByText("MOCK MODE")).toBeTruthy();
    expect(screen.queryByText("LLM ONLINE")).toBeNull();
  });

  it("renders Baili portrait label + 4 personality tags + case file description", () => {
    render(<NpcProfilePanel />);
    expect(screen.getByLabelText("白璃立绘")).toBeTruthy();
    for (const tag of ["谨慎", "毒舌", "务实", "等价交换"]) {
      expect(screen.getByText(`#${tag}`)).toBeTruthy();
    }
    expect(screen.getByText(/她的丹炉接着旧城区的灵气废管/)).toBeTruthy();
  });
});
