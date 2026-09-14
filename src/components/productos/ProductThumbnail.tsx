import { cn } from "@/lib/cn";
import { ImageIcon } from "lucide-react";
import { resolveMediaUrl } from "@/api/mediaUrl";

export interface ProductThumbnailProps {
  imagenUrl?: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ICON_SIZE: Record<NonNullable<ProductThumbnailProps["size"]>, number> = {
  sm: 16,
  md: 18,
  lg: 28,
};

/** Small product photo, or a placeholder icon when there is none — shared by the catalog table, the Mesero product picker, and the upload preview in ProductFormModal. */
export function ProductThumbnail({ imagenUrl, alt, size = "sm", className }: ProductThumbnailProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface-hover text-fg-subtle",
        size === "lg" ? "size-20" : size === "md" ? "size-11" : "size-10",
        className,
      )}
    >
      {imagenUrl ? (
        <img src={resolveMediaUrl(imagenUrl)} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <ImageIcon size={ICON_SIZE[size]} />
      )}
    </div>
  );
}
