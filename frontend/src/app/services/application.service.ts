import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface PersonalDetails {
  fullName: string;
  dateOfBirth: string; // ISO date string YYYY-MM-DD
  phone: string;
  address: Address;
}

export interface Class10Details {
  board: string;
  passingYear: number;
  marksPercentage: number;
  rollNumber?: string;
}

export interface Class12Details {
  board: string;
  passingYear: number;
  marksPercentage: number;
  stream?: string;
  rollNumber?: string;
}

export interface EntranceExamDetails {
  examName?: string;
  rollNumber?: string;
  scoreOrRank?: string;
  year?: number;
}

export interface AcademicDetails {
  class10: Class10Details;
  class12: Class12Details;
  entranceExam?: EntranceExamDetails;
}

export interface AdmissionApplication {
  _id: string;
  applicant: string | { _id: string; name: string; email: string; role: string };
  applicationId: string;
  personalDetails: PersonalDetails;
  academicDetails: AcademicDetails;
  selectedProgramme: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Verified' | 'Selected' | 'Rejected';
  verificationRemarks?: string;
  decisionRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationPayload {
  selectedProgramme: string;
  personalDetails: PersonalDetails;
  academicDetails: AcademicDetails;
}

export interface ApplicationResponse {
  success: boolean;
  message: string;
  application: AdmissionApplication;
}

export interface MyApplicationsResponse {
  success: boolean;
  count: number;
  applications: AdmissionApplication[];
}

export interface AdmissionDocument {
  _id: string;
  application: string | { _id: string; applicationId: string };
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  verificationRemarks?: string;
  isReplaced?: boolean;
  replacedBy?: string | null;
  replacesDocument?: string | null;
  createdAt: string;
  updatedAt: string;
  fileUrl: string;
}

export interface DocumentsListResponse {
  success: boolean;
  count: number;
  documents: AdmissionDocument[];
}

export interface DocumentUploadResponse {
  success: boolean;
  message: string;
  document: AdmissionDocument;
}

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/applications`;
  private readonly docUrl = `${environment.apiUrl}/documents`;

  /**
   * Submits a new admission application to the authoritative backend.
   * Expects server to assign unique applicationId and initial status.
   */
  createApplication(payload: CreateApplicationPayload): Observable<ApplicationResponse> {
    return this.http
      .post<ApplicationResponse>(this.baseUrl, payload)
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Updates an existing draft application's academic and personal details.
   */
  updateApplication(id: string, payload: CreateApplicationPayload): Observable<ApplicationResponse> {
    return this.http
      .put<ApplicationResponse>(`${this.baseUrl}/${id}`, payload)
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Retrieves all applications submitted by the authenticated applicant.
   */
  getMyApplications(): Observable<MyApplicationsResponse> {
    return this.http
      .get<MyApplicationsResponse>(`${this.baseUrl}/my`)
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Retrieves a specific application by database ObjectId.
   * Only permitted for the applicant owner or authorized staff.
   */
  getApplicationById(id: string): Observable<ApplicationResponse> {
    return this.http
      .get<ApplicationResponse>(`${this.baseUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Retrieves all documents associated with the authenticated applicant's application.
   */
  getMyDocuments(): Observable<DocumentsListResponse> {
    return this.http
      .get<DocumentsListResponse>(`${this.docUrl}/my`)
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Uploads an admission document with file and document type.
   * FormData boundary is automatically managed by the browser.
   */
  uploadDocument(formData: FormData): Observable<DocumentUploadResponse> {
    return this.http
      .post<DocumentUploadResponse>(this.docUrl, formData)
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Downloads or previews binary blob of an uploaded document using JWT authentication.
   */
  downloadDocumentFile(documentId: string): Observable<Blob> {
    return this.http
      .get(`${this.docUrl}/${documentId}/file?download=true`, {
        responseType: 'blob'
      })
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Deletes an uploaded admission document and its server-side file.
   */
  deleteDocument(documentId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<{ success: boolean; message: string }>(`${this.docUrl}/${documentId}`)
      .pipe(catchError(err => this.handleError(err)));
  }

  /**
   * Final submission of the admission application after mandatory documents are uploaded.
   * Transitions status from 'Draft' to 'Submitted'.
   */
  finalSubmitApplication(applicationId: string): Observable<ApplicationResponse> {
    return this.http
      .post<ApplicationResponse>(`${this.baseUrl}/${applicationId}/final-submit`, {})
      .pipe(catchError(err => this.handleError(err)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred while communicating with the server.';

    if (error.error && typeof error.error === 'object' && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.status === 0) {
      errorMessage = 'Unable to reach the admission server (http://localhost:5000). Please ensure backend is running.';
    } else if (error.status === 401) {
      errorMessage = 'Your session has expired. Please log in again to continue.';
    } else if (error.status === 403) {
      errorMessage = 'Access denied. You do not have permission to view or modify this resource.';
    } else if (error.status === 404) {
      errorMessage = 'The requested resource or document could not be found.';
    } else if (error.status === 409) {
      errorMessage = 'An application has already been submitted for your applicant account.';
    }

    const enhancedError = new Error(errorMessage) as Error & { status?: number };
    enhancedError.status = error.status;
    return throwError(() => enhancedError);
  }
}
