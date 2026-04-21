/* eslint-disable */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/** Use MONGODB_URI from .env, or local MongoDB (same pattern as a proper `|| "mongodb://..."` fallback). */
const MONGODB_URI = (process.env.MONGODB_URI || "").trim() || "mongodb://127.0.0.1:27017/hms";

/** Collections cleared before inserting login users only (no demo patients, stock, or catalog data). */
const COLLECTIONS_TO_CLEAR = [
  "medicinestocks",
  "stocktransactions",
  "medicines",
  "manufacturers",
  "medicinefrequencies",
  "suppliers",
  "medicinecategories",
  "medicinegroups",
  "labtests",
  "labbills",
  "procedures",
  "opvisits",
  "opchargesettings",
  "patients",
  "procedurebills",
  "prescriptions",
  "medicinebills",
  "expenses",
  "users",
];

async function seed() {
  await mongoose.connect(MONGODB_URI, { dbName: "hms" });

  const db = mongoose.connection;
  for (const name of COLLECTIONS_TO_CLEAR) {
    await db.collection(name).deleteMany({});
  }

  const User = db.collection("users");
  const hashed = await bcrypt.hash("password123", 10);

  await User.insertMany([
    { name: "Admin User", email: "admin@hms.com", password: hashed, role: "admin", isActive: true, createdAt: new Date() },
    { name: "Dr. Priya Sharma", email: "doctor@hms.com", password: hashed, role: "doctor", isActive: true, createdAt: new Date() },
    { name: "Pharmacy Staff", email: "pharmacy@hms.com", password: hashed, role: "pharmacy", isActive: true, createdAt: new Date() },
    { name: "Front Desk", email: "frontdesk@hms.com", password: hashed, role: "frontdesk", isActive: true, createdAt: new Date() },
    { name: "Laboratory Staff", email: "laboratory@hms.com", password: hashed, role: "laboratory", isActive: true, createdAt: new Date() },
  ]);

  const pmCol = db.collection("paymentmethods");
  const pmCount = await pmCol.countDocuments();
  if (pmCount === 0) {
    await pmCol.insertMany([
      { name: "Cash", code: "CASH", isActive: true, sortOrder: 0, createdAt: new Date() },
      { name: "Card", code: "CARD", isActive: true, sortOrder: 1, createdAt: new Date() },
      { name: "UPI", code: "UPI", isActive: true, sortOrder: 2, createdAt: new Date() },
      { name: "Bank transfer", code: "BANK", isActive: true, sortOrder: 3, createdAt: new Date() },
    ]);
  }

  console.log("Seed complete (logins only). Use admin@hms.com / password123 (same password for all seeded users).");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
