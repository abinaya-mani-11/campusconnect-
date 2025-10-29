import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = "mongodb+srv://Abinaya_M:abi2006@campusconnectcluster.ifapgvg.mongodb.net/";
const client = new MongoClient(uri);
let db;

// Connect to MongoDB
async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB!");
        db = client.db("campusConnect");
        return true;
    } catch (error) {
        console.error("❌ MongoDB Connection error:", error);
        return false;
    }
}

// Faculty Registration endpoint
app.post('/api/faculty/register', async (req, res) => {
    try {
        const facultyData = req.body;
        const faculty = db.collection("faculty");

        const result = await faculty.updateOne(
            { email: facultyData.email },
            {
                $set: {
                    ...facultyData,
                    updatedAt: new Date(),
                    status: 'active'
                }
            },
            { upsert: true }
        );

        if (result.upsertedCount > 0) {
            res.status(201).json({ message: 'Faculty profile created successfully' });
        } else if (result.modifiedCount > 0) {
            res.status(200).json({ message: 'Faculty profile updated successfully' });
        } else {
            res.status(200).json({ message: 'No changes were needed' });
        }
    } catch (error) {
        console.error('Error registering faculty:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Room Booking endpoint
app.post('/api/bookings/create', async (req, res) => {
    try {
        const bookingData = req.body;
        const bookings = db.collection("bookings");

        // Check for overlapping bookings
        const overlapping = await bookings.findOne({
            roomType: bookingData.roomType,
            date: bookingData.date,
            $or: [
                {
                    startTime: { $lt: bookingData.endTime },
                    endTime: { $gt: bookingData.startTime }
                }
            ]
        });

        if (overlapping) {
            return res.status(400).json({ error: 'This time slot is already booked' });
        }

        // Create booking
        const result = await bookings.insertOne({
            ...bookingData,
            status: 'pending',
            createdAt: new Date()
        });

        res.status(201).json({
            message: 'Booking created successfully',
            bookingId: result.insertedId
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get faculty's bookings
app.get('/api/bookings/faculty/:email', async (req, res) => {
    try {
        const bookings = db.collection("bookings");
        const facultyBookings = await bookings
            .find({
                facultyEmail: req.params.email,
                status: { $ne: 'cancelled' }
            })
            .sort({ date: 1, startTime: 1 })
            .toArray();

        res.json(facultyBookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server after connecting to MongoDB
async function startServer() {
    const isConnected = await connectDB();
    if (isConnected) {
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } else {
        console.error("Failed to start server due to database connection error");
    }
}

startServer();