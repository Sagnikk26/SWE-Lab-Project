const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Validates the JWT from the Authorization header and attaches the user payload to req.user.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Bearer token missing or malformed.',
    });
  }

  const token = authHeader.split(' ')[1];

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('Authentication Error: JWT_SECRET is not configured in environment variables.');
    return res.status(500).json({
      success: false,
      message: 'Internal server error: Authentication configuration missing.',
    });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.',
    });
  }
};

/**
 * Role-Based Authorization Middleware
 * Restricts access to users having one of the specified roles.
 * @param  {...string} roles Allowed roles ('applicant', 'verification_officer', 'admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User is not authenticated.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to perform this action.',
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
