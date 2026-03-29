"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PaymentMethodOption = { _id: string; name: string; code?: string };

type Props = {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Called after options load; use to default `value` when still empty. */
  onOptionsLoaded?: (options: PaymentMethodOption[]) => void;
};

export function PaymentMethodSelect({
  id = "paymentMethodId",
  label = "Payment method",
  value,
  onValueChange,
  required,
  disabled,
  className,
  onOptionsLoaded,
}: Props) {
  const [options, setOptions] = useState<PaymentMethodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const onOptionsLoadedRef = useRef(onOptionsLoaded);
  onOptionsLoadedRef.current = onOptionsLoaded;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payment-methods?billing=1", { cache: "no-store" })
      .then((r) => r.json())
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

  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled || loading}>
        <SelectTrigger id={id} className="mt-1.5 w-full max-w-md">
          <SelectValue placeholder={loading ? "Loading…" : "Select payment method"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((m) => (
            <SelectItem key={m._id} value={m._id}>
              {m.name}
              {m.code ? ` · ${m.code}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!loading && options.length === 0 ? (
        <p className="mt-1 text-xs text-amber-700">
          No active payment methods. Add them under Payment methods (Admin or Front desk).
        </p>
      ) : null}
    </div>
  );
}
