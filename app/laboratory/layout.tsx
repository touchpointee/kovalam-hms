import { DashboardShell } from "@/components/DashboardShell";

export default function LaboratoryLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
