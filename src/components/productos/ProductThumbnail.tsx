import { Image } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface ProductThumbnailProps {
  imagenUrl?: string;
  alt: string;
  size?: "sm" | "md";
  className?: string;
}

/** Small product photo, or a placeholder icon when there is none — shared by the catalog table and the Mesero product picker. */
export function ProductThumbnail({ imagenUrl, alt, size = "sm", className }: ProductThumbnailProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface-hover text-fg-subtle",
        size === "md" ? "h-11 w-11" : "h-9 w-9",
        className,
      )}
    >
      {imagenUrl ? (
        <img src={imagenUrl} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Image size={size === "md" ? 18 : 16} weight="duotone" />
      )}
    </div>
  );
}
