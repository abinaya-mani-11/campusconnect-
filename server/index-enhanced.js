import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { MongoClient, ObjectId } from 'mongodb';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import {
  validateFacultyRegistration,
  validateLogin,
  validateBooking,
  validateBookingId
} from './middleware/validation.js';
import { hashPassword, comparePassword, generateToken, isValidNecEmail } from './utils/auth.js';

const app = express();
const port = 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const uri = "mongodb+srv://Abinaya_M:abi2006@campusconnectcluster.ifapgvg.mongodb.net/";
const client = new MongoClient(uri);

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB!");
    return {
      faculty: client.db("campusConnect").collection("faculty"),
      bookings: client.db("campusConnect").collection("bookings"),
      users: client.db("campusConnect").collection("users")
    };
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// Login endpoint
app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const { users, faculty } = await connectDB();

    // Find user in users collection
    let user = await users.findOne({ email });

    // If not found in users, check faculty collection
    if (!user) {
      user = await faculty.findOne({ email });
    }

    // If still not found, create a new user account
    if (!user) {
      const hashedPassword = await hashPassword(password);
      const emailPrefix = email.split('@')[0];

      const newUser = {
        email,
        password: hashedPassword,
        name: emailPrefix,
        role: 'faculty',
        isActive: true,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      const result = await users.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    } else {
      // Verify password
      if (!await comparePassword(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await users.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role || 'faculty',
      isAdmin: user.isAdmin || false
    });

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, we'll just return success
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { users, faculty } = await connectDB();

    // Try to find user in both collections
    let user = await users.findOne({ _id: req.user.userId });
    if (!user) {
      user = await faculty.findOne({ email: req.user.email });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== FACULTY MANAGEMENT ENDPOINTS ====================

// Faculty Registration endpoint (updated with validation)
app.post('/api/faculty/register', authenticateToken, validateFacultyRegistration, async (req, res) => {
  try {
    const { faculty, users } = await connectDB();
    const facultyData = req.body;

    // Check if user is authorized to register (should be the same email or admin)
    if (req.user.email !== facultyData.email && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to register this faculty' });
    }

    // Update faculty collection
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

    // Update or create user record
    await users.updateOne(
      { email: facultyData.email },
      {
        $set: {
          name: facultyData.name,
          role: 'faculty',
          isActive: true,
          updatedAt: new Date()
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

// Get faculty profile
app.get('/api/faculty/profile', authenticateToken, async (req, res) => {
  try {
    const { faculty } = await connectDB();
    const userEmail = req.user.email;

    const facultyData = await faculty.findOne({ email: userEmail });

    if (!facultyData) {
      return res.status(404).json({ error: 'Faculty profile not found' });
    }

    res.json({ faculty: facultyData });
  } catch (error) {
    console.error('Error fetching faculty profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update faculty profile
app.put('/api/faculty/profile', authenticateToken, validateFacultyRegistration, async (req, res) => {
  try {
    const { faculty } = await connectDB();
    const userEmail = req.user.email;
    const updateData = req.body;

    const result = await faculty.updateOne(
      { email: userEmail },
      {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      res.json({ message: 'Profile updated successfully' });
    } else {
      res.status(404).json({ error: 'Profile not found or no changes made' });
    }
  } catch (error) {
    console.error('Error updating faculty profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== BOOKING MANAGEMENT ENDPOINTS ====================

// Room Booking endpoint (updated with validation)
app.post('/api/bookings/create', authenticateToken, validateBooking, async (req, res) => {
  try {
    const { bookings } = await connectDB();
    const bookingData = req.body;

    // Verify the booking is for the authenticated user
    if (req.user.email !== bookingData.facultyEmail && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to create booking for this user' });
    }

    // Check for overlapping bookings
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
      return res.status(400).json({
        error: 'This time slot is already booked',
        conflictingBooking: {
          id: overlapping._id,
          startTime: overlapping.startTime,
          endTime: overlapping.endTime
        }
      });
    }

    // Create booking
    const result = await bookings.insertOne({
      ...bookingData,
      status: 'pending',
      createdAt: new Date(),
      createdBy: req.user.userId
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

// Get user's bookings
app.get('/api/bookings/user', authenticateToken, async (req, res) => {
  try {
    const { bookings } = await connectDB();
    const userEmail = req.user.email;

    const userBookings = await bookings.find({
      facultyEmail: userEmail,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 }).toArray();

    res.json({ bookings: userBookings });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all bookings (admin only)
app.get('/api/bookings/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { bookings } = await connectDB();

    const allBookings = await bookings.find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ bookings: allBookings });
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update booking status (admin only)
app.put('/api/bookings/:id/status', authenticateToken, requireAdmin, validateBookingId, async (req, res) => {
  try {
    const { bookings } = await connectDB();
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await bookings.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
          updatedBy: req.user.userId
        }
      }
    );

    if (result.modifiedCount > 0) {
      res.json({ message: 'Booking status updated successfully' });
    } else {
      res.status(404).json({ error: 'Booking not found' });
    }
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel booking
app.put('/api/bookings/:id/cancel', authenticateToken, validateBookingId, async (req, res) => {
  try {
    const { bookings } = await connectDB();
    const { id } = req.params;
    const userEmail = req.user.email;

    // Find the booking first
    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user is authorized to cancel this booking
    if (booking.facultyEmail !== userEmail && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    const result = await bookings.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
          updatedBy: req.user.userId
        }
      }
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

// ==================== DASHBOARD ENDPOINTS ====================

// Dashboard data endpoint
app.get('/api/dashboard/data', authenticateToken, async (req, res) => {
  try {
    const { bookings, faculty } = await connectDB();
    const userEmail = req.user.email;

    // Get user's bookings
    const userBookings = await bookings.find({
      facultyEmail: userEmail,
      status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 }).limit(10).toArray();

    // Get user's faculty profile
    const facultyProfile = await faculty.findOne({ email: userEmail });

    // Get booking statistics
    const stats = await bookings.aggregate([
      { $match: { facultyEmail: userEmail } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    res.json({
      bookings: userBookings,
      facultyProfile,
      statistics: {
        total: userBookings.length,
        pending: stats.find(s => s._id === 'pending')?.count || 0,
        approved: stats.find(s => s._id === 'approved')?.count || 0,
        rejected: stats.find(s => s._id === 'rejected')?.count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get booking statistics (admin only)
app.get('/api/admin/statistics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { bookings, faculty } = await connectDB();

    const stats = await bookings.aggregate([
      {
        $group: {
          _id: {
            status: '$status',
            roomType: '$roomType'
          },
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const totalBookings = await bookings.countDocuments();
    const totalFaculty = await faculty.countDocuments();
    const pendingApprovals = await bookings.countDocuments({ status: 'pending' });

    res.json({
      totalBookings,
      totalFaculty,
      pendingApprovals,
      breakdown: stats
    });
  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
  console.log(`🔐 API Base URL: http://localhost:${port}/api`);
});
