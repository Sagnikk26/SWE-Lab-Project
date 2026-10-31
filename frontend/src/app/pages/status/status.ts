import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApplicationService, AdmissionApplication, AdmissionDocument } from '../../services/application.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './status.html',
  styleUrls: ['./status.scss']
})
export class StatusComponent implements OnInit {
  readonly applicationService = inject(ApplicationService);
  readonly authService = inject(AuthService);

  readonly existingApplication = signal<AdmissionApplication | null>(null);
  readonly uploadedDocuments = signal<AdmissionDocument[]>([]);
  readonly isLoadingInitial = signal(true);
  readonly isLoadingDocuments = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isRefreshing = signal(false);
  readonly copiedAppId = signal(false);
  readonly showHistoricalDocs = signal(false);

  // Replacement / Correction Modal state
  readonly showReplaceModal = signal(false);
  readonly replacingDoc = signal<AdmissionDocument | null>(null);
  readonly replacementFile = signal<File | null>(null);
  readonly replacementFileError = signal<string | null>(null);
  readonly isUploadingReplacement = signal(false);
  readonly documentActionSuccess = signal<string | null>(null);

  // Active documents (excluding superseded/replaced)
  readonly activeDocuments = computed(() => {
    return this.uploadedDocuments().filter(doc => !doc.isReplaced);
  });

  // Replaced / superseded documents (historical audit log)
  readonly historicalDocuments = computed(() => {
    return this.uploadedDocuments().filter(doc => doc.isReplaced === true);
  });

  // Unique document types currently requiring rectification (active and rejected)
  readonly rectificationRequiredDocTypes = computed(() => {
    const rejectedActiveDocs = this.activeDocuments().filter(
      doc => doc.verificationStatus === 'Rejected'
    );
    return Array.from(new Set(rejectedActiveDocs.map(d => d.documentType)));
  });

  readonly requiresRectification = computed(() => {
    return this.rectificationRequiredDocTypes().length > 0;
  });

  // Live document review statistics (strictly calculated on active documents to prevent double-counting)
  readonly docStats = computed(() => {
    const docs = this.activeDocuments();
    const total = docs.length;
    const verified = docs.filter(d => d.verificationStatus === 'Verified').length;
    const rejected = docs.filter(d => d.verificationStatus === 'Rejected').length;
    const pending = docs.filter(d => d.verificationStatus === 'Pending').length;
    const reviewed = verified + rejected;
    const completionPercentage = total > 0 ? Math.round((reviewed / total) * 100) : 0;

    return {
      total,
      verified,
      rejected,
      pending,
      reviewed,
      completionPercentage
    };
  });

  ngOnInit(): void {
    this.fetchApplicationStatus();
  }

  fetchApplicationStatus(): void {
    this.isLoadingInitial.set(true);
    this.errorMessage.set(null);

    this.applicationService.getMyApplications().subscribe({
      next: (res) => {
        this.isLoadingInitial.set(false);
        if (res.applications && res.applications.length > 0) {
          this.existingApplication.set(res.applications[0]);
          this.loadApplicationDocuments();
        } else {
          this.existingApplication.set(null);
        }
      },
      error: (err: Error) => {
        this.isLoadingInitial.set(false);
        this.errorMessage.set(err.message || 'Unable to retrieve your application status.');
      }
    });
  }

  loadApplicationDocuments(): void {
    this.isLoadingDocuments.set(true);
    this.applicationService.getMyDocuments().subscribe({
      next: (res) => {
        this.isLoadingDocuments.set(false);
        this.uploadedDocuments.set(res.documents || []);
      },
      error: (err: Error) => {
        this.isLoadingDocuments.set(false);
        console.error('Failed to load application documents:', err.message);
      }
    });
  }

  refreshStatus(): void {
    this.isRefreshing.set(true);
    this.documentActionSuccess.set(null);

    this.applicationService.getMyApplications().subscribe({
      next: (res) => {
        if (res.applications && res.applications.length > 0) {
          this.existingApplication.set(res.applications[0]);
        }
        this.applicationService.getMyDocuments().subscribe({
          next: (docRes) => {
            this.isRefreshing.set(false);
            this.uploadedDocuments.set(docRes.documents || []);
          },
          error: (docErr: Error) => {
            this.isRefreshing.set(false);
            this.errorMessage.set(docErr.message);
          }
        });
      },
      error: (err: Error) => {
        this.isRefreshing.set(false);
        this.errorMessage.set(err.message);
      }
    });
  }

  retryLoading(): void {
    this.fetchApplicationStatus();
  }

  copyApplicationId(id: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id).then(() => {
        this.copiedAppId.set(true);
        setTimeout(() => this.copiedAppId.set(false), 2000);
      });
    }
  }

  toggleHistoricalDocs(): void {
    this.showHistoricalDocs.update(show => !show);
  }

  openReplaceModal(doc: AdmissionDocument): void {
    if (doc.verificationStatus !== 'Rejected') return;
    if (this.existingApplication()?.status === 'Selected') return;

    this.replacingDoc.set(doc);
    this.replacementFile.set(null);
    this.replacementFileError.set(null);
    this.showReplaceModal.set(true);
  }

  closeReplaceModal(): void {
    this.showReplaceModal.set(false);
    this.replacingDoc.set(null);
    this.replacementFile.set(null);
    this.replacementFileError.set(null);
  }

  onReplacementFileSelected(event: Event): void {
    this.replacementFileError.set(null);
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      this.replacementFile.set(null);
      return;
    }

    const file = input.files[0];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      this.replacementFileError.set('Invalid file format. Only PDF, JPEG, PNG, and WebP documents are allowed.');
      this.replacementFile.set(null);
      input.value = '';
      return;
    }

    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) {
      this.replacementFileError.set('File size exceeds the 10 MB limit.');
      this.replacementFile.set(null);
      input.value = '';
      return;
    }

    this.replacementFile.set(file);
  }

  onSubmitReplacement(): void {
    this.replacementFileError.set(null);
    const file = this.replacementFile();
    const doc = this.replacingDoc();
    const app = this.existingApplication();

    if (!file || !doc || !app) {
      this.replacementFileError.set('Please select a replacement file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', doc.documentType);
    formData.append('applicationId', app._id);
    formData.append('replacesDocumentId', doc._id);

    this.isUploadingReplacement.set(true);

    this.applicationService.uploadDocument(formData).subscribe({
      next: () => {
        this.isUploadingReplacement.set(false);
        this.showReplaceModal.set(false);
        this.replacingDoc.set(null);
        this.replacementFile.set(null);

        this.documentActionSuccess.set(
          `Replacement for ${doc.documentType} uploaded successfully and returned to Pending review.`
        );

        this.refreshStatus();
      },
      error: (err: Error) => {
        this.isUploadingReplacement.set(false);
        this.replacementFileError.set(err.message);
      }
    });
  }

  downloadDocument(doc: AdmissionDocument): void {
    this.applicationService.downloadDocumentFile(doc._id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.originalFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err: Error) => {
        alert(`Failed to download ${doc.originalFilename}: ${err.message}`);
      }
    });
  }

  formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
