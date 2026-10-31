const mongoose = require('mongoose');

/**
 * Sub-schema for Residential Address
 */
const addressSchema = new mongoose.Schema(
  {
    line1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
    },
    line2: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, 'Postal code is required'],
      trim: true,
      match: [/^[0-9]{5,10}$/, 'Please enter a valid postal code (5 to 10 digits)'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'India',
    },
  },
  { _id: false }
);

/**
 * Sub-schema for Personal Details
 */
const personalDetailsSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\+?[0-9]{10,15}$/, 'Please enter a valid phone number (10 to 15 digits)'],
    },
    address: {
      type: addressSchema,
      required: [true, 'Address is required'],
    },
  },
  { _id: false }
);

/**
 * Sub-schema for Class 10 Academic Qualifications
 */
const class10DetailsSchema = new mongoose.Schema(
  {
    board: {
      type: String,
      required: [true, 'Class 10 board name is required'],
      trim: true,
    },
    passingYear: {
      type: Number,
      required: [true, 'Class 10 passing year is required'],
      min: [1990, 'Passing year must be 1990 or later'],
      max: [new Date().getFullYear(), 'Passing year cannot be in the future'],
    },
    marksPercentage: {
      type: Number,
      required: [true, 'Class 10 marks percentage is required'],
      min: [0, 'Marks percentage cannot be negative'],
      max: [100, 'Marks percentage cannot exceed 100'],
    },
    rollNumber: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

/**
 * Sub-schema for Class 12 / Diploma Academic Qualifications
 */
const class12DetailsSchema = new mongoose.Schema(
  {
    board: {
      type: String,
      required: [true, 'Class 12 board name is required'],
      trim: true,
    },
    passingYear: {
      type: Number,
      required: [true, 'Class 12 passing year is required'],
      min: [1990, 'Passing year must be 1990 or later'],
      max: [new Date().getFullYear() + 1, 'Passing year cannot exceed next academic year'],
    },
    marksPercentage: {
      type: Number,
      required: [true, 'Class 12 marks percentage is required'],
      min: [0, 'Marks percentage cannot be negative'],
      max: [100, 'Marks percentage cannot exceed 100'],
    },
    stream: {
      type: String,
      trim: true,
      default: 'Science',
    },
    rollNumber: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

/**
 * Sub-schema for Optional Entrance Examination Details (e.g. WBJEE, JEE Main, IEMJEE)
 */
const entranceExamSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      trim: true,
      default: '',
    },
    rollNumber: {
      type: String,
      trim: true,
      default: '',
    },
    scoreOrRank: {
      type: String,
      trim: true,
      default: '',
    },
    year: {
      type: Number,
      min: [2015, 'Entrance exam year must be 2015 or later'],
      max: [new Date().getFullYear() + 1, 'Entrance exam year cannot exceed next academic year'],
    },
  },
  { _id: false }
);

/**
 * Sub-schema for Academic Details aggregating 10th, 12th, and entrance exam
 */
const academicDetailsSchema = new mongoose.Schema(
  {
    class10: {
      type: class10DetailsSchema,
      required: [true, 'Class 10 details are required'],
    },
    class12: {
      type: class12DetailsSchema,
      required: [true, 'Class 12 details are required'],
    },
    entranceExam: {
      type: entranceExamSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

/**
 * Main Application Schema
 */
const applicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant reference is required'],
      index: true,
    },
    applicationId: {
      type: String,
      required: [true, 'Application ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    personalDetails: {
      type: personalDetailsSchema,
      required: [true, 'Personal details are required'],
    },
    academicDetails: {
      type: academicDetailsSchema,
      required: [true, 'Academic details are required'],
    },
    selectedProgramme: {
      type: String,
      required: [true, 'Selected programme is required'],
      trim: true,
    },
    status: {
      type: String,
      required: [true, 'Application status is required'],
      enum: {
        values: [
          'Draft',
          'Submitted',
          'Under Review',
          'Verified',
          'Selected',
          'Rejected',
        ],
        message: '{VALUE} is not a valid application status',
      },
      default: 'Draft',
      index: true,
    },
    verificationRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    decisionRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decisionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
