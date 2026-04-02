import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/api-auth";
import MedicineStock from "@/models/MedicineStock";
import { withRouteLog } from "@/lib/with-route-log";
import { buildInventoryTypeQuery, normalizeStockInventoryType } from "@/lib/stock";

export const GET = withRouteLog("stock.low.GET", async (req: Request) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireRole(session!, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const inventoryType = normalizeStockInventoryType(searchParams.get("inventoryType"));

    const batches = await MedicineStock.find({
      ...buildInventoryTypeQuery(inventoryType),
    })
      .populate("medicine", "name unit")
      .sort({ expiryDate: 1 })
      .lean();

    const now = new Date();
    const alerts = batches
      .map((batch) => {
        const currentStock = Number((batch as { currentStock?: number }).currentStock ?? 0);
        const minQuantity = Number((batch as { minQuantity?: number }).minQuantity ?? 10);
        const expiryDate = new Date(String((batch as { expiryDate?: string | Date }).expiryDate ?? now));
        const msDiff = expiryDate.getTime() - now.getTime();
        const daysToExpiry = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
        const isOutOfStock = currentStock === 0;
        const isLowStock = currentStock > 0 && currentStock < minQuantity;
        const isCriticalStock = currentStock <= Math.max(1, Math.floor(minQuantity / 2));
        const isExpired = daysToExpiry < 0;
        const isExpiringSoon = daysToExpiry >= 0 && daysToExpiry <= 30;
        const isAlert = isOutOfStock || isLowStock || isExpired || isExpiringSoon;

        return {
          ...batch,
          minQuantity,
          daysToExpiry,
          isOutOfStock,
          isLowStock,
          isCriticalStock,
          isExpired,
          isExpiringSoon,
          isAlert,
        };
      })
      .filter((batch) => batch.isAlert);

    return NextResponse.json(alerts);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
