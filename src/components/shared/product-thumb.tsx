import { cn } from "@/lib/utils";

/** Product image: an emoji illustration on a tinted tile, or an uploaded image. */
export function ProductThumb({ image, name, color, size = "md", className }: { image: string; name: string; color?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "size-8 text-base rounded-md", md: "size-10 text-xl rounded-lg", lg: "size-14 text-3xl rounded-xl", xl: "size-full text-5xl rounded-xl" };
  const isImg = image.startsWith("data:") || image.startsWith("http") || image.startsWith("/");
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none", sizes[size], className)}
      style={{ background: `color-mix(in oklch, ${color ?? "var(--primary)"} 14%, var(--card))` }}
      aria-hidden={!isImg}
    >
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="leading-none drop-shadow-sm">{image || "📦"}</span>
      )}
    </span>
  );
}
