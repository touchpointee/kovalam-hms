import mongoose from "mongoose";

/** Drop a registered model so the current schema wins (Next.js HMR / stale caches). */
export function clearRegisteredModel(modelName: string): void {
  try {
    mongoose.deleteModel(modelName);
  } catch {
    if (mongoose.models[modelName]) {
      delete mongoose.models[modelName];
    }
  }
}
