import mongoose from "mongoose";

const stockTransactionSchema = new mongoose.Schema(
  {
    medicineStock: { type: mongoose.Schema.Types.ObjectId, ref: "MedicineStock", required: true },
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    transactionType: {
      type: String,
      enum: ["in", "out", "adjustment"],
      required: true,
    },
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    reason: { type: String, default: "" },
    referenceNumber: { type: String, default: "" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.models.StockTransaction ||
  mongoose.model("StockTransaction", stockTransactionSchema);
