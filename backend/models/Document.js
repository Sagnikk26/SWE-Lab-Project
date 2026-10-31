const mongoose = require('mongoose');

/**
 * Document Schema
 * Stores metadata and secure filesystem/cloud paths for uploaded admission documents.
 * File binary contents are never stored directly in MongoDB documents.
 */
const documentSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      index: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: [
          'Class 10 Marksheet',
          'Class 12 Marksheet',
          'Identity Proof',
          'Passport Photo',
          'Signature',
          'Entrance Exam Admit/Rank Card',
        ],
        message: '{VALUE} is not a valid document type',
      },
    },
    filePath: {
      type: String,
      required: [true, 'Stored file path or reference is required'],
      trim: true,
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
      enum: {
        values: [
          'application/pdf',
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp',
        ],
        message: '{VALUE} is not an allowed document MIME type',
      },
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [1, 'File size must be greater than 0 bytes'],
      max: [10485760, 'File size cannot exceed 10MB (10,485,760 bytes)'],
    },
    verificationStatus: {
      type: String,
      required: [true, 'Verification status is required'],
      enum: {
        values: ['Pending', 'Verified', 'Rejected'],
        message: '{VALUE} is not a valid verification status',
      },
      default: 'Pending',
      index: true,
    },
    verificationRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isReplaced: {
      type: Boolean,
      default: false,
      index: true,
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
    },
    replacesDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
    },
  },
  {
    timestamps: true,
  }
);

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
