import { dbConnect } from "./mongoose";
import Patient from "@/models/Patient";
import OPVisit from "@/models/OPVisit";

const REG_NO_PREFIX = "DMC";
const LAB_REG_NO_PREFIX = "LAB";

export async function generateRegNo(): Promise<string> {
  return generateRegNoWithPrefix(REG_NO_PREFIX);
}

export async function generateLabRegNo(): Promise<string> {
  return generateRegNoWithPrefix(LAB_REG_NO_PREFIX);
}

async function generateRegNoWithPrefix(prefix: string): Promise<string> {
  await dbConnect();
  const docs = (await Patient.find({ regNo: new RegExp(`^${prefix}\\d+$`) })
    .select("regNo")
    .lean()) as { regNo?: string }[];
  let max = 0;
  for (const d of docs) {
    const m = d.regNo?.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export async function generateReceiptNo(): Promise<string> {
  await dbConnect();
  const latest = await OPVisit.findOne().sort({ receiptNo: -1 }).select("receiptNo").lean() as { receiptNo?: string } | null;
  if (!latest?.receiptNo) return "R-0001";
  const num = parseInt(latest.receiptNo.replace(/^R-/, ""), 10) || 0;
  return `R-${String(num + 1).padStart(4, "0")}`;
}
