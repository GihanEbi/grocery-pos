import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Renders assistant copy with minimal `**bold**` markup and line breaks. No HTML injection. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <span className={cn("whitespace-pre-line", className)}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && "\n"}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
            part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
              <strong key={i} className="font-semibold text-foreground">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </span>
  );
}
