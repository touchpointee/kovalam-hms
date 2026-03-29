"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type OPChargeSetting = { amount: number; updatedAt?: string; updatedBy?: { name: string } };

export default function AdminSettingsPage() {
  const [opCharge, setOpCharge] = useState<OPChargeSetting | null>(null);
  const [history, setHistory] = useState<OPChargeSetting[]>([]);
  const [newAmount, setNewAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    fetch("/api/settings/op-charge")
      .then((res) => res.json())
      .then((data) => {
        setOpCharge(data);
        setNewAmount(String(data?.amount ?? ""));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = () => {
    fetch("/api/settings/op-charge")
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : data.history ?? [data].filter(Boolean)))
      .catch(() => setHistory([]));
  };

  const updateCharge = async () => {
    const amt = Number(newAmount);
    if (isNaN(amt) || amt < 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/op-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setOpCharge(data);
      toast.success("OP charge updated");
      loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const backupAllData = async () => {
    setBackingUp(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Backup failed" }));
        throw new Error(data.message ?? "Backup failed");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") ?? "";
      const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const fileName = fileNameMatch?.[1] ?? `hms-backup-${new Date().toISOString()}.json`;
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Backup downloaded successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBackingUp(false);
    }
  };

  const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";
  const hospitalAddress = process.env.NEXT_PUBLIC_HOSPITAL_ADDRESS ?? "";
  const hospitalPhone = process.env.NEXT_PUBLIC_HOSPITAL_PHONE ?? "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>OP Charge</CardTitle>
          <CardDescription className="sr-only">Current charge</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-10 w-32" />
          ) : (
            <>
              <p className="text-2xl font-bold">{formatCurrency(opCharge?.amount ?? 0)}</p>
              <div className="flex gap-2">
                <Label htmlFor="newAmount" className="sr-only">New amount</Label>
                <Input
                  id="newAmount"
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-32"
                />
                <Button onClick={updateCharge} disabled={saving}>{saving ? "Updating..." : "Update Charge"}</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Hospital Info</CardTitle>
          <CardDescription className="sr-only">Read-only</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p><strong>Name:</strong> {hospitalName}</p>
          <p><strong>Address:</strong> {hospitalAddress}</p>
          <p><strong>Phone:</strong> {hospitalPhone}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Data Backup</CardTitle>
          <CardDescription>
            Download a full JSON backup of all database records, including inventory and billing data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={backupAllData} disabled={backingUp}>
            {backingUp ? "Backing up..." : "Backup All Data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
