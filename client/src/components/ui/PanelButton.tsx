type PanelButtonVariant = "violet" | "cyan" | "amber" | "emerald" | "rose";

type PanelButtonProps = {
  variant: PanelButtonVariant;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  fullWidth?: boolean;
  className?: string;
};

const variantClasses: Record<PanelButtonVariant, string> = {
  violet: "border-violet-300/30 bg-violet-400/10 text-violet-100 hover:border-violet-200",
  cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 hover:border-cyan-200",
  amber: "border-amber-300/30 bg-amber-400/10 text-amber-100 hover:border-amber-200",
  emerald: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:border-emerald-200",
  rose: "border-rose-300/30 bg-rose-400/10 text-rose-100 hover:border-rose-200"
};

export function PanelButton({
  variant,
  children,
  disabled = false,
  onClick,
  fullWidth = false,
  className = ""
}: PanelButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
