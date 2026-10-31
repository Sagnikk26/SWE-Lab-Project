const express = require('express');
const mongoose = require('mongoose');
const { Application, Document } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Generates a unique, human-readable Application ID (e.g. UEM-2026-749102)
 */
const generateUniqueApplicationId = async () => {
  const currentYear = new Date().getFullYear();
  let isUnique = false;
  let applicationId = '';

  while (!isUnique) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
    applicationId = `UEM-${currentYear}-${randomDigits}`;

    const existing = await Application.findOne({ applicationId });
    if (!existing) {
      isUnique = true;
    }
  }

  return applicationId;
};

/**
 * Helper to validate allowed keys in an object
 */
const checkAllowedKeys = (obj, allowedKeys, location) => {
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      return `Unsupported field: "${key}" in ${location} is not permitted.`;
    }
  }
  return null;
};

/**
 * Validates the application creation payload
 */
const validateApplicationPayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Invalid request body. A JSON object is required.';
  }

  // 1. Check top-level allowed keys
  const allowedTopLevel = ['personalDetails', 'academicDetails', 'selectedProgramme'];
  const topKeyError = checkAllowedKeys(body, allowedTopLevel, 'request body');
  if (topKeyError) return topKeyError;

  const { personalDetails, academicDetails, selectedProgramme } = body;

  // 2. Validate selectedProgramme
  if (!selectedProgramme || typeof selectedProgramme !== 'string') {
    return 'Selected programme is required and must be a valid string.';
  }
  const trimmedProgramme = selectedProgramme.trim();
  if (trimmedProgramme.length < 2 || trimmedProgramme.length > 100) {
    return 'Selected programme must be between 2 and 100 characters.';
  }

  // 3. Validate personalDetails
  if (!personalDetails || typeof personalDetails !== 'object' || Array.isArray(personalDetails)) {
    return 'Personal details are required.';
  }
  const allowedPersonalKeys = ['fullName', 'dateOfBirth', 'phone', 'address'];
  const personalKeyError = checkAllowedKeys(personalDetails, allowedPersonalKeys, 'personalDetails');
  if (personalKeyError) return personalKeyError;

  // fullName
  if (!personalDetails.fullName || typeof personalDetails.fullName !== 'string') {
    return 'Full name is required in personal details.';
  }
  const trimmedFullName = personalDetails.fullName.trim();
  if (trimmedFullName.length < 2 || trimmedFullName.length > 100) {
    return 'Full name must be between 2 and 100 characters.';
  }

  // dateOfBirth
  if (!personalDetails.dateOfBirth) {
    return 'Date of birth is required in personal details.';
  }
  const dob = new Date(personalDetails.dateOfBirth);
  if (isNaN(dob.getTime())) {
    return 'Invalid date of birth format. Please provide a valid date.';
  }
  const now = new Date();
  if (dob >= now) {
    return 'Date of birth cannot be in the future.';
  }
  const birthYear = dob.getFullYear();
  if (birthYear < 1950 || birthYear > now.getFullYear() - 12) {
    return 'Applicant must be at least 12 years of age for admission consideration.';
  }

  // phone
  if (!personalDetails.phone || typeof personalDetails.phone !== 'string') {
    return 'Phone number is required in personal details.';
  }
  const trimmedPhone = personalDetails.phone.trim();
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  if (!phoneRegex.test(trimmedPhone)) {
    return 'Please enter a valid phone number (10 to 15 digits, optional leading +).';
  }

  // address
  if (!personalDetails.address || typeof personalDetails.address !== 'object' || Array.isArray(personalDetails.address)) {
    return 'Address is required in personal details.';
  }
  const allowedAddressKeys = ['line1', 'line2', 'city', 'state', 'pincode', 'country'];
  const addressKeyError = checkAllowedKeys(personalDetails.address, allowedAddressKeys, 'address');
  if (addressKeyError) return addressKeyError;

  const { line1, line2, city, state, pincode, country } = personalDetails.address;
  if (!line1 || typeof line1 !== 'string' || line1.trim().length < 2) {
    return 'Address line 1 is required and must be at least 2 characters.';
  }
  if (line2 !== undefined && typeof line2 !== 'string') {
    return 'Address line 2 must be a string.';
  }
  if (!city || typeof city !== 'string' || city.trim().length < 2) {
    return 'City is required and must be at least 2 characters.';
  }
  if (!state || typeof state !== 'string' || state.trim().length < 2) {
    return 'State is required and must be at least 2 characters.';
  }
  if (!pincode || typeof pincode !== 'string') {
    return 'Postal code (pincode) is required and must be a string.';
  }
  const pincodeRegex = /^[0-9]{5,10}$/;
  if (!pincodeRegex.test(pincode.trim())) {
    return 'Please enter a valid postal code (5 to 10 numeric digits).';
  }
  if (country !== undefined && (typeof country !== 'string' || country.trim().length < 2)) {
    return 'Country must be a valid string of at least 2 characters.';
  }

  // 4. Validate academicDetails
  if (!academicDetails || typeof academicDetails !== 'object' || Array.isArray(academicDetails)) {
    return 'Academic details are required.';
  }
  const allowedAcademicKeys = ['class10', 'class12', 'entranceExam'];
  const academicKeyError = checkAllowedKeys(academicDetails, allowedAcademicKeys, 'academicDetails');
  if (academicKeyError) return academicKeyError;

  // class10
  if (!academicDetails.class10 || typeof academicDetails.class10 !== 'object' || Array.isArray(academicDetails.class10)) {
    return 'Class 10 details are required in academic details.';
  }
  const allowedClass10Keys = ['board', 'passingYear', 'marksPercentage', 'rollNumber'];
  const class10KeyError = checkAllowedKeys(academicDetails.class10, allowedClass10Keys, 'class10');
  if (class10KeyError) return class10KeyError;

  const c10 = academicDetails.class10;
  if (!c10.board || typeof c10.board !== 'string' || c10.board.trim().length < 2) {
    return 'Class 10 board name is required and must be at least 2 characters.';
  }
  if (typeof c10.passingYear !== 'number' || !Number.isInteger(c10.passingYear)) {
    return 'Class 10 passing year is required and must be an integer.';
  }
  const currentYear = now.getFullYear();
  if (c10.passingYear < 1990 || c10.passingYear > currentYear) {
    return `Class 10 passing year must be between 1990 and ${currentYear}.`;
  }
  if (typeof c10.marksPercentage !== 'number' || isNaN(c10.marksPercentage)) {
    return 'Class 10 marks percentage is required and must be a valid number.';
  }
  if (c10.marksPercentage < 0 || c10.marksPercentage > 100) {
    return 'Class 10 marks percentage must be between 0 and 100.';
  }
  if (c10.rollNumber !== undefined && typeof c10.rollNumber !== 'string') {
    return 'Class 10 roll number must be a string.';
  }

  // class12
  if (!academicDetails.class12 || typeof academicDetails.class12 !== 'object' || Array.isArray(academicDetails.class12)) {
    return 'Class 12 details are required in academic details.';
  }
  const allowedClass12Keys = ['board', 'passingYear', 'marksPercentage', 'stream', 'rollNumber'];
  const class12KeyError = checkAllowedKeys(academicDetails.class12, allowedClass12Keys, 'class12');
  if (class12KeyError) return class12KeyError;

  const c12 = academicDetails.class12;
  if (!c12.board || typeof c12.board !== 'string' || c12.board.trim().length < 2) {
    return 'Class 12 board name is required and must be at least 2 characters.';
  }
  if (typeof c12.passingYear !== 'number' || !Number.isInteger(c12.passingYear)) {
    return 'Class 12 passing year is required and must be an integer.';
  }
  if (c12.passingYear < 1990 || c12.passingYear > currentYear + 1) {
    return `Class 12 passing year must be between 1990 and ${currentYear + 1}.`;
  }
  if (c12.passingYear < c10.passingYear) {
    return 'Class 12 passing year cannot precede Class 10 passing year.';
  }
  if (typeof c12.marksPercentage !== 'number' || isNaN(c12.marksPercentage)) {
    return 'Class 12 marks percentage is required and must be a valid number.';
  }
  if (c12.marksPercentage < 0 || c12.marksPercentage > 100) {
    return 'Class 12 marks percentage must be between 0 and 100.';
  }
  if (c12.stream !== undefined && typeof c12.stream !== 'string') {
    return 'Class 12 stream must be a string.';
  }
  if (c12.rollNumber !== undefined && typeof c12.rollNumber !== 'string') {
    return 'Class 12 roll number must be a string.';
  }

  // optional entranceExam
  if (academicDetails.entranceExam !== undefined && academicDetails.entranceExam !== null) {
    if (typeof academicDetails.entranceExam !== 'object' || Array.isArray(academicDetails.entranceExam)) {
      return 'Entrance exam details must be an object.';
    }
    const allowedEntranceKeys = ['examName', 'rollNumber', 'scoreOrRank', 'year'];
    const entranceKeyError = checkAllowedKeys(academicDetails.entranceExam, allowedEntranceKeys, 'entranceExam');
    if (entranceKeyError) return entranceKeyError;

    const ee = academicDetails.entranceExam;
    if (ee.examName !== undefined && typeof ee.examName !== 'string') {
      return 'Entrance exam name must be a string.';
    }
    if (ee.rollNumber !== undefined && typeof ee.rollNumber !== 'string') {
      return 'Entrance exam roll number must be a string.';
    }
    if (ee.scoreOrRank !== undefined && typeof ee.scoreOrRank !== 'string') {
      return 'Entrance exam score/rank must be a string.';
    }
    if (ee.year !== undefined && ee.year !== null) {
      if (typeof ee.year !== 'number' || !Number.isInteger(ee.year)) {
        return 'Entrance exam year must be an integer.';
      }
      if (ee.year < 2015 || ee.year > currentYear + 1) {
        return `Entrance exam year must be between 2015 and ${currentYear + 1}.`;
      }
    }
  }

  return null; // Valid
};

/**
 * POST /api/applications
 * Create or save initial admission application details for the authenticated applicant.
 * Authenticated role must be 'applicant'.
 * Enforces one application per applicant.
 * Derives applicant ID and assigns initial status 'Draft' on the server.
 */
router.post('/', authenticate, async (req, res) => {
  try {
    // Only applicants can create applications
    if (req.user.role !== 'applicant') {
      return res.status(403).json({
        success: false,
        message: 'Only registered applicants can submit admission applications.',
      });
    }

    // Check if the applicant already has an application
    const existing = await Application.findOne({ applicant: req.user.id });
    if (existing) {
      if (existing.status !== 'Draft') {
        return res.status(409).json({
          success: false,
          message: 'An application has already been submitted for this applicant account.',
          applicationId: existing.applicationId,
        });
      }

      // If it's still Draft, update the draft details
      const validationError = validateApplicationPayload(req.body);
      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      const { personalDetails, academicDetails, selectedProgramme } = req.body;
      existing.personalDetails = {
        fullName: personalDetails.fullName.trim(),
        dateOfBirth: new Date(personalDetails.dateOfBirth),
        phone: personalDetails.phone.trim(),
        address: {
          line1: personalDetails.address.line1.trim(),
          line2: personalDetails.address.line2 ? personalDetails.address.line2.trim() : '',
          city: personalDetails.address.city.trim(),
          state: personalDetails.address.state.trim(),
          pincode: personalDetails.address.pincode.trim(),
          country: personalDetails.address.country ? personalDetails.address.country.trim() : 'India',
        },
      };
      existing.academicDetails = {
        class10: {
          board: academicDetails.class10.board.trim(),
          passingYear: academicDetails.class10.passingYear,
          marksPercentage: academicDetails.class10.marksPercentage,
          rollNumber: academicDetails.class10.rollNumber ? academicDetails.class10.rollNumber.trim() : '',
        },
        class12: {
          board: academicDetails.class12.board.trim(),
          passingYear: academicDetails.class12.passingYear,
          marksPercentage: academicDetails.class12.marksPercentage,
          stream: academicDetails.class12.stream ? academicDetails.class12.stream.trim() : 'Science',
          rollNumber: academicDetails.class12.rollNumber ? academicDetails.class12.rollNumber.trim() : '',
        },
        entranceExam: {
          examName: academicDetails.entranceExam?.examName ? academicDetails.entranceExam.examName.trim() : '',
          rollNumber: academicDetails.entranceExam?.rollNumber ? academicDetails.entranceExam.rollNumber.trim() : '',
          scoreOrRank: academicDetails.entranceExam?.scoreOrRank ? academicDetails.entranceExam.scoreOrRank.trim() : '',
          year: academicDetails.entranceExam?.year || undefined,
        },
      };
      existing.selectedProgramme = selectedProgramme.trim();
      await existing.save();

      return res.status(200).json({
        success: true,
        message: 'Application details updated successfully. Proceed to document upload.',
        application: existing,
      });
    }

    // Validate request body
    const validationError = validateApplicationPayload(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    // Generate unique application ID
    const applicationId = await generateUniqueApplicationId();

    // Construct sanitized application object
    const { personalDetails, academicDetails, selectedProgramme } = req.body;

    const applicationData = {
      applicant: req.user.id,
      applicationId,
      personalDetails: {
        fullName: personalDetails.fullName.trim(),
        dateOfBirth: new Date(personalDetails.dateOfBirth),
        phone: personalDetails.phone.trim(),
        address: {
          line1: personalDetails.address.line1.trim(),
          line2: personalDetails.address.line2 ? personalDetails.address.line2.trim() : '',
          city: personalDetails.address.city.trim(),
          state: personalDetails.address.state.trim(),
          pincode: personalDetails.address.pincode.trim(),
          country: personalDetails.address.country ? personalDetails.address.country.trim() : 'India',
        },
      },
      academicDetails: {
        class10: {
          board: academicDetails.class10.board.trim(),
          passingYear: academicDetails.class10.passingYear,
          marksPercentage: academicDetails.class10.marksPercentage,
          rollNumber: academicDetails.class10.rollNumber ? academicDetails.class10.rollNumber.trim() : '',
        },
        class12: {
          board: academicDetails.class12.board.trim(),
          passingYear: academicDetails.class12.passingYear,
          marksPercentage: academicDetails.class12.marksPercentage,
          stream: academicDetails.class12.stream ? academicDetails.class12.stream.trim() : 'Science',
          rollNumber: academicDetails.class12.rollNumber ? academicDetails.class12.rollNumber.trim() : '',
        },
        entranceExam: {
          examName: academicDetails.entranceExam?.examName ? academicDetails.entranceExam.examName.trim() : '',
          rollNumber: academicDetails.entranceExam?.rollNumber ? academicDetails.entranceExam.rollNumber.trim() : '',
          scoreOrRank: academicDetails.entranceExam?.scoreOrRank ? academicDetails.entranceExam.scoreOrRank.trim() : '',
          year: academicDetails.entranceExam?.year || undefined,
        },
      },
      selectedProgramme: selectedProgramme.trim(),
      status: 'Draft', // Initial status when academic details are filled
    };

    const newApplication = await Application.create(applicationData);

    // Link all unlinked documents uploaded by this applicant (if any) to the newly created application
    await Document.updateMany(
      { applicant: req.user.id, application: { $in: [null, undefined] } },
      { application: newApplication._id }
    );

    return res.status(201).json({
      success: true,
      message: 'Application details saved successfully. Proceed to document upload.',
      application: newApplication,
    });
  } catch (error) {
    console.error('Create Application Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating application.',
    });
  }
});

/**
 * PUT /api/applications/:id
 * Updates an existing draft application's academic and personal details.
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    const applicantOwnerId = application.applicant?._id
      ? application.applicant._id.toString()
      : application.applicant.toString();

    if (applicantOwnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only update your own application.',
      });
    }

    if (application.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit application details once final submitted.',
      });
    }

    const validationError = validateApplicationPayload(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const { personalDetails, academicDetails, selectedProgramme } = req.body;
    application.personalDetails = {
      fullName: personalDetails.fullName.trim(),
      dateOfBirth: new Date(personalDetails.dateOfBirth),
      phone: personalDetails.phone.trim(),
      address: {
        line1: personalDetails.address.line1.trim(),
        line2: personalDetails.address.line2 ? personalDetails.address.line2.trim() : '',
        city: personalDetails.address.city.trim(),
        state: personalDetails.address.state.trim(),
        pincode: personalDetails.address.pincode.trim(),
        country: personalDetails.address.country ? personalDetails.address.country.trim() : 'India',
      },
    };
    application.academicDetails = {
      class10: {
        board: academicDetails.class10.board.trim(),
        passingYear: academicDetails.class10.passingYear,
        marksPercentage: academicDetails.class10.marksPercentage,
        rollNumber: academicDetails.class10.rollNumber ? academicDetails.class10.rollNumber.trim() : '',
      },
      class12: {
        board: academicDetails.class12.board.trim(),
        passingYear: academicDetails.class12.passingYear,
        marksPercentage: academicDetails.class12.marksPercentage,
        stream: academicDetails.class12.stream ? academicDetails.class12.stream.trim() : 'Science',
        rollNumber: academicDetails.class12.rollNumber ? academicDetails.class12.rollNumber.trim() : '',
      },
      entranceExam: {
        examName: academicDetails.entranceExam?.examName ? academicDetails.entranceExam.examName.trim() : '',
        rollNumber: academicDetails.entranceExam?.rollNumber ? academicDetails.entranceExam.rollNumber.trim() : '',
        scoreOrRank: academicDetails.entranceExam?.scoreOrRank ? academicDetails.entranceExam.scoreOrRank.trim() : '',
        year: academicDetails.entranceExam?.year || undefined,
      },
    };
    application.selectedProgramme = selectedProgramme.trim();
    await application.save();

    return res.status(200).json({
      success: true,
      message: 'Application details updated successfully.',
      application,
    });
  } catch (error) {
    console.error('Update Application Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating application.',
    });
  }
});

/**
 * POST /api/applications/:id/final-submit
 * Final submission of the admission application by the applicant after uploading all mandatory documents.
 * Transitions application from 'Draft' to 'Submitted'.
 * Enforces mandatory documents: Class 10 Marksheet, Class 12 Marksheet, Identity Proof.
 */
router.post('/:id/final-submit', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    // Ownership check
    const applicantOwnerId = application.applicant?._id
      ? application.applicant._id.toString()
      : application.applicant.toString();

    if (applicantOwnerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only submit your own application.',
      });
    }

    // Check if already submitted
    if (application.status !== 'Draft') {
      return res.status(200).json({
        success: true,
        message: 'Application has already been submitted.',
        application,
      });
    }

    // Enforce mandatory documents upload before final submission (Requirement 8)
    const MANDATORY_DOCUMENT_TYPES = [
      'Class 10 Marksheet',
      'Class 12 Marksheet',
      'Identity Proof',
    ];

    const uploadedDocs = await Document.find({
      application: application._id,
      isReplaced: { $ne: true },
    });

    const normalizeDocType = (t) => (t || '').replace(/\s+/g, '').toLowerCase();
    const uploadedSet = new Set(uploadedDocs.map((d) => normalizeDocType(d.documentType)));

    const missingDocs = MANDATORY_DOCUMENT_TYPES.filter(
      (docType) => !uploadedSet.has(normalizeDocType(docType))
    );

    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing mandatory document(s): ${missingDocs.join(', ')}. All mandatory documents must be uploaded before final submission.`,
        missingDocuments: missingDocs,
      });
    }

    // Transition to Submitted
    application.status = 'Submitted';
    await application.save();

    return res.status(200).json({
      success: true,
      message: 'Application has been successfully submitted.',
      application,
    });
  } catch (error) {
    console.error('Final Submit Application Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while submitting application.',
    });
  }
});

/**
 * GET /api/applications/my
 * Retrieve all applications submitted by the authenticated applicant.
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const applications = await Application.find({ applicant: req.user.id })
      .populate('applicant', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error('Fetch My Applications Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving your applications.',
    });
  }
});

/**
 * GET /api/applications/:id
 * Retrieve a specific application by database ObjectId.
 * Only the owner (applicant) or staff (verification_officer, admin) can access.
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format.',
      });
    }

    const application = await Application.findById(id).populate('applicant', 'name email role');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
    }

    // Authorization: User must be the applicant owner or have staff roles ('admin', 'verification_officer')
    const applicantOwnerId = application.applicant?._id
      ? application.applicant._id.toString()
      : application.applicant.toString();

    const isOwner = applicantOwnerId === req.user.id;
    const isStaff = ['admin', 'verification_officer'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You do not have permission to view this application.',
      });
    }

    return res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Fetch Application By ID Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving application.',
    });
  }
});

/**
 * GET /api/applications/:id/documents
 * Retrieve all documents associated with a specific application.
 * Only the owner (applicant) or staff (verification_officer, admin) can access.
 */
router.get('/:id/documents', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    let application = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      application = await Application.findById(id);
    } else {
      application = await Application.findOne({ applicationId: id });
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

    const sanitizedDocs = documents.map((doc) => ({
      _id: doc._id,
      application: doc.application,
      documentType: doc.documentType,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      verificationStatus: doc.verificationStatus,
      verificationRemarks: doc.verificationRemarks || '',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      fileUrl: `/api/documents/${doc._id}/file`,
    }));

    return res.status(200).json({
      success: true,
      count: sanitizedDocs.length,
      documents: sanitizedDocs,
    });
  } catch (error) {
    console.error('Fetch Application Documents Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving documents.',
    });
  }
});

module.exports = router;
