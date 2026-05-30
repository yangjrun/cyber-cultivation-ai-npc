import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryPanel } from "./MemoryPanel";

describe("MemoryPanel", () => {
  afterEach(() => cleanup());

  it("shows placeholder when memories array is empty", () => {
    render(<MemoryPanel memories={[]} npcName="白璃" />);
    expect(screen.getByText("暂无可用记忆。")).toBeTruthy();
    expect(screen.getByText(/白璃的记忆/)).toBeTruthy();
  });

  it("renders each memory entry preserving order", () => {
    render(
      <MemoryPanel
        memories={["玩家威胁过白璃。", "玩家答应去偷监察密钥。", "玩家被天道镜锁定过灵压。"]}
        npcName="白璃"
      />
    );

    expect(screen.getByText("玩家威胁过白璃。")).toBeTruthy();
    expect(screen.getByText("玩家答应去偷监察密钥。")).toBeTruthy();
    expect(screen.getByText("玩家被天道镜锁定过灵压。")).toBeTruthy();
  });

  it("uses the npcName in the section title", () => {
    render(<MemoryPanel memories={["一条记忆"]} npcName="苏鹤" />);
    expect(screen.getByRole("heading", { name: "苏鹤的记忆" })).toBeTruthy();
  });

  it("uses index in the key so duplicate memory strings still render", () => {
    const { container } = render(
      <MemoryPanel memories={["重复内容", "重复内容", "重复内容"]} npcName="赤目" />
    );
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });
});
