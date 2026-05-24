import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RootsRadarChart } from "./RootsRadarChart";

const sampleRoots = { metal: 30, wood: 50, water: 70, fire: 20, earth: 40 };

describe("RootsRadarChart", () => {
  afterEach(() => cleanup());

  it("renders an accessible radar chart label", () => {
    render(<RootsRadarChart roots={sampleRoots} />);
    expect(screen.getByLabelText("五行灵根雷达图")).toBeTruthy();
  });

  it("renders all five elements with their Chinese label + value in the jsdom fallback", () => {
    // navigator.userAgent contains "jsdom" inside vitest's jsdom environment,
    // so the component renders its simplified grid fallback.
    render(<RootsRadarChart roots={sampleRoots} />);
    expect(screen.getByText("金30")).toBeTruthy();
    expect(screen.getByText("木50")).toBeTruthy();
    expect(screen.getByText("水70")).toBeTruthy();
    expect(screen.getByText("火20")).toBeTruthy();
    expect(screen.getByText("土40")).toBeTruthy();
  });

  it("renders zero values without crashing", () => {
    render(<RootsRadarChart roots={{ metal: 0, wood: 0, water: 0, fire: 0, earth: 0 }} />);
    expect(screen.getAllByText(/^[金木水火土]0$/)).toHaveLength(5);
  });
});
