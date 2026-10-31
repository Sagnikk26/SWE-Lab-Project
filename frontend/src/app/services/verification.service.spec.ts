import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  VerificationService,
  VerificationStatsResponse,
  VerificationApplicationsListResponse,
  VerificationApplicationDetailResponse,
  UpdateDocumentStatusResponse,
  UpdateApplicationStatusResponse
} from './verification.service';
import { environment } from '../../environments/environment';

describe('VerificationService', () => {
  let service: VerificationService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/verification`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        VerificationService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(VerificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch verification dashboard statistics', () => {
    const mockStatsResponse: VerificationStatsResponse = {
      success: true,
      stats: {
        submitted: 10,
        underReview: 4,
        verified: 7,
        rejected: 2,
        selected: 3,
        draft: 0,
        total: 26,
        requiringReview: 14,
        pendingDocuments: 12
      },
      generatedAt: '2026-10-27T18:00:00.000Z'
    };

    service.getVerificationStats().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.stats.requiringReview).toBe(14);
      expect(res.stats.pendingDocuments).toBe(12);
    });

    const req = httpMock.expectOne(`${baseUrl}/stats`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatsResponse);
  });

  it('should fetch applications list with filter params', () => {
    const mockListResponse: VerificationApplicationsListResponse = {
      success: true,
      applications: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    };

    service
      .getApplications({ page: 2, limit: 10, status: 'Submitted', search: 'John', programme: 'B.Tech' })
      .subscribe((res) => {
        expect(res.success).toBe(true);
        expect(res.pagination.page).toBe(1);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/applications` &&
        r.params.get('page') === '2' &&
        r.params.get('limit') === '10' &&
        r.params.get('status') === 'Submitted' &&
        r.params.get('search') === 'John' &&
        r.params.get('programme') === 'B.Tech'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockListResponse);
  });

  it('should fetch application details for verification', () => {
    const mockDetailResponse: VerificationApplicationDetailResponse = {
      success: true,
      application: {
        _id: 'app123',
        applicationId: 'UEM-2026-100001',
        applicant: {
          _id: 'user123',
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'applicant',
          createdAt: '2026-10-27T10:00:00.000Z'
        },
        personalDetails: {
          fullName: 'Jane Doe',
          dateOfBirth: '2005-01-01',
          phone: '+919876543210',
          address: {
            line1: '123 Park Street',
            city: 'Kolkata',
            state: 'West Bengal',
            pincode: '700016',
            country: 'India'
          }
        },
        academicDetails: {
          class10: { board: 'CBSE', passingYear: 2021, marksPercentage: 92 },
          class12: { board: 'CBSE', passingYear: 2023, marksPercentage: 90, stream: 'Science' }
        },
        selectedProgramme: 'B.Tech - Computer Science & Engineering',
        status: 'Under Review',
        documentStats: { total: 1, pending: 0, verified: 1, rejected: 0 },
        documents: [],
        createdAt: '2026-10-27T11:00:00.000Z',
        updatedAt: '2026-10-27T11:00:00.000Z'
      }
    };

    service.getApplicationDetails('app123').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.application.applicationId).toBe('UEM-2026-100001');
    });

    const req = httpMock.expectOne(`${baseUrl}/applications/app123`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetailResponse);
  });

  it('should update document verification status', () => {
    const mockDocResponse: UpdateDocumentStatusResponse = {
      success: true,
      message: 'Document successfully marked as Verified.',
      document: {
        _id: 'doc123',
        documentType: 'Class 10 Marksheet',
        originalFilename: 'class10.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        verificationStatus: 'Verified',
        verificationRemarks: 'Clear scan',
        fileUrl: '/api/documents/doc123/file',
        createdAt: '2026-10-27T10:00:00.000Z',
        updatedAt: '2026-10-27T12:00:00.000Z'
      }
    };

    service.updateDocumentStatus('doc123', 'Verified', 'Clear scan').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.document.verificationStatus).toBe('Verified');
    });

    const req = httpMock.expectOne(`${baseUrl}/documents/doc123/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'Verified', remarks: 'Clear scan' });
    req.flush(mockDocResponse);
  });

  it('should update application status through workflow', () => {
    const mockAppResponse: UpdateApplicationStatusResponse = {
      success: true,
      message: "Application status successfully updated to 'Verified'.",
      application: {
        _id: 'app123',
        applicationId: 'UEM-2026-100001',
        applicant: {
          _id: 'user123',
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'applicant',
          createdAt: '2026-10-27T10:00:00.000Z'
        },
        personalDetails: {
          fullName: 'Jane Doe',
          dateOfBirth: '2005-01-01',
          phone: '+919876543210',
          address: {
            line1: '123 Park Street',
            city: 'Kolkata',
            state: 'West Bengal',
            pincode: '700016',
            country: 'India'
          }
        },
        academicDetails: {
          class10: { board: 'CBSE', passingYear: 2021, marksPercentage: 92 },
          class12: { board: 'CBSE', passingYear: 2023, marksPercentage: 90, stream: 'Science' }
        },
        selectedProgramme: 'B.Tech - Computer Science & Engineering',
        status: 'Verified',
        verificationRemarks: 'All documents verified successfully',
        documentStats: { total: 1, pending: 0, verified: 1, rejected: 0 },
        documents: [],
        createdAt: '2026-10-27T11:00:00.000Z',
        updatedAt: '2026-10-27T12:00:00.000Z'
      }
    };

    service.updateApplicationStatus('app123', 'Verified', 'All documents verified successfully').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.application.status).toBe('Verified');
    });

    const req = httpMock.expectOne(`${baseUrl}/applications/app123/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'Verified', remarks: 'All documents verified successfully' });
    req.flush(mockAppResponse);
  });
});
