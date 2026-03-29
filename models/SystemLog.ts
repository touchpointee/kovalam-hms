import mongoose from "mongoose";

const logRetentionDays = Math.max(1, Number(process.env.LOG_RETENTION_DAYS ?? "90"));

const systemLogSchema = new mongoose.Schema(
  {
    createdAt: { type: Date, default: Date.now, index: true },
    level: { type: String, enum: ["info", "warn", "error", "debug"], required: true },
    category: { type: String, enum: ["api", "auth", "client", "system"], required: true },
    message: { type: String, required: true },
    route: { type: String },
    method: { type: String },
    path: { type: String },
    statusCode: { type: Number },
    durationMs: { type: Number },
    userId: { type: String },
    userEmail: { type: String },
    userRole: { type: String },
    ip: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: false }
);

systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ level: 1, createdAt: -1 });
systemLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: logRetentionDays * 24 * 60 * 60 }
);

export type SystemLogLevel = "info" | "warn" | "error" | "debug";
export type SystemLogCategory = "api" | "auth" | "client" | "system";

export default mongoose.models.SystemLog ||
  mongoose.model("SystemLog", systemLogSchema);
