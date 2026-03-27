"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePharmacyBase } from "@/hooks/usePharmacyBase";
import { differenceInDays } from "date-fns";
import { ChevronRight, Package, Pill, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Medicine = {
  _id: string;
  name: string;
  genericName?: string;
  category?: string;
  manufacturer?: string;
  unit?: string;
};

type StockBatch = {
  _id: string;
  currentStock: number;
  minQuantity?: number;
  expiryDate?: string;
};

type MedicineSummary = {
  medicine: Medicine;
  totalStock: number;
  totalMinStock: number;
  batchCount: number;
  status: "in" | "low" | "out" | "empty";
  expiryStatus: "expired" | "soon" | "ok" | "none";
};

export default function PharmacyStockPage() {
  const router = useRouter();
  const pharmacyBase = usePharmacyBase();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batchesByMedicine, setBatchesByMedicine] = useState<Record<string, StockBatch[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const medicinesRes = await fetch("/api/medicines", { cache: "no-store" });
        const medicinesData = await medicinesRes.json();
        const rows = Array.isArray(medicinesData) ? (medicinesData as Medicine[]) : [];
        setMedicines(rows);

        const stockRows = await Promise.all(
          rows.map(async (medicine) => {
            const params = new URLSearchParams({ medicineId: medicine._id });
            const res = await fetch(`/api/stock?${params}`, { cache: "no-store" });
            const data = await res.json();
            return [medicine._id, Array.isArray(data) ? (data as StockBatch[]) : []] as const;
          })
        );

        setBatchesByMedicine(Object.fromEntries(stockRows));
      } catch {
        setMedicines([]);
        setBatchesByMedicine({});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summaries = useMemo<MedicineSummary[]>(() => {
    return medicines.map((medicine) => {
      const batches = batchesByMedicine[medicine._id] ?? [];
      const totalStock = batches.reduce((sum, batch) => sum + batch.currentStock, 0);
      const totalMinStock = batches.reduce((sum, batch) => sum + (batch.minQuantity ?? 10), 0);

      let status: MedicineSummary["status"] = "empty";
      if (batches.length > 0) {
        if (totalStock === 0) status = "out";
        else if (totalStock <= totalMinStock) status = "low";
        else status = "in";
      }

      const expiryDays = batches
        .map((batch) => batch.expiryDate)
        .filter(Boolean)
        .map((expiryDate) => differenceInDays(new Date(expiryDate as string), new Date()));

      let expiryStatus: MedicineSummary["expiryStatus"] = "none";
      if (expiryDays.length > 0) {
        if (expiryDays.some((days) => days < 0)) expiryStatus = "expired";
        else if (expiryDays.some((days) => days <= 30)) expiryStatus = "soon";
        else expiryStatus = "ok";
      }

      return {
        medicine,
        totalStock,
        totalMinStock,
        batchCount: batches.length,
        status,
        expiryStatus,
      };
    });
  }, [batchesByMedicine, medicines]);

  const filteredSummaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return summaries;

    return summaries.filter(({ medicine }) =>
      [medicine.name, medicine.genericName, medicine.category, medicine.manufacturer]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, summaries]);

  const totalMedicines = summaries.length;
  const medicinesInStock = summaries.filter((item) => item.status === "in").length;
  const medicinesLowStock = summaries.filter((item) => item.status === "low").length;
  const medicinesOutOfStock = summaries.filter((item) => item.status === "out" || item.status === "empty").length;

  const renderStatus = (status: MedicineSummary["status"]) => {
    if (status === "out") return <Badge className="bg-red-100 text-red-700">Out of Stock</Badge>;
    if (status === "low") return <Badge className="bg-amber-100 text-amber-700">Low Stock</Badge>;
    if (status === "in") return <Badge className="bg-emerald-100 text-emerald-700">In Stock</Badge>;
    return <Badge variant="secondary">No Batches</Badge>;
  };

  const renderExpiryStatus = (status: MedicineSummary["expiryStatus"]) => {
    if (status === "expired") return <Badge className="bg-red-100 text-red-700">Expired</Badge>;
    if (status === "soon") return <Badge className="bg-amber-100 text-amber-700">Expiring Soon</Badge>;
    if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-700">Valid</Badge>;
    return <Badge variant="secondary">No Expiry</Badge>;
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">Medicine Stock</h1>
            <p className="text-sm text-slate-500">Select a medicine to open its batches and stock transactions.</p>
          </div>
          <Button onClick={() => router.push(`${pharmacyBase}/medicines`)}>Manage Medicines</Button>
        </div>

        <div className="mt-5 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine, generic name, category, or manufacturer..."
            className="pl-9"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Total Medicines</p>
            <p className="text-3xl font-semibold text-slate-800">{totalMedicines}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">In Stock</p>
            <p className="text-3xl font-semibold text-slate-800">{medicinesInStock}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Low Stock</p>
            <p className="text-3xl font-semibold text-slate-800">{medicinesLowStock}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Out / No Batches</p>
            <p className="text-3xl font-semibold text-slate-800">{medicinesOutOfStock}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-100">
          {loading ? (
            <Skeleton className="h-64" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Batches</TableHead>
                  <TableHead>Total Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No medicines found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSummaries.map(({ medicine, batchCount, totalStock, status, expiryStatus }) => (
                    <TableRow
                      key={medicine._id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/pharmacy/stock/${medicine._id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4 text-rose-400" />
                          <div>
                            <p className="font-medium text-slate-800">{medicine.name}</p>
                            <p className="text-xs text-slate-500">{medicine.genericName || medicine.unit || "-"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{medicine.category ?? "-"}</TableCell>
                      <TableCell>{medicine.manufacturer || "-"}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <span>{batchCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>{totalStock}</TableCell>
                      <TableCell>{renderStatus(status)}</TableCell>
                      <TableCell>{renderExpiryStatus(expiryStatus)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-teal-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`${pharmacyBase}/stock/${medicine._id}`);
                          }}
                        >
                          Open Batches
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
