import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/lib/useTheme";
import { IconButton } from "./IconButton";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <IconButton
      icon={isDark ? <Sun size={17} weight="bold" /> : <Moon size={17} weight="bold" />}
      label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onClick={toggleTheme}
    />
  );
}
