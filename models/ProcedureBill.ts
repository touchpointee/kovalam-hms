import mongoose from "mongoose";

const procedureBillItemSchema = new mongoose.Schema(
  {
    procedure: { type: mongoose.Schema.Types.ObjectId, ref: "Procedure", required: true },
    procedureName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const procedureBillSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: "OPVisit" },
    items: [procedureBillItemSchema],
    grandTotal: { type: Number, required: true },
    billedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    billedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.ProcedureBill ||
  mongoose.model("ProcedureBill", procedureBillSchema);
