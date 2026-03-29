import mongoose from "mongoose";

const medicineGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.MedicineGroup ||
  mongoose.model("MedicineGroup", medicineGroupSchema);
