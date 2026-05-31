import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuestLog } from "./QuestLog";
import { resetGameStoreForTests, useGameStore } from "../state/store";
import type { QuestProgress } from "../api/questApi";

const quest = (
  questId: string,
  status: QuestProgress["status"],
  title: string,
  description = "",
  extra: Partial<QuestProgress> = {}
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
  },
  repeatable: false,
  nextAvailableAt: null,
  ...extra
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
    expect(screen.getByText(/进行中 0/)).toBeTruthy();
    expect(screen.getByText(/已完成 0/)).toBeTruthy();
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
    expect(screen.getByText(/进行中 2/)).toBeTruthy();
    expect(screen.getByText(/已完成 1/)).toBeTruthy();
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

  it("marks repeatable commission quests with a 委托 badge", () => {
    useGameStore.setState({
      quests: [quest("q1", "accepted", "送药跑腿", "送货。", { repeatable: true })]
    });

    render(<QuestLog />);
    expect(screen.getByText("委托")).toBeTruthy();
  });

  it("shows cooldown countdown for completed repeatable quests", () => {
    const futureTime = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    useGameStore.setState({
      quests: [
        quest("q1", "completed", "送药跑腿", "送货。", {
          repeatable: true,
          nextAvailableAt: futureTime
        })
      ]
    });

    render(<QuestLog />);
    expect(screen.getByText(/冷却中/)).toBeTruthy();
  });

  it("shows ready-to-accept when cooldown has elapsed", () => {
    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    useGameStore.setState({
      quests: [
        quest("q1", "completed", "送药跑腿", "送货。", {
          repeatable: true,
          nextAvailableAt: pastTime
        })
      ]
    });

    render(<QuestLog />);
    expect(screen.getByText("可再次接取")).toBeTruthy();
  });
});
