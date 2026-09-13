import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-[var(--radius-pill)] border p-0.5 transition-colors duration-150",
        checked ? "border-accent bg-accent" : "border-border-strong bg-surface-hover",
      )}
    >
      <span
        className="h-3.5 w-3.5 rounded-full bg-surface shadow-[var(--shadow-token-sm)] transition-transform duration-150"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}
