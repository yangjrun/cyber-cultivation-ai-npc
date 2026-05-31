import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatePanel } from "./StatePanel";

const calmState = { trust: 30, fear: 10, anger: 20, tianDaoAlert: 40 };

describe("StatePanel", () => {
  afterEach(() => cleanup());

  it("renders the four named stats (信任 / 恐惧 / 愤怒 / 天道警戒)", () => {
    render(<StatePanel state={calmState} />);
    expect(screen.getByText("信任")).toBeTruthy();
    expect(screen.getByText("恐惧")).toBeTruthy();
    expect(screen.getByText("愤怒")).toBeTruthy();
    expect(screen.getByText("天道警戒")).toBeTruthy();
  });

  it("hides both warnings when values are below threshold", () => {
    render(<StatePanel state={calmState} />);
    expect(screen.queryByText(/天道镜正在锁定/)).toBeNull();
    expect(screen.queryByText(/白璃可能拒绝交易或举报你/)).toBeNull();
  });

  it("shows tianDao warning when tianDaoAlert > 70", () => {
    render(<StatePanel state={{ ...calmState, tianDaoAlert: 80 }} />);
    expect(screen.getByText(/天道镜正在锁定/)).toBeTruthy();
    expect(screen.queryByText(/白璃可能拒绝交易/)).toBeNull();
  });

  it("shows anger warning when anger > 70", () => {
    render(<StatePanel state={{ ...calmState, anger: 90 }} />);
    expect(screen.getByText(/白璃可能拒绝交易或举报你/)).toBeTruthy();
    expect(screen.queryByText(/天道镜正在锁定/)).toBeNull();
  });

  it("shows both warnings simultaneously when both exceed threshold", () => {
    render(<StatePanel state={{ ...calmState, anger: 80, tianDaoAlert: 80 }} />);
    expect(screen.getByText(/天道镜正在锁定/)).toBeTruthy();
    expect(screen.getByText(/白璃可能拒绝交易或举报你/)).toBeTruthy();
  });
});
