import mongoose from "mongoose";

const labNotificationSettingSchema = new mongoose.Schema(
  {
    soundEnabled: { type: Boolean, default: true },
    soundUrl: { type: String, trim: true, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.LabNotificationSetting ||
  mongoose.model("LabNotificationSetting", labNotificationSettingSchema);
