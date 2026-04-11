"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RichTextEditorHandle = {
  getHtml: () => string;
  getText: () => string;
  clear: () => void;
};

type Props = {
  placeholder?: string;
  disabled?: boolean;
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { placeholder = "Rédigez votre réponse…", disabled },
  ref
) {
  const elRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getHtml: () => elRef.current?.innerHTML?.trim() ?? "",
    getText: () => elRef.current?.innerText?.trim() ?? "",
    clear: () => {
      if (elRef.current) elRef.current.innerHTML = "";
    },
  }));

  const cmd = (command: string, value?: string) => {
    if (disabled) return;
    document.execCommand(command, false, value);
    elRef.current?.focus();
  };

  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-background", disabled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-px border-b border-border bg-muted/40 px-1.5 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-7 text-xs font-bold"
          disabled={disabled}
          onClick={() => cmd("bold")}
        >
          B
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-7 text-xs italic"
          disabled={disabled}
          onClick={() => cmd("italic")}
        >
          I
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-7 text-xs underline"
          disabled={disabled}
          onClick={() => cmd("underline")}
        >
          U
        </Button>
        <div className="mx-1 h-[18px] w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs"
          disabled={disabled}
          onClick={() => cmd("insertUnorderedList")}
        >
          ≡
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs"
          disabled={disabled}
          onClick={() => cmd("insertOrderedList")}
        >
          1.
        </Button>
        <div className="mx-1 h-[18px] w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs"
          disabled={disabled}
          onClick={() => {
            const url = prompt("URL du lien");
            if (url) cmd("createLink", url);
          }}
        >
          🔗
        </Button>
      </div>
      <div
        ref={elRef}
        className={cn(
          "min-h-[80px] max-h-[200px] overflow-y-auto px-2.5 py-2 text-xs leading-relaxed outline-none",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        )}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
      />
    </div>
  );
});
