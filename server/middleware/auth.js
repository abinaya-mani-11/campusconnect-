import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { generateToken } from '../utils/auth.js';

const router = express.Router();

// Google OAuth login
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google OAuth callback
router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "http://localhost:5173/login", session: false }),
  (req, res) => {
    if (req.user) {
      const token = generateToken(req.user);
      res.redirect(`http://localhost:5173/FacultyRegistration?token=${token}`);
    } else {
      res.redirect("http://localhost:5173/login");
    }
  }
);

// JWT middleware
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    // Safe debug log: indicate whether an Authorization header exists (do not log token value)
    console.debug('Auth middleware - Authorization header present:', !!authHeader);

    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Decode without verification for debugging only (do not trust this data)
    try {
      const decoded = jwt.decode(token) || {};
      // Only log a couple of non-sensitive fields if present
      console.debug('Auth middleware - decoded token (unverified):', {
        email: decoded.email || null,
        userId: decoded.userId || decoded.id || null,
        role: decoded.role || null
      });
    } catch (e) {
      // ignore decode errors
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production', (err, user) => {
      if (err) {
        console.error('Token verification error:', err.message);
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(403).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
      }

      // treat specific email as admin
      if (user && user.email === '2315002@nec.edu.in') {
        user.isAdmin = true;
      }

      // Ensure required user fields
      if (!user.email) {
        return res.status(403).json({ error: 'Invalid token structure' });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional: check admin
export const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
};

export default router;