import dotenv from 'dotenv';
dotenv.config(); // <-- load .env at the very top

import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import passport from 'passport';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import "./config/passport.js"; // <-- register Google strategy
import { authenticateToken } from './middleware/auth.js';
import { generateToken } from './utils/auth.js';

const app = express();
const port = 5000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Auth Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL + '/login' || 'http://localhost:5173/login', session: true }),
    (req, res) => {
        if (req.user) {
            // Restrict to nec.edu.in emails
            if (!req.user.email.endsWith('@nec.edu.in')) {
                return res.redirect(process.env.FRONTEND_URL + '/login?error=invalid-email' || 'http://localhost:5173/login?error=invalid-email');
            }

            // Generate JWT token for Google OAuth users
            const tokens = generateToken(req.user);
            const token = tokens.accessToken;

            req.session.user = {
                id: req.user.googleId,
                email: req.user.email,
                name: req.user.name,
                picture: req.user.picture
            };

            const userDataParam = encodeURIComponent(JSON.stringify({
                id: req.user.googleId,
                email: req.user.email,
                name: req.user.name,
                picture: req.user.picture,
                token: token
            }));

            res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + `/faculty-registration?userData=${userDataParam}&token=${token}`);
        } else {
            res.redirect(process.env.FRONTEND_URL + '/login' || 'http://localhost:5173/login');
        }
    }
);

// Custom login endpoint for email/password authentication
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if email ends with nec.edu.in
        if (!email.toLowerCase().endsWith('@nec.edu.in')) {
            return res.status(400).json({ error: 'Please use your college email (ending with @nec.edu.in)' });
        }

        // For now, accept any password (you can implement proper password validation later)
        // In a real application, you would verify the password against a database
        const user = {
            email: email,
            name: email.split('@')[0],
            authenticated: true
        };

        // Generate JWT token
        const tokens = generateToken(user);

        // Store user in session
        req.session.user = user;

        res.json({
            message: 'Login successful',
            user: user,
            token: tokens.accessToken
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/auth/current-user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Profile endpoint for JWT authenticated users
app.get('/api/auth/profile', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

app.post('/auth/logout', (req, res) => {
    req.logout(() => {
        res.json({ message: 'Logged out successfully' });
    });
});

// MongoDB connection - cached for serverless
let db;
let client;

async function getDB() {
    if (db) return db;

    try {
        const uri = "mongodb+srv://Abinaya_M:abi2006@campusconnectcluster.ifapgvg.mongodb.net/";
        client = new MongoClient(uri);
        await client.connect();
        console.log("✅ Connected to MongoDB!");
        db = client.db("campusConnect");
        return db;
    } catch (error) {
        console.error("❌ MongoDB Connection error:", error);
        throw error;
    }
}

// Faculty Registration endpoint
app.post('/api/faculty/register', async (req, res) => {
    try {
        const db = await getDB();
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
        const db = await getDB();
        const bookingData = req.body;
        const bookings = db.collection("bookings");

        // Check for overlapping bookings (ignore cancelled bookings so cancelled slots become available)
        const overlapping = await bookings.findOne({
            roomType: bookingData.roomType,
            date: bookingData.date,
            status: { $ne: 'cancelled' },
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

// Check booking availability
app.get('/api/bookings/check-availability', async (req, res) => {
    try {
        const { roomType, date, startTime, endTime } = req.query;
        if (!roomType || !date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const db = await getDB();
        const bookings = db.collection("bookings");
        const overlapping = await bookings.findOne({
            roomType,
            date,
            status: { $ne: 'cancelled' },
            $or: [
                {
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                }
            ]
        });

        res.json({ available: !overlapping });
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all bookings for admin
app.get('/api/bookings/admin/all', async (req, res) => {
    try {
        const db = await getDB();
        const bookings = db.collection("bookings");
        const allBookings = await bookings.find({}).sort({ createdAt: -1 }).toArray();
        res.json(allBookings);
    } catch (error) {
        console.error('Error fetching all bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update booking status for admin
app.put('/api/bookings/admin/:id/status', async (req, res) => {
    try {
        const db = await getDB();
        const { status, admin_notes } = req.body;
        const bookings = db.collection("bookings");
        const result = await bookings.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { status, admin_notes, updatedAt: new Date() } }
        );
        if (result.modifiedCount > 0) {
            res.json({ message: 'Booking status updated' });
        } else {
            res.status(404).json({ error: 'Booking not found' });
        }
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get faculty's bookings
app.get('/api/bookings/faculty/:email', async (req, res) => {
    try {
        const db = await getDB();
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

// Get authenticated user's bookings
app.get('/api/bookings/user', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const bookings = db.collection("bookings");
        const userBookings = await bookings
            .find({
                facultyEmail: req.user.email,
                status: { $ne: 'cancelled' }
            })
            .sort({ date: 1, startTime: 1 })
            .toArray();

        res.json(userBookings);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel a booking
app.put('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const bookingId = req.params.id;
        const bookings = db.collection("bookings");

        // Find the booking to check ownership
        const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if user is owner or admin
        const isOwner = booking.facultyEmail === req.user.email;
        const isAdmin = req.user.isAdmin;

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to cancel this booking' });
        }

        // Only allow cancelling pending bookings
        if (booking.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending bookings can be cancelled' });
        }

        const result = await bookings.updateOne(
            { _id: new ObjectId(bookingId) },
            { $set: { status: 'cancelled', cancelledAt: new Date() } }
        );

        if (result.modifiedCount > 0) {
            res.json({ message: 'Booking cancelled successfully' });
        } else {
            res.status(404).json({ error: 'Booking not found' });
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Rollback a cancelled booking (admin only)
app.put('/api/bookings/:id/rollback', authenticateToken, async (req, res) => {
    try {
        const db = await getDB();
        const bookingId = req.params.id;
        const bookings = db.collection("bookings");

        // Check if user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Find the booking
        const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Only allow rolling back cancelled bookings
        if (booking.status !== 'cancelled') {
            return res.status(400).json({ error: 'Only cancelled bookings can be rolled back' });
        }

        const result = await bookings.updateOne(
            { _id: new ObjectId(bookingId) },
            { $set: { status: 'pending' }, $unset: { cancelledAt: 1 } }
        );

        if (result.modifiedCount > 0) {
            res.json({ message: 'Booking rolled back successfully' });
        } else {
            res.status(404).json({ error: 'Booking not found' });
        }
    } catch (error) {
        console.error('Error rolling back booking:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// For Vercel serverless functions, export the app as a function
export default app;

// For local development, you can still run the server
if (process.env.NODE_ENV !== 'production') {
    // Start server after connecting to MongoDB
    async function startServer() {
        try {
            await getDB();
            app.listen(port, () => {
                console.log(`Server running at http://localhost:${port}`);
            });
        } catch (error) {
            console.error("Failed to start server due to database connection error", error);
        }
    }

    startServer();
}
