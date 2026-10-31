const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { authenticate, authorize } = require('../middleware/auth');
const Application = require('../models/Application');
const Document = require('../models/Document');
const User = require('../models/User');

const router = express.Router();

/**
 * Enforce authentication and administrative authorization for all admin endpoints.
 * Public or non-admin roles are strictly forbidden.
 */
router.use(authenticate);
router.use(authorize('admin'));

// Valid application statuses based on Application model enum
const VALID_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Verified',
  'Selected',
  'Rejected',
];

// Submitted application statuses eligible for administrative review and listing.
// Drafts and unsubmitted applications are strictly excluded from admin view.
const SUBMITTED_STATUSES = [
  'Submitted',
  'Under Review',
  'Verified',
  'Selected',
  'Rejected',
];

/**
 * Resolves active and superseded documents for an application.
 */
function resolveApplicationDocuments(allDocs) {
  if (!allDocs || allDocs.length === 0) {
    return { activeDocs: [], supersededDocs: [], activeByType: new Map() };
  }

  const explicitlySupersededIds = new Set();
  allDocs.forEach((d) => {
    const idStr = (d._id || '').toString();
    if (d.isReplaced === true) explicitlySupersededIds.add(idStr);
    if (d.replacesDocument) explicitlySupersededIds.add(d.replacesDocument.toString());
    if (d.replacedBy) explicitlySupersededIds.add(idStr);
  });

  const docsByType = new Map();
  allDocs.forEach((doc) => {
    const type = (doc.documentType || '').trim();
    if (!type) return;
    if (!docsByType.has(type)) docsByType.set(type, []);
    docsByType.get(type).push(doc);
  });

  const activeDocs = [];
  const supersededDocs = [];
  const activeByType = new Map();

  docsByType.forEach((typeDocs, type) => {
    typeDocs.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const strA = (a._id || '').toString();
      const strB = (b._id || '').toString();
      return strA.localeCompare(strB);
    });

    let candidate = null;
    for (let i = typeDocs.length - 1; i >= 0; i--) {
      const d = typeDocs[i];
      const idStr = (d._id || '').toString();
      if (!explicitlySupersededIds.has(idStr) && d.isReplaced !== true) {
        candidate = d;
        break;
      }
    }

    if (!candidate && typeDocs.length > 0) {
      candidate = typeDocs[typeDocs.length - 1];
    }

    if (candidate) {
      const candidateIdStr = (candidate._id || '').toString();
      activeDocs.push(candidate);
      activeByType.set(type, candidate);

      typeDocs.forEach((d) => {
        const idStr = (d._id || '').toString();
        if (idStr !== candidateIdStr) {
          supersededDocs.push(d);
        }
      });
    }
  });

  return { activeDocs, supersededDocs, activeByType };
}

/**
 * GET /api/admin/stats
 * Retrieves live admission dashboard summary statistics.
 * Uses MongoDB aggregation to aggregate counts by status and department/programme directly from actual database records.
 * Excludes draft applications from submitted-application totals and department/programme counts.
 */
router.get('/stats', async (req, res) => {
  try {
    const [statsAgg, programmeAgg] = await Promise.all([
      Application.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Application.aggregate([
        {
          $match: {
            _id: { $exists: true },
            status: { $in: SUBMITTED_STATUSES },
          },
        },
        {
          $project: {
            programme: {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $ifNull: ['$selectedProgramme', null] }, null] },
                    { $eq: [{ $trim: { input: { $ifNull: ['$selectedProgramme', ''] } } }, ''] },
                  ],
                },
                then: 'Unspecified Programme',
                else: { $trim: { input: '$selectedProgramme' } },
              },
            },
          },
        },
        {
          $group: {
            _id: '$programme',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1, _id: 1 },
        },
      ]),
    ]);

    const statsMap = {
      total: 0,
      submitted: 0,
      underReview: 0,
      verified: 0,
      selected: 0,
      rejected: 0,
      draft: 0,
    };

    let submittedTotal = 0;
    statsAgg.forEach((item) => {
      const count = Number(item.count) || 0;
      if (item._id === 'Submitted') {
        statsMap.submitted = count;
        submittedTotal += count;
      } else if (item._id === 'Under Review') {
        statsMap.underReview = count;
        submittedTotal += count;
      } else if (item._id === 'Verified') {
        statsMap.verified = count;
        submittedTotal += count;
      } else if (item._id === 'Selected') {
        statsMap.selected = count;
        submittedTotal += count;
      } else if (item._id === 'Rejected') {
        statsMap.rejected = count;
        submittedTotal += count;
      } else if (item._id === 'Draft') {
        statsMap.draft = count;
      }
    });

    // Total strictly reflects submitted applications (excluding drafts per requirement 7)
    statsMap.total = submittedTotal;

    const programmeStats = (programmeAgg || []).map((item) => ({
      programme: item._id,
      count: Number(item.count) || 0,
    }));

    statsMap.byProgramme = programmeStats;

    return res.status(200).json({
      success: true,
      stats: statsMap,
      programmeStats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin Stats API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve admission statistics.',
    });
  }
});

/**
 * GET /api/admin/applications
 * Lists admission applications with pagination, search, status filtering, and programme filtering.
 * Lists only applications that have actually been finally submitted (excludes Drafts).
 * Query Parameters:
 *   - page (number, default: 1)
 *   - limit (number, default: 10, max: 100)
 *   - search (string: matches applicant name, email, personal full name, or application ID)
 *   - status (string: Submitted, Under Review, Verified, Selected, Rejected, or All)
 *   - programme (string: matches selectedProgramme)
 */
router.get('/applications', async (req, res) => {
  try {
    const pageNum = parseInt(req.query.page, 10);
    const page = !isNaN(pageNum) && pageNum > 0 ? pageNum : 1;

    const limitNum = parseInt(req.query.limit, 10);
    const limit = !isNaN(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 10;

    const query = {};

    // 1. Status Filter Validation: Admin portal lists only submitted applications
    const statusParam = req.query.status ? req.query.status.trim() : '';
    if (statusParam && statusParam.toLowerCase() !== 'all') {
      if (!SUBMITTED_STATUSES.includes(statusParam)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter '${statusParam}'. Allowed submitted values: ${SUBMITTED_STATUSES.join(', ')}`,
        });
      }
      query.status = statusParam;
    } else {
      // Default / 'All': List only applications that have actually been submitted (exclude Drafts)
      query.status = { $in: SUBMITTED_STATUSES };
    }

    // 2. Programme Filter
    const programmeParam = req.query.programme ? req.query.programme.trim() : '';
    if (programmeParam && programmeParam.toLowerCase() !== 'all') {
      query.selectedProgramme = programmeParam;
    }

    // 3. Search Filter (by applicant name, email, or application ID)
    const searchParam = req.query.search ? req.query.search.trim() : '';
    if (searchParam) {
      // Escape regex special characters to prevent regex injection
      const escapedSearch = searchParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');

      // Search users matching name or email
      const matchingUsers = await User.find(
        {
          $or: [{ name: searchRegex }, { email: searchRegex }],
        },
        '_id'
      ).lean();

      const userIds = matchingUsers.map((u) => u._id);

      query.$or = [
        { applicationId: searchRegex },
        { 'personalDetails.fullName': searchRegex },
        { applicant: { $in: userIds } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, applications] = await Promise.all([
      Application.countDocuments(query),
      Application.find(query)
        .populate('applicant', 'name email role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      applications,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Admin Applications List API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve admission applications.',
    });
  }
});

/**
 * GET /api/admin/applications/:id
 * Retrieves full details of a single admission application, including applicant particulars
 * and associated admission documents metadata.
 */
router.get('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const application = await Application.findById(id)
      .populate('applicant', 'name email role createdAt')
      .populate('verifiedBy', 'name email')
      .populate('decisionBy', 'name email')
      .lean();

    if (!application || !SUBMITTED_STATUSES.includes(application.status)) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or has not been finally submitted.',
      });
    }

    // Retrieve associated document metadata
    const documents = await Document.find({ application: application._id })
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    const { supersededDocs } = resolveApplicationDocuments(documents);
    const supersededIdSet = new Set(supersededDocs.map((d) => d._id.toString()));

    // Sanitize document metadata: do not expose internal filesystem paths
    const sanitizedDocuments = documents.map((doc) => {
      const isSuperseded = supersededIdSet.has(doc._id.toString()) || doc.isReplaced === true;
      return {
        _id: doc._id,
        documentType: doc.documentType,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        verificationStatus: doc.verificationStatus,
        verificationRemarks: doc.verificationRemarks || '',
        fileUrl: `/api/documents/${doc._id}/file`,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        verifiedBy: doc.verifiedBy
          ? { name: doc.verifiedBy.name, email: doc.verifiedBy.email }
          : null,
        isReplaced: isSuperseded,
        replacedBy: doc.replacedBy ? doc.replacedBy.toString() : null,
        replacesDocument: doc.replacesDocument ? doc.replacesDocument.toString() : null,
      };
    });

    return res.status(200).json({
      success: true,
      application: {
        ...application,
        documents: sanitizedDocuments,
      },
    });
  } catch (error) {
    console.error('Admin Application Detail API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve application details.',
    });
  }
});

/**
 * PATCH /api/admin/applications/:id/decision
 * Authoritative administrator endpoint to execute final admission decisions (Selected or Rejected).
 * Request Body:
 *   - status ('Selected' or 'Rejected')
 *   - remarks (string, optional for Selected, required for Rejected)
 *
 * Workflow Rules:
 *   - Only administrators can perform final admission selection decisions.
 *   - An application must be in 'Verified' status before it can be 'Selected'.
 *   - When rejecting at decision stage, a meaningful remark (>= 3 chars) is required.
 *   - Audit identity records decisionBy = req.user.id (from verified JWT).
 */
router.patch('/applications/:id/decision', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const { status, remarks } = req.body;

    const allowedStatuses = ['Selected', 'Rejected'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid decision status '${status}'. Allowed statuses: ${allowedStatuses.join(', ')}`,
      });
    }

    const trimmedRemarks = typeof remarks === 'string' ? remarks.trim() : '';

    const application = await Application.findById(id);
    if (!application || !SUBMITTED_STATUSES.includes(application.status)) {
      return res.status(404).json({
        success: false,
        message: 'Application not found or has not been finally submitted.',
      });
    }

    // Rule: Candidate must be Verified by verification officer before final admission Selection
    if (status === 'Selected') {
      if (application.status !== 'Verified') {
        return res.status(400).json({
          success: false,
          message: `Cannot select candidate: Application must be 'Verified' by a verification officer before final admission selection (current status is '${application.status}').`,
        });
      }
    } else if (status === 'Rejected') {
      if (!trimmedRemarks || trimmedRemarks.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'A meaningful remark (at least 3 characters) is required when rejecting an application at final selection stage.',
        });
      }
    }

    // Update decision audit trail
    application.status = status;
    if (trimmedRemarks) {
      application.decisionRemarks = trimmedRemarks;
    }
    application.decisionBy = req.user.id;
    await application.save();

    await application.populate('applicant', 'name email role');
    await application.populate('verifiedBy', 'name email');
    await application.populate('decisionBy', 'name email');

    return res.status(200).json({
      success: true,
      message: `Candidate admission decision updated to '${status}'.`,
      application,
    });
  } catch (error) {
    console.error('Admin Application Decision Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record admission decision.',
    });
  }
});

/**
 * POST /api/admin/staff
 * Provisions a new staff account (admin or verification_officer) or promotes an existing user.
 * Protected by admin authorization.
 *
 * Request body:
 *   - name (string, min 2 chars, max 100)
 *   - email (string, valid email format)
 *   - password (string, min 8 chars)
 *   - role ('admin' or 'verification_officer')
 *   - promote (boolean, optional; if true, permits upgrading an existing user)
 */
router.post('/staff', async (req, res) => {
  try {
    const { name, email, password, role, promote } = req.body;

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

    const allowedStaffRoles = ['admin', 'verification_officer'];
    if (!role || !allowedStaffRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid staff role '${role}'. Role must be one of: ${allowedStaffRoles.join(', ')}.`,
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 8 characters for staff accounts.',
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      if (!promote) {
        return res.status(409).json({
          success: false,
          message: `An account with this email address already exists (${existingUser.role}). Set promote: true to deliberately upgrade or update this user.`,
        });
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      existingUser.name = name.trim();
      existingUser.role = role;
      existingUser.passwordHash = passwordHash;
      await existingUser.save();

      return res.status(200).json({
        success: true,
        message: `Staff account upgraded to '${role}' successfully.`,
        user: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
        },
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    });

    return res.status(201).json({
      success: true,
      message: `Staff account (${role}) provisioned successfully.`,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Staff Provisioning Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to provision staff account.',
    });
  }
});

module.exports = router;
