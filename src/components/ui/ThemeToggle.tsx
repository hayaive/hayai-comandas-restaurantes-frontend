import { useTheme } from "@/lib/useTheme";
import { IconButton } from "./IconButton";
import type { IconButtonProps } from "./IconButton";
import { Moon, Sun } from "lucide-react";

export interface ThemeToggleProps {
  variant?: IconButtonProps["variant"];
}

export function ThemeToggle({ variant }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <IconButton
      variant={variant}
      icon={isDark ? <Sun size={17} /> : <Moon size={17} />}
      label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={toggleTheme}
    />
  );
}
