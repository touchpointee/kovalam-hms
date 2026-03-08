import mongoose from "mongoose";

const opVisitSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visitDate: { type: Date, default: Date.now },
    opCharge: { type: Number, required: true },
    paid: { type: Boolean, default: false },
    receiptNo: { type: String, required: true, unique: true },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.OPVisit || mongoose.model("OPVisit", opVisitSchema);
