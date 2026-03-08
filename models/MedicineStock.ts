import mongoose from "mongoose";

const medicineStockSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    batchNo: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    mrp: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    quantityIn: { type: Number, required: true },
    quantityOut: { type: Number, default: 0 },
    currentStock: { type: Number, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.MedicineStock ||
  mongoose.model("MedicineStock", medicineStockSchema);
