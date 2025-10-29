import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import {
  validateFacultyRegistration,
  validateLogin,
  validateBooking,
  validateBookingId
} from './middleware/validation.js';
import { hashPassword, comparePassword, generateToken, isValidNecEmail } from './utils/auth.js';
import passport from './config/passport.js';
import nodemailer from 'nodemailer';

const app = express();
const port = 5000;

import session from 'express-session';


// Security middleware
// Configure Content Security Policy carefully. During local development some tools (Vite/devtools)
// use eval() for HMR / source maps. We allow 'unsafe-eval' only in non-production (localhost) to avoid
// blocking developer workflows. DO NOT enable 'unsafe-eval' in production.
if (process.env.NODE_ENV === 'production') {
  app.use(helmet());
} else {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // allow dev server & HMR scripts
            process.env.FRONTEND_URL || 'http://localhost:5173',
            "'unsafe-eval'",
            "'unsafe-inline'",
            'https://cdn.tailwindcss.com'
          ],
          connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173', 'ws://localhost:5173', 'ws://localhost:24678'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com']
        }
      }
    })
  );
}
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// session & passport (needed for Google OAuth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-eval' 'unsafe-inline'");
  next();
});

// Simple Server-Sent Events (SSE) support for real-time booking updates
let sseClients = [];
const broadcastBookingEvent = (payload) => {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(data);
    } catch (e) {
      // ignore write errors
    }
  });
};

app.get('/events/bookings', (req, res) => {
  // SSE endpoint
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // send a comment to establish the stream
  res.write(':ok\n\n');
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(r => r !== res);
  });
});


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

// Configure email transporter (expects SMTP env vars). If SMTP credentials are missing,
// create a safe stub transporter that logs emails instead of sending them. This prevents
// accidental leaking of hard-coded credentials or unwanted test emails.
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
let mailTransporter;
if (smtpUser && smtpPass) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
} else {
  console.warn('SMTP credentials not found in environment. Email sending is disabled and will be logged to console.');
  mailTransporter = {
    sendMail: async (mailOptions) => {
      // Log the mail content but do not send anything
      console.log('[MAIL STUB] sendMail called with:', JSON.stringify({
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text ? mailOptions.text.substring(0, 1000) : undefined,
        html: mailOptions.html ? mailOptions.html.substring(0, 1000) : undefined
      }, null, 2));
      return Promise.resolve({ accepted: [], info: 'stubbed' });
    }
  };
}

const sendDecisionEmail = async ({ toEmail, booking, status, adminNotes }) => {
  try {
    const subject = `Your booking has been ${status}`;
    const body = `Hello,

Your booking for ${booking.roomType || 'a venue'} on ${booking.date || ''} has been ${status}.

${adminNotes ? 'Admin notes: ' + adminNotes + '\n\n' : ''}
Booking details:
Event: ${booking.eventName || booking.purpose || 'N/A'}
Time: ${booking.startTime || ''} - ${booking.endTime || ''}

If you have questions, please contact the administration.

Regards,
Campus Connect Team`;

    await mailTransporter.sendMail({
      // prefer explicit EMAIL_FROM, then SMTP_USER, else a safe no-reply address
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost',
      to: toEmail,
      subject,
      text: body
    });
  } catch (err) {
    console.error('Error sending decision email:', err);
    // swallow error so booking update still succeeds
  }
};

const sendApplyConfirmationEmail = async (email, name, userId, registrationId, paperTitle, allAuthors) => {
  // If SMTP credentials are not configured, we log the email (see transporter stub above)
  const mailOptions = {
    from: `NEC Conference <${process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@localhost'}>`,
    to: email,
    subject: "Conference Registration Confirmation",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2E86C1;">Conference Registration Received</h2>

        <h1 style="color: #fbff00ff; background-color: #ff0000ff;text-align: center;">Registration ID: ${registrationId}</h1>



        <p>Dear <strong>${name}</strong>,</p>
        <p>We have successfully received your paper submission. Your registration has been confirmed with the above Paper ID.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="color: #2E86C1; margin-top: 0;">Paper Details:</h3>
          <p><strong>Paper ID:</strong> ${registrationId}</p>
          <p><strong>Paper Title:</strong> ${paperTitle}</p>
          <p><strong>Created on:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Authors:</strong> ${allAuthors.map(author => author.name).join(', ')}</p>
          <p><strong>Submission Files:</strong> Abstract document attached</p>
        </div>
        <p>Our team will review it and contact you soon.</p>
        <br>
        <p>Thanks</p>
        <p><strong>ICoDSES Team</strong></p>
      </div>
    `
  };

  try {
    await mailTransporter.sendMail(mailOptions);
    console.log(`Email queued (or logged) for ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error && error.message ? error.message : error);
    // Don't throw here to avoid blocking the main flow when email fails
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ---------------- Google OAuth Routes ----------------
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login', session: true }),
  async (req, res) => {
    if (req.user) {
      console.log('Google OAuth callback user:', req.user);
      // Restrict to nec.edu.in emails
      if (!req.user.email || !req.user.email.endsWith('@nec.edu.in')) {
        return res.redirect('http://localhost:5173/login?error=invalid-email');
      }

      // create a JWT token for the user so frontend can call protected endpoints
      try {
  const { users } = await connectDB();
  const dbUser = await users.findOne({ email: req.user.email });

        const tokens = generateToken({
          userId: req.user.googleId || req.user.id,
          email: req.user.email,
          name: req.user.name,
          isAdmin: req.user.email === '2315002@nec.edu.in',
          role: 'faculty'
        });

        // set session user for compatibility
        req.session.user = {
          id: req.user.googleId,
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture
        };

        const userData = {
          id: req.user.googleId,
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture,
          role: 'faculty',
          isRegistered: !!dbUser // if user exists in DB, they are registered
        };

        // Redirect with tokens and user data
        res.redirect(`http://localhost:5173/oauth/callback?` + 
          `accessToken=${encodeURIComponent(tokens.accessToken)}&` +
          `refreshToken=${encodeURIComponent(tokens.refreshToken)}&` +
          `tokenExpiry=${encodeURIComponent(new Date(Date.now() + 24*60*60*1000).toISOString())}&` +
          `userData=${encodeURIComponent(JSON.stringify(userData))}`);
        return;
      } catch (err) {
        console.error('Error generating token for OAuth user:', err);
        return res.redirect('http://localhost:5173/login?error=server_error');
      }
    } else {
      res.redirect('http://localhost:5173/login');
    }
  }
);

// Note: test email endpoint removed for security. Use the transporter stub logs or
// configure SMTP_USER / SMTP_PASS in environment to enable real email sending.

// Conference registration confirmation email endpoint
app.post('/api/email/confirmation', authenticateToken, async (req, res) => {
  try {
    const { email, name, userId, registrationId, paperTitle, allAuthors } = req.body;

    if (!email || !name || !registrationId || !paperTitle || !allAuthors) {
      return res.status(400).json({ error: 'Missing required fields: email, name, registrationId, paperTitle, allAuthors' });
    }

    await sendApplyConfirmationEmail(email, name, userId, registrationId, paperTitle, allAuthors);

    res.json({ message: 'Confirmation email sent successfully' });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    res.status(500).json({ error: 'Failed to send confirmation email', details: error.message });
  }
});

// ==================== AUTHENTICATION ENDPOINTS ====================



// Refresh token endpoint
app.post('/api/auth/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    jwt.verify(refreshToken, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('Refresh token verify failed:', err.message || err);
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      // Build payload for new tokens (preserve role/isAdmin if present)
      const payload = {
        userId: decoded.userId || decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        isAdmin: decoded.isAdmin || false
      };

      const newTokens = generateToken(payload);

      return res.json({ message: 'Token refreshed successfully', ...newTokens });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login handler used for both /api/auth/login and legacy /auth/login
const loginHandler = async (req, res) => {
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

    // Generate JWT tokens
    const tokens = generateToken({
      userId: user._id,
      email: user.email,
      role: user.role || 'faculty',
      isAdmin: user.isAdmin || false
    });

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      ...tokens,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Register both the API and legacy endpoints
app.post('/api/auth/login', validateLogin, loginHandler);
app.post('/auth/login', validateLogin, loginHandler);

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
    // Notify admin clients that bookings changed
    try { broadcastBookingEvent({ type: 'bookings-updated', reason: 'created', id: result.insertedId, timestamp: Date.now() }); } catch (e) { /* ignore */ }
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

    const adminNotes = req.body.admin_notes || null;
    const result = await bookings.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          admin_notes: adminNotes,
          updatedAt: new Date(),
          updatedBy: req.user.userId,
          decision: {
            by: req.user.userId,
            at: new Date()
          }
        }
      }
    );

    if (result.modifiedCount > 0) {
      // Return the updated booking so clients can refresh UI easily
      const updated = await bookings.findOne({ _id: new ObjectId(id) });
      // send notification email on approval/rejection (non-blocking)
      if (['approved', 'rejected'].includes(status)) {
        const recipient = updated.facultyEmail || updated.email;
        // fire-and-forget
        sendDecisionEmail({
          toEmail: recipient,
          booking: updated,
          status,
          adminNotes
        }).catch((e) => console.error('Email send failed:', e));
      }
      res.json({ message: 'Booking status updated successfully', booking: updated });
      // Notify admin clients that bookings changed (status updated)
      try { broadcastBookingEvent({ type: 'bookings-updated', reason: 'status-updated', id, status, timestamp: Date.now() }); } catch (e) { /* ignore */ }
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
    console.log(`Cancel endpoint hit for id=${id} by user=${userEmail || 'unknown'}`);
    const booking = await bookings.findOne({ _id: new ObjectId(id) });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only allow cancel if booking is pending
    if (['approved', 'rejected'].includes((booking.status || '').toLowerCase())) {
      return res.status(400).json({ error: 'Cannot cancel an approved or rejected booking' });
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
      const updated = await bookings.findOne({ _id: new ObjectId(id) });
      console.log(`Booking ${id} cancelled by ${userEmail}`);
      res.json({ message: 'Booking cancelled successfully', booking: updated });
      // Notify admin clients that bookings changed (cancelled)
      try { broadcastBookingEvent({ type: 'bookings-updated', reason: 'cancelled', id, timestamp: Date.now() }); } catch (e) { /* ignore */ }
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
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Debug: list registered routes (only enabled in development)
app.get('/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        // routes registered directly on the app
        routes.push(middleware.route.path);
      } else if (middleware.name === 'router') {
        // router middleware
        middleware.handle.stack.forEach((handler) => {
          const route = handler.route;
          if (route) routes.push(route.path);
        });
      }
    });
    res.json({ routes });
  });

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // Handle specific types of errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    console.error('Database error:', err);
    return res.status(503).json({ 
      error: 'Database service unavailable',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error',
      message: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Authentication error',
      message: 'Invalid or expired token'
    });
  }

  // Default error response
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
