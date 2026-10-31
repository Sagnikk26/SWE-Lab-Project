import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AdminDashboardComponent } from './admin';
import { AdminService, DashboardStatsResponse, AdminApplicationsListResponse, AdminApplicationDetailResponse } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let mockAdminService: any;
  let mockAuthService: any;

  const mockStatsResponse: DashboardStatsResponse = {
    success: true,
    stats: {
      total: 15,
      submitted: 8,
      underReview: 3,
      verified: 2,
      selected: 1,
      rejected: 1,
      draft: 0,
      byProgramme: [
        { programme: 'B.Tech - Computer Science & Engineering', count: 10 },
        { programme: 'Master of Business Administration (MBA)', count: 5 }
      ]
    },
    programmeStats: [
      { programme: 'B.Tech - Computer Science & Engineering', count: 10 },
      { programme: 'Master of Business Administration (MBA)', count: 5 }
    ],
    generatedAt: '2026-10-27T18:00:00.000Z'
  };

  const mockListResponse: AdminApplicationsListResponse = {
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
        createdAt: '2026-10-20',
        updatedAt: '2026-10-20'
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

  const mockDetailResponse: AdminApplicationDetailResponse = {
    success: true,
    application: {
      ...mockListResponse.applications[0],
      documents: [
        {
          _id: 'doc1',
          documentType: 'Class 10 Marksheet',
          originalFilename: 'ananya_c10.pdf',
          mimeType: 'application/pdf',
          fileSize: 524288,
          verificationStatus: 'Pending',
          verificationRemarks: '',
          fileUrl: '/api/documents/doc1/file',
          createdAt: '2026-10-20',
          updatedAt: '2026-10-20'
        }
      ]
    }
  };

  beforeEach(async () => {
    mockAdminService = {
      getDashboardStats: vi.fn().mockReturnValue(of(mockStatsResponse)),
      getApplications: vi.fn().mockReturnValue(of(mockListResponse)),
      getApplicationDetails: vi.fn().mockReturnValue(of(mockDetailResponse)),
      updateApplicationDecision: vi.fn().mockReturnValue(of({ success: true, message: 'Decision recorded' }))
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ name: 'Admin User', email: 'admin@uem.edu.in', role: 'admin' }),
      getToken: vi.fn().mockReturnValue('mock-jwt-token'),
      logout: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the admin dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should load dashboard statistics on initialization', () => {
    expect(mockAdminService.getDashboardStats).toHaveBeenCalled();
    expect(component.stats().total).toBe(15);
    expect(component.stats().submitted).toBe(8);
  });

  it('should load programme breakdown statistics on initialization', () => {
    expect(mockAdminService.getDashboardStats).toHaveBeenCalled();
    expect(component.programmeStats().length).toBe(2);
    expect(component.programmeStats()[0].programme).toBe('B.Tech - Computer Science & Engineering');
    expect(component.programmeStats()[0].count).toBe(10);
    expect(component.programmeStats()[1].programme).toBe('Master of Business Administration (MBA)');
    expect(component.programmeStats()[1].count).toBe(5);
  });

  it('should filter by programme when filterByProgramme is called and toggle on re-click', () => {
    component.filterByProgramme('B.Tech - Computer Science & Engineering');
    expect(component.selectedProgramme).toBe('B.Tech - Computer Science & Engineering');
    expect(component.currentPage).toBe(1);
    expect(mockAdminService.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        programme: 'B.Tech - Computer Science & Engineering',
        page: 1
      })
    );

    // Clicking the same programme toggles back to 'All'
    component.filterByProgramme('B.Tech - Computer Science & Engineering');
    expect(component.selectedProgramme).toBe('All');
    expect(mockAdminService.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        programme: 'All',
        page: 1
      })
    );
  });

  it('should load applications list on initialization', () => {
    expect(mockAdminService.getApplications).toHaveBeenCalled();
    expect(component.applications().length).toBe(1);
    expect(component.applications()[0].applicationId).toBe('UEM-2026-111111');
  });

  it('should update search and query backend on onSearchSubmit', () => {
    component.searchTerm = 'Ananya';
    component.onSearchSubmit();

    expect(component.currentPage).toBe(1);
    expect(mockAdminService.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Ananya',
        page: 1
      })
    );
  });

  it('should reset all filters when resetFilters() is called', () => {
    component.searchTerm = 'test';
    component.selectedStatus = 'Rejected';
    component.selectedProgramme = 'B.Tech - Mechanical Engineering';
    component.currentPage = 3;

    component.resetFilters();

    expect(component.searchTerm).toBe('');
    expect(component.selectedStatus).toBe('All');
    expect(component.selectedProgramme).toBe('All');
    expect(component.currentPage).toBe(1);
  });

  it('should open application details modal and load document records', () => {
    component.openApplicationDetails('app1');

    expect(component.isModalOpen()).toBe(true);
    expect(mockAdminService.getApplicationDetails).toHaveBeenCalledWith('app1');
    expect(component.selectedApplication()).toBeTruthy();
    expect(component.selectedApplication()?.documents.length).toBe(1);
  });

  it('should close application details modal when closeModal() is called', () => {
    component.openApplicationDetails('app1');
    expect(component.isModalOpen()).toBe(true);

    component.closeModal();
    expect(component.isModalOpen()).toBe(false);
    expect(component.selectedApplication()).toBeNull();
  });

  it('should format file size correctly in formatFileSize()', () => {
    expect(component.formatFileSize(0)).toBe('0 B');
    expect(component.formatFileSize(1024)).toBe('1 KB');
    expect(component.formatFileSize(1048576)).toBe('1 MB');
  });

  it('should prevent selectCandidate if application is not in Verified status', () => {
    component.openApplicationDetails('app1');
    // Status is 'Submitted'
    component.selectCandidate();

    expect(mockAdminService.updateApplicationDecision).not.toHaveBeenCalled();
    expect(component.actionError()).toContain("Application must be 'Verified'");
  });

  it('should successfully select candidate when application is in Verified status', () => {
    component.openApplicationDetails('app1');
    component.selectedApplication.update((app) => (app ? { ...app, status: 'Verified' } : null));

    component.selectCandidate();

    expect(mockAdminService.updateApplicationDecision).toHaveBeenCalledWith(
      'app1',
      'Selected',
      expect.stringContaining('Selected for admission')
    );
    expect(component.actionSuccess()).toContain('officially Selected');
  });

  it('should validate rejection remarks before rejecting candidate', () => {
    component.openApplicationDetails('app1');
    component.openRejectPrompt();
    expect(component.isRejectingDecision()).toBe(true);

    // Empty remarks
    component.decisionRemarks = ' ';
    component.confirmRejectCandidate();
    expect(component.decisionRemarksError).toContain('at least 3 characters');
    expect(mockAdminService.updateApplicationDecision).not.toHaveBeenCalled();

    // Valid remarks
    component.decisionRemarks = 'Eligibility threshold not met';
    component.confirmRejectCandidate();
    expect(mockAdminService.updateApplicationDecision).toHaveBeenCalledWith(
      'app1',
      'Rejected',
      'Eligibility threshold not met'
    );
    expect(component.isRejectingDecision()).toBe(false);
  });

  it('should not include Draft in statusOptions for the admin portal', () => {
    expect(component.statusOptions).not.toContain('Draft');
    expect(component.statusOptions).toEqual([
      'All',
      'Submitted',
      'Under Review',
      'Verified',
      'Selected',
      'Rejected'
    ]);
  });

  it('should filter applications by status and query backend on onStatusChange', () => {
    component.selectedStatus = 'Under Review';
    component.onStatusChange();

    expect(component.currentPage).toBe(1);
    expect(mockAdminService.getApplications).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Under Review',
        page: 1
      })
    );
  });

  it('should not contain Verification Portal navigation link in the admin header', () => {
    const element: HTMLElement = fixture.nativeElement;
    const verificationLink = element.querySelector('a[routerLink="/verification"]');
    expect(verificationLink).toBeNull();
    const allLinks = Array.from(element.querySelectorAll('.admin-user-bar a')).map(a => a.textContent?.trim());
    expect(allLinks).not.toContain('Verification Portal');
    expect(allLinks).toContain('Portal Home');
  });

  it('should correctly separate active and superseded historical documents', () => {
    const docs = [
      {
        _id: 'doc_id_old',
        documentType: 'Identity Proof',
        originalFilename: 'old_aadhaar.pdf',
        mimeType: 'application/pdf',
        fileSize: 1000,
        verificationStatus: 'Rejected' as const,
        verificationRemarks: 'Blurry scan',
        fileUrl: '/api/documents/doc_id_old/file',
        createdAt: '2026-10-18T10:00:00.000Z',
        updatedAt: '2026-10-19T10:00:00.000Z',
        isReplaced: true
      },
      {
        _id: 'doc_id_new',
        documentType: 'Identity Proof',
        originalFilename: 'new_aadhaar.pdf',
        mimeType: 'application/pdf',
        fileSize: 1200,
        verificationStatus: 'Verified' as const,
        verificationRemarks: 'Clear and verified',
        fileUrl: '/api/documents/doc_id_new/file',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-21T10:00:00.000Z'
      },
      {
        _id: 'doc_c10',
        documentType: 'Class 10 Marksheet',
        originalFilename: 'c10.pdf',
        mimeType: 'application/pdf',
        fileSize: 1500,
        verificationStatus: 'Verified' as const,
        verificationRemarks: '',
        fileUrl: '/api/documents/doc_c10/file',
        createdAt: '2026-10-18T10:00:00.000Z',
        updatedAt: '2026-10-18T10:00:00.000Z'
      }
    ];

    const active = component.getActiveDocuments(docs);
    const historical = component.getHistoricalDocuments(docs);

    expect(active.length).toBe(2);
    expect(active.map(d => d._id)).toEqual(['doc_id_new', 'doc_c10']);

    expect(historical.length).toBe(1);
    expect(historical[0]._id).toBe('doc_id_old');
    expect(historical[0].isReplaced).toBe(true);
  });

  it('should toggle historical document archive visibility and reset upon closing', () => {
    expect(component.showHistoricalDocs()).toBe(false);
    component.toggleHistoricalDocs();
    expect(component.showHistoricalDocs()).toBe(true);
    component.toggleHistoricalDocs();
    expect(component.showHistoricalDocs()).toBe(false);

    component.openApplicationDetails('app1');
    component.toggleHistoricalDocs();
    expect(component.showHistoricalDocs()).toBe(true);
    component.closeModal();
    expect(component.showHistoricalDocs()).toBe(false);
  });

  it('should display active documents in main table and render collapsible archive when historical documents exist', () => {
    const multiDocApplication = {
      ...mockListResponse.applications[0],
      documents: [
        {
          _id: 'doc_id_old',
          documentType: 'Identity Proof',
          originalFilename: 'old_aadhaar.pdf',
          mimeType: 'application/pdf',
          fileSize: 1000,
          verificationStatus: 'Rejected' as const,
          verificationRemarks: 'Blurry copy',
          fileUrl: '/api/documents/doc_id_old/file',
          createdAt: '2026-10-18T10:00:00.000Z',
          updatedAt: '2026-10-19T10:00:00.000Z',
          isReplaced: true
        },
        {
          _id: 'doc_id_new',
          documentType: 'Identity Proof',
          originalFilename: 'new_aadhaar.pdf',
          mimeType: 'application/pdf',
          fileSize: 1200,
          verificationStatus: 'Verified' as const,
          verificationRemarks: 'Approved',
          fileUrl: '/api/documents/doc_id_new/file',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-21T10:00:00.000Z'
        }
      ]
    };
    mockAdminService.getApplicationDetails.mockReturnValue(of({
      success: true,
      application: multiDocApplication
    }));

    component.openApplicationDetails('app1');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    // Header count must reflect active count (1 active document)
    const titles = Array.from(element.querySelectorAll('.dossier-sec-title'));
    const docTitle = titles.find(t => t.textContent?.includes('Uploaded Admission Documents'));
    expect(docTitle?.textContent).toContain('Uploaded Admission Documents (1)');

    // Summary bar for archived history
    const summaryBar = element.querySelector('.historical-summary-bar');
    expect(summaryBar).toBeTruthy();
    expect(summaryBar?.textContent).toContain('1 superseded document version(s) archived');

    // Archive table not shown initially
    expect(element.querySelector('.historical-table')).toBeNull();

    // Toggle to show archive
    const toggleBtn: HTMLButtonElement | null = element.querySelector('.btn-toggle-history');
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn?.textContent?.trim()).toBe('View Archived History');

    toggleBtn?.click();
    fixture.detectChanges();

    expect(component.showHistoricalDocs()).toBe(true);
    const histTable = element.querySelector('.historical-table');
    expect(histTable).toBeTruthy();
    expect(histTable?.textContent).toContain('old_aadhaar.pdf');
    expect(histTable?.textContent).toContain('(Replaced)');
  });

  it('should call authService.logout() and navigate to / when signing out as admin', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.onSignOut();

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
    expect(navigateSpy).not.toHaveBeenCalledWith(['/login']);
  });
});
