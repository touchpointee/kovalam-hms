"use client";

import { format } from "date-fns";
import LabBillsDashboard from "@/components/LabBillsDashboard";

export default function LaboratoryDashboardPage() {
  return (
    <LabBillsDashboard
      pageTitle="Laboratory"
      pageDescription={`Today's lab orders and billing (${format(new Date(), "dd MMM yyyy")}). Recent activity below for quick reference.`}
    />
  );
}
