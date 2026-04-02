import mongoose from "mongoose";

const opVisitSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    /** Consulting doctor (User with role doctor); optional for legacy visits. */
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    visitDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["waiting", "served"], default: "waiting" },
    opCharge: { type: Number, required: true },
    opChargeChangeReason: { type: String, trim: true },
    paid: { type: Boolean, default: false },
    receiptNo: { type: String, required: true, unique: true },
    generatedByName: { type: String, trim: true },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paymentMethod: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod" },
    createdAt: { type: Date, default: Date.now },
    /** Sum of prior-visit OP collected during this registration (for receipt reprint). */
    priorSettlementTotal: { type: Number, default: 0 },
    /** Snapshot of prior visits settled when creating this visit (receipt line items). */
    priorSettlementLines: {
      type: [
        {
          receiptNo: { type: String, required: true },
          visitDate: { type: Date, required: true },
          opCharge: { type: Number, required: true },
        },
      ],
      default: undefined,
    },
  },
  { timestamps: false }
);

// Next.js dev reuses mongoose.models across HMR; stale schema causes StrictPopulateError on `doctor`.
if (process.env.NODE_ENV === "development" && mongoose.models.OPVisit) {
  delete mongoose.models.OPVisit;
}

export default mongoose.models.OPVisit || mongoose.model("OPVisit", opVisitSchema);
