import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService, DashboardStatsResponse, AdminApplicationsListResponse, AdminApplicationDetailResponse } from './admin.service';
import { environment } from '../../environments/environment';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch admission dashboard statistics including programme breakdown', () => {
    const mockStatsResponse: DashboardStatsResponse = {
      success: true,
      stats: {
        total: 25,
        submitted: 10,
        underReview: 5,
        verified: 6,
        selected: 3,
        rejected: 1,
        draft: 0,
        byProgramme: [
          { programme: 'B.Tech - Computer Science & Engineering', count: 15 },
          { programme: 'Master of Business Administration (MBA)', count: 10 }
        ]
      },
      programmeStats: [
        { programme: 'B.Tech - Computer Science & Engineering', count: 15 },
        { programme: 'Master of Business Administration (MBA)', count: 10 }
      ],
      generatedAt: '2026-10-27T18:00:00.000Z'
    };

    service.getDashboardStats().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.stats.total).toBe(25);
      expect(res.stats.verified).toBe(6);
      expect(res.stats.byProgramme?.length).toBe(2);
      expect(res.stats.byProgramme?.[0].programme).toBe('B.Tech - Computer Science & Engineering');
      expect(res.stats.byProgramme?.[0].count).toBe(15);
      expect(res.programmeStats?.length).toBe(2);
    });

    const req = httpMock.expectOne(`${baseUrl}/stats`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatsResponse);
  });

  it('should fetch applications with pagination and query parameters', () => {
    const mockListResponse: AdminApplicationsListResponse = {
      success: true,
      applications: [],
      pagination: {
        total: 100,
        page: 2,
        limit: 10,
        totalPages: 10,
        hasNextPage: true,
        hasPrevPage: true
      }
    };

    service
      .getApplications({
        page: 2,
        limit: 10,
        search: 'Rahul',
        status: 'Submitted',
        programme: 'B.Tech - Computer Science & Engineering'
      })
      .subscribe((res) => {
        expect(res.success).toBe(true);
        expect(res.pagination.page).toBe(2);
        expect(res.pagination.total).toBe(100);
      });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/applications`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('search')).toBe('Rahul');
    expect(req.request.params.get('status')).toBe('Submitted');
    expect(req.request.params.get('programme')).toBe('B.Tech - Computer Science & Engineering');
    req.flush(mockListResponse);
  });

  it('should fetch single application details including documents', () => {
    const mockDetailResponse: AdminApplicationDetailResponse = {
      success: true,
      application: {
        _id: 'app123',
        applicationId: 'UEM-2026-123456',
        applicant: {
          _id: 'user1',
          name: 'Priya Sharma',
          email: 'priya@example.com',
          role: 'applicant',
          createdAt: '2026-10-20'
        },
        personalDetails: {
          fullName: 'Priya Sharma',
          dateOfBirth: '2005-04-12',
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
          class10: { board: 'CBSE', passingYear: 2021, marksPercentage: 92 },
          class12: { board: 'CBSE', passingYear: 2023, marksPercentage: 94, stream: 'Science' }
        },
        selectedProgramme: 'B.Tech - Computer Science & Engineering',
        status: 'Verified',
        createdAt: '2026-10-20',
        updatedAt: '2026-10-21',
        documents: [
          {
            _id: 'doc1',
            documentType: 'Class 10 Marksheet',
            originalFilename: 'class10.pdf',
            mimeType: 'application/pdf',
            fileSize: 1048576,
            verificationStatus: 'Verified',
            verificationRemarks: 'Clear copy',
            fileUrl: '/api/documents/doc1/file',
            createdAt: '2026-10-20',
            updatedAt: '2026-10-21'
          }
        ]
      }
    };

    service.getApplicationDetails('app123').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.application.applicationId).toBe('UEM-2026-123456');
      expect(res.application.documents.length).toBe(1);
    });

    const req = httpMock.expectOne(`${baseUrl}/applications/app123`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetailResponse);
  });
});
