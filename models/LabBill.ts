import mongoose from "mongoose";
import { clearRegisteredModel } from "@/lib/mongoose-clear-model";

const labBillItemSchema = new mongoose.Schema(
  {
    labTest: { type: mongoose.Schema.Types.ObjectId, ref: "LabTest", required: true },
    labTestName: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true },
    /** Amount off this line (currency), applied before bill-level offer. */
    lineOffer: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const labBillSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: "OPVisit" },
    items: [labBillItemSchema],
    /** Extra amount off the bill after line offers (currency). */
    billOffer: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    generatedByName: { type: String, trim: true },
    billedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    billedAt: { type: Date, default: Date.now },
    paymentMethod: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Only visit-linked lab bills must be unique; lab-only bills should not index null/missing visit.
labBillSchema.index(
  { visit: 1 },
  {
    unique: true,
    partialFilterExpression: { visit: { $type: "objectId" } },
  }
);

clearRegisteredModel("LabBill");

export default mongoose.model("LabBill", labBillSchema);
