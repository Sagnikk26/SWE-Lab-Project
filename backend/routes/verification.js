const express = require('express');
const mongoose = require('mongoose');
const { authenticate, authorize } = require('../middleware/auth');
const Application = require('../models/Application');
const Document = require('../models/Document');
const User = require('../models/User');

const router = express.Router();

/**
 * Access Control:
 * All verification endpoints require authentication and authorization for
 * 'verification_officer' role strictly.
 * Administrators, applicants, and unauthenticated clients are forbidden.
 */
router.use(authenticate);
router.use(authorize('verification_officer'));

// Valid application statuses accessible in the verification portal (Drafts are strictly excluded)
const VERIFICATION_STATUSES = [
  'Submitted',
  'Under Review',
  'Verified',
  'Rejected',
];

// Valid document verification statuses based on Document model enum
const VALID_DOCUMENT_STATUSES = ['Pending', 'Verified', 'Rejected'];

// Mandatory documents required for admission application verification
const MANDATORY_DOCUMENT_TYPES = [
  'Class 10 Marksheet',
  'Class 12 Marksheet',
  'Identity Proof',
];

/**
 * Resolves active and superseded documents for an application.
 *
 * Rules:
 * 1. An explicitly replaced document (isReplaced: true, or referenced by replacesDocument, or having replacedBy)
 *    is considered superseded.
 * 2. Documents are grouped by documentType.
 * 3. For each documentType, exactly ONE document is identified as the current active document:
 *    - The latest non-superseded document in chronological order.
 *    - If all documents in that type were flagged, the latest uploaded document for that type.
 * 4. Any other document for that documentType is superseded.
 * 5. Returns { activeDocs, supersededDocs, activeByType }.
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
 * GET /api/verification/stats
 * Summary counts for verification dashboard:
 * - Awaiting review (Submitted)
 * - Under review (Under Review)
 * - Verified
 * - Rejected
 * - Total requiring attention
 */
router.get('/stats', async (req, res) => {
  try {
    const statsAgg = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = {
      submitted: 0,
      underReview: 0,
      verified: 0,
      rejected: 0,
      selected: 0,
      draft: 0,
      total: 0,
      requiringReview: 0,
    };

    statsAgg.forEach((item) => {
      const count = Number(item.count) || 0;
      if (item._id === 'Submitted') statsMap.submitted = count;
      else if (item._id === 'Under Review') statsMap.underReview = count;
      else if (item._id === 'Verified') statsMap.verified = count;
      else if (item._id === 'Selected') statsMap.selected = count;
      else if (item._id === 'Rejected') statsMap.rejected = count;
      else if (item._id === 'Draft') statsMap.draft = count;
    });

    // Exclude drafts from total submitted applications count in verification portal
    statsMap.total =
      statsMap.submitted +
      statsMap.underReview +
      statsMap.verified +
      statsMap.rejected +
      statsMap.selected;
    statsMap.requiringReview = statsMap.submitted + statsMap.underReview;

    // Also count pending documents needing review (excluding superseded/replaced documents)
    const pendingDocumentsCount = await Document.countDocuments({
      verificationStatus: 'Pending',
      isReplaced: { $ne: true },
    });

    return res.status(200).json({
      success: true,
      stats: {
        ...statsMap,
        pendingDocuments: pendingDocumentsCount,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Verification Stats API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification statistics.',
    });
  }
});

/**
 * GET /api/verification/applications
 * Lists applications requiring review with pagination, status filtering, programme filtering, and search.
 * Query Parameters:
 *   - page (number, default: 1)
 *   - limit (number, default: 10, max: 100)
 *   - status (string: Submitted, Under Review, Verified, Rejected, or All)
 *   - programme (string, optional)
 *   - search (string, optional: matches application ID, candidate name, or email)
 */
router.get('/applications', async (req, res) => {
  try {
    const pageNum = parseInt(req.query.page, 10);
    const page = !isNaN(pageNum) && pageNum > 0 ? pageNum : 1;

    const limitNum = parseInt(req.query.limit, 10);
    const limit = !isNaN(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 10;

    const query = {};

    // 1. Status Filter: Exclude drafts; default to verification queue statuses
    const statusParam = req.query.status ? req.query.status.trim() : '';
    if (statusParam && statusParam.toLowerCase() !== 'all') {
      if (!VERIFICATION_STATUSES.includes(statusParam)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter '${statusParam}'. Allowed values: ${VERIFICATION_STATUSES.join(', ')}`,
        });
      }
      query.status = statusParam;
    } else {
      // Default to all active verification statuses, strictly excluding Drafts
      query.status = { $in: VERIFICATION_STATUSES };
    }

    // 2. Programme Filter
    const programmeParam = req.query.programme ? req.query.programme.trim() : '';
    if (programmeParam && programmeParam.toLowerCase() !== 'all') {
      query.selectedProgramme = programmeParam;
    }

    // 3. Search Filter
    const searchParam = req.query.search ? req.query.search.trim() : '';
    if (searchParam) {
      const escapedSearch = searchParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');

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
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // For each application, retrieve document verification counts for rich dashboard progress
    const appIds = applications.map((app) => app._id);
    const docCountsAgg = await Document.aggregate([
      { $match: { application: { $in: appIds }, isReplaced: { $ne: true } } },
      {
        $group: {
          _id: { application: '$application', status: '$verificationStatus' },
          count: { $sum: 1 },
        },
      },
    ]);

    const docStatsMap = {};
    docCountsAgg.forEach((item) => {
      const appId = item._id.application.toString();
      if (!docStatsMap[appId]) {
        docStatsMap[appId] = { total: 0, pending: 0, verified: 0, rejected: 0 };
      }
      const count = Number(item.count) || 0;
      docStatsMap[appId].total += count;
      if (item._id.status === 'Pending') docStatsMap[appId].pending += count;
      else if (item._id.status === 'Verified') docStatsMap[appId].verified += count;
      else if (item._id.status === 'Rejected') docStatsMap[appId].rejected += count;
    });

    const enrichedApplications = applications.map((app) => ({
      ...app,
      documentStats: docStatsMap[app._id.toString()] || {
        total: 0,
        pending: 0,
        verified: 0,
        rejected: 0,
      },
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      applications: enrichedApplications,
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
    console.error('Verification Applications List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve applications for verification.',
    });
  }
});

/**
 * GET /api/verification/applications/:id
 * Retrieves full application details, academic records, and associated documents
 * for verification review.
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

    if (!application || application.status === 'Draft') {
      return res.status(404).json({
        success: false,
        message: 'Application not found or has not been submitted for verification.',
      });
    }

    // Retrieve associated documents with verification audit details
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
          ? { _id: doc.verifiedBy._id, name: doc.verifiedBy.name, email: doc.verifiedBy.email }
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
    console.error('Verification Application Detail Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve application details.',
    });
  }
});

/**
 * PATCH /api/verification/documents/:id/status
 * Updates an individual document's verification status (Verified or Rejected).
 * Request Body:
 *   - status ('Verified' or 'Rejected')
 *   - remarks (string, mandatory if status is 'Rejected')
 *
 * Workflow Rules:
 *   - A rejected document MUST have a meaningful rejection remark (at least 3 characters).
 *   - Document's verification status and remarks are updated.
 *   - Audit trail records verifiedBy = req.user.id (from verified JWT).
 *   - If the parent application is currently in 'Submitted' status, updating a document
 *     advances the application to 'Under Review'.
 *   - Does NOT automatically mark the overall application as 'Verified'.
 */
router.patch('/documents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format.',
      });
    }

    const { status, remarks } = req.body;

    if (!status || !['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status is required and must be either 'Verified' or 'Rejected'.",
      });
    }

    const trimmedRemarks = typeof remarks === 'string' ? remarks.trim() : '';

    // Rule: A rejected document must have a meaningful rejection remark
    if (status === 'Rejected') {
      if (!trimmedRemarks || trimmedRemarks.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'A meaningful rejection remark (at least 3 characters) is required when rejecting a document.',
        });
      }
    }

    const documentRecord = await Document.findById(id);
    if (!documentRecord) {
      return res.status(404).json({
        success: false,
        message: 'Document record not found.',
      });
    }

    if (documentRecord.isReplaced === true) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify verification status of a superseded document. Please review the active replacement file.',
      });
    }

    // Also check if document has been superseded by a newer version of the same type
    if (documentRecord.application) {
      const sameTypeDocs = await Document.find({
        application: documentRecord.application,
        documentType: documentRecord.documentType,
      }).sort({ createdAt: 1 }).lean();
      const { supersededDocs } = resolveApplicationDocuments(sameTypeDocs);
      if (supersededDocs.some((d) => d._id.toString() === documentRecord._id.toString())) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify verification status of a superseded document. Please review the active replacement file.',
        });
      }
    }

    // Update document verification fields
    documentRecord.verificationStatus = status;
    documentRecord.verificationRemarks = trimmedRemarks;
    documentRecord.verifiedBy = req.user.id; // Derived from verified JWT
    await documentRecord.save();

    // Populate verifiedBy info for response
    await documentRecord.populate('verifiedBy', 'name email');

    // Automatically advance parent application to 'Under Review' if it is currently 'Submitted'
    const parentApp = await Application.findById(documentRecord.application);
    if (parentApp && parentApp.status === 'Submitted') {
      parentApp.status = 'Under Review';
      parentApp.verifiedBy = req.user.id;
      if (!parentApp.verificationRemarks) {
        parentApp.verificationRemarks = 'Document review in progress.';
      }
      await parentApp.save();
    }

    return res.status(200).json({
      success: true,
      message: `Document successfully marked as ${status}.`,
      document: {
        _id: documentRecord._id,
        application: documentRecord.application,
        documentType: documentRecord.documentType,
        originalFilename: documentRecord.originalFilename,
        mimeType: documentRecord.mimeType,
        fileSize: documentRecord.fileSize,
        verificationStatus: documentRecord.verificationStatus,
        verificationRemarks: documentRecord.verificationRemarks,
        isReplaced: documentRecord.isReplaced === true,
        replacedBy: documentRecord.replacedBy ? documentRecord.replacedBy.toString() : null,
        replacesDocument: documentRecord.replacesDocument ? documentRecord.replacesDocument.toString() : null,
        fileUrl: `/api/documents/${documentRecord._id}/file`,
        updatedAt: documentRecord.updatedAt,
        verifiedBy: documentRecord.verifiedBy
          ? {
              _id: documentRecord.verifiedBy._id,
              name: documentRecord.verifiedBy.name,
              email: documentRecord.verifiedBy.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Update Document Verification Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update document verification status.',
    });
  }
});

/**
 * PATCH /api/verification/applications/:id/status
 * Updates the overall application status through permitted workflow transitions.
 * Request Body:
 *   - status ('Under Review', 'Verified', 'Rejected')
 *   - remarks (string, mandatory if status is 'Rejected')
 *
 * Workflow Rules & Permitted Transitions:
 *   - Draft applications cannot be verified (must be submitted first).
 *   - Selected applications cannot be modified by verification officers.
 *   - Permitted transitions:
 *       'Submitted'    -> 'Under Review', 'Rejected'
 *       'Under Review' -> 'Verified', 'Rejected'
 *       'Rejected'     -> 'Under Review' (only via explicit correction workflow with remarks)
 *       'Verified'     -> 'Under Review' (only via explicit correction workflow with remarks)
 *   - To transition to 'Verified':
 *       * At least 1 document must be uploaded.
 *       * ALL uploaded documents MUST be in 'Verified' status (none 'Pending' or 'Rejected').
 *   - To transition to 'Rejected':
 *       * A meaningful rejection remark is mandatory (at least 3 characters).
 *   - Records verifiedBy staff member ID and verificationRemarks.
 */
router.patch('/applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const { status, remarks } = req.body;

    const allowedTargetStatuses = ['Under Review', 'Verified', 'Rejected'];
    if (!status || !allowedTargetStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid target status '${status}'. Permitted statuses: ${allowedTargetStatuses.join(', ')}`,
      });
    }

    // Role check: Verification Officers are strictly forbidden from rejecting an entire application.
    // Final application selection and rejection is an Administrator responsibility.
    if (status === 'Rejected' && req.user.role === 'verification_officer') {
      return res.status(403).json({
        success: false,
        message: 'Verification officers are not permitted to reject an entire application. Final admission selection and rejection decisions are strictly reserved for Administrators.',
      });
    }

    const trimmedRemarks = typeof remarks === 'string' ? remarks.trim() : '';

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    const currentStatus = application.status;

    // Check terminal or invalid starting states
    if (currentStatus === 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Cannot verify a draft application. The candidate must submit the application first.',
      });
    }

    if (currentStatus === 'Selected') {
      return res.status(400).json({
        success: false,
        message: 'Application has already received final selection and cannot be modified in verification.',
      });
    }

    if (currentStatus === status) {
      return res.status(400).json({
        success: false,
        message: `Application is already in '${status}' status.`,
      });
    }

    // Transition Logic:
    if (status === 'Verified') {
      // Must not move to Verified directly from Draft or Selected
      // Retrieve ALL documents uploaded for this application to assess complete history and replacement chain
      const allDocs = await Document.find({ application: application._id }).lean();
      if (!allDocs || allDocs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark application as Verified: No admission documents have been uploaded for this candidate.',
        });
      }

      // Resolve current active documents per document type using robust replacement chain analysis
      const { activeDocs, activeByType } = resolveApplicationDocuments(allDocs);

      if (activeDocs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark application as Verified: No active admission documents found.',
        });
      }

      // 1. Mandatory document completeness check
      const missingMandatory = MANDATORY_DOCUMENT_TYPES.filter((type) => !activeByType.has(type));
      if (missingMandatory.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot mark application as Verified: Missing mandatory document(s): ${missingMandatory.join(', ')}. All mandatory documents must be uploaded and verified.`,
        });
      }

      // 2. Check condition: ALL active document types must be verified
      const pendingDocs = activeDocs.filter((d) => d.verificationStatus === 'Pending');
      const rejectedDocs = activeDocs.filter((d) => d.verificationStatus === 'Rejected');

      if (rejectedDocs.length > 0) {
        const rejectedTypes = Array.from(new Set(rejectedDocs.map((d) => d.documentType)));
        return res.status(400).json({
          success: false,
          message: `Cannot mark application as Verified: ${rejectedDocs.length} active document(s) (${rejectedTypes.join(', ')}) are rejected without a verified replacement. All documents must be verified or rectified.`,
        });
      }

      if (pendingDocs.length > 0) {
        const pendingTypes = Array.from(new Set(pendingDocs.map((d) => d.documentType)));
        return res.status(400).json({
          success: false,
          message: `Cannot mark application as Verified: ${pendingDocs.length} active document(s) (${pendingTypes.join(', ')}) are still pending verification. Please review all documents first.`,
        });
      }

      const unverifiedDocs = activeDocs.filter((d) => d.verificationStatus !== 'Verified');
      if (unverifiedDocs.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark application as Verified: Not all active documents are in Verified status.',
        });
      }
    } else if (status === 'Rejected') {
      // Rule: Meaningful remarks required when rejecting
      if (!trimmedRemarks || trimmedRemarks.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'A meaningful remark (at least 3 characters) is required when rejecting an application.',
        });
      }
    } else if (status === 'Under Review') {
      // If moving back from 'Verified' or 'Rejected' to 'Under Review', require explanation remarks
      if (['Verified', 'Rejected'].includes(currentStatus)) {
        if (!trimmedRemarks || trimmedRemarks.length < 3) {
          return res.status(400).json({
            success: false,
            message: `A remark explaining the re-review is required when reopening an application from '${currentStatus}' to 'Under Review'.`,
          });
        }
      }
    }

    // Update application
    application.status = status;
    if (trimmedRemarks) {
      application.verificationRemarks = trimmedRemarks;
    }
    application.verifiedBy = req.user.id; // Derived from verified JWT
    await application.save();

    await application.populate('applicant', 'name email role');
    await application.populate('verifiedBy', 'name email');

    return res.status(200).json({
      success: true,
      message: `Application status successfully updated to '${status}'.`,
      application,
    });
  } catch (error) {
    console.error('Update Application Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update application status.',
    });
  }
});

module.exports = router;
