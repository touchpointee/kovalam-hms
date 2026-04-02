import type { FilterQuery } from "mongoose";

export const STOCK_INVENTORY_TYPES = ["store", "pharmacy"] as const;

export type StockInventoryType = (typeof STOCK_INVENTORY_TYPES)[number];

export function normalizeStockInventoryType(value: string | null | undefined): StockInventoryType {
  return value === "pharmacy" ? "pharmacy" : "store";
}

export function buildInventoryTypeQuery<T extends { inventoryType?: StockInventoryType }>(
  inventoryType: StockInventoryType
): FilterQuery<T> {
  if (inventoryType === "pharmacy") {
    return { inventoryType: "pharmacy" } as FilterQuery<T>;
  }

  return {
    $or: [
      { inventoryType: "store" },
      { inventoryType: { $exists: false } },
    ],
  } as FilterQuery<T>;
}
