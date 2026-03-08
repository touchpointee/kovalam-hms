/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const fs = require("fs");

// Load .env.local so MONGODB_URI is set (ts-node doesn't load it automatically)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line: string) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/hms";

async function seed() {
  await mongoose.connect(MONGODB_URI);

  const User = mongoose.connection.collection("users");
  const Patient = mongoose.connection.collection("patients");
  const OPVisit = mongoose.connection.collection("opvisits");
  const OPChargeSetting = mongoose.connection.collection("opchargesettings");
  const Procedure = mongoose.connection.collection("procedures");
  const Medicine = mongoose.connection.collection("medicines");
  const MedicineStock = mongoose.connection.collection("medicinestocks");

  await MedicineStock.deleteMany({});
  await Medicine.deleteMany({});
  await Procedure.deleteMany({});
  await OPVisit.deleteMany({});
  await OPChargeSetting.deleteMany({});
  await Patient.deleteMany({});
  await mongoose.connection.collection("procedurebills").deleteMany({});
  await mongoose.connection.collection("prescriptions").deleteMany({});
  await mongoose.connection.collection("medicinebills").deleteMany({});
  await mongoose.connection.collection("expenses").deleteMany({});
  await User.deleteMany({});

  const hashed = await bcrypt.hash("password123", 10);

  await User.insertMany([
    { name: "Admin User", email: "admin@hms.com", password: hashed, role: "admin", isActive: true, createdAt: new Date() },
    { name: "Dr. Priya Sharma", email: "doctor@hms.com", password: hashed, role: "doctor", isActive: true, createdAt: new Date() },
    { name: "Pharmacy Staff", email: "pharmacy@hms.com", password: hashed, role: "pharmacy", isActive: true, createdAt: new Date() },
    { name: "Front Desk", email: "frontdesk@hms.com", password: hashed, role: "frontdesk", isActive: true, createdAt: new Date() },
  ]);

  const users = await User.find({}).toArray();
  const adminId = users.find((u: { email: string }) => u.email === "admin@hms.com")?._id;

  await OPChargeSetting.insertOne({ amount: 200, updatedBy: adminId, updatedAt: new Date() });

  const patients = await Patient.insertMany([
    { regNo: "P-0001", name: "Ramesh Kumar", age: 45, gender: "male", phone: "9876543210", address: "12 Gandhi Nagar", bloodGroup: "B+", createdAt: new Date() },
    { regNo: "P-0002", name: "Lakshmi Venkatesh", age: 32, gender: "female", phone: "9876543211", address: "5 Park Street", bloodGroup: "O+", createdAt: new Date() },
    { regNo: "P-0003", name: "Arun Patel", age: 28, gender: "male", phone: "9876543212", address: "7 Temple Road", bloodGroup: "A+", createdAt: new Date() },
    { regNo: "P-0004", name: "Sita Iyer", age: 55, gender: "female", phone: "9876543213", address: "3 South End", bloodGroup: "AB+", createdAt: new Date() },
    { regNo: "P-0005", name: "Vijay Singh", age: 62, gender: "male", phone: "9876543214", address: "9 Railway Colony", bloodGroup: "O-", createdAt: new Date() },
  ]);

  await Procedure.insertMany([
    { name: "ECG", description: "Electrocardiogram", price: 300, isActive: true, createdAt: new Date() },
    { name: "Blood Test (CBC)", description: "Complete Blood Count", price: 250, isActive: true, createdAt: new Date() },
    { name: "Urine Analysis", description: "Urine test", price: 150, isActive: true, createdAt: new Date() },
    { name: "X-Ray Chest", description: "Chest X-Ray", price: 500, isActive: true, createdAt: new Date() },
    { name: "Blood Sugar Test", description: "Glucose test", price: 100, isActive: true, createdAt: new Date() },
  ]);

  const procedures = await Procedure.find({}).toArray();
  const pharmacyId = users.find((u: { email: string }) => u.email === "pharmacy@hms.com")?._id;

  const meds = await Medicine.insertMany([
    { name: "Paracetamol 500mg", genericName: "Paracetamol", category: "tablet", manufacturer: "Generic", unit: "tablet", isActive: true, createdAt: new Date() },
    { name: "Amoxicillin 250mg", genericName: "Amoxicillin", category: "capsule", manufacturer: "Generic", unit: "capsule", isActive: true, createdAt: new Date() },
    { name: "Omeprazole 20mg", genericName: "Omeprazole", category: "capsule", manufacturer: "Generic", unit: "capsule", isActive: true, createdAt: new Date() },
    { name: "Cetirizine 10mg", genericName: "Cetirizine", category: "tablet", manufacturer: "Generic", unit: "tablet", isActive: true, createdAt: new Date() },
    { name: "Azithromycin 500mg", genericName: "Azithromycin", category: "tablet", manufacturer: "Generic", unit: "tablet", isActive: true, createdAt: new Date() },
    { name: "Metformin 500mg", genericName: "Metformin", category: "tablet", manufacturer: "Generic", unit: "tablet", isActive: true, createdAt: new Date() },
  ]);

  const now = new Date();
  for (const med of meds) {
    const expiry1 = new Date(now);
    expiry1.setMonth(expiry1.getMonth() + 3);
    const expiry2 = new Date(now);
    expiry2.setMonth(expiry2.getMonth() + 18);
    const mrp1 = Math.floor(50 + Math.random() * 150);
    const mrp2 = Math.floor(100 + Math.random() * 400);
    const sp1 = Math.round(mrp1 * 0.85);
    const sp2 = Math.round(mrp2 * 0.85);
    const qty1 = Math.floor(100 + Math.random() * 400);
    const qty2 = Math.floor(100 + Math.random() * 400);
    await MedicineStock.insertMany([
      { medicine: med._id, batchNo: `BT-2024-${String(meds.indexOf(med) + 1).padStart(3, "0")}A`, expiryDate: expiry1, mrp: mrp1, sellingPrice: sp1, quantityIn: qty1, quantityOut: 0, currentStock: qty1, addedBy: pharmacyId, createdAt: now, updatedAt: now },
      { medicine: med._id, batchNo: `BT-2024-${String(meds.indexOf(med) + 1).padStart(3, "0")}B`, expiryDate: expiry2, mrp: mrp2, sellingPrice: sp2, quantityIn: qty2, quantityOut: 0, currentStock: qty2, addedBy: pharmacyId, createdAt: now, updatedAt: now },
    ]);
  }

  console.log("Seed complete. Login with admin@hms.com / password123");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
