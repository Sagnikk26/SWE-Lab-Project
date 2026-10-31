import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationService } from './application.service';
import { environment } from '../../environments/environment';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApplicationService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(ApplicationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call GET /api/applications/my and return applications list', () => {
    const mockResponse = {
      success: true,
      count: 1,
      applications: [
        {
          _id: 'app123',
          applicationId: 'UEM-2026-102938',
          status: 'Submitted'
        } as any
      ]
    };

    service.getMyApplications().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
      expect(res.applications[0].applicationId).toBe('UEM-2026-102938');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/applications/my`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should call POST /api/applications with payload', () => {
    const payload: any = {
      selectedProgramme: 'B.Tech CSE',
      personalDetails: { fullName: 'Test Candidate' },
      academicDetails: {}
    };

    const mockResponse = {
      success: true,
      message: 'Created',
      application: {
        _id: 'app456',
        applicationId: 'UEM-2026-999999',
        status: 'Submitted'
      } as any
    };

    service.createApplication(payload).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.application.applicationId).toBe('UEM-2026-999999');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/applications`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('should call GET /api/documents/my and return documents list', () => {
    const mockResponse = {
      success: true,
      count: 1,
      documents: [
        {
          _id: 'doc123',
          documentType: 'Class 10 Marksheet',
          originalFilename: 'class10.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
          verificationStatus: 'Pending',
          fileUrl: '/api/documents/doc123/file'
        } as any
      ]
    };

    service.getMyDocuments().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.documents.length).toBe(1);
      expect(res.documents[0].documentType).toBe('Class 10 Marksheet');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/documents/my`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should call POST /api/documents with FormData', () => {
    const formData = new FormData();
    formData.append('documentType', 'Class 12 Marksheet');

    const mockResponse = {
      success: true,
      message: 'Uploaded',
      document: {
        _id: 'doc789',
        documentType: 'Class 12 Marksheet',
        verificationStatus: 'Pending'
      } as any
    };

    service.uploadDocument(formData).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.document._id).toBe('doc789');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/documents`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should call DELETE /api/documents/:id to remove document', () => {
    const mockResponse = {
      success: true,
      message: 'Document removed successfully.'
    };

    service.deleteDocument('doc_delete_1').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.message).toContain('removed');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/documents/doc_delete_1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(mockResponse);
  });
});
