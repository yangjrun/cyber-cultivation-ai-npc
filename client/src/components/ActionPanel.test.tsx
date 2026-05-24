import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActionPanel } from "./ActionPanel";

describe("ActionPanel", () => {
  afterEach(() => cleanup());

  it("shows placeholder text when no action has been triggered", () => {
    render(<ActionPanel actionResult="" intentType="none" />);
    expect(screen.getByText("暂无触发动作。")).toBeTruthy();
    expect(screen.getByText("intent:none")).toBeTruthy();
  });

  it("renders the actionResult text when provided", () => {
    render(<ActionPanel actionResult="白璃给你递过一个药瓶。" intentType="give_item" />);
    expect(screen.getByText("白璃给你递过一个药瓶。")).toBeTruthy();
    expect(screen.getByText("intent:give_item")).toBeTruthy();
  });

  it("falls back to 'none' label when intentType is empty string", () => {
    render(<ActionPanel actionResult="" intentType="" />);
    expect(screen.getByText("intent:none")).toBeTruthy();
  });
});
