"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  paid?: boolean;
  status?: "waiting" | "served";
};

type PatientDetail = {
  _id: string;
  regNo: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address?: string;
  bloodGroup?: string;
  visits?: Visit[];
};

export default function FrontdeskPatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = () => {
      setLoading(true);
      fetch(`/api/patients/${id}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => setPatient(data))
        .catch(() => setPatient(null))
        .finally(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [id]);

  const visits = useMemo(() => patient?.visits ?? [], [patient]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!patient?._id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Patient Details</h1>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Button asChild variant="outline">
          <Link href="/frontdesk/register">Back to Patient Search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Patient Details</h1>
          <p className="text-sm text-muted-foreground">Frontdesk view</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/frontdesk/register">Back</Link>
          </Button>
          <Button asChild>
            <Link href={`/frontdesk/visit?patientId=${patient._id}`}>Create Visit</Link>
          </Button>
        </div>
      </div>

      <Card className="border-blue-100">
        <CardHeader>
          <CardTitle>{patient.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><strong>Reg No:</strong> {patient.regNo}</p>
          <p><strong>Phone:</strong> {patient.phone}</p>
          <p><strong>Age:</strong> {patient.age}</p>
          <p><strong>Gender:</strong> <span className="capitalize">{patient.gender}</span></p>
          <p><strong>Blood Group:</strong> {patient.bloodGroup ?? "Unknown"}</p>
          <p><strong>Address:</strong> {patient.address || "-"}</p>
        </CardContent>
      </Card>

      <Card className="border-blue-100">
        <CardHeader>
          <CardTitle>Visit History</CardTitle>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v._id}>
                    <TableCell>{format(new Date(v.visitDate), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell>{v.receiptNo ?? "-"}</TableCell>
                    <TableCell>{v.paid ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{v.status ?? "waiting"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/doctor/patients/${patient._id}/consultation?visitId=${v._id}`}>Open</Link>
                      </Button>
                    </TableCell>
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

