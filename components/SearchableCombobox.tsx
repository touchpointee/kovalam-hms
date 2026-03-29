"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  /** Extra text included when filtering (e.g. batch code, stock) */
  keywords?: string;
};

type SearchableComboboxProps = {
  options: SearchableComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

export function SearchableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches.",
  disabled,
  triggerClassName,
  contentClassName,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [options, q]);

  const empty = options.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || empty}
          className={cn(
            "h-9 w-full justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm hover:bg-background",
            !selected && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          "p-0",
          "w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,16rem)] max-w-[min(100vw-2rem,28rem)]",
          contentClassName
        )}
      >
        <div className="flex flex-col">
          <div className="border-b p-2">
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-[min(50vh,280px)] overflow-y-auto overscroll-contain p-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-2 pr-8 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    value === o.value && "bg-accent/70"
                  )}
                  onClick={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{o.label}</span>
                  {value === o.value ? (
                    <Check className="absolute right-2 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
