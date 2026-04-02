import mongoose from "mongoose";
import { clearRegisteredModel } from "@/lib/mongoose-clear-model";

const medicineBillItemSchema = new mongoose.Schema(
  {
    medicineStock: { type: mongoose.Schema.Types.ObjectId, ref: "MedicineStock", required: true },
    medicineName: { type: String, required: true },
    batchNo: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true },
    mrp: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    lineOffer: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const medicineBillSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: "OPVisit" },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription" },
    items: [medicineBillItemSchema],
    billOffer: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    generatedByName: { type: String, trim: true },
    billedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    billedAt: { type: Date, default: Date.now },
    paymentMethod: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod" },
  },
  { timestamps: false }
);

clearRegisteredModel("MedicineBill");

export default mongoose.model("MedicineBill", medicineBillSchema);
