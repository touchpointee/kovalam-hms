import mongoose from "mongoose";

const medicineFrequencySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.MedicineFrequency ||
  mongoose.model("MedicineFrequency", medicineFrequencySchema);
