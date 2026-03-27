import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;

const clientOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
} as const;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;
if (!global._mongoClientPromise) {
  global._mongoClientPromise = new MongoClient(uri, clientOptions).connect();
}
clientPromise = global._mongoClientPromise;

export default clientPromise;
