import bcrypt from 'bcryptjs';

// Hash password
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password with hash
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate JWT token
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // Extended to 7 days
const REFRESH_TOKEN_EXPIRES_IN = '30d'; // 30 days for refresh token

export const generateToken = (payload) => {
  // Ensure required fields are present
  if (!payload.email) {
    throw new Error('Email is required for token generation');
  }

  // Create a standardized payload
  const tokenPayload = {
    userId: payload.userId || payload.id,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    role: payload.role || 'faculty',
    isAdmin: payload.isAdmin || payload.email === '2315002@nec.edu.in',
    iat: Math.floor(Date.now() / 1000),
  };

  // Generate access token
  const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256'
  });

  // Generate refresh token with longer expiration
  const refreshToken = jwt.sign(
    { ...tokenPayload, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN
  };
};

// Validate email format for NEC college
export const isValidNecEmail = (email) => {
  return /^[a-zA-Z0-9._%+-]+@nec\.edu\.in$/.test(email);
};
