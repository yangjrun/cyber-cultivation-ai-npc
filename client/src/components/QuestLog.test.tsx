import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuestLog } from "./QuestLog";
import { resetGameStoreForTests, useGameStore } from "../state/store";
import type { QuestProgress } from "../api/questApi";

const quest = (
  questId: string,
  status: QuestProgress["status"],
  title: string,
  description = ""
): QuestProgress => ({
  sessionId: "test-session",
  questId,
  status,
  progress: {},
  acceptedAt: null,
  completedAt: null,
  updatedAt: "2026-01-01T00:00:00Z",
  definition: {
    questId,
    title,
    description,
    giverNpcId: "baili",
    involvedNpcIds: ["baili"]
  }
});

describe("QuestLog", () => {
  beforeEach(() => {
    resetGameStoreForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows placeholder when there are no quests", () => {
    render(<QuestLog />);
    expect(screen.getByText("还没有任何任务记录。")).toBeTruthy();
    expect(screen.getByText(/active 0/)).toBeTruthy();
    expect(screen.getByText(/done 0/)).toBeTruthy();
  });

  it("renders accepted + in_progress quests in the active section header counts", () => {
    useGameStore.setState({
      quests: [
        quest("q1", "accepted", "偷监察密钥"),
        quest("q2", "in_progress", "潜入九龙下城"),
        quest("q3", "completed", "买灵脉丹")
      ]
    });

    render(<QuestLog />);
    expect(screen.getByText(/active 2/)).toBeTruthy();
    expect(screen.getByText(/done 1/)).toBeTruthy();
    expect(screen.getByText("偷监察密钥")).toBeTruthy();
    expect(screen.getByText("潜入九龙下城")).toBeTruthy();
    expect(screen.getByText("买灵脉丹")).toBeTruthy();
  });

  it("uses the right Chinese status label for each quest status", () => {
    useGameStore.setState({
      quests: [
        quest("q1", "accepted", "T1"),
        quest("q2", "in_progress", "T2"),
        quest("q3", "completed", "T3"),
        quest("q4", "failed", "T4")
      ]
    });

    render(<QuestLog />);
    expect(screen.getByText("已接")).toBeTruthy();
    expect(screen.getByText("进行中")).toBeTruthy();
    expect(screen.getByText("已完成")).toBeTruthy();
    expect(screen.getByText("失败")).toBeTruthy();
  });

  it("renders description text when provided", () => {
    useGameStore.setState({
      quests: [quest("q1", "accepted", "偷监察密钥", "从监察院巡视员身上偷一枚密钥。")]
    });

    render(<QuestLog />);
    expect(screen.getByText("从监察院巡视员身上偷一枚密钥。")).toBeTruthy();
  });
});
