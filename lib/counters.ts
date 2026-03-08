import { dbConnect } from "./mongoose";
import Patient from "@/models/Patient";
import OPVisit from "@/models/OPVisit";

export async function generateRegNo(): Promise<string> {
  await dbConnect();
  const latest = await Patient.findOne().sort({ createdAt: -1 }).select("regNo").lean() as { regNo?: string } | null;
  if (!latest?.regNo) return "P-0001";
  const num = parseInt(latest.regNo.replace(/^P-/, ""), 10) || 0;
  return `P-${String(num + 1).padStart(4, "0")}`;
}

export async function generateReceiptNo(): Promise<string> {
  await dbConnect();
  const latest = await OPVisit.findOne().sort({ createdAt: -1 }).select("receiptNo").lean() as { receiptNo?: string } | null;
  if (!latest?.receiptNo) return "R-0001";
  const num = parseInt(latest.receiptNo.replace(/^R-/, ""), 10) || 0;
  return `R-${String(num + 1).padStart(4, "0")}`;
}
