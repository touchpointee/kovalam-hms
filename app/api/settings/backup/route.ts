import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
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
    const payload = {
      generatedAt: now.toISOString(),
      dbName: db.databaseName,
      collections: backup,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="hms-backup-${timestamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
