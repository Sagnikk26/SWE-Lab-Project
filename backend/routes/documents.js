const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const { Document, Application } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Dedicated secure upload directory (outside git tracking)
const UPLOAD_DIR = path.resolve(__dirname, '../uploads/documents');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Supported document types per Document model enum (category "Other" has been removed)
const ALLOWED_DOCUMENT_TYPES = [
  'Class 10 Marksheet',
  'Class 12 Marksheet',
  'Identity Proof',
  'Passport Photo',
  'Signature',
  'Entrance Exam Admit/Rank Card',
];

// Supported MIME types and extensions
const MIME_EXTENSION_MAP = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSION_MAP);
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

// Configure Multer disk storage with server-generated safe filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.bin';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `doc-${uniqueSuffix}${safeExt}`);
  },
});

// File filter validating both MIME type and file extension
const fileFilter = (req, file, cb) => {
  const mimeType = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    const error = new Error('Invalid file type. Only PDF, JPEG, PNG, and WebP documents are permitted.');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error('Invalid file extension. Only .pdf, .jpg, .jpeg, .png, and .webp files are permitted.');
    error.code = 'INVALID_FILE_EXTENSION';
    return cb(error, false);
  }

  const validExtsForMime = MIME_EXTENSION_MAP[mimeType] || [];
  if (!validExtsForMime.includes(ext)) {
    const error = new Error('File extension does not match its detected MIME type.');
    error.code = 'MIME_EXTENSION_MISMATCH';
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB (10,485,760 bytes)
    files: 1,
  },
  fileFilter,
});

/**
 * Middleware wrapper for handling Multer errors cleanly
 */
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds the 10 MB limit (maximum 10,485,760 bytes).',
        });
      }
      if (
        err.code === 'INVALID_FILE_TYPE' ||
        err.code === 'INVALID_FILE_EXTENSION' ||
        err.code === 'MIME_EXTENSION_MISMATCH'
      ) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload validation failed.',
      });
    }
    next();
  });
};

/**
 * Safely removes a file from disk if database metadata creation fails
 */
const cleanupFile = async (filePath) => {
  if (filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup uploaded file:', cleanupErr.message);
    }
  }
};

/**
 * Safely resolves a stored file path to prevent directory traversal
 */
const safeResolveFilePath = (storedFilePath) => {
  if (!storedFilePath || typeof storedFilePath !== 'string') return null;
  const baseName = path.basename(storedFilePath);
  const resolvedPath = path.resolve(UPLOAD_DIR, baseName);

  const relative = path.relative(UPLOAD_DIR, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return resolvedPath;
};

/**
 * Sanitizes document record to avoid exposing server filesystem paths
 */
const sanitizeDocument = (doc) => {
  return {
    _id: doc._id,
    application: doc.application,
    documentType: doc.documentType,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    verificationStatus: doc.verificationStatus,
    verificationRemarks: doc.verificationRemarks || '',
    isReplaced: doc.isReplaced === true,
    replacedBy: doc.replacedBy || null,
    replacesDocument: doc.replacesDocument || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    fileUrl: `/api/documents/${doc._id}/file`,
  };
};

/**
 * POST /api/documents
 * Uploads an admission document for the authenticated applicant's application.
 * Enforces ownership, valid document type, MIME type, extension, and 10MB limit.
 */
router.post('/', authenticate, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a document file to upload.',
      });
    }

    const { documentType, applicationId } = req.body;

    // Explicit rejection of removed "Other" document category (Requirement 3)
    if (documentType && documentType.trim().toLowerCase() === 'other') {
      await cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'The "Other" document category has been removed and is no longer accepted. Please select an official document type.',
      });
    }

    // Validate documentType
    if (!documentType || typeof documentType !== 'string' || !ALLOWED_DOCUMENT_TYPES.includes(documentType.trim())) {
      await cleanupFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: `Invalid document type. Allowed types are: ${ALLOWED_DOCUMENT_TYPES.join(', ')}.`,
      });
    }

    // Locate the application if exists
    let application = null;
    if (applicationId) {
      if (mongoose.Types.ObjectId.isValid(applicationId)) {
        application = await Application.findById(applicationId);
      } else {
        application = await Application.findOne({ applicationId });
      }

      if (!application) {
        await cleanupFile(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Specified application could not be found.',
        });
      }
    } else {
      // Find authenticated applicant's existing application (if submitted)
      application = await Application.findOne({ applicant: req.user.id });
    }

    // Authorize application ownership if an application is linked
    if (application) {
      const applicantOwnerId = application.applicant?._id
        ? application.applicant._id.toString()
        : application.applicant.toString();

      if (req.user.role === 'applicant' && applicantOwnerId !== req.user.id) {
        await cleanupFile(req.file.path);
        return res.status(403).json({
          success: false,
          message: 'Access forbidden. You can only upload documents for your own application.',
        });
      }

      if (application.status === 'Selected') {
        await cleanupFile(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Application has already received final selection. Document uploads are locked.',
        });
      }
    }

    const { replacesDocumentId } = req.body;
    let previousDoc = null;

    if (replacesDocumentId && mongoose.Types.ObjectId.isValid(replacesDocumentId)) {
      previousDoc = await Document.findOne({
        _id: replacesDocumentId,
        $or: [
          { applicant: req.user.id },
          ...(application ? [{ application: application._id }] : [])
        ]
      });
    } else if (application) {
      // Look for any existing non-replaced document of the same type to supersede
      previousDoc = await Document.findOne({
        application: application._id,
        documentType: documentType.trim(),
        isReplaced: { $ne: true },
      }).sort({ verificationStatus: -1, createdAt: -1 });
    } else {
      previousDoc = await Document.findOne({
        applicant: req.user.id,
        documentType: documentType.trim(),
        isReplaced: { $ne: true },
      }).sort({ verificationStatus: -1, createdAt: -1 });
    }

    // Relative reference stored in MongoDB (safe filename only, never absolute path)
    const storedRelativePath = `documents/${req.file.filename}`;

    // Create Document record with server-enforced initial status
    let documentRecord;
    try {
      documentRecord = await Document.create({
        application: application ? application._id : undefined,
        applicant: req.user.id,
        documentType: documentType.trim(),
        filePath: storedRelativePath,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        verificationStatus: 'Pending', // Enforced by server
        verificationRemarks: '',       // Enforced by server
        isReplaced: false,
        replacesDocument: previousDoc ? previousDoc._id : null,
      });

      if (previousDoc) {
        previousDoc.isReplaced = true;
        previousDoc.replacedBy = documentRecord._id;
        await previousDoc.save();

        // Mark any older documents of the same type as replaced to maintain clean replacement chains
        await Document.updateMany(
          {
            _id: { $nin: [documentRecord._id, previousDoc._id] },
            $or: [
              { applicant: req.user.id },
              ...(application ? [{ application: application._id }] : [])
            ],
            documentType: documentType.trim(),
            isReplaced: { $ne: true }
          },
          {
            $set: { isReplaced: true, replacedBy: documentRecord._id }
          }
        );
      }
    } catch (dbErr) {
      // Clean up file if database insertion fails
      await cleanupFile(req.file.path);
      console.error('Database Document Create Error:', dbErr.message);
      return res.status(400).json({
        success: false,
        message: dbErr.message || 'Failed to save document metadata.',
      });
    }

    const successMsg = previousDoc
      ? `Replacement for ${documentType.trim()} uploaded successfully and returned to Pending review.`
      : `${documentType.trim()} uploaded successfully.`;

    return res.status(201).json({
      success: true,
      message: successMsg,
      document: sanitizeDocument(documentRecord),
    });
  } catch (error) {
    if (req.file) {
      await cleanupFile(req.file.path);
    }
    console.error('Document Upload Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during document upload.',
    });
  }
});

/**
 * GET /api/documents/my
 * Retrieves all documents belonging to the authenticated applicant's application.
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    // Find applications owned by applicant
    const applications = await Application.find({ applicant: req.user.id }).select('_id');
    const applicationIds = applications.map((app) => app._id);

    // Fetch documents either linked to the user's application or uploaded by the user directly
    const documents = await Document.find({
      $or: [
        { applicant: req.user.id },
        { application: { $in: applicationIds } },
      ],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents: documents.map(sanitizeDocument),
    });
  } catch (error) {
    console.error('Fetch My Documents Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving documents.',
    });
  }
});

/**
 * GET /api/documents/application/:applicationId
 * Retrieves all documents for a specific application.
 * Accessible by the applicant owner, verification officers, and admins.
 */
router.get('/application/:applicationId', authenticate, async (req, res) => {
  try {
    const { applicationId } = req.params;

    let application = null;
    if (mongoose.Types.ObjectId.isValid(applicationId)) {
      application = await Application.findById(applicationId);
    } else {
      application = await Application.findOne({ applicationId });
    }

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    const applicantOwnerId = application.applicant?._id
      ? application.applicant._id.toString()
      : application.applicant.toString();

    const isOwner = applicantOwnerId === req.user.id;
    const isStaff = ['admin', 'verification_officer'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to view documents for this application.',
      });
    }

    const documents = await Document.find({ application: application._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents: documents.map(sanitizeDocument),
    });
  } catch (error) {
    console.error('Fetch Application Documents Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving application documents.',
    });
  }
});

/**
 * GET /api/documents/:id
 * Retrieves metadata for a single document.
 * Accessible by the applicant owner, verification officers, and admins.
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format.',
      });
    }

    const documentRecord = await Document.findById(id).populate('application', 'applicant applicationId');

    if (!documentRecord) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const application = documentRecord.application;
    const applicantOwnerId = application?.applicant?._id
      ? application.applicant._id.toString()
      : application?.applicant?.toString();

    const isOwner = (documentRecord.applicant && documentRecord.applicant.toString() === req.user.id) ||
      (applicantOwnerId === req.user.id);
    const isStaff = ['admin', 'verification_officer'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to view this document.',
      });
    }

    return res.status(200).json({
      success: true,
      document: sanitizeDocument(documentRecord),
    });
  } catch (error) {
    console.error('Fetch Document Metadata Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving document metadata.',
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Removes an uploaded document and its physical file.
 * Only the owner (applicant) or an admin can delete.
 * Prohibits deleting documents if the application is already 'Selected' or 'Verified'.
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format.',
      });
    }

    const documentRecord = await Document.findById(id).populate('application', 'applicant status');

    if (!documentRecord) {
      return res.status(404).json({
        success: false,
        message: 'Document record not found.',
      });
    }

    // Determine ownership
    const docApplicantId = documentRecord.applicant ? documentRecord.applicant.toString() : null;
    const application = documentRecord.application;
    const appApplicantId = application?.applicant?._id
      ? application.applicant._id.toString()
      : application?.applicant?.toString();

    const isOwner = (docApplicantId === req.user.id) || (appApplicantId === req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only delete your own documents.',
      });
    }

    // Application status restriction: locked if Selected or Verified
    if (application) {
      if (application.status === 'Selected') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete documents for an application that has already received final selection.',
        });
      }
      if (application.status === 'Verified') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete documents for an application that has already been verified.',
        });
      }
    }

    // Securely resolve physical file path and delete file if it exists
    const resolvedPath = safeResolveFilePath(documentRecord.filePath);
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      try {
        await fs.promises.unlink(resolvedPath);
      } catch (unlinkErr) {
        console.error('File Unlink Warning:', unlinkErr.message);
      }
    }

    // Delete database record
    await Document.findByIdAndDelete(documentRecord._id);

    return res.status(200).json({
      success: true,
      message: 'Document removed successfully.',
    });
  } catch (error) {
    console.error('Delete Document Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting document.',
    });
  }
});

/**
 * GET /api/documents/:id/file
 * Authenticated download or preview endpoint for an uploaded document.
 * Enforces ownership or staff role, path traversal checks, and sets proper headers.
 */
router.get('/:id/file', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID format.',
      });
    }

    const documentRecord = await Document.findById(id).populate('application', 'applicant applicationId');

    if (!documentRecord) {
      return res.status(404).json({
        success: false,
        message: 'Document record not found.',
      });
    }

    const application = documentRecord.application;
    const applicantOwnerId = application?.applicant?._id
      ? application.applicant._id.toString()
      : application?.applicant?.toString();

    const isOwner = (documentRecord.applicant && documentRecord.applicant.toString() === req.user.id) ||
      (applicantOwnerId === req.user.id);
    const isStaff = ['admin', 'verification_officer'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to access this file.',
      });
    }

    // Securely resolve physical file path and verify traversal safety
    const resolvedPath = safeResolveFilePath(documentRecord.filePath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({
        success: false,
        message: 'The requested document file could not be found on the server filesystem.',
      });
    }

    // Set correct MIME type
    res.setHeader('Content-Type', documentRecord.mimeType);

    // Determine disposition: attachment for download=true query, inline otherwise
    const isDownload = req.query.download === 'true';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const safeOriginalFilename = encodeURIComponent(documentRecord.originalFilename);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeOriginalFilename}"; filename*=UTF-8''${safeOriginalFilename}`);

    // Stream file securely to authenticated client
    return res.sendFile(resolvedPath);
  } catch (error) {
    console.error('Retrieve Document File Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while accessing document file.',
    });
  }
});

module.exports = router;
