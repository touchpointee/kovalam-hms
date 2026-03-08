import mongoose from "mongoose";

const medicineBillItemSchema = new mongoose.Schema(
  {
    medicineStock: { type: mongoose.Schema.Types.ObjectId, ref: "MedicineStock", required: true },
    medicineName: { type: String, required: true },
    batchNo: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true },
    mrp: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
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
    grandTotal: { type: Number, required: true },
    billedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    billedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.MedicineBill ||
  mongoose.model("MedicineBill", medicineBillSchema);
