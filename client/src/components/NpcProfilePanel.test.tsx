import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NpcProfilePanel } from "./NpcProfilePanel";

describe("NpcProfilePanel", () => {
  afterEach(() => cleanup());

  it("shows AI 在线 indicator in real mode (default)", () => {
    render(<NpcProfilePanel />);
    expect(screen.getByText("AI 在线")).toBeTruthy();
    expect(screen.queryByText("模拟模式")).toBeNull();
  });

  it("shows 模拟模式 indicator when mode=mock", () => {
    render(<NpcProfilePanel mode="mock" />);
    expect(screen.getByText("模拟模式")).toBeTruthy();
    expect(screen.queryByText("AI 在线")).toBeNull();
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
