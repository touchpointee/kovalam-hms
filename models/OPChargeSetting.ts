import mongoose from "mongoose";

const opChargeSettingSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.OPChargeSetting ||
  mongoose.model("OPChargeSetting", opChargeSettingSchema);
