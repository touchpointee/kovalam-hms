const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function testConnection() {
    if (!uri) {
        console.error("❌ MONGODB_URI is not set. Please configure it in your environment.");
        process.exit(1);
    }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    try {
        console.log("Attempting to connect to MongoDB Atlas...");
        await client.connect();
        console.log("✅ Successfully connected to MongoDB Atlas!");
        await client.db('admin').command({ ping: 1 });
        console.log("✅ Ping successful!");
    } catch (err) {
        console.error("❌ Connection failed:");
        console.error(err.message);
        if (err.message.includes("IP")) {
            console.log("\n⚠️ Potential IP Whitelist Issue. Ensure your current IP is added to the MongoDB Atlas Network Access list.");
        }
    } finally {
        await client.close();
    }
}

testConnection();
