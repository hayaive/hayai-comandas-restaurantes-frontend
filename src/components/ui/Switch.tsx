import { Switch as SwitchPrimitive } from "./primitives/switch";

export interface SwitchProps {
  checked: boolean;
  /** Fired on every toggle. Kept as a no-argument callback to match the
   *  existing call sites, which all flip a store boolean. */
  onChange: () => void;
  /** Accessible name. */
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Thin adapter over the shadcn/Radix switch so the two existing call sites
 * keep their `{ checked, onChange, label }` API.
 *
 * What Radix brings that the hand-rolled version did not: Space/Enter
 * activation, a real `role="switch"` with managed `aria-checked`, a hidden
 * form-participating input, and `data-state` driving the colour and the thumb
 * so no inline `style={{ transform }}` is recomputed on every render.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
  className,
}: SwitchProps) {
  return (
    <SwitchPrimitive
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={className}
    />
  );
}
