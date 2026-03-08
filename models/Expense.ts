import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["salary", "supplies", "utilities", "maintenance", "misc", "other"],
    },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
