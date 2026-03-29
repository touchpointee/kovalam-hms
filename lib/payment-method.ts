import mongoose from "mongoose";
import PaymentMethod from "@/models/PaymentMethod";

/**
 * Validates an active payment method id. Throws if invalid or inactive.
 * When `required` is false and id is empty, returns undefined.
 */
export async function resolvePaymentMethodId(
  id: string | undefined | null,
  opts?: { required?: boolean }
): Promise<mongoose.Types.ObjectId | undefined> {
  const required = opts?.required ?? false;
  const raw = id != null ? String(id).trim() : "";
  if (!raw) {
    if (required) throw new Error("Payment method is required");
    return undefined;
  }
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw new Error("Invalid payment method");
  }
  const pm = await PaymentMethod.findOne({ _id: raw, isActive: true }).select("_id").lean();
  if (!pm) {
    throw new Error("Payment method not found or inactive");
  }
  return new mongoose.Types.ObjectId(raw);
}
