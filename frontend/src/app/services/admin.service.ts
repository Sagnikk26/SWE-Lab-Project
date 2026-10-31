import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProgrammeCount {
  programme: string;
  count: number;
}

export interface DashboardStats {
  total: number;
  submitted: number;
  underReview: number;
  verified: number;
  selected: number;
  rejected: number;
  draft: number;
  byProgramme?: ProgrammeCount[];
}

export interface DashboardStatsResponse {
  success: boolean;
  stats: DashboardStats;
  programmeStats?: ProgrammeCount[];
  generatedAt: string;
}

export interface AdminApplicantInfo {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AdminDocumentInfo {
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
  verifiedBy?: { name: string; email: string } | null;
  isReplaced?: boolean;
  replacesDocument?: string | null;
  replacedBy?: string | null;
}

export interface AdminApplicationSummary {
  _id: string;
  applicationId: string;
  applicant: AdminApplicantInfo;
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
  createdAt: string;
  updatedAt: string;
}

export interface AdminApplicationDetail extends AdminApplicationSummary {
  documents: AdminDocumentInfo[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AdminApplicationsListResponse {
  success: boolean;
  applications: AdminApplicationSummary[];
  pagination: PaginationMeta;
}

export interface AdminApplicationDetailResponse {
  success: boolean;
  application: AdminApplicationDetail;
}

export interface ApplicationFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  programme?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  /**
   * Retrieves admission dashboard statistics from the authoritative backend.
   */
  getDashboardStats(): Observable<DashboardStatsResponse> {
    return this.http.get<DashboardStatsResponse>(`${this.baseUrl}/stats`);
  }

  /**
   * Lists admission applications with pagination, search, status, and programme filters.
   */
  getApplications(filters: ApplicationFilterParams = {}): Observable<AdminApplicationsListResponse> {
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

    return this.http.get<AdminApplicationsListResponse>(`${this.baseUrl}/applications`, { params });
  }

  /**
   * Retrieves the full details of an individual application along with document metadata.
   */
  getApplicationDetails(id: string): Observable<AdminApplicationDetailResponse> {
    return this.http.get<AdminApplicationDetailResponse>(`${this.baseUrl}/applications/${id}`);
  }

  /**
   * Records authoritative final admission selection decision (Selected or Rejected).
   */
  updateApplicationDecision(
    id: string,
    status: 'Selected' | 'Rejected',
    remarks?: string
  ): Observable<{ success: boolean; message: string; application: AdminApplicationDetail }> {
    return this.http.patch<{ success: boolean; message: string; application: AdminApplicationDetail }>(
      `${this.baseUrl}/applications/${id}/decision`,
      { status, remarks }
    );
  }
}
