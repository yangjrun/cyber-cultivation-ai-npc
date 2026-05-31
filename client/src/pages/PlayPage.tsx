import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { InputMode } from "../api/chatApi";
import { ActionPanel } from "../components/ActionPanel";
import { AlchemyModal } from "../components/AlchemyModal";
import { GatheringModal } from "../components/GatheringModal";
import { TradeModal } from "../components/TradeModal";
import { ArtifactPanel } from "../components/ArtifactPanel";
import { CultivationPanel } from "../components/CultivationPanel";
import { DialoguePanel } from "../components/DialoguePanel";
import { InputModeSelector } from "../components/InputModeSelector";
import { InventoryPanel } from "../components/InventoryPanel";
import { MemoryPanel } from "../components/MemoryPanel";
import { MilestonePanel } from "../components/MilestonePanel";
import { NpcListPanel } from "../components/NpcListPanel";
import { NpcProfilePanel } from "../components/NpcProfilePanel";
import { PlayerPanel } from "../components/PlayerPanel";
import { QuestLog } from "../components/QuestLog";
import { QuickPromptButtons } from "../components/QuickPromptButtons";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { SceneSwitcher } from "../components/SceneSwitcher";
import { StatePanel } from "../components/StatePanel";
import { SystemLogPanel } from "../components/SystemLogPanel";
import {
  getActiveMemories,
  getActiveMessages,
  getActiveNpcState,
  getNpcName,
  MAX_INPUT,
  useGameStore
} from "../state/store";

const quickPrompts = [
  "我想买点丹药。",
  "我需要躲过监察院望气的丹药。",
  "我怀疑苏鹤是卧底。",
  "让我过去。"
] as const;

export function PlayPage() {
  const { sceneId } = useParams<{ sceneId?: string }>();
  const navigate = useNavigate();

  const sessionId = useGameStore((state) => state.sessionId);
  const sessionLoading = useGameStore((state) => state.sessionLoading);
  const activeSceneId = useGameStore((state) => state.activeSceneId);
  const activeNpcId = useGameStore((state) => state.activeNpcId);
  const scenes = useGameStore((state) => state.scenes);
  const input = useGameStore((state) => state.input);
  const inputMode = useGameStore((state) => state.inputMode);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const lastActionResult = useGameStore((state) => state.lastActionResult);
  const lastIntent = useGameStore((state) => state.lastIntent);
  const lastIntentParams = useGameStore((state) => state.lastIntentParams);
  const inventory = useGameStore((state) => state.inventory);
  const systemLogs = useGameStore((state) => state.systemLogs);
  const messages = useGameStore(getActiveMessages);
  const memories = useGameStore(getActiveMemories);
  const npcState = useGameStore(getActiveNpcState);
  const setInput = useGameStore((state) => state.setInput);
  const setInputMode = useGameStore((state) => state.setInputMode);
  const selectQuickPrompt = useGameStore((state) => state.selectQuickPrompt);
  const sendMessage = useGameStore((state) => state.sendMessage);
  const resetDialogue = useGameStore((state) => state.resetDialogue);
  const switchScene = useGameStore((state) => state.switchScene);
  const openTradeModal = useGameStore((state) => state.openTradeModal);

  useEffect(() => {
    if (!sceneId || !sessionId || scenes.length === 0) {
      return;
    }

    const target = scenes.find((scene) => scene.sceneId === sceneId);

    if (!target) {
      navigate(`/play/scene/${activeSceneId}`, { replace: true });
      return;
    }

    if (target.sceneId !== activeSceneId) {
      void switchScene(target.sceneId);
    }
  }, [sceneId, sessionId, scenes, activeSceneId, switchScene, navigate]);

  useEffect(() => {
    if (!sceneId && sessionId && activeSceneId) {
      navigate(`/play/scene/${activeSceneId}`, { replace: true });
    }
  }, [sceneId, sessionId, activeSceneId, navigate]);

  useEffect(() => {
    document.title = `${getNpcName(activeNpcId)} · 九龙下城 · 以仙途`;
  }, [activeNpcId]);

  const inputLength = Array.from(input).length;
  const canSend = input.trim().length > 0 && !loading && !sessionLoading;
  const activeNpcName = getNpcName(activeNpcId);
  const offeredItemId = typeof lastIntentParams.itemId === "string" ? lastIntentParams.itemId : null;
  const offeredItemName = offeredItemId
    ? inventory.find((entry) => entry.itemId === offeredItemId)?.item?.name ?? offeredItemId
    : null;

  return (
    <>
      <div className="space-y-4">
        <SceneSwitcher />
        <SceneBackdrop />
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-1 lg:grid-cols-[280px_1fr_320px]">
        <div className="space-y-4">
          <NpcListPanel />
          <NpcProfilePanel mode="real" />
          <StatePanel state={npcState} />
        </div>

        <section className="flex flex-col gap-4">
          <DialoguePanel messages={messages} loading={loading || sessionLoading} />

          {lastIntent === "offer_trade" ? (
            <div
              data-testid="trade-banner"
              className="animate-flash rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-amber-100">
                  {offeredItemName
                    ? `${activeNpcName}想与你交易「${offeredItemName}」——可通过商店面板实时结算，或继续对话，成交后系统自动扣灵石。`
                    : `${activeNpcName}想要与你交易 — 可通过商店面板结算，或继续对话，成交后系统自动结算。`}
                </p>
                <button
                  type="button"
                  onClick={() => void openTradeModal(activeNpcId)}
                  className="shrink-0 rounded-md bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-950 shadow-[0_0_12px_-3px_rgba(251,191,36,0.5)] transition hover:from-amber-300 hover:to-rose-300"
                >
                  打开商店
                </button>
              </div>
            </div>
          ) : null}

          <div className="sticky bottom-0 z-10 cultivation-panel cultivation-panel--cyan cultivation-corner relative overflow-hidden p-4 bg-slate-950/95 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider text-cyan-300/85">
              <span>快捷输入</span>
              <span>共 {quickPrompts.length} 条</span>
            </div>
            <QuickPromptButtons
              prompts={quickPrompts}
              disabled={loading || sessionLoading}
              onSelect={selectQuickPrompt}
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-cyan-300/85">输入模式</span>
              <InputModeSelector
                value={inputMode}
                disabled={loading || sessionLoading}
                onChange={setInputMode}
              />
            </div>

            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-950/70 p-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={buildPlaceholder(inputMode, activeNpcName)}
                rows={2}
                maxLength={MAX_INPUT * 4}
                className="cultivation-scroll block w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="flex items-center justify-between border-t border-cyan-400/15 px-2 pt-2 text-xs">
                <span className="font-mono text-slate-400">
                  当前字数 <span className="text-cyan-200">{inputLength}</span> / {MAX_INPUT}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void resetDialogue()}
                    className="rounded-md border border-slate-600/60 px-3 py-1 text-xs text-slate-300 transition hover:border-rose-300/60 hover:text-rose-100"
                  >
                    重置 NPC
                  </button>
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => void sendMessage()}
                    className="rounded-md bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 shadow-[0_0_18px_-6px_rgba(34,211,238,0.7)] transition hover:from-cyan-300 hover:to-violet-300 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {loading || sessionLoading ? "灵识传输中..." : "发送"}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {error}
              </p>
            ) : null}
          </div>

          <p className="text-center text-xs uppercase tracking-wider text-slate-400">
            演示版本 · AI 生成对话与意图，状态由系统验证
          </p>
        </section>

        <aside className="space-y-4">
          <PlayerPanel />
          <CultivationPanel />
          <InventoryPanel />
          <QuestLog />
          <MilestonePanel />
          <ArtifactPanel />
          <MemoryPanel memories={memories} npcName={activeNpcName} />
          <ActionPanel actionResult={lastActionResult} intentType={lastIntent} />
          <SystemLogPanel logs={systemLogs} />
        </aside>
      </div>
      <AlchemyModal />
      <TradeModal />
      <GatheringModal />
    </>
  );
}

function buildPlaceholder(mode: InputMode, activeNpcName: string): string {
  if (mode === "action") {
    return "描述一个动作……（如：偷摸过去；Enter 发送）";
  }
  if (mode === "hybrid") {
    return `描述动作并对${activeNpcName}说话……（NPC 会回应；Enter 发送）`;
  }
  if (mode === "monologue") {
    return "心声闪过……（NPC 不会听见，但天道镜可能记下）";
  }
  return `向${activeNpcName}开口……（Enter 发送 / Shift+Enter 换行）`;
}
