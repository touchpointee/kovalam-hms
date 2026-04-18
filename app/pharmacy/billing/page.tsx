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
import { useMedicineBillingBase } from "@/hooks/usePharmacyBase";
import { formatCurrency } from "@/lib/utils";

type Patient = { _id: string; name: string; regNo: string; phone?: string; createdAt?: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  status?: "waiting" | "served";
  patient?: Patient;
  medicineBills?: Array<{ _id: string; grandTotal?: number }>;
};

export default function PharmacyBillingPage() {
  const medicineBillingBase = useMedicineBillingBase();
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [pharmacyOnlyPatients, setPharmacyOnlyPatients] = useState<Patient[]>([]);
  const [directBillsByPatient, setDirectBillsByPatient] = useState<
    Record<string, { _id: string; grandTotal?: number } | null>
  >({});
  const [directBillsLoading, setDirectBillsLoading] = useState(false);

  const loadTodayVisits = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}&includeMedicineBills=true`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTodayVisits(Array.isArray(d) ? d : d.visits ?? []))
      .catch(() => setTodayVisits([]));
  };

  const loadDirectSalePatients = () => {
    const params = new URLSearchParams({ registrationType: "pharmacy", limit: "20", page: "1" });
    fetch(`/api/patients?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then(async (data) => {
        const list: Patient[] = Array.isArray(data?.patients) ? data.patients : [];
        setPharmacyOnlyPatients(list);
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
            const bill = Array.isArray(res?.medicineBills) ? res.medicineBills[0] : null;
            nextMap[list[idx]._id] = bill?._id ? { _id: bill._id, grandTotal: bill.grandTotal } : null;
          });
          setDirectBillsByPatient(nextMap);
        } finally {
          setDirectBillsLoading(false);
        }
      })
      .catch(() => {
        setPharmacyOnlyPatients([]);
        setDirectBillsByPatient({});
      });
  };

  useEffect(() => {
    loadTodayVisits();
    loadDirectSalePatients();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Medicine Billing</h1>
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
            <CardTitle>Direct Medicine Sale</CardTitle>
            <CardDescription>
              Start a new walk-in medicine bill here, or reopen a recent direct-sale bill from the same section below.
            </CardDescription>
          </div>
          <Button asChild className="shrink-0">
            <Link href={`${medicineBillingBase}/direct-sale`}>Start Direct Sale</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pharmacyOnlyPatients.length === 0 ? (
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
                {pharmacyOnlyPatients.map((patient) => {
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
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${medicineBillingBase}/direct/${patient._id}`}>
                            {hasBill ? "Open Bill" : "Create Bill"}
                          </Link>
                        </Button>
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
          <CardDescription>Select a visit to bill prescribed medicines.</CardDescription>
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
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayVisits.map((v) => {
                  const hasBill = Boolean(v.medicineBills?.length);
                  const latestBill = hasBill ? v.medicineBills?.[0] : null;
                  return (
                    <TableRow key={v._id}>
                      <TableCell>{v.patient?.name ?? "-"}</TableCell>
                      <TableCell>{v.patient?.regNo ?? "-"}</TableCell>
                      <TableCell>{format(new Date(v.visitDate), "HH:mm")}</TableCell>
                      <TableCell>{v.receiptNo ?? "-"}</TableCell>
                      <TableCell className="capitalize">{v.status ?? "waiting"}</TableCell>
                      <TableCell>
                        {hasBill ? (
                          <Badge className="bg-red-600 text-white">Billed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>{hasBill ? formatCurrency(Number(latestBill?.grandTotal) || 0) : "-"}</TableCell>
                      <TableCell>
                        {v.patient?._id ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`${medicineBillingBase}/${v._id}`}>
                              {hasBill ? "Open Bill" : "Bill This Visit"}
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
    </div>
  );
}
