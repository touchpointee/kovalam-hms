"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

type Patient = { _id: string; name: string; regNo: string; phone?: string; createdAt?: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  status?: "waiting" | "served";
  patient?: Patient;
  procedureBills?: Array<{ _id: string; grandTotal?: number }>;
};

export default function FrontdeskProcedureBillingPage() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const procedureBillingBase = pathname.startsWith("/admin/")
    ? "/admin/procedure-billing"
    : "/frontdesk/procedure-billing";
  const canDeleteBill = session?.user?.role === "admin";
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [procedureOnlyPatients, setProcedureOnlyPatients] = useState<Patient[]>([]);
  const [directBillsByPatient, setDirectBillsByPatient] = useState<
    Record<string, { _id: string; grandTotal?: number } | null>
  >({});
  const [directBillsLoading, setDirectBillsLoading] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState("");

  const loadTodayVisits = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}&includeProcedureBills=true`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTodayVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setTodayVisits([]));
  };

  const loadDirectSalePatients = () => {
    const params = new URLSearchParams({ registrationType: "procedure", limit: "20", page: "1" });
    fetch(`/api/patients?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then(async (data) => {
        const list: Patient[] = Array.isArray(data?.patients) ? data.patients : [];
        setProcedureOnlyPatients(list);
        if (list.length === 0) {
          setDirectBillsByPatient({});
          return;
        }
        setDirectBillsLoading(true);
        try {
          const results = await Promise.all(
            list.map((patient) =>
              fetch(`/api/patients/${patient._id}`, { cache: "no-store" })
                .then((res) => res.json())
                .catch(() => null)
            )
          );
          const nextMap: Record<string, { _id: string; grandTotal?: number } | null> = {};
          results.forEach((res, idx) => {
            const bill = Array.isArray(res?.procedureBills) ? res.procedureBills[0] : null;
            nextMap[list[idx]._id] = bill?._id ? { _id: bill._id, grandTotal: bill.grandTotal } : null;
          });
          setDirectBillsByPatient(nextMap);
        } finally {
          setDirectBillsLoading(false);
        }
      })
      .catch(() => {
        setProcedureOnlyPatients([]);
        setDirectBillsByPatient({});
      });
  };

  useEffect(() => {
    loadTodayVisits();
    loadDirectSalePatients();
  }, []);

  const deleteDirectBill = async (billId: string) => {
    if (!billId) return;
    if (!window.confirm("Are you sure you want to delete this bill? This action cannot be undone.")) return;

    setDeletingBillId(billId);
    try {
      const res = await fetch(`/api/billing/procedure/${billId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to delete bill");
      toast.success("Procedure bill deleted");
      loadDirectSalePatients();
      loadTodayVisits();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete bill");
    } finally {
      setDeletingBillId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Procedure Billing</h1>
        <Button
          variant="outline"
          onClick={() => {
            loadTodayVisits();
            loadDirectSalePatients();
          }}
        >
          Refresh
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Direct Procedure Sale</CardTitle>
            <CardDescription>
              Start a new walk-in procedure bill here, or reopen a recent direct-sale bill from the same section below.
            </CardDescription>
          </div>
          <Button asChild className="shrink-0">
            <Link href={`${procedureBillingBase}/direct-sale`}>Start Direct Sale</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {procedureOnlyPatients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No direct-sale registrations found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Bill Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedureOnlyPatients.map((patient) => {
                  const bill = directBillsByPatient[patient._id];
                  const hasBill = Boolean(bill?._id);
                  return (
                    <TableRow key={patient._id}>
                      <TableCell>{patient.name}</TableCell>
                      <TableCell>{patient.regNo}</TableCell>
                      <TableCell>{patient.phone ?? "-"}</TableCell>
                      <TableCell>
                        {patient.createdAt ? format(new Date(patient.createdAt), "dd MMM yyyy, HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        {directBillsLoading ? (
                          <Badge variant="outline">Checking...</Badge>
                        ) : hasBill ? (
                          <Badge className="bg-red-600 text-white">Billed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {directBillsLoading ? "-" : hasBill ? formatCurrency(Number(bill?.grandTotal) || 0) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`${procedureBillingBase}/direct/${patient._id}`}>
                              {hasBill ? "Open Bill" : "Create Bill"}
                            </Link>
                          </Button>
                          {bill?._id && canDeleteBill ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteDirectBill(bill._id)}
                              disabled={deletingBillId === bill._id}
                            >
                              {deletingBillId === bill._id ? "Deleting..." : "Delete"}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s OP Visits</CardTitle>
          <CardDescription>Bill procedures as soon as a visit is registered (no need to wait for served)</CardDescription>
        </CardHeader>
        <CardContent>
          {todayVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits today.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Visit Time</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Visit Status</TableHead>
                  <TableHead>Bill Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayVisits.map((visit) => {
                  const latestBill = (visit.procedureBills?.length ?? 0) > 0 ? visit.procedureBills?.[0] : null;
                  const hasBill = Boolean(latestBill?._id);
                  return (
                    <TableRow key={visit._id}>
                      <TableCell>{visit.patient?.name ?? "-"}</TableCell>
                      <TableCell>{visit.patient?.regNo ?? "-"}</TableCell>
                      <TableCell>{format(new Date(visit.visitDate), "HH:mm")}</TableCell>
                      <TableCell>{visit.receiptNo ?? "-"}</TableCell>
                      <TableCell className="capitalize">{visit.status ?? "waiting"}</TableCell>
                      <TableCell>
                        {hasBill ? (
                          <Badge className="bg-red-600 text-white">Billed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {visit.patient?._id ? (
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`${procedureBillingBase}/${visit._id}`}>
                                {hasBill ? "Open Bill" : "Bill This Visit"}
                              </Link>
                            </Button>
                            {latestBill?._id && canDeleteBill ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteDirectBill(latestBill._id)}
                                disabled={deletingBillId === latestBill._id}
                              >
                                {deletingBillId === latestBill._id ? "Deleting..." : "Delete"}
                              </Button>
                            ) : null}
                          </div>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
