import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genericName: { type: String },
    category: { type: String },
    group: { type: String },
    manufacturer: { type: String },
    unit: { type: String },
    minQuantity: { type: Number, default: 10 },
    maxQuantity: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.Medicine || mongoose.model("Medicine", medicineSchema);
