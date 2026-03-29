import { dbConnect } from "./mongoose";
import Patient from "@/models/Patient";
import OPVisit from "@/models/OPVisit";

const REG_NO_PREFIX = "DMC";

export async function generateRegNo(): Promise<string> {
  await dbConnect();
  const docs = (await Patient.find({ regNo: new RegExp(`^${REG_NO_PREFIX}\\d+$`) })
    .select("regNo")
    .lean()) as { regNo?: string }[];
  let max = 0;
  for (const d of docs) {
    const m = d.regNo?.match(new RegExp(`^${REG_NO_PREFIX}(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `${REG_NO_PREFIX}${String(next).padStart(3, "0")}`;
}

export async function generateReceiptNo(): Promise<string> {
  await dbConnect();
  const latest = await OPVisit.findOne().sort({ receiptNo: -1 }).select("receiptNo").lean() as { receiptNo?: string } | null;
  if (!latest?.receiptNo) return "R-0001";
  const num = parseInt(latest.receiptNo.replace(/^R-/, ""), 10) || 0;
  return `R-${String(num + 1).padStart(4, "0")}`;
}
