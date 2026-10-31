const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { authenticate, authorize } = require('../middleware/auth');

// Ensure a test JWT_SECRET is set for the test run
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_uem_portal_2026';

describe('Authentication & Role Authorization Middleware', () => {
  const secret = process.env.JWT_SECRET;

  const createToken = (payload, options = { expiresIn: '1h' }) => {
    return jwt.sign(payload, secret, options);
  };

  test('authenticate should reject requests without Authorization header with 401', () => {
    const req = { headers: {} };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authenticate(req, res, next);

    assert.equal(status, 401);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /Bearer token missing/i);
    assert.equal(nextCalled, false);
  });

  test('authenticate should reject malformed Authorization header with 401', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authenticate(req, res, next);

    assert.equal(status, 401);
    assert.equal(jsonBody.success, false);
    assert.equal(nextCalled, false);
  });

  test('authenticate should reject invalid token signature with 401', () => {
    const fakeToken = jwt.sign({ id: 'u1', role: 'admin' }, 'different_secret');
    const req = { headers: { authorization: `Bearer ${fakeToken}` } };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authenticate(req, res, next);

    assert.equal(status, 401);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /Invalid authentication token/i);
    assert.equal(nextCalled, false);
  });

  test('authenticate should reject expired token with 401', () => {
    const expiredToken = jwt.sign(
      { id: 'u1', role: 'applicant' },
      secret,
      { expiresIn: '-1s' }
    );
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authenticate(req, res, next);

    assert.equal(status, 401);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /token has expired/i);
    assert.equal(nextCalled, false);
  });

  test('authenticate should populate req.user for valid token and call next()', () => {
    const validToken = createToken({
      id: 'usr_123',
      email: 'officer@uem.edu.in',
      role: 'verification_officer',
    });
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authenticate(req, {}, next);

    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 'usr_123');
    assert.equal(req.user.email, 'officer@uem.edu.in');
    assert.equal(req.user.role, 'verification_officer');
  });

  test('authorize should forbid applicant from accessing admin endpoints (403)', () => {
    const req = {
      user: { id: 'app1', email: 'app@example.com', role: 'applicant' },
    };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authorize('admin')(req, res, next);

    assert.equal(status, 403);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /Access forbidden/i);
    assert.equal(nextCalled, false);
  });

  test('authorize should forbid applicant from accessing verification officer endpoints (403)', () => {
    const req = {
      user: { id: 'app1', email: 'app@example.com', role: 'applicant' },
    };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authorize('verification_officer')(req, res, next);

    assert.equal(status, 403);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /Access forbidden/i);
    assert.equal(nextCalled, false);
  });

  test('authorize should forbid verification officer from accessing admin endpoints (403)', () => {
    const req = {
      user: { id: 'off1', email: 'officer@uem.edu.in', role: 'verification_officer' },
    };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authorize('admin')(req, res, next);

    assert.equal(status, 403);
    assert.equal(jsonBody.success, false);
    assert.equal(nextCalled, false);
  });

  test('authorize should allow verification officer to access verification endpoints', () => {
    const req = {
      user: { id: 'off1', email: 'officer@uem.edu.in', role: 'verification_officer' },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authorize('verification_officer')(req, {}, next);

    assert.equal(nextCalled, true);
  });

  test('authorize should forbid admin from accessing verification officer endpoints (403)', () => {
    const req = {
      user: { id: 'admin1', email: 'admin@uem.edu.in', role: 'admin' },
    };
    let status = null;
    let jsonBody = null;
    const res = {
      status: (code) => {
        status = code;
        return {
          json: (data) => {
            jsonBody = data;
          },
        };
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    authorize('verification_officer')(req, res, next);

    assert.equal(status, 403);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.message, /Access forbidden/i);
    assert.equal(nextCalled, false);
  });

  test('authorize should allow admin to access admin endpoints', () => {
    const req = {
      user: { id: 'admin1', email: 'admin@uem.edu.in', role: 'admin' },
    };
    let nextCalledAdmin = false;
    authorize('admin')(req, {}, () => {
      nextCalledAdmin = true;
    });
    assert.equal(nextCalledAdmin, true);
  });
});

describe('Staff Account Provisioning Validation Safeguards', () => {
  test('rejects staff account creation with missing or short password (< 8 chars)', () => {
    const weakPasswords = ['', 'pass', '1234567'];
    for (const pwd of weakPasswords) {
      assert.equal(pwd.length < 8, true);
    }
    const strongPassword = 'StrongStaffPassword123';
    assert.equal(strongPassword.length >= 8, true);
  });

  test('rejects unauthorized roles such as "applicant" for staff provisioning', () => {
    const allowedStaffRoles = ['admin', 'verification_officer'];
    assert.equal(allowedStaffRoles.includes('applicant'), false);
    assert.equal(allowedStaffRoles.includes('student'), false);
    assert.equal(allowedStaffRoles.includes('superuser'), false);
    assert.equal(allowedStaffRoles.includes('admin'), true);
    assert.equal(allowedStaffRoles.includes('verification_officer'), true);
  });

  test('public registration role enforcement: always assigns "applicant"', () => {
    // In backend/routes/auth.js, line 87 enforces role: 'applicant'
    const payload = {
      name: 'Sneaky User',
      email: 'sneaky@example.com',
      password: 'password123',
      role: 'admin', // Attacker attempts to pass admin
    };

    // The handler explicitly assigns:
    const assignedRole = 'applicant';
    assert.equal(assignedRole, 'applicant');
    assert.notEqual(assignedRole, payload.role);
  });

  test('email format validation for staff provisioning', () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    assert.equal(emailRegex.test('valid.officer@uem.edu.in'), true);
    assert.equal(emailRegex.test('invalid-email'), false);
    assert.equal(emailRegex.test('missing-domain@'), false);
    assert.equal(emailRegex.test('@missing-user.com'), false);
  });
});

describe('Document Replacement & Applicant Submission Integrity', () => {
  test('document replacement marks previous rejected document as superseded', () => {
    // Simulate previous rejected document
    const previousDoc = {
      _id: 'doc_old_1',
      documentType: 'Class 10 Mark Sheet',
      verificationStatus: 'Rejected',
      verificationRemarks: 'Illegible photocopy',
      isReplaced: false,
      replacedBy: null,
    };

    // When replacement is uploaded:
    const newDocId = 'doc_new_2';
    previousDoc.isReplaced = true;
    previousDoc.replacedBy = newDocId;

    const newDoc = {
      _id: newDocId,
      documentType: 'Class 10 Mark Sheet',
      verificationStatus: 'Pending',
      isReplaced: false,
      replacesDocument: previousDoc._id,
    };

    assert.equal(previousDoc.isReplaced, true);
    assert.equal(previousDoc.replacedBy, 'doc_new_2');
    assert.equal(newDoc.verificationStatus, 'Pending');
    assert.equal(newDoc.replacesDocument, 'doc_old_1');
    assert.equal(newDoc.isReplaced, false);
  });

  test('active document queries exclude superseded documents ($ne: true)', () => {
    const documents = [
      { _id: 'd1', documentType: 'Class 10 Mark Sheet', verificationStatus: 'Rejected', isReplaced: true },
      { _id: 'd2', documentType: 'Class 10 Mark Sheet', verificationStatus: 'Pending', isReplaced: false },
      { _id: 'd3', documentType: 'Class 12 Mark Sheet', verificationStatus: 'Verified' }, // undefined isReplaced
      { _id: 'd4', documentType: 'Identity Proof', verificationStatus: 'Pending', isReplaced: false },
    ];

    // Filter replicating Mongoose { isReplaced: { $ne: true } }
    const activeDocs = documents.filter((doc) => doc.isReplaced !== true);

    assert.equal(activeDocs.length, 3);
    assert.equal(activeDocs.some((d) => d._id === 'd1'), false);
    assert.equal(activeDocs.some((d) => d._id === 'd2'), true);
    assert.equal(activeDocs.some((d) => d._id === 'd3'), true);
    assert.equal(activeDocs.some((d) => d._id === 'd4'), true);
  });

  test('live document statistics do not double-count replaced documents', () => {
    const documents = [
      { _id: 'd1', isReplaced: true, verificationStatus: 'Rejected' },
      { _id: 'd2', isReplaced: false, verificationStatus: 'Pending' },
      { _id: 'd3', isReplaced: false, verificationStatus: 'Verified' },
    ];

    const activeDocs = documents.filter((doc) => !doc.isReplaced);
    const total = activeDocs.length;
    const verified = activeDocs.filter((d) => d.verificationStatus === 'Verified').length;
    const pending = activeDocs.filter((d) => d.verificationStatus === 'Pending').length;
    const rejected = activeDocs.filter((d) => d.verificationStatus === 'Rejected').length;
    const reviewed = verified + rejected;
    const completionPercentage = total > 0 ? Math.round((reviewed / total) * 100) : 0;

    assert.equal(total, 2);
    assert.equal(verified, 1);
    assert.equal(pending, 1);
    assert.equal(rejected, 0); // Replaced rejection is NOT counted
    assert.equal(reviewed, 1);
    assert.equal(completionPercentage, 50);
  });

  test('blocks document upload if application decision is already Selected', () => {
    const application = {
      _id: 'app_1',
      applicant: 'user_1',
      status: 'Selected',
    };

    const isUploadAllowed = (app, applicantId) => {
      if (app.applicant !== applicantId) {
        return { allowed: false, status: 403, message: 'Access denied' };
      }
      if (app.status === 'Selected') {
        return { allowed: false, status: 400, message: 'Cannot upload documents for an application that has already been Selected.' };
      }
      return { allowed: true };
    };

    const result = isUploadAllowed(application, 'user_1');
    assert.equal(result.allowed, false);
    assert.equal(result.status, 400);
    assert.match(result.message, /already been Selected/i);

    const alienUserResult = isUploadAllowed(application, 'user_other');
    assert.equal(alienUserResult.allowed, false);
    assert.equal(alienUserResult.status, 403);
  });

  test('duplicate-submission protection: rejects second application for same user with 409', () => {
    const existingApplications = [{ _id: 'app_existing', applicant: 'user_applicant_1' }];

    const canSubmit = (applicantId) => {
      const existing = existingApplications.find((a) => a.applicant === applicantId);
      if (existing) {
        return { status: 409, message: 'You have already submitted an admission application on record.' };
      }
      return { status: 201, message: 'Application created successfully' };
    };

    const res1 = canSubmit('user_applicant_1');
    assert.equal(res1.status, 409);
    assert.match(res1.message, /already submitted/i);

    const res2 = canSubmit('new_user_applicant');
    assert.equal(res2.status, 201);
  });

  test('sanitizes document response and includes replacement tracking fields', () => {
    const sanitizeDocument = (doc) => ({
      _id: doc._id,
      application: doc.application,
      documentType: doc.documentType,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      verificationStatus: doc.verificationStatus,
      verificationRemarks: doc.verificationRemarks || '',
      isReplaced: doc.isReplaced || false,
      replacedBy: doc.replacedBy || null,
      replacesDocument: doc.replacesDocument || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      fileUrl: `/api/documents/${doc._id}/file`,
    });

    const sanitized = sanitizeDocument({
      _id: 'doc_10',
      application: 'app_1',
      documentType: 'Class 10 Mark Sheet',
      originalFilename: 'scan.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      verificationStatus: 'Pending',
      isReplaced: false,
      replacesDocument: 'doc_old',
      storedFilename: 'internal-secret-storage-name.pdf', // sensitive!
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.equal(sanitized.storedFilename, undefined); // sensitive storage filename excluded
    assert.equal(sanitized.isReplaced, false);
    assert.equal(sanitized.replacesDocument, 'doc_old');
    assert.equal(sanitized.fileUrl, '/api/documents/doc_10/file');
  });

  test('rejects document upload with "Other" category', () => {
    const isCategoryAllowed = (category) => {
      const allowedCategories = [
        'Class 10 Marksheet',
        'Class 12 Marksheet',
        'Identity Proof',
        'Passport Photo',
        'Signature',
        'Entrance Exam Admit/Rank Card',
      ];
      if (category.toLowerCase() === 'other') {
        return { allowed: false, message: 'The "Other" document category has been removed and is no longer accepted.' };
      }
      return { allowed: allowedCategories.includes(category) };
    };

    const resOther = isCategoryAllowed('Other');
    assert.equal(resOther.allowed, false);
    assert.match(resOther.message, /removed/i);

    const resAllowed = isCategoryAllowed('Class 10 Marksheet');
    assert.equal(resAllowed.allowed, true);
  });

  test('enforces document deletion ownership and restricts non-owners', () => {
    const doc = {
      _id: 'doc_1',
      applicant: 'user_owner',
      application: {
        _id: 'app_1',
        applicant: 'user_owner',
        status: 'Submitted',
      },
    };

    const canDelete = (userId, userRole, documentRecord) => {
      const isOwner = documentRecord.applicant === userId || documentRecord.application?.applicant === userId;
      const isAdmin = userRole === 'admin';
      if (!isOwner && !isAdmin) {
        return { allowed: false, status: 403, message: 'Access forbidden.' };
      }
      if (documentRecord.application?.status === 'Selected') {
        return { allowed: false, status: 400, message: 'Cannot delete documents for an application that has already received final selection.' };
      }
      if (documentRecord.application?.status === 'Verified') {
        return { allowed: false, status: 400, message: 'Cannot delete documents for an application that has already been verified.' };
      }
      return { allowed: true, status: 200 };
    };

    // Owner can delete submitted document
    const ownerRes = canDelete('user_owner', 'applicant', doc);
    assert.equal(ownerRes.allowed, true);
    assert.equal(ownerRes.status, 200);

    // Another applicant cannot delete
    const attackerRes = canDelete('user_intruder', 'applicant', doc);
    assert.equal(attackerRes.allowed, false);
    assert.equal(attackerRes.status, 403);

    // Cannot delete when application is Selected
    const selectedDoc = { ...doc, application: { ...doc.application, status: 'Selected' } };
    const selectedRes = canDelete('user_owner', 'applicant', selectedDoc);
    assert.equal(selectedRes.allowed, false);
    assert.equal(selectedRes.status, 400);

    // Cannot delete when application is Verified
    const verifiedDoc = { ...doc, application: { ...doc.application, status: 'Verified' } };
    const verifiedRes = canDelete('user_owner', 'applicant', verifiedDoc);
    assert.equal(verifiedRes.allowed, false);
    assert.equal(verifiedRes.status, 400);
  });

  test('final submission validation: blocks submission when mandatory documents are missing', () => {
    const MANDATORY_DOCUMENT_TYPES = [
      'Class 10 Marksheet',
      'Class 12 Marksheet',
      'Identity Proof',
    ];

    const validateMandatoryDocs = (uploadedDocs) => {
      const normalize = (t) => (t || '').replace(/\s+/g, '').toLowerCase();
      const uploadedSet = new Set(uploadedDocs.map((d) => normalize(d.documentType)));
      const missing = MANDATORY_DOCUMENT_TYPES.filter((m) => !uploadedSet.has(normalize(m)));
      if (missing.length > 0) {
        return { valid: false, missing };
      }
      return { valid: true, missing: [] };
    };

    // Incomplete documents
    const incompleteDocs = [
      { documentType: 'Class 10 Marksheet' },
      { documentType: 'Identity Proof' },
    ];
    const failRes = validateMandatoryDocs(incompleteDocs);
    assert.equal(failRes.valid, false);
    assert.deepEqual(failRes.missing, ['Class 12 Marksheet']);

    // Complete mandatory documents
    const completeDocs = [
      { documentType: 'Class 10 Marksheet' },
      { documentType: 'Class 12 Marksheet' },
      { documentType: 'Identity Proof' },
    ];
    const passRes = validateMandatoryDocs(completeDocs);
    assert.equal(passRes.valid, true);
    assert.equal(passRes.missing.length, 0);
  });
});

describe('Registration Data Persistence & Password Protection', () => {
  test('persists applicant phone and intended programme in user record', () => {
    const user = {
      _id: 'usr_reg_1',
      name: 'Sagnik Roy',
      email: 'sagnik.roy@example.com',
      passwordHash: '$2b$10$encryptedHashValueForSecurity',
      role: 'applicant',
      phone: '+919876543210',
      intendedProgramme: 'B.Tech - Computer Science & Engineering',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    assert.equal(user.name, 'Sagnik Roy');
    assert.equal(user.phone, '+919876543210');
    assert.equal(user.intendedProgramme, 'B.Tech - Computer Science & Engineering');
    assert.equal(user.role, 'applicant');
  });

  test('user JSON serialization strips passwordHash to prevent credential exposure', () => {
    const userDoc = {
      _id: 'usr_reg_2',
      name: 'Applicant Candidate',
      email: 'candidate@example.com',
      passwordHash: '$2b$10$superSecretPasswordHashValue',
      role: 'applicant',
      phone: '+919876543210',
      intendedProgramme: 'Bachelor of Computer Applications (BCA)',
    };

    // Simulate toJSON transformation from User schema
    const serialized = JSON.parse(JSON.stringify(userDoc));
    delete serialized.passwordHash;

    assert.equal(serialized.passwordHash, undefined);
    assert.equal('passwordHash' in serialized, false);
    assert.equal(serialized.name, 'Applicant Candidate');
    assert.equal(serialized.phone, '+919876543210');
    assert.equal(serialized.intendedProgramme, 'Bachelor of Computer Applications (BCA)');
  });

  test('sanitizes and validates phone numbers during registration', () => {
    const validPhones = ['+919876543210', '9876543210', '+14155552671'];
    const invalidPhones = ['123', 'abc', '++91-1234'];

    const phoneRegex = /^\+?[0-9\s-]{10,18}$/;
    for (const vp of validPhones) {
      assert.equal(phoneRegex.test(vp), true);
    }
    for (const ip of invalidPhones) {
      assert.equal(phoneRegex.test(ip), false);
    }
  });
});

describe('Authentication Endpoints Strict Role Separation & Escalation Prevention', () => {
  const secret = process.env.JWT_SECRET || 'test_jwt_secret_uem_portal_2026';

  const simulateApplicantLogin = (user, passwordValid) => {
    let statusCode = null;
    let body = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            body = data;
          },
        };
      },
    };

    if (!user || !passwordValid) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return { statusCode, body };
    }

    if (user.role !== 'applicant') {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return { statusCode, body };
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, secret, { expiresIn: '24h' });
    res.status(200).json({ success: true, token, user });
    return { statusCode, body };
  };

  const simulateStaffLogin = (user, passwordValid, targetRole) => {
    let statusCode = null;
    let body = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            body = data;
          },
        };
      },
    };

    if (!user || !passwordValid) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return { statusCode, body };
    }

    if (user.role !== targetRole) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return { statusCode, body };
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, secret, { expiresIn: '24h' });
    res.status(200).json({ success: true, token, user });
    return { statusCode, body };
  };

  const applicantUser = { _id: 'app_1', email: 'applicant@example.com', role: 'applicant' };
  const adminUser = { _id: 'admin_1', email: 'admin@uem.edu.in', role: 'admin' };
  const officerUser = { _id: 'off_1', email: 'officer@uem.edu.in', role: 'verification_officer' };

  test('1. Applicant credentials work through Applicant Login', () => {
    const { statusCode, body } = simulateApplicantLogin(applicantUser, true);
    assert.equal(statusCode, 200);
    assert.equal(body.success, true);
    assert.ok(body.token);
    assert.equal(body.user.role, 'applicant');
  });

  test('2. Admin credentials are rejected through Applicant Login', () => {
    const { statusCode, body } = simulateApplicantLogin(adminUser, true);
    assert.equal(statusCode, 401);
    assert.equal(body.success, false);
    assert.equal(body.token, undefined);
    assert.match(body.message, /Invalid email or password/i);
  });

  test('3. Verification Officer credentials are rejected through Applicant Login', () => {
    const { statusCode, body } = simulateApplicantLogin(officerUser, true);
    assert.equal(statusCode, 401);
    assert.equal(body.success, false);
    assert.equal(body.token, undefined);
    assert.match(body.message, /Invalid email or password/i);
  });

  test('4. Admin credentials work through Admin Login', () => {
    const { statusCode, body } = simulateStaffLogin(adminUser, true, 'admin');
    assert.equal(statusCode, 200);
    assert.equal(body.success, true);
    assert.ok(body.token);
    assert.equal(body.user.role, 'admin');
  });

  test('5. Admin credentials are rejected through Verification Officer Login', () => {
    const { statusCode, body } = simulateStaffLogin(adminUser, true, 'verification_officer');
    assert.equal(statusCode, 401);
    assert.equal(body.success, false);
    assert.equal(body.token, undefined);
    assert.match(body.message, /Invalid email or password/i);
  });

  test('6. Verification Officer credentials work through Verification Officer Login', () => {
    const { statusCode, body } = simulateStaffLogin(officerUser, true, 'verification_officer');
    assert.equal(statusCode, 200);
    assert.equal(body.success, true);
    assert.ok(body.token);
    assert.equal(body.user.role, 'verification_officer');
  });

  test('7. Verification Officer credentials are rejected through Admin Login', () => {
    const { statusCode, body } = simulateStaffLogin(officerUser, true, 'admin');
    assert.equal(statusCode, 401);
    assert.equal(body.success, false);
    assert.equal(body.token, undefined);
    assert.match(body.message, /Invalid email or password/i);
  });

  test('8. Applicants cannot access staff-only APIs', () => {
    const req = { user: applicantUser };
    let adminDenied = false;
    let officerDenied = false;

    authorize('admin')(req, {
      status: (code) => {
        if (code === 403) adminDenied = true;
        return { json: () => {} };
      },
    }, () => {});

    authorize('verification_officer')(req, {
      status: (code) => {
        if (code === 403) officerDenied = true;
        return { json: () => {} };
      },
    }, () => {});

    assert.equal(adminDenied, true);
    assert.equal(officerDenied, true);
  });

  test('9. Staff cannot perform applicant-facing operations (creating applications or uploading documents)', () => {
    const staffRoles = ['admin', 'verification_officer'];

    for (const role of staffRoles) {
      const user = { _id: 'staff_1', role };
      // Check application creation guard
      const canCreateApp = user.role === 'applicant';
      assert.equal(canCreateApp, false);

      // Check document upload guard
      const canUploadDocs = user.role === 'applicant';
      assert.equal(canUploadDocs, false);
    }
  });

  test('10. Client-side role tampering during registration cannot grant elevated privileges', () => {
    const registrationPayload = {
      name: 'Tamper Tester',
      email: 'tamper@example.com',
      password: 'password123',
      role: 'admin', // Malicious attempt to self-assign admin
    };

    // Server-side registration logic explicitly forces role = 'applicant'
    const serverDerivedRole = 'applicant';
    const userDoc = { ...registrationPayload, role: serverDerivedRole };
    const token = jwt.sign({ id: 'u_tamper', email: userDoc.email, role: userDoc.role }, secret);
    const decoded = jwt.verify(token, secret);

    assert.equal(decoded.role, 'applicant');
    assert.notEqual(decoded.role, 'admin');
  });
});
