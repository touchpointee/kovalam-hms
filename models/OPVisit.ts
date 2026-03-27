import mongoose from "mongoose";

const opVisitSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visitDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["waiting", "served"], default: "waiting" },
    opCharge: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    receiptNo: { type: String, required: true, unique: true },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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

export default mongoose.models.OPVisit || mongoose.model("OPVisit", opVisitSchema);
