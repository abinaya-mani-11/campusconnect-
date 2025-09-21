import { MongoClient } from 'mongodb';

const uri = "mongodb+srv://Abinaya_M:abi2006@campusconnectcluster.ifapgvg.mongodb.net/";
const dbName = "campusConnect";

class Database {
    constructor() {
        this.client = new MongoClient(uri);
        this.db = null;
    }

    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db(dbName);
            console.log("✅ Connected to MongoDB!");
            return this.db;
        } catch (error) {
            console.error("❌ MongoDB Connection error:", error);
            throw error;
        }
    }

    getDB() {
        return this.db;
    }

    // Get collection helpers
    faculty() {
        return this.db.collection('faculty');
    }

    bookings() {
        return this.db.collection('bookings');
    }

    users() {
        return this.db.collection('users');
    }

    async close() {
        await this.client.close();
        this.db = null;
        console.log("MongoDB connection closed");
    }
}

// Create a singleton instance
const database = new Database();

export default database;