import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { StatusComponent } from './status';
import { ApplicationService, AdmissionApplication, AdmissionDocument } from '../../services/application.service';
import { AuthService } from '../../services/auth.service';
import { vi } from 'vitest';

describe('StatusComponent', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;
  let mockAppService: any;
  let mockAuthService: any;

  const mockApp: AdmissionApplication = {
    _id: 'app_123',
    applicationId: 'UEM-2026-CS-0001',
    applicant: {
      _id: 'user_1',
      name: 'Sagnik Applicant',
      email: 'sagnik@example.com',
      role: 'applicant'
    },
    selectedProgramme: 'B.Tech - Computer Science & Engineering',
    status: 'Under Review',
    personalDetails: {
      fullName: 'Sagnik Applicant',
      dateOfBirth: '2005-06-15',
      phone: '+919876543210',
      address: {
        line1: '123 University Ave',
        city: 'Kolkata',
        state: 'West Bengal',
        pincode: '700156',
        country: 'India'
      }
    },
    academicDetails: {
      class10: {
        board: 'CBSE',
        passingYear: 2021,
        marksPercentage: 92.5
      },
      class12: {
        board: 'CBSE',
        passingYear: 2023,
        stream: 'Science',
        marksPercentage: 94.0
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockDocuments: AdmissionDocument[] = [
    {
      _id: 'doc_1',
      application: 'app_123',
      documentType: 'Class 10 Marksheet',
      originalFilename: 'class10.pdf',
      mimeType: 'application/pdf',
      fileSize: 102400,
      verificationStatus: 'Verified',
      isReplaced: false,
      fileUrl: '/api/documents/doc_1/file',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'doc_2_old',
      application: 'app_123',
      documentType: 'Class 12 Marksheet',
      originalFilename: 'class12_blurry.pdf',
      mimeType: 'application/pdf',
      fileSize: 204800,
      verificationStatus: 'Rejected',
      verificationRemarks: 'Blurry scan. Please upload clear copy.',
      isReplaced: true,
      replacedBy: 'doc_2_new',
      fileUrl: '/api/documents/doc_2_old/file',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'doc_2_new',
      application: 'app_123',
      documentType: 'Class 12 Marksheet',
      originalFilename: 'class12_clear.pdf',
      mimeType: 'application/pdf',
      fileSize: 215000,
      verificationStatus: 'Pending',
      isReplaced: false,
      replacesDocument: 'doc_2_old',
      fileUrl: '/api/documents/doc_2_new/file',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'doc_3',
      application: 'app_123',
      documentType: 'Identity Proof',
      originalFilename: 'aadhaar.pdf',
      mimeType: 'application/pdf',
      fileSize: 153600,
      verificationStatus: 'Rejected',
      verificationRemarks: 'Name mismatch on card',
      isReplaced: false,
      fileUrl: '/api/documents/doc_3/file',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  beforeEach(async () => {
    mockAppService = {
      getMyApplications: vi.fn(() => of({ success: true, count: 1, applications: [mockApp] })),
      getMyDocuments: vi.fn(() => of({ success: true, count: mockDocuments.length, documents: mockDocuments })),
      uploadDocument: vi.fn(() => of({
        success: true,
        message: 'Success',
        document: {
          _id: 'doc_3_new',
          application: 'app_123',
          documentType: 'Identity Proof',
          originalFilename: 'aadhaar_fixed.pdf',
          verificationStatus: 'Pending',
          isReplaced: false
        } as any
      })),
      downloadDocumentFile: vi.fn(() => of(new Blob(['dummy'])))
    };

    mockAuthService = {
      currentUser: () => ({ id: 'user_1', name: 'Sagnik Applicant', email: 'sagnik@example.com', role: 'applicant' }),
      isAuthenticated: () => true
    };

    await TestBed.configureTestingModule({
      imports: [StatusComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: ApplicationService, useValue: mockAppService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the status tracking component', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch application status and document reviews on initialization', () => {
    expect(mockAppService.getMyApplications).toHaveBeenCalled();
    expect(mockAppService.getMyDocuments).toHaveBeenCalled();
    expect(component.existingApplication()).toEqual(mockApp);
    expect(component.uploadedDocuments().length).toBe(4);
  });

  it('should correctly filter active vs historical documents', () => {
    // 3 active (doc_1, doc_2_new, doc_3) and 1 historical (doc_2_old)
    expect(component.activeDocuments().length).toBe(3);
    expect(component.historicalDocuments().length).toBe(1);
    expect(component.historicalDocuments()[0]._id).toBe('doc_2_old');
  });

  it('should compute live review statistics strictly on active documents without double counting', () => {
    const stats = component.docStats();
    expect(stats.total).toBe(3);
    expect(stats.verified).toBe(1); // doc_1
    expect(stats.pending).toBe(1);  // doc_2_new
    expect(stats.rejected).toBe(1); // doc_3
    expect(stats.reviewed).toBe(2); // verified + rejected = 2
    expect(stats.completionPercentage).toBe(67); // 2/3 * 100 = 67%
  });

  it('should refresh status and documents when manual refresh is requested', () => {
    component.refreshStatus();
    expect(mockAppService.getMyApplications).toHaveBeenCalledTimes(2);
    expect(mockAppService.getMyDocuments).toHaveBeenCalledTimes(2);
  });

  it('should handle empty state when applicant has not yet submitted an application', () => {
    mockAppService.getMyApplications.mockReturnValue(of({ success: true, count: 0, applications: [] }));
    component.fetchApplicationStatus();
    expect(component.existingApplication()).toBeNull();
  });

  it('should open replacement modal for rejected documents', () => {
    const rejectedDoc = component.activeDocuments().find(d => d.verificationStatus === 'Rejected')!;
    expect(rejectedDoc).toBeTruthy();

    component.openReplaceModal(rejectedDoc);
    expect(component.showReplaceModal()).toBe(true);
    expect(component.replacingDoc()).toBe(rejectedDoc);
  });

  it('should not open replacement modal if document is already verified', () => {
    const verifiedDoc = component.activeDocuments().find(d => d.verificationStatus === 'Verified')!;
    component.openReplaceModal(verifiedDoc);
    expect(component.showReplaceModal()).toBe(false);
  });

  it('should submit replacement document and return to pending review', () => {
    const rejectedDoc = component.activeDocuments().find(d => d.verificationStatus === 'Rejected')!;
    component.openReplaceModal(rejectedDoc);

    const testFile = new File(['dummy content'], 'aadhaar_new.pdf', { type: 'application/pdf' });
    component.replacementFile.set(testFile);

    component.onSubmitReplacement();

    expect(mockAppService.uploadDocument).toHaveBeenCalled();
    expect(component.showReplaceModal()).toBe(false);
  });

  it('should copy application ID to clipboard', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy
      }
    });

    component.copyApplicationId('UEM-2026-CS-0001');
    expect(writeTextSpy).toHaveBeenCalledWith('UEM-2026-CS-0001');
    await Promise.resolve();
    expect(component.copiedAppId()).toBe(true);
  });

  it('should display prominent rectification warning when an active document is rejected', () => {
    expect(component.requiresRectification()).toBe(true);
    expect(component.rectificationRequiredDocTypes()).toEqual(['Identity Proof']);
    expect(component.rectificationRequiredDocTypes().length).toBe(1);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const alertCard = compiled.querySelector('.banner-rectification');
    expect(alertCard).toBeTruthy();
    expect(alertCard?.textContent).toContain('Action Required: Document Rectification Needed');
    expect(alertCard?.textContent).toContain('1 document type');
    expect(alertCard?.textContent).toContain('Identity Proof');

    // Verify it is positioned immediately above the yellow Scrutiny in Progress card
    const reviewCard = compiled.querySelector('.banner-review');
    expect(reviewCard).toBeTruthy();
    expect(alertCard?.nextElementSibling).toBe(reviewCard);
  });

  it('should disappear when all rejected documents have valid replacements uploaded', () => {
    // Simulate replacement uploaded for doc_3 (Identity Proof)
    const resolvedDocs: AdmissionDocument[] = [
      {
        _id: 'doc_1',
        application: 'app_123',
        documentType: 'Class 10 Marksheet',
        originalFilename: 'class10.pdf',
        mimeType: 'application/pdf',
        fileSize: 102400,
        verificationStatus: 'Verified',
        isReplaced: false,
        fileUrl: '/api/documents/doc_1/file',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        _id: 'doc_2_old',
        application: 'app_123',
        documentType: 'Class 12 Marksheet',
        originalFilename: 'class12_blurry.pdf',
        mimeType: 'application/pdf',
        fileSize: 204800,
        verificationStatus: 'Rejected',
        isReplaced: true,
        fileUrl: '/api/documents/doc_2_old/file',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        _id: 'doc_2_new',
        application: 'app_123',
        documentType: 'Class 12 Marksheet',
        originalFilename: 'class12_clear.pdf',
        mimeType: 'application/pdf',
        fileSize: 215000,
        verificationStatus: 'Pending',
        isReplaced: false,
        fileUrl: '/api/documents/doc_2_new/file',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        _id: 'doc_3_old',
        application: 'app_123',
        documentType: 'Identity Proof',
        originalFilename: 'aadhaar_rejected.pdf',
        mimeType: 'application/pdf',
        fileSize: 153600,
        verificationStatus: 'Rejected',
        isReplaced: true,
        fileUrl: '/api/documents/doc_3_old/file',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        _id: 'doc_3_new',
        application: 'app_123',
        documentType: 'Identity Proof',
        originalFilename: 'aadhaar_clean.pdf',
        mimeType: 'application/pdf',
        fileSize: 160000,
        verificationStatus: 'Pending',
        isReplaced: false,
        fileUrl: '/api/documents/doc_3_new/file',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    component.uploadedDocuments.set(resolvedDocs);

    expect(component.requiresRectification()).toBe(false);
    expect(component.rectificationRequiredDocTypes().length).toBe(0);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.banner-rectification')).toBeNull();
  });
});
