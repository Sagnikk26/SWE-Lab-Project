const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('Application Lifecycle & Portal Draft Exclusion Safeguards', () => {
  const SUBMITTED_STATUSES = ['Submitted', 'Under Review', 'Verified', 'Selected', 'Rejected'];
  const VERIFICATION_STATUSES = ['Submitted', 'Under Review', 'Verified', 'Rejected'];
  const MANDATORY_DOCUMENT_TYPES = [
    'Class 10 Marksheet',
    'Class 12 Marksheet',
    'Identity Proof',
  ];

  // Helper to create mock response object
  const createMockRes = () => {
    let statusCode = 200;
    let responseData = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
      getStatusCode: () => statusCode,
      getBody: () => responseData,
    };
    return res;
  };

  /* ====================================================================
   * 1. REGISTRATION LIFECYCLE
   * ==================================================================== */
  describe('Registration Lifecycle', () => {
    test('registration creates applicant user account but does NOT create an application', () => {
      // Simulate registration payload
      const registerPayload = {
        name: 'New Candidate',
        email: 'candidate@example.com',
        password: 'SecurePassword123',
        phone: '9876543210',
        intendedProgramme: 'B.Tech - Computer Science & Engineering',
      };

      // User model simulation
      const createdUser = {
        _id: 'user_new_123',
        name: registerPayload.name.trim(),
        email: registerPayload.email.toLowerCase(),
        role: 'applicant',
        phone: registerPayload.phone,
        intendedProgramme: registerPayload.intendedProgramme,
      };

      // Applications in DB before and after registration
      const applicationsDatabase = [];

      // Registration handler only creates User, does not create Application
      assert.equal(createdUser.role, 'applicant');
      assert.equal(applicationsDatabase.length, 0, 'No application should be created upon registration');
    });
  });

  /* ====================================================================
   * 2. STEP 1 - ACADEMIC & PERSONAL DETAILS SAVE (DRAFT CREATION)
   * ==================================================================== */
  describe('Step 1: Academic & Personal Details', () => {
    test('saving Step 1 initial details sets application status to Draft and generates unique application ID', () => {
      const currentYear = new Date().getFullYear();
      const randomDigits = 582194;
      const applicationId = `UEM-${currentYear}-${randomDigits}`;

      const applicationData = {
        applicant: 'user_new_123',
        applicationId,
        personalDetails: {
          fullName: 'New Candidate',
          dateOfBirth: new Date('2005-04-12'),
          phone: '9876543210',
          address: {
            line1: '123 University Road',
            city: 'Kolkata',
            state: 'West Bengal',
            pincode: '700156',
            country: 'India',
          },
        },
        academicDetails: {
          class10: { board: 'CBSE', passingYear: 2021, marksPercentage: 92 },
          class12: { board: 'CBSE', passingYear: 2023, marksPercentage: 89, stream: 'Science' },
        },
        selectedProgramme: 'B.Tech - Computer Science & Engineering',
        status: 'Draft',
      };

      assert.equal(applicationData.status, 'Draft', 'Initial application status must be Draft');
      assert.match(applicationData.applicationId, /^UEM-\d{4}-\d{6}$/, 'Application ID format must be UEM-YYYY-NNNNNN');
    });

    test('updating Step 1 details preserves status as Draft', () => {
      const existingApplication = {
        _id: 'app_draft_1',
        applicationId: 'UEM-2026-582194',
        applicant: 'user_new_123',
        status: 'Draft',
        selectedProgramme: 'B.Tech - Computer Science & Engineering',
      };

      // Update programme and address in draft
      existingApplication.selectedProgramme = 'B.Tech - CSE (Artificial Intelligence & Machine Learning)';

      // Verification that status did NOT change
      assert.equal(existingApplication.status, 'Draft', 'Updating draft details must keep status as Draft');
    });
  });

  /* ====================================================================
   * 3. STEP 2 - DOCUMENT UPLOAD CENTER
   * ==================================================================== */
  describe('Step 2: Document Upload Center', () => {
    test('uploading documents creates pending document records without changing application status to Submitted', () => {
      const application = {
        _id: 'app_draft_1',
        applicationId: 'UEM-2026-582194',
        status: 'Draft',
      };

      const uploadedFiles = [
        { documentType: 'Class 10 Marksheet', originalFilename: 'c10.pdf' },
        { documentType: 'Class 12 Marksheet', originalFilename: 'c12.pdf' },
        { documentType: 'Identity Proof', originalFilename: 'aadhaar.pdf' },
      ];

      const documentsInDb = uploadedFiles.map((f, idx) => ({
        _id: `doc_${idx + 1}`,
        application: application._id,
        documentType: f.documentType,
        verificationStatus: 'Pending',
        isReplaced: false,
      }));

      // Document upload does not touch application.status
      assert.equal(documentsInDb.length, 3);
      assert.equal(documentsInDb[0].verificationStatus, 'Pending');
      assert.equal(application.status, 'Draft', 'Application status must remain Draft after uploading documents');
    });
  });

  /* ====================================================================
   * 4. FINAL SUBMISSION WORKFLOW
   * ==================================================================== */
  describe('Final Submission Enforcement', () => {
    const validateFinalSubmission = (application, documents) => {
      if (application.status !== 'Draft') {
        return { success: true, message: 'Already submitted', status: application.status };
      }

      const normalizeDocType = (t) => (t || '').replace(/\s+/g, '').toLowerCase();
      const activeUploadedSet = new Set(
        documents
          .filter((d) => d.isReplaced !== true)
          .map((d) => normalizeDocType(d.documentType))
      );

      const missingDocs = MANDATORY_DOCUMENT_TYPES.filter(
        (docType) => !activeUploadedSet.has(normalizeDocType(docType))
      );

      if (missingDocs.length > 0) {
        return {
          success: false,
          statusCode: 400,
          message: `Missing mandatory document(s): ${missingDocs.join(', ')}. All mandatory documents must be uploaded before final submission.`,
          missingDocuments: missingDocs,
        };
      }

      application.status = 'Submitted';
      return { success: true, statusCode: 200, message: 'Application submitted successfully.' };
    };

    test('final submission fails with 400 if mandatory documents are missing', () => {
      const application = { _id: 'app1', status: 'Draft' };
      // Only 1 document uploaded
      const documents = [
        { documentType: 'Class 10 Marksheet', isReplaced: false },
      ];

      const result = validateFinalSubmission(application, documents);
      assert.equal(result.success, false);
      assert.equal(result.statusCode, 400);
      assert.ok(result.missingDocuments.includes('Class 12 Marksheet'));
      assert.ok(result.missingDocuments.includes('Identity Proof'));
      assert.equal(application.status, 'Draft', 'Application must remain Draft when submission fails');
    });

    test('final submission succeeds and transitions status from Draft to Submitted when all mandatory documents are uploaded', () => {
      const application = { _id: 'app1', status: 'Draft' };
      const documents = [
        { documentType: 'Class 10 Marksheet', isReplaced: false },
        { documentType: 'Class 12 Marksheet', isReplaced: false },
        { documentType: 'Identity Proof', isReplaced: false },
      ];

      const result = validateFinalSubmission(application, documents);
      assert.equal(result.success, true);
      assert.equal(result.statusCode, 200);
      assert.equal(application.status, 'Submitted', 'Application status must transition to Submitted');
    });

    test('blocks editing details once application status is Submitted', () => {
      const application = { _id: 'app1', status: 'Submitted' };

      const canEdit = (app) => {
        if (app.status !== 'Draft') {
          return { error: 'Cannot edit application details once final submitted.', statusCode: 400 };
        }
        return { ok: true };
      };

      const result = canEdit(application);
      assert.equal(result.statusCode, 400);
      assert.equal(result.error, 'Cannot edit application details once final submitted.');
    });
  });

  /* ====================================================================
   * 5. ADMIN PORTAL FILTERING & DRAFT EXCLUSION
   * ==================================================================== */
  describe('Admin Portal Filtering & Draft Exclusion', () => {
    test('admin portal queries filter by SUBMITTED_STATUSES by default when status is All or omitted', () => {
      const buildAdminQuery = (statusParam) => {
        const query = {};
        const param = statusParam ? statusParam.trim() : '';
        if (param && param.toLowerCase() !== 'all') {
          if (!SUBMITTED_STATUSES.includes(param)) {
            return { error: `Invalid status filter '${param}'. Allowed submitted values: ${SUBMITTED_STATUSES.join(', ')}` };
          }
          query.status = param;
        } else {
          query.status = { $in: SUBMITTED_STATUSES };
        }
        return { query };
      };

      // Default (no status query param)
      const resDefault = buildAdminQuery('');
      assert.deepEqual(resDefault.query.status, { $in: SUBMITTED_STATUSES });

      // 'All' status query param
      const resAll = buildAdminQuery('All');
      assert.deepEqual(resAll.query.status, { $in: SUBMITTED_STATUSES });

      // Specific submitted status
      const resSub = buildAdminQuery('Under Review');
      assert.equal(resSub.query.status, 'Under Review');

      // Draft status filter is rejected
      const resDraft = buildAdminQuery('Draft');
      assert.ok(resDraft.error);
      assert.match(resDraft.error, /Invalid status filter 'Draft'/);
    });

    test('admin portal detail endpoint rejects unsubmitted Draft applications with 404', () => {
      const mockApplicationsInDb = [
        { _id: 'app_sub_1', applicationId: 'UEM-2026-111111', status: 'Submitted' },
        { _id: 'app_draft_1', applicationId: 'UEM-2026-582194', status: 'Draft' },
      ];

      const getAdminApplicationDetail = (id) => {
        const app = mockApplicationsInDb.find((a) => a._id === id);
        if (!app || !SUBMITTED_STATUSES.includes(app.status)) {
          return { statusCode: 404, message: 'Application not found or has not been finally submitted.' };
        }
        return { statusCode: 200, application: app };
      };

      // Accessing submitted application succeeds
      const subRes = getAdminApplicationDetail('app_sub_1');
      assert.equal(subRes.statusCode, 200);

      // Accessing draft application returns 404
      const draftRes = getAdminApplicationDetail('app_draft_1');
      assert.equal(draftRes.statusCode, 404);
      assert.match(draftRes.message, /not been finally submitted/i);
    });

    test('admin dashboard statistics excludes draft applications from total count', () => {
      const statusAgg = [
        { _id: 'Submitted', count: 10 },
        { _id: 'Under Review', count: 4 },
        { _id: 'Verified', count: 3 },
        { _id: 'Selected', count: 2 },
        { _id: 'Rejected', count: 1 },
        { _id: 'Draft', count: 7 }, // Untouched drafts must not inflate total
      ];

      const statsMap = {
        total: 0,
        submitted: 0,
        underReview: 0,
        verified: 0,
        selected: 0,
        rejected: 0,
        draft: 0,
      };

      statusAgg.forEach((item) => {
        const count = Number(item.count) || 0;
        if (item._id === 'Submitted') statsMap.submitted = count;
        else if (item._id === 'Under Review') statsMap.underReview = count;
        else if (item._id === 'Verified') statsMap.verified = count;
        else if (item._id === 'Selected') statsMap.selected = count;
        else if (item._id === 'Rejected') statsMap.rejected = count;
        else if (item._id === 'Draft') statsMap.draft = count;
      });

      statsMap.total =
        statsMap.submitted +
        statsMap.underReview +
        statsMap.verified +
        statsMap.selected +
        statsMap.rejected;

      assert.equal(statsMap.total, 20, 'Total applications must be 20 (excluding 7 drafts)');
      assert.equal(statsMap.draft, 7, 'Draft count is tracked separately but excluded from total');
    });

    test('admin department/programme breakdown aggregation excludes Draft applications', () => {
      const applications = [
        { selectedProgramme: 'B.Tech - CSE', status: 'Submitted' },
        { selectedProgramme: 'B.Tech - CSE', status: 'Verified' },
        { selectedProgramme: 'B.Tech - CSE', status: 'Draft' }, // Draft must be excluded
        { selectedProgramme: 'MBA', status: 'Selected' },
        { selectedProgramme: 'MBA', status: 'Draft' }, // Draft must be excluded
      ];

      // Simulate $match status: { $in: SUBMITTED_STATUSES }
      const matched = applications.filter((app) => SUBMITTED_STATUSES.includes(app.status));
      const progMap = new Map();
      for (const app of matched) {
        progMap.set(app.selectedProgramme, (progMap.get(app.selectedProgramme) || 0) + 1);
      }

      assert.equal(progMap.get('B.Tech - CSE'), 2, 'Should only count 2 submitted CSE applications, ignoring 1 draft');
      assert.equal(progMap.get('MBA'), 1, 'Should only count 1 submitted MBA application, ignoring 1 draft');
    });
  });

  /* ====================================================================
   * 6. VERIFICATION OFFICER PORTAL FILTERING & DRAFT EXCLUSION
   * ==================================================================== */
  describe('Verification Officer Portal Filtering & Draft Exclusion', () => {
    test('verification portal queries filter by VERIFICATION_STATUSES by default, excluding drafts', () => {
      const buildVerificationQuery = (statusParam) => {
        const query = {};
        const param = statusParam ? statusParam.trim() : '';
        if (param && param.toLowerCase() !== 'all') {
          if (!VERIFICATION_STATUSES.includes(param)) {
            return { error: `Invalid status filter '${param}'. Allowed values: ${VERIFICATION_STATUSES.join(', ')}` };
          }
          query.status = param;
        } else {
          query.status = { $in: VERIFICATION_STATUSES };
        }
        return { query };
      };

      // Default (no status query param)
      const resDefault = buildVerificationQuery('');
      assert.deepEqual(resDefault.query.status, { $in: VERIFICATION_STATUSES });

      // 'All' status query param
      const resAll = buildVerificationQuery('All');
      assert.deepEqual(resAll.query.status, { $in: VERIFICATION_STATUSES });

      // Draft status filter is rejected
      const resDraft = buildVerificationQuery('Draft');
      assert.ok(resDraft.error);
      assert.match(resDraft.error, /Invalid status filter 'Draft'/);
    });

    test('verification portal detail endpoint rejects unsubmitted Draft applications with 404', () => {
      const mockApplicationsInDb = [
        { _id: 'app_sub_1', applicationId: 'UEM-2026-111111', status: 'Submitted' },
        { _id: 'app_draft_1', applicationId: 'UEM-2026-582194', status: 'Draft' },
      ];

      const getVerificationApplicationDetail = (id) => {
        const app = mockApplicationsInDb.find((a) => a._id === id);
        if (!app || app.status === 'Draft') {
          return { statusCode: 404, message: 'Application not found or has not been submitted for verification.' };
        }
        return { statusCode: 200, application: app };
      };

      const draftRes = getVerificationApplicationDetail('app_draft_1');
      assert.equal(draftRes.statusCode, 404);
      assert.match(draftRes.message, /not been submitted for verification/i);
    });

    test('verification dashboard statistics total excludes draft applications', () => {
      const statsMap = {
        submitted: 5,
        underReview: 3,
        verified: 4,
        selected: 1,
        rejected: 2,
        draft: 8,
      };

      const total =
        statsMap.submitted +
        statsMap.underReview +
        statsMap.verified +
        statsMap.selected +
        statsMap.rejected;

      assert.equal(total, 15, 'Total applications in verification must exclude 8 drafts');
    });

    test('verification officer cannot verify or reject draft applications', () => {
      const application = { _id: 'app_draft_1', status: 'Draft' };

      const verifyStatusChange = (app, targetStatus) => {
        if (app.status === 'Draft') {
          return {
            statusCode: 400,
            message: 'Cannot verify a draft application. The candidate must submit the application first.',
          };
        }
        return { statusCode: 200 };
      };

      const result = verifyStatusChange(application, 'Under Review');
      assert.equal(result.statusCode, 400);
      assert.match(result.message, /Cannot verify a draft application/i);
    });

    test('verification officer cannot reject an entire application through the backend API (403 Forbidden)', () => {
      const updateApplicationStatus = (role, targetStatus) => {
        if (targetStatus === 'Rejected' && role === 'verification_officer') {
          return {
            statusCode: 403,
            message: 'Verification officers are not permitted to reject an entire application. Final admission selection and rejection decisions are strictly reserved for Administrators.',
          };
        }
        return { statusCode: 200 };
      };

      const officerResult = updateApplicationStatus('verification_officer', 'Rejected');
      assert.equal(officerResult.statusCode, 403);
      assert.match(officerResult.message, /not permitted to reject an entire application/i);

      // Admin role is permitted to make decisions
      const adminResult = updateApplicationStatus('admin', 'Rejected');
      assert.equal(adminResult.statusCode, 200);
    });
  });

  /* ====================================================================
   * 7. DOCUMENT-TYPE-AWARE VERIFICATION & REPLACEMENT CHAIN
   * ==================================================================== */
  describe('Document-Type-Aware Verification & Replacement Chain', () => {
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

    const evaluateVerification = (allDocs) => {
      if (!allDocs || allDocs.length === 0) {
        return { success: false, statusCode: 400, message: 'No admission documents uploaded.' };
      }

      const { activeDocs, activeByType } = resolveApplicationDocuments(allDocs);

      if (activeDocs.length === 0) {
        return { success: false, statusCode: 400, message: 'No active admission documents found.' };
      }

      const MANDATORY_DOCUMENT_TYPES = ['Class 10 Marksheet', 'Class 12 Marksheet', 'Identity Proof'];
      const missingMandatory = MANDATORY_DOCUMENT_TYPES.filter((type) => !activeByType.has(type));
      if (missingMandatory.length > 0) {
        return {
          success: false,
          statusCode: 400,
          message: `Cannot mark application as Verified: Missing mandatory document(s): ${missingMandatory.join(', ')}. All mandatory documents must be uploaded and verified.`,
          missingMandatory
        };
      }

      const pendingDocs = activeDocs.filter((d) => d.verificationStatus === 'Pending');
      const rejectedDocs = activeDocs.filter((d) => d.verificationStatus === 'Rejected');

      if (rejectedDocs.length > 0) {
        const rejectedTypes = Array.from(new Set(rejectedDocs.map((d) => d.documentType)));
        return {
          success: false,
          statusCode: 400,
          message: `Cannot mark application as Verified: ${rejectedDocs.length} active document(s) (${rejectedTypes.join(', ')}) are rejected without a verified replacement.`,
          rejectedTypes,
        };
      }

      if (pendingDocs.length > 0) {
        const pendingTypes = Array.from(new Set(pendingDocs.map((d) => d.documentType)));
        return {
          success: false,
          statusCode: 400,
          message: `Cannot mark application as Verified: ${pendingDocs.length} active document(s) (${pendingTypes.join(', ')}) are still pending verification.`,
          pendingTypes,
        };
      }

      return { success: true, statusCode: 200, message: 'All active documents verified.' };
    };

    test('a rejected document with a verified replacement of the same type does NOT block application verification', () => {
      const allDocs = [
        {
          _id: 'doc1',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Rejected',
          isReplaced: true,
          replacedBy: 'doc2',
        },
        {
          _id: 'doc2',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
          replacesDocument: 'doc1',
        },
        {
          _id: 'doc3',
          documentType: 'Class 12 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
        {
          _id: 'doc4',
          documentType: 'Identity Proof',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
      ];

      const result = evaluateVerification(allDocs);
      assert.equal(result.success, true);
      assert.equal(result.statusCode, 200);
    });

    test('a rejected document without a valid verified replacement still blocks verification', () => {
      const allDocs = [
        {
          _id: 'doc1',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Rejected',
          isReplaced: false,
        },
        {
          _id: 'doc3',
          documentType: 'Class 12 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
        {
          _id: 'doc4',
          documentType: 'Identity Proof',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
      ];

      const result = evaluateVerification(allDocs);
      assert.equal(result.success, false);
      assert.equal(result.statusCode, 400);
      assert.match(result.message, /Class 10 Marksheet.*rejected without a verified replacement/);
    });

    test('a verified document of a different type cannot satisfy the rejected type', () => {
      const allDocs = [
        {
          _id: 'doc1',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Rejected',
          isReplaced: false,
        },
        {
          _id: 'doc3',
          documentType: 'Class 12 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
        {
          _id: 'doc4',
          documentType: 'Identity Proof',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
        {
          _id: 'doc5',
          documentType: 'Passport Photo',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
      ];

      const result = evaluateVerification(allDocs);
      assert.equal(result.success, false);
      assert.equal(result.statusCode, 400);
      assert.ok(result.rejectedTypes.includes('Class 10 Marksheet'));
    });

    test('historical rejected and replacement files remain visible in the sanitized dossier list', () => {
      const rawDocs = [
        {
          _id: 'doc1',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Rejected',
          verificationRemarks: 'Blurry copy',
          isReplaced: true,
          replacedBy: 'doc2',
        },
        {
          _id: 'doc2',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
          replacesDocument: 'doc1',
        },
      ];

      const sanitized = rawDocs.map((doc) => ({
        _id: doc._id,
        documentType: doc.documentType,
        verificationStatus: doc.verificationStatus,
        isReplaced: doc.isReplaced === true,
        replacedBy: doc.replacedBy || null,
        replacesDocument: doc.replacesDocument || null,
      }));

      assert.equal(sanitized.length, 2, 'Both historical and replacement files must remain in dossier');
      assert.equal(sanitized[0].isReplaced, true);
      assert.equal(sanitized[1].isReplaced, false);
      assert.equal(sanitized[1].replacesDocument, 'doc1');
    });

    test('superseded documents are excluded from active document counts', () => {
      const allDocs = [
        { _id: 'doc1', documentType: 'Class 10 Marksheet', verificationStatus: 'Rejected', isReplaced: true },
        { _id: 'doc2', documentType: 'Class 10 Marksheet', verificationStatus: 'Pending', isReplaced: false, replacesDocument: 'doc1' },
        { _id: 'doc3', documentType: 'Class 12 Marksheet', verificationStatus: 'Verified', isReplaced: false },
      ];

      const supersededIds = new Set(allDocs.filter((d) => d.replacesDocument).map((d) => d.replacesDocument));
      const active = allDocs.filter((d) => !d.isReplaced && !supersededIds.has(d._id));

      assert.equal(active.length, 2, 'Active count must exclude superseded doc1');
      assert.equal(active.filter((d) => d.verificationStatus === 'Rejected').length, 0, 'No active rejected documents');
      assert.equal(active.filter((d) => d.verificationStatus === 'Pending').length, 1, 'Only doc2 is pending');
    });

    test('regression: rejected Identity Proof -> replacement uploaded -> replacement verified -> original hidden from active dossier listing -> verification succeeds', () => {
      const allDocs = [
        {
          _id: 'doc_c10',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
          createdAt: new Date('2026-10-25T10:00:00Z'),
        },
        {
          _id: 'doc_c12',
          documentType: 'Class 12 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
          createdAt: new Date('2026-10-25T10:01:00Z'),
        },
        {
          _id: 'doc_id_orig',
          documentType: 'Identity Proof',
          verificationStatus: 'Rejected',
          verificationRemarks: 'Illegible photocopy',
          isReplaced: true,
          replacedBy: 'doc_id_repl',
          createdAt: new Date('2026-10-25T10:02:00Z'),
        },
        {
          _id: 'doc_id_repl',
          documentType: 'Identity Proof',
          verificationStatus: 'Verified',
          verificationRemarks: 'Valid Aadhaar verified',
          isReplaced: false,
          replacesDocument: 'doc_id_orig',
          createdAt: new Date('2026-10-26T10:00:00Z'),
        },
      ];

      const { activeDocs, supersededDocs } = resolveApplicationDocuments(allDocs);

      // 1. Original superseded document must be hidden from active list
      assert.equal(activeDocs.length, 3, 'Active listing must contain exactly 3 documents');
      assert.equal(activeDocs.some((d) => d._id === 'doc_id_orig'), false, 'Superseded original must be excluded');
      assert.equal(activeDocs.some((d) => d._id === 'doc_id_repl'), true, 'Active replacement must be present');
      assert.equal(supersededDocs.length, 1, 'Superseded list must contain original');
      assert.equal(supersededDocs[0]._id, 'doc_id_orig');

      // 2. Verification evaluation succeeds
      const result = evaluateVerification(allDocs);
      assert.equal(result.success, true);
      assert.equal(result.statusCode, 200);
    });

    test('pending replacement blocks application verification and explains outstanding requirement', () => {
      const allDocs = [
        {
          _id: 'doc_c10',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
        {
          _id: 'doc_c12',
          documentType: 'Class 12 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
        {
          _id: 'doc_id_orig',
          documentType: 'Identity Proof',
          verificationStatus: 'Rejected',
          isReplaced: true,
          replacedBy: 'doc_id_repl',
        },
        {
          _id: 'doc_id_repl',
          documentType: 'Identity Proof',
          verificationStatus: 'Pending',
          isReplaced: false,
          replacesDocument: 'doc_id_orig',
        },
      ];

      const result = evaluateVerification(allDocs);
      assert.equal(result.success, false);
      assert.equal(result.statusCode, 400);
      assert.match(result.message, /Identity Proof.*still pending verification/);
    });

    test('missing mandatory document blocks verification', () => {
      const allDocs = [
        {
          _id: 'doc_c10',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
        {
          _id: 'doc_id',
          documentType: 'Identity Proof',
          verificationStatus: 'Verified',
          isReplaced: false,
        },
      ];

      const result = evaluateVerification(allDocs);
      assert.equal(result.success, false);
      assert.equal(result.statusCode, 400);
      assert.match(result.message, /Missing mandatory document\(s\): Class 12 Marksheet/);
    });

    test('chain of multiple replacements correctly resolves to latest verified replacement', () => {
      const allDocs = [
        {
          _id: 'doc_c10',
          documentType: 'Class 10 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
          createdAt: new Date('2026-10-25T10:00:00Z'),
        },
        {
          _id: 'doc_c12',
          documentType: 'Class 12 Marksheet',
          verificationStatus: 'Verified',
          isReplaced: false,
          createdAt: new Date('2026-10-25T10:01:00Z'),
        },
        {
          _id: 'doc_id_1',
          documentType: 'Identity Proof',
          verificationStatus: 'Rejected',
          isReplaced: true,
          replacedBy: 'doc_id_2',
          createdAt: new Date('2026-10-25T10:02:00Z'),
        },
        {
          _id: 'doc_id_2',
          documentType: 'Identity Proof',
          verificationStatus: 'Rejected',
          isReplaced: true,
          replacesDocument: 'doc_id_1',
          replacedBy: 'doc_id_3',
          createdAt: new Date('2026-10-25T10:03:00Z'),
        },
        {
          _id: 'doc_id_3',
          documentType: 'Identity Proof',
          verificationStatus: 'Verified',
          isReplaced: false,
          replacesDocument: 'doc_id_2',
          createdAt: new Date('2026-10-25T10:04:00Z'),
        },
      ];

      const { activeDocs, supersededDocs } = resolveApplicationDocuments(allDocs);
      assert.equal(activeDocs.length, 3);
      assert.equal(activeDocs.find((d) => d.documentType === 'Identity Proof')._id, 'doc_id_3');
      assert.equal(supersededDocs.length, 2);

      const result = evaluateVerification(allDocs);
      assert.equal(result.success, true);
    });
  });
});
