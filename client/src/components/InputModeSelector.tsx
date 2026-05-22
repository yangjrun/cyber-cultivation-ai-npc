import type { InputMode } from "../api/chatApi";

type InputModeSelectorProps = {
  value: InputMode;
  disabled?: boolean;
  onChange: (mode: InputMode) => void;
};

type ModeOption = {
  mode: InputMode;
  label: string;
  emoji: string;
  hint: string;
  active: string;
  idle: string;
};

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: "dialogue",
    label: "对话",
    emoji: "💬",
    hint: "正面对 NPC 说话",
    active: "border-cyan-300/80 bg-cyan-500/15 text-cyan-50",
    idle: "border-cyan-400/30 bg-cyan-500/5 text-cyan-100 hover:border-cyan-300/60 hover:bg-cyan-500/10"
  },
  {
    mode: "action",
    label: "动作",
    emoji: "🎬",
    hint: "执行动作 / 旁白，NPC 不接话",
    active: "border-rose-300/80 bg-rose-500/15 text-rose-50",
    idle: "border-rose-400/30 bg-rose-500/5 text-rose-100 hover:border-rose-300/60 hover:bg-rose-500/10"
  },
  {
    mode: "monologue",
    label: "心声",
    emoji: "🤔",
    hint: "自言自语，NPC 不接话（但可能被天道云听见）",
    active: "border-violet-300/80 bg-violet-500/15 text-violet-50",
    idle: "border-violet-400/30 bg-violet-500/5 text-violet-100 hover:border-violet-300/60 hover:bg-violet-500/10"
  }
];

export function InputModeSelector({ value, disabled, onChange }: InputModeSelectorProps) {
  return (
    <div role="radiogroup" aria-label="输入模式" className="flex flex-wrap gap-2">
      {MODE_OPTIONS.map((option) => {
        const isActive = option.mode === value;
        const classes = isActive ? option.active : option.idle;

        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${option.label}模式：${option.hint}`}
            title={option.hint}
            disabled={disabled}
            onClick={() => onChange(option.mode)}
            className={`rounded-full border px-3 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
          >
            <span className="mr-1">{option.emoji}</span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
