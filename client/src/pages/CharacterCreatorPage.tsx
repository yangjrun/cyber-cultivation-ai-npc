import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateSessionInput, ElementRoots, PlayerTraitId, RootElement } from "../api/sessionApi";
import { useGameStore } from "../state/store";

type TraitOption = {
  id: PlayerTraitId;
  name: string;
  description: string;
  preview: string[];
};

const TRAIT_OPTIONS: TraitOption[] = [
  {
    id: "yiti_arm",
    name: "右臂经脉",
    description: "右臂经脉曾被人接驳金石灵纹，能撕开符纸但被天道镜持续标记。",
    preview: ["右臂经脉", "金石灵纹残响"]
  },
  {
    id: "leifa_scar",
    name: "雷罚残痕",
    description: "未死透的雷罚在心脉上烧出了灼痕；筑基难，破境时易引来二次劫。",
    preview: ["雷罚残痕", "焚天体质"]
  },
  {
    id: "feifagen",
    name: "非法灵根",
    description: "灵根烙印被天道镜列为禁纹；普通灵气吸收效率低，但能用废管邪气。",
    preview: ["非法灵根烙印"]
  }
];

const DEFAULT_ROOTS: ElementRoots = {
  metal: 70,
  wood: 40,
  water: 12,
  fire: 8,
  earth: 16
};

const ROOT_LABELS: Record<RootElement, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土"
};

const MAX_NAME_LEN = 12;
const MAX_ROOT_TOTAL = 200;

export function CharacterCreatorPage() {
  const initializeSession = useGameStore((state) => state.initializeSession);
  const sessionLoading = useGameStore((state) => state.sessionLoading);
  const sessionId = useGameStore((state) => state.sessionId);
  const navigate = useNavigate();

  const [name, setName] = useState("陆玄");
  const [roots, setRoots] = useState<ElementRoots>({ ...DEFAULT_ROOTS });
  const [traitId, setTraitId] = useState<PlayerTraitId | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rootsTotal = useMemo(
    () => roots.metal + roots.wood + roots.water + roots.fire + roots.earth,
    [roots]
  );

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && Array.from(trimmedName).length <= MAX_NAME_LEN;
  const rootsValid = rootsTotal <= MAX_ROOT_TOTAL;
  const canSubmit = nameValid && rootsValid && !submitting && !sessionLoading && !sessionId;

  async function submit(input: CreateSessionInput) {
    setSubmitting(true);
    await initializeSession(input);
    setSubmitting(false);
    navigate("/play");
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    await submit({ name: trimmedName, roots, ...(traitId ? { traitId } : {}) });
  }

  async function handleQuickStart() {
    if (sessionLoading || submitting || sessionId) return;
    await submit({});
  }

  return (
    <section
      aria-labelledby="creator-heading"
      className="cultivation-panel cultivation-corner mx-auto max-w-3xl space-y-6 p-6"
    >
      <header className="flex items-start justify-between border-b border-cyan-400/15 pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/70">// avatar_init</div>
          <h1 id="creator-heading" className="mt-1 text-2xl font-semibold text-cyan-50 cultivation-glow-text">
            注入身份
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            天道镜尚未识别你的灵压——填好这张档案，然后进入九龙下城。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleQuickStart()}
          disabled={sessionLoading || submitting || Boolean(sessionId)}
          className="rounded-md border border-slate-500/40 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300 transition hover:border-cyan-300/60 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          用默认（陆玄）
        </button>
      </header>

      <section className="space-y-2">
        <label id="creator-name-label" htmlFor="creator-name" className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">
          道号 / 玩家名
        </label>
        <input
          id="creator-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={MAX_NAME_LEN * 3}
          placeholder="陆玄 / 夜辰 / 沈晚 / ..."
          className="block w-full rounded-md border border-cyan-400/30 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
        />
        <p className={`text-[11px] ${nameValid ? "text-slate-500" : "text-rose-300"}`}>
          {nameValid
            ? `${Array.from(trimmedName).length}/${MAX_NAME_LEN} 字符`
            : `名字需要 1-${MAX_NAME_LEN} 个字符`}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 id="creator-roots-label" className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">
            五行灵根（总和 ≤ {MAX_ROOT_TOTAL}）
          </h2>
          <span className={`font-mono text-xs ${rootsValid ? "text-cyan-200" : "text-rose-300"}`}>
            {rootsTotal} / {MAX_ROOT_TOTAL}
          </span>
        </div>
        <div className="space-y-2">
          {(Object.keys(ROOT_LABELS) as RootElement[]).map((element) => (
            <RootSlider
              key={element}
              element={element}
              value={roots[element]}
              onChange={(value) => setRoots((prev) => ({ ...prev, [element]: value }))}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 id="creator-trait-label" className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">
          起始特质（可选 · 不选则保留陆玄完整 3 项）
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {TRAIT_OPTIONS.map((option) => (
            <TraitCard
              key={option.id}
              option={option}
              selected={traitId === option.id}
              onToggle={() => setTraitId((prev) => (prev === option.id ? null : option.id))}
            />
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between border-t border-cyan-400/15 pt-4">
        <p className="text-[11px] text-slate-500">
          确认后会创建一个新存档（旧存档保留在记忆水晶页）。
        </p>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
          className="rounded-md bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-950 transition hover:from-cyan-300 hover:to-violet-300 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
        >
          {submitting || sessionLoading ? "注入中..." : "进入九龙下城"}
        </button>
      </div>
    </section>
  );
}

function RootSlider({
  element,
  value,
  onChange
}: {
  element: RootElement;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-6 text-center font-mono text-cyan-200">{ROOT_LABELS[element]}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={`${ROOT_LABELS[element]}灵根值`}
        onChange={(event) => onChange(Math.max(0, Math.min(100, Number(event.target.value))))}
        className="flex-1 accent-cyan-300"
      />
      <span className="w-10 text-right font-mono text-slate-200">{value}</span>
    </label>
  );
}

function TraitCard({
  option,
  selected,
  onToggle
}: {
  option: TraitOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={
        selected
          ? "rounded-lg border border-violet-300/70 bg-violet-500/15 p-3 text-left text-violet-50 shadow-[0_0_18px_-6px_rgba(139,92,246,0.6)]"
          : "rounded-lg border border-slate-600/40 bg-slate-900/40 p-3 text-left text-slate-200 transition hover:border-violet-300/40"
      }
    >
      <div className="text-sm font-semibold">{option.name}</div>
      <p className="mt-1 text-[11px] leading-5 text-slate-400">{option.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {option.preview.map((tag) => (
          <span key={tag} className="rounded-full border border-violet-300/30 bg-slate-950/50 px-2 py-0.5 text-[10px] text-violet-100">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
