"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShoppingCart, Users } from "lucide-react";

type LowStockBatch = {
  batchNo?: string;
  currentStock?: number;
  medicine?: { name?: string };
  expiryMessage?: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
};

export default function PharmacyDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [servedTodayCount, setServedTodayCount] = useState(0);
  const [lowStock, setLowStock] = useState<LowStockBatch[]>([]);

  const load = useCallback(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    Promise.all([
      fetch(`/api/visits?date=${today}&status=served`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : data.visits ?? [];
          setServedTodayCount(list.length);
        })
        .catch(() => setServedTodayCount(0)),
      fetch("/api/stock/low?inventoryType=pharmacy", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => setLowStock(Array.isArray(data) ? data : []))
        .catch(() => setLowStock([])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pharmacy</h1>
        <p className="text-sm text-muted-foreground">
          Today&apos;s billing queue, stock alerts, and medicine billing for {format(new Date(), "dd MMM yyyy")}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Served visits today</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-2xl font-semibold">{servedTodayCount}</p>
            )}
            <p className="text-xs text-muted-foreground">Patients ready for medicine billing (served today).</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/pharmacy/billing">Open billing queue</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock / expiry alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {lowStock.slice(0, 5).map((b, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">{b.medicine?.name ?? "-"}</span>
                      {b.expiryMessage && (
                        <span className={`text-[10px] uppercase font-bold ${b.isExpired ? "text-red-500" : "text-amber-600"}`}>
                          {b.isExpired ? "EXPIRED" : `Expires in ${b.expiryMessage}`}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-800">Stock: {b.currentStock ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">{b.batchNo ?? "-"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!loading && lowStock.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {lowStock.length} batch{lowStock.length === 1 ? "" : "es"} need attention.
              </p>
            ) : null}
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/pharmacy/stock">View stock</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Medicine billing
          </CardTitle>
          <CardDescription>Open visits with prescriptions and record medicine sales.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/pharmacy/billing">Go to medicine billing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
