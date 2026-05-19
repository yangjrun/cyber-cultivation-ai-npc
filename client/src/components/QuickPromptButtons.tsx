type QuickPromptButtonsProps = {
  prompts: readonly string[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
};

export function QuickPromptButtons({ prompts, disabled, onSelect }: QuickPromptButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          aria-label={prompt}
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="group rounded-full border border-violet-400/30 bg-violet-500/5 px-3 py-1 text-xs text-violet-100 transition hover:border-cyan-300/60 hover:bg-cyan-500/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-violet-300/80 group-hover:text-cyan-300/80">»</span>{" "}
          {prompt}
        </button>
      ))}
    </div>
  );
}
