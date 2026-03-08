import mongoose from "mongoose";

const prescriptionMedicineSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
    medicineName: { type: String, required: true },
    dosage: { type: String },
    frequency: { type: String },
    duration: { type: String },
    instructions: { type: String },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: "OPVisit", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    medicines: [prescriptionMedicineSchema],
    procedures: [{ type: mongoose.Schema.Types.ObjectId, ref: "Procedure" }],
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.Prescription ||
  mongoose.model("Prescription", prescriptionSchema);
