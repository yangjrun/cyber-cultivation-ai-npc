import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InputModeSelector } from "./InputModeSelector";

describe("InputModeSelector", () => {
  afterEach(() => cleanup());

  it("renders four radio buttons with the current value checked", () => {
    render(<InputModeSelector value="action" onChange={() => {}} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);

    const action = screen.getByRole("radio", { name: /^动作模式/ });
    const dialogue = screen.getByRole("radio", { name: /^对话模式/ });
    const hybrid = screen.getByRole("radio", { name: /^动作\+对话模式/ });
    const monologue = screen.getByRole("radio", { name: /^心声模式/ });

    expect(action.getAttribute("aria-checked")).toBe("true");
    expect(dialogue.getAttribute("aria-checked")).toBe("false");
    expect(hybrid.getAttribute("aria-checked")).toBe("false");
    expect(monologue.getAttribute("aria-checked")).toBe("false");
  });

  it("calls onChange with the selected mode when clicked", async () => {
    const onChange = vi.fn();
    render(<InputModeSelector value="dialogue" onChange={onChange} />);

    await userEvent.click(screen.getByRole("radio", { name: /^心声模式/ }));
    expect(onChange).toHaveBeenCalledWith("monologue");

    await userEvent.click(screen.getByRole("radio", { name: /^动作模式/ }));
    expect(onChange).toHaveBeenCalledWith("action");

    await userEvent.click(screen.getByRole("radio", { name: /^动作\+对话模式/ }));
    expect(onChange).toHaveBeenCalledWith("hybrid");
  });

  it("disables all buttons when disabled=true", () => {
    render(<InputModeSelector value="dialogue" disabled={true} onChange={() => {}} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("exposes a labelled radiogroup for accessibility", () => {
    render(<InputModeSelector value="dialogue" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "输入模式" });
    expect(group).toBeTruthy();
  });
});
