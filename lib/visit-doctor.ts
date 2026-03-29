import mongoose from "mongoose";
import User from "@/models/User";

/** Returns ObjectId to store, or undefined if omitted / empty string. Throws if invalid. */
export async function resolveVisitDoctorId(
  doctorId: string | null | undefined
): Promise<mongoose.Types.ObjectId | undefined> {
  if (doctorId == null || String(doctorId).trim() === "") return undefined;
  const id = String(doctorId).trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid doctor ID");
  }
  const u = (await User.findById(id).select("role isActive").lean()) as {
    role?: string;
    isActive?: boolean;
  } | null;
  if (!u || u.role !== "doctor" || u.isActive === false) {
    throw new Error("Invalid or inactive doctor");
  }
  return new mongoose.Types.ObjectId(id);
}
