import { DashboardShell } from "@/components/DashboardShell";

export default function FrontdeskLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
