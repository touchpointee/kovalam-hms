"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
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

type Patient = { _id: string; name: string; regNo: string };
type LabPatient = { _id: string; name: string; regNo: string; phone?: string; createdAt?: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  status?: "waiting" | "served";
  patient?: Patient;
  labBill?: { _id: string; grandTotal?: number } | null;
};

export default function FrontdeskLabBillingPage() {
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [labOnlyPatients, setLabOnlyPatients] = useState<LabPatient[]>([]);
  const [labOnlyBillsByPatient, setLabOnlyBillsByPatient] = useState<
    Record<string, { _id: string; grandTotal?: number } | null>
  >({});
  const [labOnlyBillsLoading, setLabOnlyBillsLoading] = useState(false);

  const loadTodayVisits = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}&includeLabBills=true`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTodayVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setTodayVisits([]));
  };

  const loadLabOnlyPatients = () => {
    const params = new URLSearchParams({ registrationType: "lab", limit: "20", page: "1" });
    fetch(`/api/patients?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then(async (data) => {
        const list: LabPatient[] = Array.isArray(data?.patients) ? data.patients : [];
        setLabOnlyPatients(list);
        if (list.length === 0) {
          setLabOnlyBillsByPatient({});
          return;
        }
        setLabOnlyBillsLoading(true);
        try {
          const results = await Promise.all(
            list.map((p) =>
              fetch(`/api/laboratory/bills?patientId=${p._id}&limit=1&page=1`, { cache: "no-store" })
                .then((r) => r.json())
                .catch(() => null)
            )
          );
          const nextMap: Record<string, { _id: string; grandTotal?: number } | null> = {};
          results.forEach((res, idx) => {
            const bill = Array.isArray(res?.items) ? res.items[0] : null;
            nextMap[list[idx]._id] = bill?._id ? { _id: bill._id, grandTotal: bill.grandTotal } : null;
          });
          setLabOnlyBillsByPatient(nextMap);
        } finally {
          setLabOnlyBillsLoading(false);
        }
      })
      .catch(() => {
        setLabOnlyPatients([]);
        setLabOnlyBillsByPatient({});
      });
  };

  useEffect(() => {
    loadTodayVisits();
    loadLabOnlyPatients();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Lab Billing</h1>
        <Button
          variant="outline"
          onClick={() => {
            loadTodayVisits();
            loadLabOnlyPatients();
          }}
        >
          Refresh
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s OP visits</CardTitle>
          <CardDescription>
            Open a visit to build the lab bill from Admin {"->"} Lab Tests (same catalog the doctor uses). You can also
            print after saving.
          </CardDescription>
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
                  <TableHead>Visit time</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Visit status</TableHead>
                  <TableHead>Bill status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayVisits.map((visit) => {
                  const hasLab = Boolean(visit.labBill);
                  return (
                    <TableRow key={visit._id}>
                      <TableCell>{visit.patient?.name ?? "-"}</TableCell>
                      <TableCell>{visit.patient?.regNo ?? "-"}</TableCell>
                      <TableCell>{format(new Date(visit.visitDate), "dd MMM yyyy, HH:mm")}</TableCell>
                      <TableCell>{visit.receiptNo ?? "-"}</TableCell>
                      <TableCell className="capitalize">{visit.status ?? "waiting"}</TableCell>
                      <TableCell>
                        {hasLab ? (
                          <Badge className="bg-red-600 text-white">Billed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasLab ? formatCurrency(Number(visit.labBill?.grandTotal) || 0) : "-"}
                      </TableCell>
                      <TableCell>
                        {visit.patient?._id ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/frontdesk/lab-billing/${visit._id}`}>
                              {hasLab ? "Open Bill" : "Bill This Visit"}
                            </Link>
                          </Button>
                        ) : (
                          "-"
                        )}
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
          <CardTitle>Lab-only registrations</CardTitle>
          <CardDescription>
            Use this for patients who are coming only for lab tests (no OP visit). You can create a lab bill directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {labOnlyPatients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lab-only registrations found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Bill status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labOnlyPatients.map((patient) => (
                  <TableRow key={patient._id}>
                    {(() => {
                      const bill = labOnlyBillsByPatient[patient._id];
                      const hasBill = Boolean(bill?._id);
                      return (
                        <>
                    <TableCell>{patient.name}</TableCell>
                    <TableCell>{patient.regNo}</TableCell>
                    <TableCell>{patient.phone ?? "-"}</TableCell>
                    <TableCell>
                      {patient.createdAt ? format(new Date(patient.createdAt), "dd MMM yyyy, HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      {labOnlyBillsLoading ? (
                        <Badge variant="outline">Checking...</Badge>
                      ) : hasBill ? (
                        <Badge className="bg-red-600 text-white">Billed</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {labOnlyBillsLoading ? "-" : hasBill ? formatCurrency(Number(bill?.grandTotal) || 0) : "-"}
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/frontdesk/lab-billing/lab-only/${patient._id}`}>
                          {hasBill ? "Open Bill" : "Create Lab Bill"}
                        </Link>
                      </Button>
                    </TableCell>
                        </>
                      );
                    })()}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
