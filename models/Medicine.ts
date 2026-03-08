import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genericName: { type: String },
    category: { type: String },
    manufacturer: { type: String },
    unit: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.Medicine || mongoose.model("Medicine", medicineSchema);
