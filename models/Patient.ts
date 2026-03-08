import mongoose from "mongoose";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] as const;

const patientSchema = new mongoose.Schema(
  {
    regNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true, enum: ["male", "female", "other"] },
    phone: { type: String, required: true },
    address: { type: String },
    bloodGroup: { type: String, enum: bloodGroups },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.Patient || mongoose.model("Patient", patientSchema);
