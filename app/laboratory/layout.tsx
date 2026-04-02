import { DashboardShell } from "@/components/DashboardShell";
import { LaboratoryNotifier } from "@/components/LaboratoryNotifier";

export default function LaboratoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <LaboratoryNotifier />
      {children}
    </DashboardShell>
  );
}
