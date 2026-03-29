import mongoose from "mongoose";
import { clearRegisteredModel } from "@/lib/mongoose-clear-model";

const paymentMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Optional short code e.g. CASH, UPI */
    code: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

paymentMethodSchema.index({ name: 1 }, { unique: true });

clearRegisteredModel("PaymentMethod");

export default mongoose.model("PaymentMethod", paymentMethodSchema);
