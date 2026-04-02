import BillingStaff from "@/models/BillingStaff";

export const DEFAULT_BILLING_STAFF = [
  { name: "Anitha Renjulal (M.D)", code: "01", sortOrder: 0 },
  { name: "Mary Dayana Banu", code: "02", sortOrder: 1 },
  { name: "Neethu", code: "03", sortOrder: 2 },
  { name: "Saranya", code: "04", sortOrder: 3 },
] as const;

export async function ensureBillingStaffSeeded(): Promise<void> {
  const count = await BillingStaff.countDocuments();
  if (count > 0) return;

  await BillingStaff.insertMany(
    DEFAULT_BILLING_STAFF.map((staff) => ({
      ...staff,
      isActive: true,
    }))
  );
}
