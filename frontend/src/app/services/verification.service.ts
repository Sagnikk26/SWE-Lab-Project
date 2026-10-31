import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VerificationStats {
  submitted: number;
  underReview: number;
  verified: number;
  rejected: number;
  selected: number;
  draft: number;
  total: number;
  requiringReview: number;
  pendingDocuments: number;
}

export interface VerificationStatsResponse {
  success: boolean;
  stats: VerificationStats;
  generatedAt: string;
}

export interface VerificationApplicantInfo {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface VerificationDocument {
  _id: string;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  verificationRemarks: string;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
  verifiedBy?: { _id: string; name: string; email: string } | null;
  isReplaced?: boolean;
  replacedBy?: string | null;
  replacesDocument?: string | null;
}

export interface VerificationDocumentStats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
}

export interface VerificationApplicationSummary {
  _id: string;
  applicationId: string;
  applicant: VerificationApplicantInfo;
  personalDetails: {
    fullName: string;
    dateOfBirth: string;
    phone: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
  };
  academicDetails: {
    class10: {
      board: string;
      passingYear: number;
      marksPercentage: number;
      rollNumber?: string;
    };
    class12: {
      board: string;
      passingYear: number;
      marksPercentage: number;
      stream: string;
      rollNumber?: string;
    };
    entranceExam?: {
      examName?: string;
      rollNumber?: string;
      scoreOrRank?: string;
      year?: number;
    };
  };
  selectedProgramme: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Verified' | 'Selected' | 'Rejected';
  verificationRemarks?: string;
  decisionRemarks?: string;
  verifiedBy?: { _id: string; name: string; email: string } | null;
  documentStats: VerificationDocumentStats;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationApplicationDetail extends VerificationApplicationSummary {
  documents: VerificationDocument[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface VerificationApplicationsListResponse {
  success: boolean;
  applications: VerificationApplicationSummary[];
  pagination: PaginationMeta;
}

export interface VerificationApplicationDetailResponse {
  success: boolean;
  application: VerificationApplicationDetail;
}

export interface UpdateDocumentStatusResponse {
  success: boolean;
  message: string;
  document: VerificationDocument;
}

export interface UpdateApplicationStatusResponse {
  success: boolean;
  message: string;
  application: VerificationApplicationDetail;
}

export interface VerificationFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  programme?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VerificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/verification`;

  /**
   * Retrieves summary counts for verification dashboard.
   */
  getVerificationStats(): Observable<VerificationStatsResponse> {
    return this.http.get<VerificationStatsResponse>(`${this.baseUrl}/stats`);
  }

  /**
   * Lists admission applications with pagination, status, programme, and search filters.
   */
  getApplications(filters: VerificationFilterParams = {}): Observable<VerificationApplicationsListResponse> {
    let params = new HttpParams();

    if (filters.page && filters.page > 0) {
      params = params.set('page', filters.page.toString());
    }
    if (filters.limit && filters.limit > 0) {
      params = params.set('limit', filters.limit.toString());
    }
    if (filters.search && filters.search.trim()) {
      params = params.set('search', filters.search.trim());
    }
    if (filters.status && filters.status.trim() && filters.status !== 'All') {
      params = params.set('status', filters.status.trim());
    }
    if (filters.programme && filters.programme.trim() && filters.programme !== 'All') {
      params = params.set('programme', filters.programme.trim());
    }

    return this.http.get<VerificationApplicationsListResponse>(`${this.baseUrl}/applications`, { params });
  }

  /**
   * Retrieves application details and associated document metadata for verification review.
   */
  getApplicationDetails(id: string): Observable<VerificationApplicationDetailResponse> {
    return this.http.get<VerificationApplicationDetailResponse>(`${this.baseUrl}/applications/${id}`);
  }

  /**
   * Updates an individual document's verification status (Verified or Rejected).
   * Meaningful rejection remark is mandatory when status is 'Rejected'.
   */
  updateDocumentStatus(
    documentId: string,
    status: 'Verified' | 'Rejected',
    remarks?: string
  ): Observable<UpdateDocumentStatusResponse> {
    return this.http.patch<UpdateDocumentStatusResponse>(
      `${this.baseUrl}/documents/${documentId}/status`,
      { status, remarks }
    );
  }

  /**
   * Updates the overall application status through permitted workflow transitions.
   */
  updateApplicationStatus(
    applicationId: string,
    status: 'Under Review' | 'Verified' | 'Rejected',
    remarks?: string
  ): Observable<UpdateApplicationStatusResponse> {
    return this.http.patch<UpdateApplicationStatusResponse>(
      `${this.baseUrl}/applications/${applicationId}/status`,
      { status, remarks }
    );
  }
}
