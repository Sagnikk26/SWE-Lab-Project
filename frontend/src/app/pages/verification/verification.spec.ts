import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { VerificationDashboardComponent } from './verification';
import {
  VerificationService,
  VerificationStatsResponse,
  VerificationApplicationsListResponse,
  VerificationApplicationDetailResponse,
  UpdateDocumentStatusResponse,
  UpdateApplicationStatusResponse
} from '../../services/verification.service';
import { AuthService } from '../../services/auth.service';

describe('VerificationDashboardComponent', () => {
  let component: VerificationDashboardComponent;
  let fixture: ComponentFixture<VerificationDashboardComponent>;
  let mockVerificationService: any;
  let mockAuthService: any;

  const mockStatsResponse: VerificationStatsResponse = {
    success: true,
    stats: {
      submitted: 5,
      underReview: 3,
      verified: 4,
      rejected: 1,
      selected: 2,
      draft: 0,
      total: 15,
      requiringReview: 8,
      pendingDocuments: 6
    },
    generatedAt: '2026-10-27T18:00:00.000Z'
  };

  const mockListResponse: VerificationApplicationsListResponse = {
    success: true,
    applications: [
      {
        _id: 'app1',
        applicationId: 'UEM-2026-111111',
        applicant: {
          _id: 'u1',
          name: 'Ananya Roy',
          email: 'ananya@example.com',
          role: 'applicant',
          createdAt: '2026-10-20'
        },
        personalDetails: {
          fullName: 'Ananya Roy',
          dateOfBirth: '2005-01-15',
          phone: '+919876543210',
          address: {
            line1: 'Salt Lake',
            city: 'Kolkata',
            state: 'West Bengal',
            pincode: '700091',
            country: 'India'
          }
        },
        academicDetails: {
          class10: { board: 'CBSE', passingYear: 2021, marksPercentage: 90 },
          class12: { board: 'CBSE', passingYear: 2023, marksPercentage: 88, stream: 'Science' }
        },
        selectedProgramme: 'B.Tech - Computer Science & Engineering',
        status: 'Submitted',
        documentStats: { total: 2, pending: 2, verified: 0, rejected: 0 },
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z'
      }
    ],
    pagination: {
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    }
  };

  const mockDetailResponse: VerificationApplicationDetailResponse = {
    success: true,
    application: {
      _id: 'app1',
      applicationId: 'UEM-2026-111111',
      applicant: {
        _id: 'u1',
        name: 'Ananya Roy',
        email: 'ananya@example.com',
        role: 'applicant',
        createdAt: '2026-10-20'
      },
      personalDetails: {
        fullName: 'Ananya Roy',
        dateOfBirth: '2005-01-15',
        phone: '+919876543210',
        address: {
          line1: 'Salt Lake',
          city: 'Kolkata',
          state: 'West Bengal',
          pincode: '700091',
          country: 'India'
        }
      },
      academicDetails: {
        class10: { board: 'CBSE', passingYear: 2021, marksPercentage: 90 },
        class12: { board: 'CBSE', passingYear: 2023, marksPercentage: 88, stream: 'Science' }
      },
      selectedProgramme: 'B.Tech - Computer Science & Engineering',
      status: 'Under Review',
      documentStats: { total: 2, pending: 1, verified: 1, rejected: 0 },
      documents: [
        {
          _id: 'doc1',
          documentType: 'Class 10 Marksheet',
          originalFilename: 'class10.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          verificationStatus: 'Verified',
          verificationRemarks: '',
          fileUrl: '/api/documents/doc1/file',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:00:00.000Z'
        },
        {
          _id: 'doc2',
          documentType: 'Class 12 Marksheet',
          originalFilename: 'class12.pdf',
          mimeType: 'application/pdf',
          fileSize: 2048,
          verificationStatus: 'Pending',
          verificationRemarks: '',
          fileUrl: '/api/documents/doc2/file',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:00:00.000Z'
        }
      ],
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z'
    }
  };

  beforeEach(async () => {
    mockVerificationService = {
      getVerificationStats: vi.fn().mockReturnValue(of(mockStatsResponse)),
      getApplications: vi.fn().mockReturnValue(of(mockListResponse)),
      getApplicationDetails: vi.fn().mockReturnValue(of(mockDetailResponse)),
      updateDocumentStatus: vi.fn(),
      updateApplicationStatus: vi.fn()
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({
        name: 'Officer Das',
        email: 'officer@uem.edu.in',
        role: 'verification_officer'
      }),
      getToken: vi.fn().mockReturnValue('mock-officer-token'),
      logout: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [VerificationDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VerificationService, useValue: mockVerificationService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load verification stats and applications on init', () => {
    expect(component).toBeTruthy();
    expect(mockVerificationService.getVerificationStats).toHaveBeenCalled();
    expect(mockVerificationService.getApplications).toHaveBeenCalled();
    expect(component.stats().requiringReview).toBe(8);
    expect(component.applications().length).toBe(1);
  });

  it('should open application detail modal and display documents', () => {
    component.openApplicationDetails('app1');
    expect(mockVerificationService.getApplicationDetails).toHaveBeenCalledWith('app1');
    expect(component.isModalOpen()).toBe(true);
    expect(component.selectedApplication()).toBeTruthy();
    expect(component.selectedApplication()?.documents.length).toBe(2);
  });

  it('should prevent marking application verified when documents are pending', () => {
    component.openApplicationDetails('app1');
    expect(component.canMarkApplicationVerified()).toBe(false);
    expect(component.getVerificationBlockReason()).toContain('pending verification review');
  });

  it('should allow approving an individual document', () => {
    const mockApproveResponse: UpdateDocumentStatusResponse = {
      success: true,
      message: 'Document successfully marked as Verified.',
      document: {
        _id: 'doc2',
        documentType: 'Class 12 Marksheet',
        originalFilename: 'class12.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        verificationStatus: 'Verified',
        verificationRemarks: '',
        fileUrl: '/api/documents/doc2/file',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-27T12:00:00.000Z'
      }
    };

    mockVerificationService.updateDocumentStatus.mockReturnValue(of(mockApproveResponse));

    component.openApplicationDetails('app1');
    const docToApprove = component.selectedApplication()!.documents[1];
    component.approveDocument(docToApprove);

    expect(mockVerificationService.updateDocumentStatus).toHaveBeenCalledWith('doc2', 'Verified');
    expect(component.actionSuccess()).toContain('Class 12 Marksheet marked as Verified');
  });

  it('should require remarks when rejecting a document', () => {
    component.openApplicationDetails('app1');
    const docToReject = component.selectedApplication()!.documents[1];
    component.openRejectDocumentPrompt(docToReject);

    // Empty remarks
    component.documentRejectionRemarks = '  ';
    component.confirmRejectDocument();

    expect(component.documentRejectionError).toContain('meaningful remark');
    expect(mockVerificationService.updateDocumentStatus).not.toHaveBeenCalled();
  });

  it('should reject a document with valid remarks', () => {
    const mockRejectResponse: UpdateDocumentStatusResponse = {
      success: true,
      message: 'Document successfully marked as Rejected.',
      document: {
        _id: 'doc2',
        documentType: 'Class 12 Marksheet',
        originalFilename: 'class12.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        verificationStatus: 'Rejected',
        verificationRemarks: 'Blurred scan',
        fileUrl: '/api/documents/doc2/file',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-27T12:00:00.000Z'
      }
    };

    mockVerificationService.updateDocumentStatus.mockReturnValue(of(mockRejectResponse));

    component.openApplicationDetails('app1');
    const docToReject = component.selectedApplication()!.documents[1];
    component.openRejectDocumentPrompt(docToReject);

    component.documentRejectionRemarks = 'Blurred scan of marksheet';
    component.confirmRejectDocument();

    expect(mockVerificationService.updateDocumentStatus).toHaveBeenCalledWith(
      'doc2',
      'Rejected',
      'Blurred scan of marksheet'
    );
    expect(component.actionSuccess()).toContain('Rejected');
  });

  it('should not include Draft in statusOptions for the verification portal', () => {
    expect(component.statusOptions).not.toContain('Draft');
    expect(component.statusOptions).toEqual([
      'All',
      'Submitted',
      'Under Review',
      'Verified',
      'Rejected'
    ]);
  });

  it('should filter applications by status and query backend on onStatusChange', () => {
    component.selectedStatus = 'Submitted';
    component.onStatusChange();

    expect(component.currentPage).toBe(1);
    expect(mockVerificationService.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Submitted',
        page: 1
      })
    );
  });

  it('should not allow Verification Officers to reject an entire application in the UI', () => {
    component.openApplicationDetails('app1');
    fixture.detectChanges();

    // Verify rejection action button does not exist in the DOM
    const compiled = fixture.nativeElement as HTMLElement;
    const allButtons = Array.from(compiled.querySelectorAll('button')).map(b => b.textContent?.trim());
    expect(allButtons.some(text => text === 'Reject Application')).toBe(false);

    // Verify application rejection method is removed from component
    expect((component as any).confirmRejectApplication).toBeUndefined();
    expect((component as any).openRejectApplicationPrompt).toBeUndefined();
  });

  it('should allow application verification when a rejected document has a verified replacement of the same type', () => {
    const docsWithReplacement: any[] = [
      {
        _id: 'doc1',
        documentType: 'Class 10 Marksheet',
        verificationStatus: 'Rejected',
        isReplaced: true,
        replacedBy: 'doc1_new'
      },
      {
        _id: 'doc1_new',
        documentType: 'Class 10 Marksheet',
        verificationStatus: 'Verified',
        isReplaced: false,
        replacesDocument: 'doc1'
      },
      {
        _id: 'doc2',
        documentType: 'Class 12 Marksheet',
        verificationStatus: 'Verified',
        isReplaced: false
      },
      {
        _id: 'doc3',
        documentType: 'Identity Proof',
        verificationStatus: 'Verified',
        isReplaced: false
      }
    ];

    component.selectedApplication.set({
      ...mockDetailResponse.application,
      status: 'Under Review',
      documents: docsWithReplacement
    });

    expect(component.getActiveDocuments(docsWithReplacement).length).toBe(3);
    expect(component.canMarkApplicationVerified()).toBe(true);
    expect(component.getVerificationBlockReason()).toBe('');
  });

  it('should block application verification when a rejected document has no verified replacement', () => {
    const docsWithUnresolvedRejection: any[] = [
      {
        _id: 'doc1',
        documentType: 'Class 10 Marksheet',
        verificationStatus: 'Rejected',
        isReplaced: false
      },
      {
        _id: 'doc2',
        documentType: 'Class 12 Marksheet',
        verificationStatus: 'Verified',
        isReplaced: false
      }
    ];

    component.selectedApplication.set({
      ...mockDetailResponse.application,
      status: 'Under Review',
      documents: docsWithUnresolvedRejection
    });

    expect(component.canMarkApplicationVerified()).toBe(false);
    expect(component.getVerificationBlockReason()).toContain('Class 10 Marksheet');
    expect(component.getVerificationBlockReason()).toContain('rejected without a verified replacement');
  });

  it('should not allow a verified document of a different type to satisfy a rejected document', () => {
    const docsWithMismatchedTypes: any[] = [
      {
        _id: 'doc1',
        documentType: 'Class 10 Marksheet',
        verificationStatus: 'Rejected',
        isReplaced: false
      },
      {
        _id: 'doc2',
        documentType: 'Passport Photo',
        verificationStatus: 'Verified',
        isReplaced: false
      }
    ];

    component.selectedApplication.set({
      ...mockDetailResponse.application,
      status: 'Under Review',
      documents: docsWithMismatchedTypes
    });

    expect(component.canMarkApplicationVerified()).toBe(false);
    expect(component.getVerificationBlockReason()).toContain('Class 10 Marksheet');
  });

  it('regression: rejected Identity Proof -> replacement uploaded -> replacement verified -> original hidden from active dossier listing -> verification succeeds', () => {
    // Scenario matching the user's reported bug
    const docsScenario: any[] = [
      {
        _id: 'doc_class10',
        documentType: 'Class 10 Marksheet',
        originalFilename: 'class10.pdf',
        verificationStatus: 'Verified',
        isReplaced: false
      },
      {
        _id: 'doc_class12',
        documentType: 'Class 12 Marksheet',
        originalFilename: 'class12.pdf',
        verificationStatus: 'Verified',
        isReplaced: false
      },
      {
        _id: 'doc_id_orig',
        documentType: 'Identity Proof',
        originalFilename: 'aadhaar_blurry.pdf',
        verificationStatus: 'Rejected',
        verificationRemarks: 'Illegible photocopy',
        isReplaced: true,
        replacedBy: 'doc_id_replacement',
        createdAt: '2026-10-25T10:00:00Z'
      },
      {
        _id: 'doc_id_replacement',
        documentType: 'Identity Proof',
        originalFilename: 'aadhaar_clear.pdf',
        verificationStatus: 'Verified',
        verificationRemarks: 'Clear government ID',
        isReplaced: false,
        replacesDocument: 'doc_id_orig',
        createdAt: '2026-10-26T10:00:00Z'
      }
    ];

    component.selectedApplication.set({
      ...mockDetailResponse.application,
      status: 'Under Review',
      documents: docsScenario
    });
    component.isModalOpen.set(true);

    fixture.detectChanges();

    // 1. Original superseded document must be HIDDEN from active dossier listing
    const activeDocs = component.getActiveDocuments(docsScenario);
    expect(activeDocs.length).toBe(3);
    expect(activeDocs.find(d => d._id === 'doc_id_orig')).toBeUndefined();
    expect(activeDocs.find(d => d._id === 'doc_id_replacement')).toBeDefined();
    expect(activeDocs.find(d => d.documentType === 'Identity Proof')?.verificationStatus).toBe('Verified');

    // 2. Historical document is preserved in historical listing
    const historicalDocs = component.getHistoricalDocuments(docsScenario);
    expect(historicalDocs.length).toBe(1);
    expect(historicalDocs[0]._id).toBe('doc_id_orig');

    // 3. Application verification must succeed
    expect(component.canMarkApplicationVerified()).toBe(true);
    expect(component.getVerificationBlockReason()).toBe('');

    // 4. Verify DOM rendering: only active documents rendered in main table
    const compiled = fixture.nativeElement as HTMLElement;
    const mainRows = compiled.querySelectorAll('.documents-table tbody tr');
    // Active rows should match activeDocs count (3)
    expect(mainRows.length).toBe(3);
    const textContent = compiled.querySelector('.documents-table tbody')?.textContent;
    expect(textContent).toContain('aadhaar_clear.pdf');
    expect(textContent).not.toContain('aadhaar_blurry.pdf');
  });

  it('should block application verification when a replacement document is still Pending', () => {
    const docsWithPendingReplacement: any[] = [
      {
        _id: 'doc1',
        documentType: 'Class 10 Marksheet',
        verificationStatus: 'Verified',
        isReplaced: false
      },
      {
        _id: 'doc2',
        documentType: 'Class 12 Marksheet',
        verificationStatus: 'Verified',
        isReplaced: false
      },
      {
        _id: 'doc3_orig',
        documentType: 'Identity Proof',
        verificationStatus: 'Rejected',
        isReplaced: true,
        replacedBy: 'doc3_new'
      },
      {
        _id: 'doc3_new',
        documentType: 'Identity Proof',
        verificationStatus: 'Pending',
        isReplaced: false,
        replacesDocument: 'doc3_orig'
      }
    ];

    component.selectedApplication.set({
      ...mockDetailResponse.application,
      status: 'Under Review',
      documents: docsWithPendingReplacement
    });

    expect(component.canMarkApplicationVerified()).toBe(false);
    expect(component.getVerificationBlockReason()).toContain('Identity Proof');
    expect(component.getVerificationBlockReason()).toContain('still pending verification');
  });

  it('should block application verification when a mandatory document type is missing', () => {
    const docsMissingMandatory: any[] = [
      {
        _id: 'doc1',
        documentType: 'Class 10 Marksheet',
        verificationStatus: 'Verified',
        isReplaced: false
      },
      {
        _id: 'doc2',
        documentType: 'Identity Proof',
        verificationStatus: 'Verified',
        isReplaced: false
      }
      // Class 12 Marksheet is missing
    ];

    component.selectedApplication.set({
      ...mockDetailResponse.application,
      status: 'Under Review',
      documents: docsMissingMandatory
    });

    expect(component.canMarkApplicationVerified()).toBe(false);
    expect(component.getVerificationBlockReason()).toContain('Missing mandatory document(s): Class 12 Marksheet');
  });

  it('should toggle historical document archive display in the dossier', () => {
    expect(component.showHistoricalDocs()).toBe(false);
    component.toggleHistoricalDocs();
    expect(component.showHistoricalDocs()).toBe(true);
    component.toggleHistoricalDocs();
    expect(component.showHistoricalDocs()).toBe(false);
  });

  it('should call authService.logout() and navigate to / when signing out as verification officer', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.onSignOut();

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
    expect(navigateSpy).not.toHaveBeenCalledWith(['/login']);
  });
});
