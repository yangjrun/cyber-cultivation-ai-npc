import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SystemLogPanel, type SystemLog } from "./SystemLogPanel";

const log = (id: string, time: string, text: string): SystemLog => ({ id, time, text });

describe("SystemLogPanel", () => {
  afterEach(() => cleanup());

  it("shows placeholder text when logs are empty", () => {
    render(<SystemLogPanel logs={[]} />);
    expect(screen.getByText("暂无日志。")).toBeTruthy();
  });

  it("renders each log entry with bracketed time and text", () => {
    render(
      <SystemLogPanel
        logs={[
          log("a", "12:00", "玩家发送灵识讯息。"),
          log("b", "12:01", "intent=respond_question 已校验。")
        ]}
      />
    );

    expect(screen.getByText("[12:00]")).toBeTruthy();
    expect(screen.getByText("[12:01]")).toBeTruthy();
    expect(screen.getByText("玩家发送灵识讯息。")).toBeTruthy();
    expect(screen.getByText("intent=respond_question 已校验。")).toBeTruthy();
  });

  it("renders entries in the order given (no auto-sort)", () => {
    const { container } = render(
      <SystemLogPanel
        logs={[
          log("a", "12:00", "first"),
          log("b", "12:01", "second"),
          log("c", "12:02", "third")
        ]}
      />
    );

    const items = Array.from(container.querySelectorAll("li"));
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain("12:00");
    expect(items[0]?.textContent).toContain("first");
    expect(items[1]?.textContent).toContain("12:01");
    expect(items[1]?.textContent).toContain("second");
    expect(items[2]?.textContent).toContain("12:02");
    expect(items[2]?.textContent).toContain("third");
  });
});
