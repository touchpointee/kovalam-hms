import mongoose from "mongoose";
import { clearRegisteredModel } from "@/lib/mongoose-clear-model";

const procedureBillItemSchema = new mongoose.Schema(
  {
    procedure: { type: mongoose.Schema.Types.ObjectId, ref: "Procedure", required: true },
    procedureName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineOffer: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const procedureBillSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: "OPVisit" },
    items: [procedureBillItemSchema],
    billOffer: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    billedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    billedAt: { type: Date, default: Date.now },
    paymentMethod: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod" },
  },
  { timestamps: false }
);

clearRegisteredModel("ProcedureBill");

export default mongoose.model("ProcedureBill", procedureBillSchema);
