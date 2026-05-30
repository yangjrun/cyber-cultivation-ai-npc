import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMemories, type StoredMemory } from "../api/memoryApi";
import { getPersonality, resetPersonality, type PersonalityRecord } from "../api/personalityApi";
import { getNpcName, NPC_NAMES, useGameStore } from "../state/store";

const NPC_IDS = Object.keys(NPC_NAMES);

const COUNTER_LABEL: Record<string, string> = {
  threats: "威胁次数",
  completed_quests: "完成任务",
  failed_quests: "失败任务",
  gifts: "示好",
  reports: "被打小报告",
  refused_trades: "拒绝交易",
  successful_trades: "成功交易",
  queries: "询问/请求"
};

export function MemoryCrystalPage() {
  const sessionId = useGameStore((state) => state.sessionId);
  const activeNpcId = useGameStore((state) => state.activeNpcId);
  const [selectedNpc, setSelectedNpc] = useState<string>(activeNpcId || NPC_IDS[0]);
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [personality, setPersonality] = useState<PersonalityRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      listMemories(sessionId, selectedNpc, 20),
      getPersonality(sessionId, selectedNpc)
    ])
      .then(([mems, perso]) => {
        if (cancelled) return;
        setMemories(mems);
        setPersonality(perso);
      })
      .catch(() => {
        if (cancelled) return;
        setError("记忆水晶链路中断。");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, selectedNpc]);

  const handleReset = async () => {
    if (!sessionId) return;
    setLoading(true);

    try {
      const next = await resetPersonality(sessionId, selectedNpc);
      setPersonality(next);
    } catch {
      setError("演化重置失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="cultivation-panel cultivation-corner mx-auto max-w-3xl space-y-4 p-6">
      <header className="flex items-end justify-between border-b border-cyan-400/15 pb-3">
        <div>
          <h1 className="text-lg font-semibold text-cyan-50 cultivation-glow-text">记忆水晶</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-cyan-200/60">
            // memory_crystal · 显示 NPC 记得你的什么 + 人格演化
          </p>
        </div>
        <Link
          to="/play"
          className="rounded-md border border-cyan-300/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-100 transition hover:bg-cyan-500/10"
        >
          返回对话
        </Link>
      </header>

      {!sessionId ? (
        <p className="text-sm text-slate-400">尚未建立会话，无可查记忆。</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {NPC_IDS.map((npcId) => (
              <button
                key={npcId}
                type="button"
                onClick={() => setSelectedNpc(npcId)}
                aria-pressed={selectedNpc === npcId}
                className={
                  selectedNpc === npcId
                    ? "rounded-md border border-violet-300/70 bg-violet-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-violet-100"
                    : "rounded-md border border-slate-600/50 bg-slate-900/40 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300 transition hover:border-violet-300/60 hover:text-violet-100"
                }
              >
                {getNpcName(npcId)}
              </button>
            ))}
          </div>

          {error ? (
            <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-xs text-slate-400">链路传输中...</p>
          ) : null}

          <section className="space-y-2">
            <header className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-violet-300">
              <span>人格演化</span>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-md border border-rose-300/50 px-2 py-0.5 text-[10px] text-rose-100 transition hover:bg-rose-500/10"
              >
                重置该 NPC 演化
              </button>
            </header>

            {personality && personality.evolvedTraits.length > 0 ? (
              <ul className="space-y-1 text-sm text-slate-100">
                {personality.evolvedTraits.map((trait) => (
                  <li key={trait} className="rounded-md border border-violet-400/30 bg-violet-500/5 p-2">
                    {trait}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">尚未触发任何演化条件。</p>
            )}

            {personality && Object.keys(personality.counters).length > 0 ? (
              <dl className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 sm:grid-cols-3">
                {Object.entries(personality.counters).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-slate-700/50 bg-slate-900/40 px-2 py-1">
                    <dt className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
                      {COUNTER_LABEL[key] ?? key}
                    </dt>
                    <dd className="font-mono text-cyan-100">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>

          <section className="space-y-2">
            <header className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">最近记忆</header>
            {memories.length === 0 ? (
              <p className="text-xs text-slate-400">该 NPC 还没记下任何关于你的事。</p>
            ) : (
              <ul className="space-y-1">
                {memories.map((memory) => (
                  <li
                    key={memory.id}
                    className="rounded-md border border-cyan-400/20 bg-slate-950/60 p-2 text-sm text-slate-100"
                  >
                    <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      {memory.createdAt.slice(0, 16).replace("T", " ")}
                    </div>
                    <div className="mt-1">{memory.content}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
