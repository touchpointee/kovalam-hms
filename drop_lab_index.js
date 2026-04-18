const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Manually read .env to get MONGODB_URI
function getMongoUri() {
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/MONGODB_URI=(.*)/);
    return match ? match[1].trim() : null;
  } catch (err) {
    console.error('Error reading .env:', err);
    return null;
  }
}

async function run() {
  const uri = getMongoUri();
  if (!uri) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(); 
    const collection = db.collection('labbills');
    
    console.log('Checking indexes on labbills...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    const visitIndex = indexes.find(idx => idx.name === 'visit_1');
    if (visitIndex) {
      console.log('Dropping index visit_1...');
      await collection.dropIndex('visit_1');
      console.log('Index visit_1 dropped successfully.');
    } else {
      console.log('Index visit_1 not found.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

run();
