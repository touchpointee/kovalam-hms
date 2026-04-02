import mongoose from "mongoose";
import { clearRegisteredModel } from "@/lib/mongoose-clear-model";

const billingStaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

billingStaffSchema.index({ name: 1, code: 1 }, { unique: true });

clearRegisteredModel("BillingStaff");

export default mongoose.model("BillingStaff", billingStaffSchema);
