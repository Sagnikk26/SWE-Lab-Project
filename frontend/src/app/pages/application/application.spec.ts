import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ApplicationComponent } from './application';
import { ApplicationService, AdmissionDocument } from '../../services/application.service';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

describe('ApplicationComponent', () => {
  let component: ApplicationComponent;
  let mockAppService: any;
  let mockAuthService: any;
  let router: Router;

  const sampleMandatoryDocs: AdmissionDocument[] = [
    {
      _id: 'doc_1',
      documentType: 'Class 10 Marksheet',
      originalFilename: 'class10.pdf',
      fileSize: 102400,
      verificationStatus: 'Pending',
      isReplaced: false
    } as any,
    {
      _id: 'doc_2',
      documentType: 'Class 12 Marksheet',
      originalFilename: 'class12.pdf',
      fileSize: 204800,
      verificationStatus: 'Pending',
      isReplaced: false
    } as any,
    {
      _id: 'doc_3',
      documentType: 'Identity Proof',
      originalFilename: 'aadhaar.pdf',
      fileSize: 153600,
      verificationStatus: 'Pending',
      isReplaced: false
    } as any
  ];

  const populateValidForm = (comp: ApplicationComponent) => {
    comp.applicationForm.get('selectedProgramme')?.setValue('B.Tech - Computer Science & Engineering');
    comp.applicationForm.get('personalDetails.fullName')?.setValue('Sagnik Applicant');
    comp.applicationForm.get('personalDetails.dateOfBirth')?.setValue('2002-05-15');
    comp.applicationForm.get('personalDetails.phone')?.setValue('+919876543210');
    comp.applicationForm.get('personalDetails.address.line1')?.setValue('123 University Road');
    comp.applicationForm.get('personalDetails.address.city')?.setValue('Kolkata');
    comp.applicationForm.get('personalDetails.address.state')?.setValue('West Bengal');
    comp.applicationForm.get('personalDetails.address.pincode')?.setValue('700156');
    comp.applicationForm.get('personalDetails.address.country')?.setValue('India');

    comp.applicationForm.get('academicDetails.class10.board')?.setValue('CBSE');
    comp.applicationForm.get('academicDetails.class10.passingYear')?.setValue(2018);
    comp.applicationForm.get('academicDetails.class10.marksPercentage')?.setValue(88);

    comp.applicationForm.get('academicDetails.class12.board')?.setValue('CBSE');
    comp.applicationForm.get('academicDetails.class12.passingYear')?.setValue(2020);
    comp.applicationForm.get('academicDetails.class12.stream')?.setValue('Science');
    comp.applicationForm.get('academicDetails.class12.marksPercentage')?.setValue(85);

    comp.applicationForm.get('declaration')?.setValue(true);
  };

  beforeEach(async () => {
    mockAppService = {
      getMyApplications: vi.fn(() => of({ success: true, count: 0, applications: [] })),
      createApplication: vi.fn(() => of({
        success: true,
        message: 'Success',
        application: {
          _id: 'app_new_1',
          applicationId: 'UEM-2026-CS-0001',
          selectedProgramme: 'B.Tech - Computer Science & Engineering',
          status: 'Draft'
        } as any
      })),
      updateApplication: vi.fn(() => of({
        success: true,
        message: 'Updated',
        application: {
          _id: 'app_new_1',
          applicationId: 'UEM-2026-CS-0001',
          selectedProgramme: 'B.Tech - Computer Science & Engineering',
          status: 'Draft'
        } as any
      })),
      finalSubmitApplication: vi.fn(() => of({
        success: true,
        message: 'Application has been successfully submitted.',
        application: {
          _id: 'app_new_1',
          applicationId: 'UEM-2026-CS-0001',
          selectedProgramme: 'B.Tech - Computer Science & Engineering',
          status: 'Submitted'
        } as any
      })),
      getMyDocuments: vi.fn(() => of({ success: true, count: 0, documents: [] })),
      uploadDocument: vi.fn((formData: FormData) => of({
        success: true,
        message: 'Success',
        document: {
          _id: 'doc_uploaded_1',
          documentType: formData.get('documentType'),
          originalFilename: 'test.pdf',
          fileSize: 1024,
          verificationStatus: 'Pending',
          isReplaced: false
        } as any
      })),
      deleteDocument: vi.fn(() => of({ success: true, message: 'Document deleted successfully' })),
      downloadDocumentFile: vi.fn(() => of(new Blob(['dummy'])))
    };

    mockAuthService = {
      currentUser: () => ({
        id: 'user_1',
        name: 'Sagnik Applicant',
        email: 'sagnik@example.com',
        role: 'applicant',
        phone: '+919876543210',
        intendedProgramme: 'B.Tech - Computer Science & Engineering'
      }),
      getIntendedProgramme: () => 'B.Tech - Computer Science & Engineering',
      clearIntendedProgramme: vi.fn(),
      checkAuthStatus: vi.fn(() => of({
        id: 'user_1',
        name: 'Sagnik Applicant',
        email: 'sagnik@example.com',
        role: 'applicant',
        phone: '+919876543210',
        intendedProgramme: 'B.Tech - Computer Science & Engineering'
      }))
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: ApplicationService, useValue: mockAppService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(ApplicationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an invalid form due to required fields', () => {
    expect(component.applicationForm.valid).toBe(false);
  });

  it('should validate date of birth cannot be in the future', () => {
    const dobControl = component.applicationForm.get('personalDetails.dateOfBirth');
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    dobControl?.setValue(futureDate.toISOString().split('T')[0]);
    expect(dobControl?.errors?.['futureDate']).toBe(true);
  });

  it('should validate date of birth requires applicant to be at least 12 years old', () => {
    const dobControl = component.applicationForm.get('personalDetails.dateOfBirth');
    const tooYoungDate = new Date();
    tooYoungDate.setFullYear(tooYoungDate.getFullYear() - 5);

    dobControl?.setValue(tooYoungDate.toISOString().split('T')[0]);
    expect(dobControl?.errors?.['underage']).toBe(true);
  });

  it('should validate Class 12 passing year cannot precede Class 10 passing year', () => {
    const form = component.applicationForm;
    form.get('academicDetails.class10.passingYear')?.setValue(2023);
    form.get('academicDetails.class12.passingYear')?.setValue(2021);

    form.updateValueAndValidity();
    expect(form.errors?.['passingYearPrecedes']).toBe(true);
  });

  it('should reject files with unsupported extensions during selection', () => {
    const fakeEvent: any = {
      target: {
        files: [{ name: 'malicious.exe', size: 1024 }],
        value: 'malicious.exe'
      }
    };

    component.onFileSelected(fakeEvent);
    expect(component.selectedFile()).toBe(null);
    expect(component.selectedFileError()).toContain('Invalid file format');
  });

  it('should reject files larger than 10MB during selection', () => {
    const fakeEvent: any = {
      target: {
        files: [{ name: 'huge_document.pdf', size: 15 * 1024 * 1024 }],
        value: 'huge_document.pdf'
      }
    };

    component.onFileSelected(fakeEvent);
    expect(component.selectedFile()).toBe(null);
    expect(component.selectedFileError()).toContain('10 MB limit');
  });

  it('should NOT contain "Other" in allowed documentTypes (Requirement 3)', () => {
    expect(component.documentTypes).not.toContain('Other');
    expect(component.documentTypes).toContain('Class 10 Marksheet');
    expect(component.documentTypes).toContain('Class 12 Marksheet');
    expect(component.documentTypes).toContain('Identity Proof');
  });

  it('should reject uploading a document under "Other" category (Requirement 3)', () => {
    component.selectedDocType.set('Other');
    component.selectedFile.set(new File(['dummy'], 'doc.pdf', { type: 'application/pdf' }));

    const dummyInput = { value: 'file' } as any;
    component.onUploadDocument(dummyInput);

    expect(component.documentUploadError()).toContain('"Other" document category has been removed');
    expect(mockAppService.uploadDocument).not.toHaveBeenCalled();
  });

  it('should track mandatory documents completion status (Requirement 4)', () => {
    expect(component.mandatoryDocuments).toEqual([
      'Class 10 Marksheet',
      'Class 12 Marksheet',
      'Identity Proof'
    ]);

    expect(component.missingMandatoryDocs().length).toBe(3);
    expect(component.isMandatoryDocsComplete()).toBe(false);

    // Upload first mandatory doc
    component.uploadedDocuments.set([sampleMandatoryDocs[0]]);
    expect(component.missingMandatoryDocs()).toEqual(['Class 12 Marksheet', 'Identity Proof']);
    expect(component.isMandatoryDocsComplete()).toBe(false);

    // Upload remaining mandatory docs
    component.uploadedDocuments.set(sampleMandatoryDocs);
    expect(component.missingMandatoryDocs()).toEqual([]);
    expect(component.isMandatoryDocsComplete()).toBe(true);
  });

  it('should disable submission until all mandatory documents and form fields are complete (Requirement 4)', () => {
    populateValidForm(component);
    expect(component.applicationForm.valid).toBe(true);
    expect(component.isMandatoryDocsComplete()).toBe(false);
    expect(component.canFinalSubmit()).toBe(false);

    // Provide mandatory documents
    component.uploadedDocuments.set(sampleMandatoryDocs);
    expect(component.isMandatoryDocsComplete()).toBe(true);
    expect(component.canFinalSubmit()).toBe(true);
  });

  it('should block onInitiateSubmit() if mandatory documents are missing (Requirement 4)', () => {
    populateValidForm(component);
    component.uploadedDocuments.set([sampleMandatoryDocs[0]]); // Missing 2 mandatory docs

    component.onInitiateSubmit();

    expect(component.showConfirmModal()).toBe(false);
    expect(component.errorMessage()).toContain('Please upload all mandatory documents before final submission');
  });

  it('should open confirmation modal when form and mandatory documents are complete', () => {
    populateValidForm(component);
    component.uploadedDocuments.set(sampleMandatoryDocs);

    component.onInitiateSubmit();

    expect(component.showConfirmModal()).toBe(true);
    expect(component.errorMessage()).toBeNull();
  });

  it('should successfully submit application and redirect to /status (Requirement 1)', () => {
    populateValidForm(component);
    component.uploadedDocuments.set(sampleMandatoryDocs);
    component.showConfirmModal.set(true);

    component.onSubmit();

    expect(mockAppService.createApplication).toHaveBeenCalled();
    expect(mockAuthService.clearIntendedProgramme).toHaveBeenCalled();
    expect(component.showConfirmModal()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/status']);
  });

  it('should NOT redirect to /status if submission fails with backend error (Requirement 1)', () => {
    populateValidForm(component);
    component.uploadedDocuments.set(sampleMandatoryDocs);
    component.showConfirmModal.set(true);

    mockAppService.createApplication.mockReturnValue(
      throwError(() => ({
        status: 400,
        error: { message: 'Missing mandatory documents on server' }
      }))
    );

    component.onSubmit();

    expect(router.navigate).not.toHaveBeenCalledWith(['/status']);
    expect(component.errorMessage()).toContain('Missing mandatory documents on server');
    expect(component.isSubmitting()).toBe(false);
    expect(component.showConfirmModal()).toBe(false);
  });

  it('should delete uploaded document successfully (Requirement 2)', () => {
    const docToDelete = sampleMandatoryDocs[0];
    component.uploadedDocuments.set([...sampleMandatoryDocs]);

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.onDeleteDocument(docToDelete);

    expect(mockAppService.deleteDocument).toHaveBeenCalledWith(docToDelete._id);
    expect(component.uploadedDocuments().find(d => d._id === docToDelete._id)).toBeUndefined();
    expect(component.documentUploadSuccess()).toContain('removed successfully');
  });

  it('should not delete document if user cancels confirmation dialog', () => {
    const docToDelete = sampleMandatoryDocs[0];
    component.uploadedDocuments.set([...sampleMandatoryDocs]);

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.onDeleteDocument(docToDelete);

    expect(mockAppService.deleteDocument).not.toHaveBeenCalled();
    expect(component.uploadedDocuments().length).toBe(3);
  });

  it('should redirect to /status on init if applicant already has a submitted application', () => {
    mockAppService.getMyApplications.mockReturnValue(
      of({
        success: true,
        count: 1,
        applications: [{
          _id: 'app_existing',
          applicationId: 'UEM-2026-CS-0001',
          selectedProgramme: 'B.Tech - Computer Science & Engineering',
          status: 'Under Review'
        }]
      })
    );

    component.checkExistingApplications();

    expect(component.existingApplication()).toBeTruthy();
    expect(router.navigate).toHaveBeenCalledWith(['/status']);
  });

  describe('Two-Step Separated Application & Document Upload Workflow', () => {
    it('should start on Step 1 (Academic Details) when no prior application exists', () => {
      expect(component.activeStep()).toBe('form');
    });

    it('should prevent proceeding to Step 2 if academic form is invalid', () => {
      component.onProceedToDocuments();
      expect(component.activeStep()).toBe('form');
      expect(component.errorMessage()).toContain('Please fill out all required');
      expect(mockAppService.createApplication).not.toHaveBeenCalled();
    });

    it('should save draft application and transition to Step 2 (Document Upload Center) with assigned Applicant ID', () => {
      populateValidForm(component);

      component.onProceedToDocuments();

      expect(mockAppService.createApplication).toHaveBeenCalled();
      expect(component.activeStep()).toBe('documents');
      expect(component.existingApplication()?.applicationId).toBe('UEM-2026-CS-0001');
      expect(mockAppService.getMyDocuments).toHaveBeenCalled();
    });

    it('should allow returning from Step 2 to Step 1 via backToFormStep()', () => {
      component.activeStep.set('documents');
      expect(component.activeStep()).toBe('documents');

      component.backToFormStep();
      expect(component.activeStep()).toBe('form');
    });

    it('should keep Final Submit disabled when mandatory documents are missing in Step 2', () => {
      component.existingApplication.set({
        _id: 'app_1',
        applicationId: 'UEM-2026-CS-0001',
        selectedProgramme: 'B.Tech - CSE',
        status: 'Draft'
      } as any);
      component.activeStep.set('documents');
      component.uploadedDocuments.set([sampleMandatoryDocs[0]]); // Only 1 of 3 uploaded

      expect(component.canFinalSubmit()).toBe(false);

      component.onFinalSubmit();
      expect(mockAppService.finalSubmitApplication).not.toHaveBeenCalled();
      expect(component.finalSubmitError()).toContain('Please upload all mandatory documents before final submission');
    });

    it('should enable Final Submit and redirect to /status upon successful final submission', () => {
      component.existingApplication.set({
        _id: 'app_1',
        applicationId: 'UEM-2026-CS-0001',
        selectedProgramme: 'B.Tech - CSE',
        status: 'Draft'
      } as any);
      component.activeStep.set('documents');
      component.uploadedDocuments.set(sampleMandatoryDocs); // All 3 uploaded

      expect(component.canFinalSubmit()).toBe(true);

      component.onFinalSubmit();

      expect(mockAppService.finalSubmitApplication).toHaveBeenCalledWith('app_1');
      expect(mockAuthService.clearIntendedProgramme).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/status']);
    });
  });

  describe('Persistent Registration Details & Automatic Programme Selection', () => {
    it('should autofill matching fields (fullName, phone, selectedProgramme) from authenticated user profile when no draft exists', () => {
      // Clear form and verify initial autofill
      component.applicationForm.reset();
      component.existingApplication.set(null);

      component.autofillFromRegistrationProfile();

      expect(component.applicationForm.get('personalDetails.fullName')?.value).toBe('Sagnik Applicant');
      expect(component.applicationForm.get('personalDetails.phone')?.value).toBe('+919876543210');
      expect(component.applicationForm.get('selectedProgramme')?.value).toBe('B.Tech - Computer Science & Engineering');
    });

    it('should restore existing draft data without overwriting it with registration defaults', () => {
      const existingDraft = {
        _id: 'app_draft_99',
        applicationId: 'UEM-2026-DRAFT-99',
        selectedProgramme: 'Master of Computer Applications (MCA)',
        status: 'Draft',
        personalDetails: {
          fullName: 'Custom Draft Name',
          phone: '+919111122222',
          dateOfBirth: '2001-01-01',
          address: {
            line1: '99 Custom Lane',
            city: 'Kolkata',
            state: 'West Bengal',
            pincode: '700001',
            country: 'India'
          }
        },
        academicDetails: {
          class10: { board: 'ICSE', passingYear: 2017, marksPercentage: 92 },
          class12: { board: 'ISC', passingYear: 2019, marksPercentage: 90, stream: 'Science' }
        }
      };

      mockAppService.getMyApplications.mockReturnValue(of({
        success: true,
        count: 1,
        applications: [existingDraft]
      }));

      component.checkExistingApplications();

      // Ensure draft values are strictly preserved and NOT overwritten by user profile defaults
      expect(component.applicationForm.get('personalDetails.fullName')?.value).toBe('Custom Draft Name');
      expect(component.applicationForm.get('personalDetails.phone')?.value).toBe('+919111122222');
      expect(component.applicationForm.get('selectedProgramme')?.value).toBe('Master of Computer Applications (MCA)');
      expect(component.activeStep()).toBe('documents');
    });

    it('should give explicit route programme priority over registration preference', () => {
      const activatedRoute = TestBed.inject(ActivatedRoute);
      vi.spyOn(activatedRoute.snapshot.queryParamMap, 'get').mockImplementation((key: string) => {
        if (key === 'programme') return 'B.Tech - Mechanical Engineering';
        return null;
      });

      component.applicationForm.get('selectedProgramme')?.setValue('');
      component.initProgrammeSelection();

      expect(component.applicationForm.get('selectedProgramme')?.value).toBe('B.Tech - Mechanical Engineering');
    });

    it('should reject arbitrary unsupported programme query parameters and fallback to registration preference', () => {
      const activatedRoute = TestBed.inject(ActivatedRoute);
      vi.spyOn(activatedRoute.snapshot.queryParamMap, 'get').mockImplementation((key: string) => {
        if (key === 'programme') return 'Arbitrary Invalid Degree 12345';
        return null;
      });

      component.applicationForm.get('selectedProgramme')?.setValue('');
      component.initProgrammeSelection();

      // Arbitrary parameter is rejected; falls back to registration preference
      expect(component.applicationForm.get('selectedProgramme')?.value).toBe('B.Tech - Computer Science & Engineering');
    });

    it('should preserve selected programme when navigating back to form step', () => {
      component.applicationForm.get('selectedProgramme')?.setValue('B.Tech - Electrical Engineering');
      component.activeStep.set('documents');

      component.backToFormStep();

      expect(component.activeStep()).toBe('form');
      expect(component.applicationForm.get('selectedProgramme')?.value).toBe('B.Tech - Electrical Engineering');
    });
  });
});
