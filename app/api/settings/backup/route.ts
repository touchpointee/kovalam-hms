import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isMongoScalarLike(value: unknown) {
  if (!value || typeof value !== "object") return false;
  if (value instanceof Date) return true;
  if (typeof (value as { toHexString?: unknown }).toHexString === "function") return true;
  const bsonType = (value as { _bsontype?: unknown })._bsontype;
  return typeof bsonType === "string";
}

function normalizeExportValue(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value;

  if (typeof (value as { toHexString?: () => string }).toHexString === "function") {
    return (value as { toHexString: () => string }).toHexString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeExportValue(item));
  }

  if ((value as { _bsontype?: unknown })._bsontype) {
    if (typeof (value as { toString?: () => string }).toString === "function") {
      return (value as { toString: () => string }).toString();
    }
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      normalizeExportValue(nestedValue),
    ])
  );
}

function asId(value: unknown) {
  const normalized = normalizeExportValue(value);
  if (normalized === null || normalized === undefined || normalized === "") return "";
  return String(normalized);
}

function joinNonEmpty(parts: unknown[], separator = " | ") {
  return parts
    .map((part) => serializeCellValue(part).trim())
    .filter(Boolean)
    .join(separator);
}

function buildReferenceLookups(collections: Record<string, unknown[]>) {
  const getRows = (name: string) => collections[name] ?? [];

  const patients = new Map<string, string>();
  for (const row of getRows("patients")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    patients.set(id, joinNonEmpty([item.regNo, item.name], " - "));
  }

  const users = new Map<string, string>();
  for (const row of getRows("users")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    users.set(id, joinNonEmpty([item.name, item.role ? `(${item.role})` : ""], " "));
  }

  const paymentMethods = new Map<string, string>();
  for (const row of getRows("paymentmethods")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    paymentMethods.set(id, joinNonEmpty([item.name, item.code], " - "));
  }

  const visits = new Map<string, string>();
  for (const row of getRows("opvisits")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    visits.set(id, joinNonEmpty([item.receiptNo, item.visitDate], " - "));
  }

  const medicines = new Map<string, string>();
  for (const row of getRows("medicines")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    medicines.set(id, joinNonEmpty([item.name, item.genericName], " - "));
  }

  const medicineStocks = new Map<string, string>();
  for (const row of getRows("medicinestocks")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    const medicineName = medicines.get(asId(item.medicine)) ?? "";
    medicineStocks.set(
      id,
      joinNonEmpty([item.inventoryType, medicineName, item.batchNo, item.expiryDate], " - ")
    );
  }

  const procedures = new Map<string, string>();
  for (const row of getRows("procedures")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    procedures.set(id, joinNonEmpty([item.name, item.price], " - "));
  }

  const labTests = new Map<string, string>();
  for (const row of getRows("labtests")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    labTests.set(id, joinNonEmpty([item.name, item.price], " - "));
  }

  const prescriptions = new Map<string, string>();
  for (const row of getRows("prescriptions")) {
    const item = normalizeExportValue(row) as Record<string, unknown>;
    const id = asId(item._id);
    if (!id) continue;
    prescriptions.set(
      id,
      joinNonEmpty([
        patients.get(asId(item.patient)) ?? asId(item.patient),
        visits.get(asId(item.visit)) ?? asId(item.visit),
      ])
    );
  }

  return {
    patients,
    users,
    paymentMethods,
    visits,
    medicines,
    medicineStocks,
    procedures,
    labTests,
    prescriptions,
  };
}

function summarizeLineItems(items: unknown, kind: "medicine" | "procedure" | "lab") {
  if (!Array.isArray(items)) return serializeCellValue(items);
  return items
    .map((rawItem) => {
      const item = normalizeExportValue(rawItem) as Record<string, unknown>;
      if (kind === "medicine") {
        return joinNonEmpty(
          [item.medicineName, item.batchNo, `Qty ${item.quantity}`, `Total ${item.totalPrice}`],
          " | "
        );
      }
      if (kind === "procedure") {
        return joinNonEmpty([item.procedureName, `Qty ${item.quantity}`, `Total ${item.totalPrice}`], " | ");
      }
      return joinNonEmpty([item.labTestName, `Qty ${item.quantity}`, `Total ${item.totalPrice}`], " | ");
    })
    .filter(Boolean)
    .join(" || ");
}

function transformCollectionRow(
  collectionName: string,
  row: unknown,
  lookups: ReturnType<typeof buildReferenceLookups>
) {
  const item = normalizeExportValue(row) as Record<string, unknown>;
  const cleaned = Object.fromEntries(
    Object.entries(item).filter(([key]) => !["__v"].includes(key))
  ) as Record<string, unknown>;

  switch (collectionName.toLowerCase()) {
    case "opvisits":
      cleaned.patient = lookups.patients.get(asId(cleaned.patient)) ?? asId(cleaned.patient);
      cleaned.doctor = lookups.users.get(asId(cleaned.doctor)) ?? asId(cleaned.doctor);
      cleaned.collectedBy =
        lookups.users.get(asId(cleaned.collectedBy)) ?? asId(cleaned.collectedBy);
      cleaned.paymentMethod =
        lookups.paymentMethods.get(asId(cleaned.paymentMethod)) ?? asId(cleaned.paymentMethod);
      return cleaned;
    case "expenses":
      cleaned.addedBy = lookups.users.get(asId(cleaned.addedBy)) ?? asId(cleaned.addedBy);
      return cleaned;
    case "prescriptions":
      cleaned.patient = lookups.patients.get(asId(cleaned.patient)) ?? asId(cleaned.patient);
      cleaned.visit = lookups.visits.get(asId(cleaned.visit)) ?? asId(cleaned.visit);
      cleaned.doctor = lookups.users.get(asId(cleaned.doctor)) ?? asId(cleaned.doctor);
      cleaned.procedures = Array.isArray(cleaned.procedures)
        ? (cleaned.procedures as unknown[])
            .map((value) => lookups.procedures.get(asId(value)) ?? asId(value))
            .filter(Boolean)
            .join(" || ")
        : serializeCellValue(cleaned.procedures);
      cleaned.labTests = Array.isArray(cleaned.labTests)
        ? (cleaned.labTests as unknown[])
            .map((value) => lookups.labTests.get(asId(value)) ?? asId(value))
            .filter(Boolean)
            .join(" || ")
        : serializeCellValue(cleaned.labTests);
      cleaned.medicines = Array.isArray(cleaned.medicines)
        ? (cleaned.medicines as unknown[])
            .map((entry) => {
              const med = normalizeExportValue(entry) as Record<string, unknown>;
              return joinNonEmpty([med.medicineName, med.dosage, med.frequency, med.duration], " | ");
            })
            .filter(Boolean)
            .join(" || ")
        : serializeCellValue(cleaned.medicines);
      return cleaned;
    case "medicinebills":
      cleaned.patient = lookups.patients.get(asId(cleaned.patient)) ?? asId(cleaned.patient);
      cleaned.visit = lookups.visits.get(asId(cleaned.visit)) ?? asId(cleaned.visit);
      cleaned.prescription =
        lookups.prescriptions.get(asId(cleaned.prescription)) ?? asId(cleaned.prescription);
      cleaned.billedBy = lookups.users.get(asId(cleaned.billedBy)) ?? asId(cleaned.billedBy);
      cleaned.paymentMethod =
        lookups.paymentMethods.get(asId(cleaned.paymentMethod)) ?? asId(cleaned.paymentMethod);
      cleaned.items = summarizeLineItems(cleaned.items, "medicine");
      return cleaned;
    case "procedurebills":
      cleaned.patient = lookups.patients.get(asId(cleaned.patient)) ?? asId(cleaned.patient);
      cleaned.visit = lookups.visits.get(asId(cleaned.visit)) ?? asId(cleaned.visit);
      cleaned.billedBy = lookups.users.get(asId(cleaned.billedBy)) ?? asId(cleaned.billedBy);
      cleaned.paymentMethod =
        lookups.paymentMethods.get(asId(cleaned.paymentMethod)) ?? asId(cleaned.paymentMethod);
      cleaned.items = summarizeLineItems(cleaned.items, "procedure");
      return cleaned;
    case "labbills":
      cleaned.patient = lookups.patients.get(asId(cleaned.patient)) ?? asId(cleaned.patient);
      cleaned.visit = lookups.visits.get(asId(cleaned.visit)) ?? asId(cleaned.visit);
      cleaned.billedBy = lookups.users.get(asId(cleaned.billedBy)) ?? asId(cleaned.billedBy);
      cleaned.paymentMethod =
        lookups.paymentMethods.get(asId(cleaned.paymentMethod)) ?? asId(cleaned.paymentMethod);
      cleaned.items = summarizeLineItems(cleaned.items, "lab");
      return cleaned;
    case "medicinestocks":
      cleaned.medicine = lookups.medicines.get(asId(cleaned.medicine)) ?? asId(cleaned.medicine);
      cleaned.sourceStock =
        lookups.medicineStocks.get(asId(cleaned.sourceStock)) ?? asId(cleaned.sourceStock);
      cleaned.addedBy = lookups.users.get(asId(cleaned.addedBy)) ?? asId(cleaned.addedBy);
      return cleaned;
    case "stocktransactions":
      cleaned.medicineStock =
        lookups.medicineStocks.get(asId(cleaned.medicineStock)) ?? asId(cleaned.medicineStock);
      cleaned.relatedStock =
        lookups.medicineStocks.get(asId(cleaned.relatedStock)) ?? asId(cleaned.relatedStock);
      cleaned.medicine = lookups.medicines.get(asId(cleaned.medicine)) ?? asId(cleaned.medicine);
      cleaned.performedBy =
        lookups.users.get(asId(cleaned.performedBy)) ?? asId(cleaned.performedBy);
      return cleaned;
    case "pushsubscriptions":
      delete cleaned.keys;
      return cleaned;
    default:
      return cleaned;
  }
}

function serializeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const normalized = normalizeExportValue(value);
  if (normalized === null || normalized === undefined) return "";
  if (typeof normalized === "object") return JSON.stringify(normalized);
  return String(normalized);
}

function flattenRecord(
  value: unknown,
  prefix = "",
  target: Record<string, string> = {}
): Record<string, string> {
  if (value === null || value === undefined) {
    if (prefix) target[prefix] = "";
    return target;
  }

  if (value instanceof Date) {
    if (prefix) target[prefix] = value.toISOString();
    return target;
  }

  if (isMongoScalarLike(value)) {
    if (prefix) target[prefix] = serializeCellValue(value);
    return target;
  }

  if (Array.isArray(value)) {
    if (prefix) target[prefix] = serializeCellValue(value);
    return target;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) {
      target[prefix] = "{}";
      return target;
    }
    for (const [key, nestedValue] of entries) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenRecord(nestedValue, nextPrefix, target);
    }
    return target;
  }

  if (prefix) target[prefix] = String(value);
  return target;
}

function buildExcelWorkbook(
  generatedAt: string,
  dbName: string,
  collections: Record<string, unknown[]>
) {
  const lookups = buildReferenceLookups(collections);
  const buildTablesForCollection = (collectionName: string, rows: unknown[]) => {
    const transformedRows = rows.map((row) => transformCollectionRow(collectionName, row, lookups));
    const normalizedCollectionName = collectionName.toLowerCase();

    if (normalizedCollectionName === "medicinestocks") {
      const storeStockRows = transformedRows.filter(
        (row) => (row as Record<string, unknown>).inventoryType === "store"
      );
      const pharmacyStockRows = transformedRows.filter(
        (row) => (row as Record<string, unknown>).inventoryType === "pharmacy"
      );

      return [
        { title: "Store Stock", rows: storeStockRows },
        { title: "Pharmacy Stock", rows: pharmacyStockRows },
      ];
    }

    if (normalizedCollectionName === "stocktransactions") {
      const storeTransactionRows = transformedRows.filter(
        (row) => (row as Record<string, unknown>).inventoryType === "store"
      );
      const pharmacyTransactionRows = transformedRows.filter(
        (row) => (row as Record<string, unknown>).inventoryType === "pharmacy"
      );

      return [
        { title: "Store Stock Transactions", rows: storeTransactionRows },
        { title: "Pharmacy Stock Transactions", rows: pharmacyTransactionRows },
      ];
    }

    return [{ title: humanizeCollectionName(collectionName), rows: transformedRows }];
  };

  const sectionGroups: Array<{ name: string; collections: string[] }> = [
    {
      name: "Front Office Data",
      collections: [
        "patients",
        "opvisits",
        "paymentmethods",
        "billingstaff",
        "opchargesettings",
        "expenses",
      ],
    },
    {
      name: "Pharmacy Data",
      collections: [
        "medicines",
        "medicinebills",
        "medicinecategories",
        "medicinegroups",
        "manufacturers",
        "suppliers",
        "prescriptions",
      ],
    },
    {
      name: "Laboratory Data",
      collections: [
        "labtests",
        "labbills",
        "labnotificationsettings",
        "pushsubscriptions",
      ],
    },
    {
      name: "Stock Data",
      collections: ["medicinestocks", "stocktransactions"],
    },
    {
      name: "Procedure Data",
      collections: ["procedures", "procedurebills"],
    },
    {
      name: "System Data",
      collections: ["users", "systemlogs"],
    },
  ];

  const normalizedEntries = Object.entries(collections).map(([name, rows]) => ({
    rawName: name,
    normalizedName: name.toLowerCase(),
    rows,
  }));

  const assignedCollections = new Set<string>();

  const worksheets = sectionGroups
    .map((section) => {
      const sectionCollections = normalizedEntries.filter((entry) =>
        section.collections.includes(entry.normalizedName)
      );

      sectionCollections.forEach((entry) => assignedCollections.add(entry.rawName));

      return buildSectionWorksheet({
        sheetName: section.name,
        generatedAt,
        dbName,
        tables: sectionCollections.flatMap((entry) =>
          buildTablesForCollection(entry.rawName, entry.rows)
        ),
      });
    })
    .filter(Boolean);

  const unassignedCollections = normalizedEntries
    .filter((entry) => !assignedCollections.has(entry.rawName))
    .map((entry) => ({
      title: humanizeCollectionName(entry.rawName),
      rows: entry.rows,
    }));

  if (unassignedCollections.length > 0) {
    worksheets.push(
      buildSectionWorksheet({
        sheetName: "Other Data",
        generatedAt,
        dbName,
        tables: unassignedCollections.flatMap((table) =>
          buildTablesForCollection(table.title, table.rows)
        ),
      })
    );
  }

  return `<?xml version="1.0"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="SectionTitle">
      <Font ss:Bold="1" ss:Size="14" />
    </Style>
    <Style ss:ID="TableTitle">
      <Font ss:Bold="1" ss:Size="12" />
      <Interior ss:Color="#F3F7FF" ss:Pattern="Solid" />
    </Style>
    <Style ss:ID="Header">
      <Font ss:Bold="1" />
      <Interior ss:Color="#DCEBFF" ss:Pattern="Solid" />
    </Style>
    <Style ss:ID="Meta">
      <Font ss:Bold="1" />
    </Style>
  </Styles>
  ${worksheets.join("")}
</Workbook>`;
}

function humanizeCollectionName(name: string) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSectionWorksheet({
  sheetName,
  generatedAt,
  dbName,
  tables,
}: {
  sheetName: string;
  generatedAt: string;
  dbName: string;
  tables: Array<{ title: string; rows: unknown[] }>;
}) {
  const safeSheetName = sheetName.replace(/[:\\/?*\[\]]/g, "_").slice(0, 31) || "Sheet";

  const rows: string[] = [
    `<Row><Cell ss:StyleID="SectionTitle"><Data ss:Type="String">${escapeXml(sheetName)}</Data></Cell></Row>`,
    `<Row><Cell ss:StyleID="Meta"><Data ss:Type="String">Generated At</Data></Cell><Cell><Data ss:Type="String">${escapeXml(generatedAt)}</Data></Cell></Row>`,
    `<Row><Cell ss:StyleID="Meta"><Data ss:Type="String">Database</Data></Cell><Cell><Data ss:Type="String">${escapeXml(dbName)}</Data></Cell></Row>`,
    "<Row />",
  ];

  if (tables.length === 0) {
    rows.push(
      `<Row><Cell><Data ss:Type="String">No data available for this section.</Data></Cell></Row>`
    );
  }

  for (const table of tables) {
    const flattenedRows = table.rows.map((row) => flattenRecord(row));
    const headers = Array.from(
      flattenedRows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>())
    );

    rows.push(
      `<Row><Cell ss:StyleID="TableTitle"><Data ss:Type="String">${escapeXml(table.title)}</Data></Cell></Row>`
    );

    if (headers.length === 0) {
      rows.push(`<Row><Cell><Data ss:Type="String">No rows found.</Data></Cell></Row>`);
      rows.push("<Row />");
      rows.push("<Row />");
      continue;
    }

    rows.push(
      `<Row>${headers
        .map(
          (header) =>
            `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`
        )
        .join("")}</Row>`
    );

    for (const row of flattenedRows) {
      rows.push(
        `<Row>${headers
          .map((header) => {
            const cellValue = serializeCellValue(row[header] ?? "");
            return `<Cell><Data ss:Type="String">${escapeXml(cellValue)}</Data></Cell>`;
          })
          .join("")}</Row>`
      );
    }

    rows.push("<Row />");
    rows.push("<Row />");
  }

  return `
    <Worksheet ss:Name="${escapeXml(safeSheetName)}">
      <Table>
        ${rows.join("")}
      </Table>
    </Worksheet>
  `;
}

function jsonPayloadResponse(
  payload: { generatedAt: string; dbName: string; collections: Record<string, unknown[]> },
  timestamp: string
) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hms-backup-${timestamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

function excelPayloadResponse(
  payload: { generatedAt: string; dbName: string; collections: Record<string, unknown[]> },
  timestamp: string
) {
  const workbook = buildExcelWorkbook(payload.generatedAt, payload.dbName, payload.collections);
  return new NextResponse(workbook, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="hms-backup-${timestamp}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session, ["admin"]);
    if (forbidden) return forbidden;

    const mongoose = await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ message: "Database connection not ready" }, { status: 500 });
    }
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();

    const backup: Record<string, unknown[]> = {};
    for (const collection of collections) {
      if (!collection.name) continue;
      backup[collection.name] = await db.collection(collection.name).find({}).toArray();
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const generatedAt = now.toISOString();
    const payload = {
      generatedAt,
      dbName: db.databaseName,
      collections: backup,
    };
    const format = req.nextUrl.searchParams.get("format")?.toLowerCase();

    if (format === "excel" || format === "xls") {
      return excelPayloadResponse(payload, timestamp);
    }

    return jsonPayloadResponse(payload, timestamp);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
