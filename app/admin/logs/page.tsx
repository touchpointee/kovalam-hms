"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type LogEntry = {
  _id: string;
  createdAt: string;
  level: "info" | "warn" | "error" | "debug";
  category: "api" | "auth" | "client" | "system";
  message: string;
  route?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userEmail?: string;
  userRole?: string;
  ip?: string;
};

const levelClass: Record<LogEntry["level"], string> = {
  info: "bg-blue-500/15 text-blue-700",
  warn: "bg-yellow-500/20 text-yellow-800",
  error: "bg-red-500/15 text-red-700",
  debug: "bg-slate-500/20 text-slate-700",
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [level, setLevel] = useState("all");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    params.set("level", level);
    params.set("category", category);
    params.set("q", q);
    params.set("from", from);
    params.set("to", to);
    return params.toString();
  }, [page, level, category, q, from, to]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?${query}`, { cache: "no-store" });
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setLogs([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [query]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">System Logs</h1>

      <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Search</Label>
          <Input value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} placeholder="message, path, route, user email" />
        </div>
        <div>
          <Label>Level</Label>
          <Select value={level} onValueChange={(value) => { setPage(1); setLevel(value); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={(value) => { setPage(1); setCategory(value); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="auth">Auth</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-72" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No logs found.</TableCell>
              </TableRow>
            ) : (
              logs.map((entry) => (
                <TableRow key={entry._id}>
                  <TableCell>{format(new Date(entry.createdAt), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                  <TableCell><Badge className={levelClass[entry.level]}>{entry.level}</Badge></TableCell>
                  <TableCell className="capitalize">{entry.category}</TableCell>
                  <TableCell className="max-w-[420px] truncate">{entry.message}</TableCell>
                  <TableCell className="text-xs">
                    {entry.method ?? "-"} {entry.path ?? ""} {entry.statusCode ? `(${entry.statusCode})` : ""}
                    {entry.durationMs !== undefined ? ` • ${entry.durationMs}ms` : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.userEmail ?? "-"}{entry.userRole ? ` (${entry.userRole})` : ""}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
        <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
