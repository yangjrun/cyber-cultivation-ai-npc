import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickPromptButtons } from "./QuickPromptButtons";

const samplePrompts = ["我想买点丹药。", "我需要躲过监察院扫描的丹药。"] as const;

describe("QuickPromptButtons", () => {
  afterEach(() => cleanup());

  it("renders one button per prompt with aria-label set to the prompt", () => {
    render(<QuickPromptButtons prompts={samplePrompts} onSelect={() => {}} />);

    for (const prompt of samplePrompts) {
      expect(screen.getByRole("button", { name: prompt })).toBeTruthy();
    }
  });

  it("calls onSelect with the clicked prompt", async () => {
    const onSelect = vi.fn();
    render(<QuickPromptButtons prompts={samplePrompts} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: samplePrompts[1] }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(samplePrompts[1]);
  });

  it("disables every button when disabled=true", () => {
    render(<QuickPromptButtons prompts={samplePrompts} disabled={true} onSelect={() => {}} />);
    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("renders no buttons when prompts is empty", () => {
    render(<QuickPromptButtons prompts={[]} onSelect={() => {}} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
