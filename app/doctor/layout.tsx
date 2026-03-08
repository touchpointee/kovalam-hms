import { DashboardShell } from "@/components/DashboardShell";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
