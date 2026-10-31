import { Component, OnInit, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, LowerCasePipe, SlicePipe } from '@angular/common';
import {
  VerificationService,
  VerificationStats,
  VerificationApplicationSummary,
  VerificationApplicationDetail,
  VerificationDocument,
  PaginationMeta
} from '../../services/verification.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verification',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, LowerCasePipe, SlicePipe],
  templateUrl: './verification.html',
  styleUrl: './verification.scss'
})
export class VerificationDashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly verificationService = inject(VerificationService);
  private readonly router = inject(Router);

  // Verification Statistics State
  readonly stats = signal<VerificationStats>({
    submitted: 0,
    underReview: 0,
    verified: 0,
    rejected: 0,
    selected: 0,
    draft: 0,
    total: 0,
    requiringReview: 0,
    pendingDocuments: 0
  });
  readonly isLoadingStats = signal(true);

  // Applications Table State
  readonly applications = signal<VerificationApplicationSummary[]>([]);
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

  // Filters & Search
  searchTerm = '';
  selectedStatus = 'All';
  selectedProgramme = 'All';
  currentPage = 1;
  itemsPerPage = 10;

  // Selected Application Dossier (Modal)
  readonly selectedApplication = signal<VerificationApplicationDetail | null>(null);
  readonly isLoadingDetails = signal(false);
  readonly detailsError = signal<string | null>(null);
  readonly isModalOpen = signal(false);

  // Action / Feedback State
  readonly actionLoading = signal<string | null>(null); // document ID or 'application'
  readonly actionSuccess = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  // Document Rejection Modal / Prompt State
  readonly rejectingDocument = signal<VerificationDocument | null>(null);
  documentRejectionRemarks = '';
  documentRejectionError = '';

  // Archived / Historical Documents disclosure state
  readonly showHistoricalDocs = signal<boolean>(false);

  // Static options for dropdown filters
  readonly statusOptions: string[] = [
    'All',
    'Submitted',
    'Under Review',
    'Verified',
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
    this.loadStats();
    this.loadApplications();
  }

  loadStats(): void {
    this.isLoadingStats.set(true);
    this.verificationService.getVerificationStats().subscribe({
      next: (res) => {
        this.isLoadingStats.set(false);
        if (res.success && res.stats) {
          this.stats.set(res.stats);
        }
      },
      error: (err: Error) => {
        this.isLoadingStats.set(false);
        console.error('Error fetching verification stats:', err);
      }
    });
  }

  loadApplications(): void {
    this.isLoadingApplications.set(true);
    this.applicationsError.set(null);

    this.verificationService
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

  onSearchSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.currentPage = 1;
    this.loadApplications();
  }

  onClearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadApplications();
  }

  onStatusChange(): void {
    this.currentPage = 1;
    this.loadApplications();
  }

  onProgrammeChange(): void {
    this.currentPage = 1;
    this.loadApplications();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'All';
    this.selectedProgramme = 'All';
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.loadApplications();
  }

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
   * Opens application dossier for verification review
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
    this.rejectingDocument.set(null);

    this.verificationService.getApplicationDetails(applicationId).subscribe({
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
    this.rejectingDocument.set(null);
  }

  /**
   * Approves an individual document (sets to 'Verified')
   */
  approveDocument(doc: VerificationDocument): void {
    this.actionLoading.set(doc._id);
    this.actionSuccess.set(null);
    this.actionError.set(null);

    this.verificationService.updateDocumentStatus(doc._id, 'Verified').subscribe({
      next: (res) => {
        this.actionLoading.set(null);
        if (res.success && res.document) {
          this.actionSuccess.set(`${doc.documentType} marked as Verified.`);
          // Refresh dossier
          const app = this.selectedApplication();
          if (app) {
            this.openApplicationDetails(app._id, true);
          }
          this.loadStats();
          this.loadApplications();
        }
      },
      error: (err: Error) => {
        this.actionLoading.set(null);
        this.actionError.set(err.message || 'Failed to approve document.');
      }
    });
  }

  /**
   * Opens document rejection prompt
   */
  openRejectDocumentPrompt(doc: VerificationDocument): void {
    this.rejectingDocument.set(doc);
    this.documentRejectionRemarks = '';
    this.documentRejectionError = '';
  }

  cancelRejectDocument(): void {
    this.rejectingDocument.set(null);
    this.documentRejectionRemarks = '';
    this.documentRejectionError = '';
  }

  /**
   * Confirms document rejection with required remarks
   */
  confirmRejectDocument(): void {
    const doc = this.rejectingDocument();
    if (!doc) return;

    const remarks = this.documentRejectionRemarks.trim();
    if (!remarks || remarks.length < 3) {
      this.documentRejectionError = 'A meaningful remark (at least 3 characters) is required when rejecting a document.';
      return;
    }

    this.actionLoading.set(doc._id);
    this.actionSuccess.set(null);
    this.actionError.set(null);

    this.verificationService.updateDocumentStatus(doc._id, 'Rejected', remarks).subscribe({
      next: (res) => {
        this.actionLoading.set(null);
        this.rejectingDocument.set(null);
        if (res.success && res.document) {
          this.actionSuccess.set(`${doc.documentType} has been Rejected. Candidate remark recorded.`);
          const app = this.selectedApplication();
          if (app) {
            this.openApplicationDetails(app._id, true);
          }
          this.loadStats();
          this.loadApplications();
        }
      },
      error: (err: Error) => {
        this.actionLoading.set(null);
        this.actionError.set(err.message || 'Failed to reject document.');
      }
    });
  }

  /**
   * Transitions application to 'Under Review'
   */
  markApplicationUnderReview(): void {
    const app = this.selectedApplication();
    if (!app) return;

    this.actionLoading.set('application');
    this.actionSuccess.set(null);
    this.actionError.set(null);

    this.verificationService
      .updateApplicationStatus(app._id, 'Under Review', 'Officer review initiated.')
      .subscribe({
        next: (res) => {
          this.actionLoading.set(null);
          if (res.success) {
            this.actionSuccess.set('Application marked as Under Review.');
            this.openApplicationDetails(app._id, true);
            this.loadStats();
            this.loadApplications();
          }
        },
        error: (err: Error) => {
          this.actionLoading.set(null);
          this.actionError.set(err.message || 'Failed to update application status.');
        }
      });
  }

  /**
   * Marks overall application as Verified
   * Requires that all uploaded documents are Verified and no documents are Pending or Rejected.
   */
  markApplicationVerified(): void {
    const app = this.selectedApplication();
    if (!app) return;

    if (!this.canMarkApplicationVerified()) {
      this.actionError.set(this.getVerificationBlockReason());
      return;
    }

    this.actionLoading.set('application');
    this.actionSuccess.set(null);
    this.actionError.set(null);

    this.verificationService
      .updateApplicationStatus(app._id, 'Verified', 'All required documents verified successfully.')
      .subscribe({
        next: (res) => {
          this.actionLoading.set(null);
          if (res.success) {
            this.actionSuccess.set('Application successfully marked as Verified!');
            this.openApplicationDetails(app._id, true);
            this.loadStats();
            this.loadApplications();
          }
        },
        error: (err: Error) => {
          this.actionLoading.set(null);
          this.actionError.set(err.message || 'Failed to verify application.');
        }
      });
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
  resolveDocuments(documents: VerificationDocument[] | undefined | null): {
    activeDocs: VerificationDocument[];
    historicalDocs: VerificationDocument[];
    activeByType: Map<string, VerificationDocument>;
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

    const docsByType = new Map<string, VerificationDocument[]>();
    documents.forEach((doc) => {
      const type = (doc.documentType || '').trim();
      if (!type) return;
      if (!docsByType.has(type)) docsByType.set(type, []);
      docsByType.get(type)!.push(doc);
    });

    const activeDocs: VerificationDocument[] = [];
    const historicalDocs: VerificationDocument[] = [];
    const activeByType = new Map<string, VerificationDocument>();

    docsByType.forEach((typeDocs, type) => {
      typeDocs.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a._id || '').localeCompare(String(b._id || ''));
      });

      let candidate: VerificationDocument | null = null;
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
  getActiveDocuments(documents: VerificationDocument[] | undefined | null): VerificationDocument[] {
    return this.resolveDocuments(documents).activeDocs;
  }

  /**
   * Returns superseded/historical documents for audit history
   */
  getHistoricalDocuments(documents: VerificationDocument[] | undefined | null): VerificationDocument[] {
    return this.resolveDocuments(documents).historicalDocs;
  }

  /**
   * Helper to check whether verification conditions are fully satisfied:
   * 1. Must have active documents (activeDocs.length > 0)
   * 2. All mandatory document types must be present
   * 3. ALL active documents must be in 'Verified' status
   * 4. A rejected document with a verified replacement of the same type satisfies that type.
   */
  canMarkApplicationVerified(): boolean {
    const app = this.selectedApplication();
    if (!app || !app.documents || app.documents.length === 0) return false;
    if (app.status === 'Verified' || app.status === 'Selected') return false;

    const { activeDocs, activeByType } = this.resolveDocuments(app.documents);
    if (activeDocs.length === 0) return false;

    const mandatoryTypes = ['Class 10 Marksheet', 'Class 12 Marksheet', 'Identity Proof'];
    const hasAllMandatory = mandatoryTypes.every((t) => activeByType.has(t));
    if (!hasAllMandatory) return false;

    return activeDocs.every((d) => d.verificationStatus === 'Verified');
  }

  getVerificationBlockReason(): string {
    const app = this.selectedApplication();
    if (!app) return '';
    if (!app.documents || app.documents.length === 0) {
      return 'No documents uploaded for this applicant. Cannot mark application as Verified.';
    }

    const { activeDocs, activeByType } = this.resolveDocuments(app.documents);
    if (activeDocs.length === 0) {
      return 'No active admission documents available for verification.';
    }

    const rejectedDocs = activeDocs.filter((d) => d.verificationStatus === 'Rejected');
    if (rejectedDocs.length > 0) {
      const rejectedTypes = Array.from(new Set(rejectedDocs.map((d) => d.documentType)));
      return `Cannot verify: ${rejectedDocs.length} active document(s) (${rejectedTypes.join(', ')}) are rejected without a verified replacement.`;
    }

    const pendingDocs = activeDocs.filter((d) => d.verificationStatus === 'Pending');
    if (pendingDocs.length > 0) {
      const pendingTypes = Array.from(new Set(pendingDocs.map((d) => d.documentType)));
      return `Cannot verify: ${pendingDocs.length} active document(s) (${pendingTypes.join(', ')}) are still pending verification review.`;
    }

    const mandatoryTypes = ['Class 10 Marksheet', 'Class 12 Marksheet', 'Identity Proof'];
    const missingMandatory = mandatoryTypes.filter((t) => !activeByType.has(t));
    if (missingMandatory.length > 0) {
      return `Cannot verify: Missing mandatory document(s): ${missingMandatory.join(', ')}. All mandatory documents must be uploaded and verified.`;
    }

    const unverifiedDocs = activeDocs.filter((d) => d.verificationStatus !== 'Verified');
    if (unverifiedDocs.length > 0) {
      return 'Cannot verify: All active documents must be in Verified status.';
    }

    return '';
  }

  /**
   * Opens authenticated document preview in a new window using Bearer token
   */
  openDocument(fileUrl: string): void {
    const token = this.authService.getToken();
    if (!token) return;

    fetch(`http://localhost:5000${fileUrl}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to retrieve document file.');
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
    this.loadStats();
    this.loadApplications();
  }

  onSignOut(): void {
    this.authService.logout('/');
    this.router.navigate(['/']);
  }
}
