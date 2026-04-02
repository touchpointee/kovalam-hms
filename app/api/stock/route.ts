import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import MedicineStock from "@/models/MedicineStock";
import StockTransaction from "@/models/StockTransaction";
import Medicine from "@/models/Medicine";
import "@/models/User";
import { withRouteLog } from "@/lib/with-route-log";
import { buildInventoryTypeQuery, normalizeStockInventoryType } from "@/lib/stock";

export const GET = withRouteLog("stock.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const medicineId = req.nextUrl.searchParams.get("medicineId");
    const status = req.nextUrl.searchParams.get("status");
    const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
    const inventoryType = normalizeStockInventoryType(req.nextUrl.searchParams.get("inventoryType"));

    if (!medicineId) {
      return NextResponse.json({ message: "medicineId is required" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(medicineId)) {
      return NextResponse.json({ message: "Invalid medicineId" }, { status: 400 });
    }

    const query: Record<string, unknown> = {
      medicine: medicineId,
      ...buildInventoryTypeQuery(inventoryType),
    };
    if (status === "out") query.currentStock = 0;
    if (status === "low") {
      query.$expr = { $and: [{ $gt: ["$currentStock", 0] }, { $lt: ["$currentStock", "$minQuantity"] }] };
    }
    if (status === "in") {
      query.$expr = { $gte: ["$currentStock", "$minQuantity"] };
    }

    const batches = await MedicineStock.find(query)
      .sort({ expiryDate: 1 })
      .populate("medicine", "name unit")
      .populate("addedBy", "name")
      .lean();

    const filtered = search
      ? batches.filter((b) => {
          const medName = ((b as { medicine?: { name?: string } }).medicine?.name ?? "").toLowerCase();
          const batchNo = String((b as { batchNo?: string }).batchNo ?? "").toLowerCase();
          const q = search.toLowerCase();
          return medName.includes(q) || batchNo.includes(q);
        })
      : batches;

    return NextResponse.json(filtered);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

const postSchema = z.object({
  medicineId: z.string().min(1),
  inventoryType: z.enum(["store", "pharmacy"]).optional(),
  sourceStockId: z.string().optional(),
  batchNo: z.string().min(1),
  expiryDate: z.string().min(1),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  quantityIn: z.number().int().min(1),
  location: z.string().optional(),
  supplier: z.string().optional(),
});

export const POST = withRouteLog("stock.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["pharmacy", "admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      inventoryType: body.inventoryType,
      sourceStockId: body.sourceStockId ? String(body.sourceStockId) : undefined,
      mrp: Number(body.mrp),
      sellingPrice: Number(body.sellingPrice),
      quantityIn: parseInt(String(body.quantityIn), 10),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(parsed.data.medicineId)) {
      return NextResponse.json({ message: "Invalid medicine id" }, { status: 400 });
    }
    if (parsed.data.sourceStockId && !mongoose.Types.ObjectId.isValid(parsed.data.sourceStockId)) {
      return NextResponse.json({ message: "Invalid source stock id" }, { status: 400 });
    }

    const expiryDate = new Date(parsed.data.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) {
      return NextResponse.json({ message: "Invalid expiry date" }, { status: 400 });
    }
    if (parsed.data.sellingPrice > parsed.data.mrp) {
      return NextResponse.json(
        { message: "Selling price cannot be greater than MRP" },
        { status: 400 }
      );
    }
    if ((parsed.data.inventoryType ?? "store") === "pharmacy") {
      return NextResponse.json(
        { message: "Pharmacy stock must be created through stock transfer from store stock" },
        { status: 400 }
      );
    }

    const medicine = await Medicine.findById(parsed.data.medicineId).lean();
    if (!medicine) {
      return NextResponse.json({ message: "Medicine not found" }, { status: 404 });
    }

    const userId = (session!.user as { id?: string }).id;
    const stock = await MedicineStock.create({
      medicine: parsed.data.medicineId,
      inventoryType: parsed.data.inventoryType ?? "store",
      sourceStock: parsed.data.sourceStockId ?? null,
      batchNo: parsed.data.batchNo,
      expiryDate,
      mrp: parsed.data.mrp,
      sellingPrice: parsed.data.sellingPrice,
      quantityIn: parsed.data.quantityIn,
      quantityOut: 0,
      currentStock: parsed.data.quantityIn,
      minQuantity: (medicine as { minQuantity?: number }).minQuantity ?? 10,
      maxQuantity: (medicine as { maxQuantity?: number }).maxQuantity ?? 0,
      location: parsed.data.location ?? "",
      supplier: parsed.data.supplier ?? "",
      addedBy: userId,
    });
    await StockTransaction.create({
      medicineStock: stock._id,
      medicine: stock.medicine,
      inventoryType: stock.inventoryType,
      transactionType: "in",
      quantity: parsed.data.quantityIn,
      previousQuantity: 0,
      newQuantity: parsed.data.quantityIn,
      reason: "Initial stock entry",
      referenceNumber: "",
      performedBy: userId,
    });
    const populated = await MedicineStock.findById(stock._id)
      .populate("medicine", "name unit")
      .populate("addedBy", "name")
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
