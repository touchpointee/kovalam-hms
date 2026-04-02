import mongoose from "mongoose";
import LabTest from "@/models/LabTest";
import LabBill from "@/models/LabBill";
import {
  clampBillOffer,
  clampLineOffer,
  grandTotalAfterBillOffer,
  lineNetAfterOffer,
} from "@/lib/bill-offers";

export type LabBillLineInput = { labTestId: string; quantity: number; lineOffer?: number };

/**
 * Upsert or delete the lab bill for a visit from admin catalog tests (name/price from {@link LabTest}).
 */
export async function syncLabBillForVisitItems(args: {
  patientId: string;
  visitId: string;
  items: LabBillLineInput[];
  sessionUserId: string | undefined;
  generatedByName?: string;
  billOffer?: number;
  paymentMethod?: mongoose.Types.ObjectId;
}): Promise<void> {
  const { patientId, visitId, items, sessionUserId, generatedByName, billOffer = 0, paymentMethod } = args;
  if (!sessionUserId) return;

  const normalized = items.filter((i) => i.labTestId && Number(i.quantity) > 0);
  if (normalized.length === 0) {
    await LabBill.findOneAndDelete({ visit: visitId });
    return;
  }

  const ids = Array.from(new Set(normalized.map((i) => i.labTestId)));
  const tests = (await LabTest.find({ _id: { $in: ids }, isActive: true })
    .select("_id name price")
    .lean()) as unknown as Array<{ _id: { toString(): string }; name: string; price: number }>;
  const byId = new Map(tests.map((t) => [String(t._id), t]));

  const billItems: Array<{
    labTest: mongoose.Types.ObjectId;
    labTestName: string;
    quantity: number;
    unitPrice: number;
    lineOffer: number;
    totalPrice: number;
  }> = [];

  for (const row of normalized) {
    const t = byId.get(row.labTestId);
    if (!t) continue;
    const unit = Number(t.price) || 0;
    const q = Math.max(1, Math.floor(Number(row.quantity)));
    const gross = unit * q;
    const lo = clampLineOffer(gross, row.lineOffer ?? 0);
    billItems.push({
      labTest: t._id as mongoose.Types.ObjectId,
      labTestName: t.name,
      quantity: q,
      unitPrice: unit,
      lineOffer: lo,
      totalPrice: lineNetAfterOffer(gross, lo),
    });
  }

  if (billItems.length === 0) {
    await LabBill.findOneAndDelete({ visit: visitId });
    return;
  }

  const linesNetSum = billItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const grandTotal = grandTotalAfterBillOffer(linesNetSum, billOffer);

  await LabBill.findOneAndUpdate(
    { visit: visitId },
    {
      $set: {
        patient: patientId,
        visit: visitId,
        items: billItems,
        billOffer: clampBillOffer(linesNetSum, billOffer),
        grandTotal,
        ...(generatedByName?.trim() ? { generatedByName: generatedByName.trim() } : {}),
        billedBy: sessionUserId,
        updatedAt: new Date(),
        ...(paymentMethod ? { paymentMethod } : {}),
      },
      $setOnInsert: { billedAt: new Date() },
    },
    { upsert: true, new: true }
  );
}
