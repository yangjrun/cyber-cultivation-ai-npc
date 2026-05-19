import type { NpcState } from "../api/chatApi";

type StatePanelProps = {
  state: NpcState;
};

const labels: Array<{ key: keyof NpcState; label: string }> = [
  { key: "trust", label: "trust" },
  { key: "fear", label: "fear" },
  { key: "anger", label: "anger" },
  { key: "tianDaoAlert", label: "tianDaoAlert" }
];

export function StatePanel({ state }: StatePanelProps) {
  return (
    <section className="rounded-2xl border border-cyan-400/25 bg-slate-950/75 p-4">
      <h2 className="mb-3 text-base font-semibold text-cyan-200">NPC 状态</h2>
      <div className="space-y-3">
        {labels.map(({ key, label }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
              <span>{label}</span>
              <span className="font-mono text-cyan-100">{state[key]}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-pink-400" style={{ width: `${state[key]}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
