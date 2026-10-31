import { Component, OnInit, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, LowerCasePipe, SlicePipe } from '@angular/common';
import {
  AdminService,
  DashboardStats,
  ProgrammeCount,
  AdminApplicationSummary,
  AdminApplicationDetail,
  AdminDocumentInfo,
  PaginationMeta
} from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, DecimalPipe, LowerCasePipe, SlicePipe],
  templateUrl: './admin.html',
  styleUrl: './admin.scss'
})
export class AdminDashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);

  // Statistics State
  readonly stats = signal<DashboardStats>({
    total: 0,
    submitted: 0,
    underReview: 0,
    verified: 0,
    selected: 0,
    rejected: 0,
    draft: 0
  });
  readonly programmeStats = signal<ProgrammeCount[]>([]);
  readonly isLoadingStats = signal(true);

  // Applications Table State
  readonly applications = signal<AdminApplicationSummary[]>([]);
  readonly pagination = signal<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  readonly isLoadingApplications = signal(true);
  readonly applicationsError = signal<string | null>(null);

  // Filter & Search Controls
  searchTerm = '';
  selectedStatus = 'All';
  selectedProgramme = 'All';
  currentPage = 1;
  itemsPerPage = 10;

  // Selected Application Details (Modal)
  readonly selectedApplication = signal<AdminApplicationDetail | null>(null);
  readonly isLoadingDetails = signal(false);
  readonly detailsError = signal<string | null>(null);
  readonly isModalOpen = signal(false);
  readonly showHistoricalDocs = signal<boolean>(false);

  // Decision Action State
  readonly actionLoading = signal<boolean>(false);
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly isRejectingDecision = signal<boolean>(false);
  decisionRemarks = '';
  decisionRemarksError = '';

  // Static options for dropdown filters
  readonly statusOptions: string[] = [
    'All',
    'Submitted',
    'Under Review',
    'Verified',
    'Selected',
    'Rejected'
  ];

  readonly programmeOptions: string[] = [
    'All',
    'B.Tech - Computer Science & Engineering',
    'B.Tech - CSE (Artificial Intelligence & Machine Learning)',
    'B.Tech - Electronics & Communication Engineering',
    'B.Tech - Electrical Engineering',
    'B.Tech - Mechanical Engineering',
    'Bachelor of Computer Applications (BCA)',
    'Bachelor of Business Administration (BBA)',
    'Master of Computer Applications (MCA)',
    'Master of Business Administration (MBA)',
    'M.Tech - Computer Science & Engineering'
  ];

  readonly pageSizeOptions: number[] = [10, 25, 50];

  ngOnInit(): void {
    this.loadDashboardStats();
    this.loadApplications();
  }

  /**
   * Loads admission counts computed by MongoDB aggregation on the backend.
   */
  loadDashboardStats(): void {
    this.isLoadingStats.set(true);
    this.adminService.getDashboardStats().subscribe({
      next: (res) => {
        this.isLoadingStats.set(false);
        if (res.success && res.stats) {
          this.stats.set(res.stats);
          const pStats = res.programmeStats || res.stats.byProgramme || [];
          this.programmeStats.set(pStats);
        }
      },
      error: (err: Error) => {
        this.isLoadingStats.set(false);
        console.error('Error fetching dashboard stats:', err);
      }
    });
  }

  /**
   * Filters applications table by clicked programme breakdown item.
   * Toggles back to 'All' if already selected.
   */
  filterByProgramme(prog: string): void {
    if (this.selectedProgramme === prog) {
      this.selectedProgramme = 'All';
    } else {
      this.selectedProgramme = prog;
    }
    this.currentPage = 1;
    this.loadApplications();
  }

  /**
   * Fetches applications matching current search, filters, and pagination page.
   */
  loadApplications(): void {
    this.isLoadingApplications.set(true);
    this.applicationsError.set(null);

    this.adminService
      .getApplications({
        page: this.currentPage,
        limit: this.itemsPerPage,
        search: this.searchTerm,
        status: this.selectedStatus,
        programme: this.selectedProgramme
      })
      .subscribe({
        next: (res) => {
          this.isLoadingApplications.set(false);
          if (res.success) {
            this.applications.set(res.applications);
            this.pagination.set(res.pagination);
          }
        },
        error: (err: Error) => {
          this.isLoadingApplications.set(false);
          this.applicationsError.set(err.message || 'Failed to retrieve applications.');
        }
      });
  }

  /**
   * Triggers search filter
   */
  onSearchSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.currentPage = 1;
    this.loadApplications();
  }

  /**
   * Clears search input and refreshes
   */
  onClearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadApplications();
  }

  /**
   * Handles status dropdown filter change
   */
  onStatusChange(): void {
    this.currentPage = 1;
    this.loadApplications();
  }

  /**
   * Handles programme dropdown filter change
   */
  onProgrammeChange(): void {
    this.currentPage = 1;
    this.loadApplications();
  }

  /**
   * Resets all filters to initial state
   */
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'All';
    this.selectedProgramme = 'All';
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.loadApplications();
  }

  /**
   * Pagination navigation
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().totalPages || page === this.currentPage) {
      return;
    }
    this.currentPage = page;
    this.loadApplications();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadApplications();
  }

  /**
   * Opens application detail modal and retrieves full records and document metadata
   */
  openApplicationDetails(applicationId: string, keepFeedback = false): void {
    this.isModalOpen.set(true);
    this.isLoadingDetails.set(true);
    this.detailsError.set(null);
    if (!keepFeedback) {
      this.actionSuccess.set(null);
      this.actionError.set(null);
    }
    this.selectedApplication.set(null);
    this.isRejectingDecision.set(false);
    if (!keepFeedback) {
      this.showHistoricalDocs.set(false);
    }

    this.adminService.getApplicationDetails(applicationId).subscribe({
      next: (res) => {
        this.isLoadingDetails.set(false);
        if (res.success && res.application) {
          this.selectedApplication.set(res.application);
        }
      },
      error: (err: Error) => {
        this.isLoadingDetails.set(false);
        this.detailsError.set(err.message || 'Failed to retrieve application details.');
      }
    });
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.selectedApplication.set(null);
    this.detailsError.set(null);
    this.actionSuccess.set(null);
    this.actionError.set(null);
    this.isRejectingDecision.set(false);
    this.showHistoricalDocs.set(false);
  }

  toggleHistoricalDocs(): void {
    this.showHistoricalDocs.update((v) => !v);
  }

  /**
   * Resolves active and historical superseded documents for an application.
   * Rules:
   * 1. Explicitly replaced documents (isReplaced: true, or referenced by replacesDocument, or having replacedBy)
   *    are marked as superseded.
   * 2. Groups documents by documentType.
   * 3. For each documentType, selects exactly ONE latest active replacement:
   *    - The latest non-superseded document in chronological order.
   *    - If all documents in that type were flagged, the latest uploaded document for that type.
   * 4. All other documents for that documentType are classified as historical/superseded.
   */
  resolveDocuments(documents: AdminDocumentInfo[] | undefined | null): {
    activeDocs: AdminDocumentInfo[];
    historicalDocs: AdminDocumentInfo[];
    activeByType: Map<string, AdminDocumentInfo>;
  } {
    if (!documents || documents.length === 0) {
      return { activeDocs: [], historicalDocs: [], activeByType: new Map() };
    }

    const explicitlySupersededIds = new Set<string>();
    documents.forEach((d) => {
      const idStr = String(d._id || '');
      if (d.isReplaced === true) explicitlySupersededIds.add(idStr);
      if (d.replacesDocument) explicitlySupersededIds.add(String(d.replacesDocument));
      if (d.replacedBy) explicitlySupersededIds.add(idStr);
    });

    const docsByType = new Map<string, AdminDocumentInfo[]>();
    documents.forEach((doc) => {
      const type = (doc.documentType || '').trim();
      if (!type) return;
      if (!docsByType.has(type)) docsByType.set(type, []);
      docsByType.get(type)!.push(doc);
    });

    const activeDocs: AdminDocumentInfo[] = [];
    const historicalDocs: AdminDocumentInfo[] = [];
    const activeByType = new Map<string, AdminDocumentInfo>();

    docsByType.forEach((typeDocs, type) => {
      typeDocs.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a._id || '').localeCompare(String(b._id || ''));
      });

      let candidate: AdminDocumentInfo | null = null;
      for (let i = typeDocs.length - 1; i >= 0; i--) {
        const d = typeDocs[i];
        const idStr = String(d._id || '');
        if (!explicitlySupersededIds.has(idStr) && d.isReplaced !== true) {
          candidate = d;
          break;
        }
      }

      if (!candidate && typeDocs.length > 0) {
        candidate = typeDocs[typeDocs.length - 1];
      }

      if (candidate) {
        const candidateIdStr = String(candidate._id || '');
        activeDocs.push(candidate);
        activeByType.set(type, candidate);

        typeDocs.forEach((d) => {
          const idStr = String(d._id || '');
          if (idStr !== candidateIdStr) {
            historicalDocs.push({ ...d, isReplaced: true });
          }
        });
      }
    });

    return { activeDocs, historicalDocs, activeByType };
  }

  /**
   * Returns only current active documents (hiding superseded originals from main listing)
   */
  getActiveDocuments(documents: AdminDocumentInfo[] | undefined | null): AdminDocumentInfo[] {
    return this.resolveDocuments(documents).activeDocs;
  }

  /**
   * Returns superseded/historical documents for audit history
   */
  getHistoricalDocuments(documents: AdminDocumentInfo[] | undefined | null): AdminDocumentInfo[] {
    return this.resolveDocuments(documents).historicalDocs;
  }

  /**
   * Final Selection Decision: Mark candidate application as 'Selected'
   * Requires that candidate application is in 'Verified' status.
   */
  selectCandidate(): void {
    const app = this.selectedApplication();
    if (!app) return;

    if (app.status !== 'Verified') {
      this.actionError.set(
        `Cannot select candidate: Application must be 'Verified' before final selection (current status is '${app.status}').`
      );
      return;
    }

    this.actionLoading.set(true);
    this.actionSuccess.set(null);
    this.actionError.set(null);

    const remarks = 'Selected for admission based on merit score and verified credentials.';

    this.adminService.updateApplicationDecision(app._id, 'Selected', remarks).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        if (res.success) {
          this.actionSuccess.set(`Candidate ${app.personalDetails?.fullName || app.applicationId} has been officially Selected for admission.`);
          this.openApplicationDetails(app._id, true);
          this.loadDashboardStats();
          this.loadApplications();
        }
      },
      error: (err: Error) => {
        this.actionLoading.set(false);
        this.actionError.set(err.message || 'Failed to select candidate.');
      }
    });
  }

  openRejectPrompt(): void {
    this.isRejectingDecision.set(true);
    this.decisionRemarks = '';
    this.decisionRemarksError = '';
  }

  cancelRejectPrompt(): void {
    this.isRejectingDecision.set(false);
    this.decisionRemarks = '';
    this.decisionRemarksError = '';
  }

  confirmRejectCandidate(): void {
    const app = this.selectedApplication();
    if (!app) return;

    const remarks = this.decisionRemarks.trim();
    if (!remarks || remarks.length < 3) {
      this.decisionRemarksError = 'A meaningful remark (at least 3 characters) is required when rejecting an application.';
      return;
    }

    this.actionLoading.set(true);
    this.actionSuccess.set(null);
    this.actionError.set(null);

    this.adminService.updateApplicationDecision(app._id, 'Rejected', remarks).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.isRejectingDecision.set(false);
        if (res.success) {
          this.actionSuccess.set('Application marked as Rejected with recorded administrative decision remarks.');
          this.openApplicationDetails(app._id, true);
          this.loadDashboardStats();
          this.loadApplications();
        }
      },
      error: (err: Error) => {
        this.actionLoading.set(false);
        this.actionError.set(err.message || 'Failed to reject candidate.');
      }
    });
  }

  /**
   * Downloads or previews an uploaded document using the authenticated endpoint
   */
  openDocument(fileUrl: string): void {
    const token = this.authService.getToken();
    if (!token) return;

    // Direct download with authorization
    fetch(`http://localhost:5000${fileUrl}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to retrieve document.');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      })
      .catch((err) => {
        alert(`Error opening document: ${err.message}`);
      });
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  onRefresh(): void {
    this.loadDashboardStats();
    this.loadApplications();
  }

  onSignOut(): void {
    this.authService.logout('/');
    this.router.navigate(['/']);
  }
}
