"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BillingStaffOption = {
  _id: string;
  name: string;
  code?: string;
  label: string;
  isActive?: boolean;
};

export function getBillingStaffDisplayName(value?: string | null): string {
  return value?.trim().replace(/\s+\d{2,}$/, "") ?? "";
}

type Props = {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  onOptionsLoaded?: (options: BillingStaffOption[]) => void;
};

export function BillingStaffSelect({
  id = "generatedByName",
  label = "Staff",
  value,
  onValueChange,
  required,
  disabled,
  className,
  triggerClassName,
  onOptionsLoaded,
}: Props) {
  const [options, setOptions] = useState<BillingStaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeValue, setCodeValue] = useState("");
  const onOptionsLoadedRef = useRef(onOptionsLoaded);
  onOptionsLoadedRef.current = onOptionsLoaded;

  const selectedStaff = useMemo(
    () =>
      options.find((staff) => staff.name === value || staff.label === value) ??
      options.find((staff) => staff.code?.trim() === value.trim()),
    [options, value]
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing-staff?billing=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setOptions(data);
          onOptionsLoadedRef.current?.(data);
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedStaff?.code?.trim()) {
      setCodeValue(selectedStaff.code.trim());
      return;
    }
    if (!value?.trim()) {
      setCodeValue("");
    }
  }, [selectedStaff, value]);

  const hasUnmatchedCode = codeValue.trim().length > 0 && !selectedStaff;

  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        value={codeValue}
        onChange={(e) => {
          const nextCode = e.target.value.replace(/\s+/g, "");
          setCodeValue(nextCode);
          const matched = options.find((staff) => staff.code?.trim().toLowerCase() === nextCode.toLowerCase());
          if (matched) {
            onValueChange(matched.name);
          } else if (!nextCode) {
            onValueChange("");
          }
        }}
        disabled={disabled || loading}
        placeholder={loading ? "Loading..." : "Type staff code"}
        className={triggerClassName ?? "mt-1.5 w-full max-w-md"}
        autoComplete="off"
      />
      {selectedStaff ? (
        <p className="mt-1 text-xs text-emerald-700">
          Selected: {selectedStaff.name}
        </p>
      ) : null}
      {hasUnmatchedCode ? (
        <p className="mt-1 text-xs text-amber-700">
          No staff found for code `{codeValue}`.
        </p>
      ) : null}
      {!loading && options.length === 0 ? (
        <p className="mt-1 text-xs text-amber-700">
          No active billing staff. Add them in Admin → Billing staff.
        </p>
      ) : null}
    </div>
  );
}
