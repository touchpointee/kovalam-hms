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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
type LabNotificationSetting = {
  soundEnabled: boolean;
  soundUrl?: string;
  updatedAt?: string;
  updatedBy?: { name?: string };
};

const LAB_SOUND_OPTIONS = [
  { label: "Default Beep", value: "__default__" },
  { label: "Chime", value: "/sounds/notification-chime.wav" },
  { label: "Bell", value: "/sounds/notification-bell.wav" },
  { label: "Ping", value: "/sounds/notification-ping.wav" },
  { label: "Alert", value: "/sounds/notification-alert.wav" },
  { label: "Soft Tone", value: "/sounds/notification-soft-tone.wav" },
] as const;

export default function AdminSettingsPage() {
  const [opCharge, setOpCharge] = useState<OPChargeSetting | null>(null);
  const [labNotificationSetting, setLabNotificationSetting] = useState<LabNotificationSetting | null>(null);
  const [history, setHistory] = useState<OPChargeSetting[]>([]);
  const [newAmount, setNewAmount] = useState("");
  const [labSoundEnabled, setLabSoundEnabled] = useState(true);
  const [labSoundUrl, setLabSoundUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLabNotifications, setSavingLabNotifications] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const previewLabSound = async () => {
    try {
      if (!labSoundUrl || labSoundUrl === "__default__") {
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const context = new AudioCtx();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.15, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.45);
        return;
      }

      const audio = new Audio(labSoundUrl);
      await audio.play();
    } catch (e) {
      toast.error("Unable to play preview sound");
    }
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/op-charge")
        .then((res) => res.json())
        .then((data) => {
          setOpCharge(data);
          setNewAmount(String(data?.amount ?? ""));
        })
        .catch(() => {}),
      fetch("/api/settings/lab-notifications")
        .then((res) => res.json())
        .then((data) => {
          setLabNotificationSetting(data);
          setLabSoundEnabled(data?.soundEnabled !== false);
          setLabSoundUrl(String(data?.soundUrl ?? "") || "__default__");
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
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

  const updateLabNotifications = async () => {
    setSavingLabNotifications(true);
    try {
      const normalizedSoundUrl = labSoundUrl === "__default__" ? "" : labSoundUrl.trim();
      const res = await fetch("/api/settings/lab-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soundEnabled: labSoundEnabled,
          soundUrl: normalizedSoundUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setLabNotificationSetting(data);
      setLabSoundEnabled(data?.soundEnabled !== false);
      setLabSoundUrl(String(data?.soundUrl ?? "") || "__default__");
      toast.success("Lab notification settings updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingLabNotifications(false);
    }
  };

  const backupAllData = async () => {
    setBackingUp(true);
    try {
      const downloadBackupFile = async (url: string, fallbackExtension: "json" | "xls") => {
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({ message: "Backup failed" }));
          throw new Error(data.message ?? "Backup failed");
        }

        const blob = await res.blob();
        const contentDisposition = res.headers.get("content-disposition") ?? "";
        const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);
        const fileName =
          fileNameMatch?.[1] ?? `hms-backup-${new Date().toISOString()}.${fallbackExtension}`;
        const downloadUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(downloadUrl);
      };

      await downloadBackupFile("/api/settings/backup", "json");
      await downloadBackupFile("/api/settings/backup?format=excel", "xls");

      toast.success("JSON and Excel backups downloaded successfully");
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
          <CardTitle>Laboratory Notification Sound</CardTitle>
          <CardDescription>
            Manage the sound played in the laboratory dashboard when a new lab bill is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  id="labSoundEnabled"
                  type="checkbox"
                  checked={labSoundEnabled}
                  onChange={(e) => setLabSoundEnabled(e.target.checked)}
                />
                <Label htmlFor="labSoundEnabled">Enable laboratory notification sound</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="labSoundUrl">Notification sound</Label>
                <Select value={labSoundUrl} onValueChange={setLabSoundUrl}>
                  <SelectTrigger id="labSoundUrl" className="max-w-md">
                    <SelectValue placeholder="Select notification sound" />
                  </SelectTrigger>
                  <SelectContent>
                    {LAB_SOUND_OPTIONS.map((option) => (
                      <SelectItem key={option.label} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Choose one of the built-in common notification sounds. Default Beep uses the built-in browser beep.
                </p>
              </div>
              <Button type="button" variant="outline" className="w-fit" onClick={previewLabSound}>
                Preview Sound
              </Button>
              {labNotificationSetting?.updatedAt ? (
                <p className="text-xs text-slate-500">
                  Last updated {format(new Date(labNotificationSetting.updatedAt), "dd MMM yyyy HH:mm")}
                  {labNotificationSetting.updatedBy?.name ? ` by ${labNotificationSetting.updatedBy.name}` : ""}
                </p>
              ) : null}
              <Button onClick={updateLabNotifications} disabled={savingLabNotifications}>
                {savingLabNotifications ? "Saving..." : "Save Lab Notification Settings"}
              </Button>
            </>
          )}
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
