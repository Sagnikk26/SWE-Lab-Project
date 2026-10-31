const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper function to sign JWT token
 */
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }

  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: '24h' }
  );
};

/**
 * POST /api/auth/register
 * Public registration for applicants.
 * Always assigns the 'applicant' role regardless of client payload.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, programme, intendedProgramme } = req.body;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name is required and must be at least 2 characters.',
      });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters.',
      });
    }

    // Sanitize optional registration details
    let sanitizedPhone = '';
    if (phone !== undefined && phone !== null && typeof phone === 'string' && phone.trim()) {
      sanitizedPhone = phone.trim();
      const phoneRegex = /^\+?[0-9\s-]{10,18}$/;
      if (!phoneRegex.test(sanitizedPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10 to 15 digit mobile phone number.',
        });
      }
      sanitizedPhone = sanitizedPhone.replace(/[\s-]/g, '');
    }

    const progInput = programme || intendedProgramme;
    const sanitizedProgramme = progInput && typeof progInput === 'string' ? progInput.trim() : '';

    // Check for existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Enforce applicant role on server side and persist registration details
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'applicant',
      phone: sanitizedPhone,
      intendedProgramme: sanitizedProgramme,
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        intendedProgramme: user.intendedProgramme || '',
      },
    });
  } catch (error) {
    console.error('Registration Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates applicant credentials and returns a signed JWT.
 * Strict Role Boundary: Authenticates applicants ONLY.
 * If valid credentials belong to an Admin or Verification Officer, rejects with a generic error
 * and does NOT issue an applicant token.
 * Does not reveal whether the email exists upon failure.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Use consistent failure response to avoid account enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Role Boundary Enforcement:
    // Check if a specific staff portal was explicitly targeted.
    // If no staff portal was targeted (standard Applicant Login), authenticate APPLICANTS ONLY.
    // If a staff portal was targeted, authenticate ONLY the matching staff role.
    const portal = req.body?.portal;
    const requestedRole = req.body?.role;
    let expectedRole = 'applicant';

    if (portal === 'admin' || requestedRole === 'admin') {
      expectedRole = 'admin';
    } else if (portal === 'verification' || portal === 'verification_officer' || requestedRole === 'verification_officer') {
      expectedRole = 'verification_officer';
    }

    if (user.role !== expectedRole) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        intendedProgramme: user.intendedProgramme || '',
      },
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.',
    });
  }
});

/**
 * Helper to authenticate staff credentials with strict role validation.
 * Rejects mismatching roles, non-staff accounts, or invalid credentials with 401 generic error.
 */
const handleStaffLogin = async (req, res, targetRole) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Role Boundary Enforcement: Authenticate strictly for targetRole
    if (user.role !== targetRole) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Staff authentication successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        intendedProgramme: user.intendedProgramme || '',
      },
    });
  } catch (error) {
    console.error('Staff Login Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during staff authentication.',
    });
  }
};

/**
 * POST /api/auth/staff-login/admin
 * Admin Login endpoint: Authenticates administrators ONLY.
 * Rejects verification officers and applicants with generic 401.
 */
router.post('/staff-login/admin', (req, res) => handleStaffLogin(req, res, 'admin'));
router.post('/admin/login', (req, res) => handleStaffLogin(req, res, 'admin'));

/**
 * POST /api/auth/staff-login/verification
 * Verification Officer Login endpoint: Authenticates verification officers ONLY.
 * Rejects administrators and applicants with generic 401.
 */
router.post('/staff-login/verification', (req, res) => handleStaffLogin(req, res, 'verification_officer'));
router.post('/verification/login', (req, res) => handleStaffLogin(req, res, 'verification_officer'));

/**
 * POST /api/auth/staff-login
 * Dispatches to admin or verification based on portal or role parameter.
 */
router.post('/staff-login', (req, res) => {
  const portal = req.body?.portal || req.body?.role || req.query?.portal;
  if (portal === 'admin') {
    return handleStaffLogin(req, res, 'admin');
  }
  if (portal === 'verification' || portal === 'verification_officer') {
    return handleStaffLogin(req, res, 'verification_officer');
  }
  return res.status(400).json({
    success: false,
    message: 'Staff portal or role must be specified (admin or verification).',
  });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        intendedProgramme: user.intendedProgramme || '',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Fetch Current User Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching user profile.',
    });
  }
});

module.exports = router;
