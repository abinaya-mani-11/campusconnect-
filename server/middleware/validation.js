import { body, param, validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Validation rules for faculty registration
export const validateFacultyRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('department')
    .isIn(['cse', 'it', 'aids', 'ece', 'eee', 'civil', 'mech'])
    .withMessage('Invalid department'),
  body('designation')
    .isIn(['Professor', 'Associate Professor', 'Assistant Professor', 'Head of Department', 'Lab Instructor'])
    .withMessage('Invalid designation'),
  body('email')
    .isEmail()
    .matches(/^[a-zA-Z0-9._%+-]+@nec\.edu\.in$/)
    .withMessage('Email must be a valid NEC college email'),
  handleValidationErrors
];

// Validation rules for login
export const validateLogin = [
  body('email')
    .isEmail()
    .matches(/^[a-zA-Z0-9._%+-]+@nec\.edu\.in$/)
    .withMessage('Email must be a valid NEC college email'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  handleValidationErrors
];

// Validation rules for booking creation
export const validateBooking = [
  body('roomType')
    .isIn(['alumni', 'auditorium', 'library', 'techpark', 'delegate'])
    .withMessage('Invalid room type'),
  body('date')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid start time format (HH:MM)'),
  body('endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Invalid end time format (HH:MM)'),
  body('facultyEmail')
    .isEmail()
    .matches(/^[a-zA-Z0-9._%+-]+@nec\.edu\.in$/)
    .withMessage('Faculty email must be a valid NEC college email'),
  handleValidationErrors
];

// Validation rules for booking ID parameter
export const validateBookingId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  handleValidationErrors
];
