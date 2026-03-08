import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: typeof mongoose | undefined;
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (global._mongooseConn) {
    return global._mongooseConn;
  }
  const conn = await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    bufferCommands: false,
  });
  global._mongooseConn = conn;
  return conn;
}
