const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://nithulps:nithul123@cluster0.t55o5tr.mongodb.net/hms?retryWrites=true&w=majority&appName=Cluster0";

async function testConnection() {
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
