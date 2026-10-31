import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService, AuthResponse, UserProfileResponse, User } from './auth.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  const mockUser: User = {
    id: 'user_123',
    name: 'Sagnik Applicant',
    email: 'sagnik@example.com',
    role: 'applicant',
    phone: '+919876543210',
    intendedProgramme: 'B.Tech - Computer Science & Engineering'
  };

  const mockAuthResponse: AuthResponse = {
    success: true,
    message: 'Authentication successful',
    token: 'jwt_mock_token_xyz',
    user: mockUser
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created and start with unauthenticated state', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.userRole()).toBeNull();
    expect(service.getToken()).toBeNull();
  });

  describe('Registration & Automatic Authentication', () => {
    it('should register applicant, store token in localStorage, and update reactive signals immediately', () => {
      const payload = {
        name: 'Sagnik Applicant',
        email: 'sagnik@example.com',
        password: 'SecurePassword123'
      };

      service.register(payload).subscribe(res => {
        expect(res.success).toBe(true);
        expect(res.token).toBe('jwt_mock_token_xyz');
        expect(res.user.name).toBe('Sagnik Applicant');
        expect(res.user.role).toBe('applicant');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(mockAuthResponse);

      // Verify session established
      expect(service.getToken()).toBe('jwt_mock_token_xyz');
      expect(service.isAuthenticated()).toBe(true);
      expect(service.currentUser()?.name).toBe('Sagnik Applicant');
      expect(service.userRole()).toBe('applicant');
      // Verify password is not retained in user signal
      expect((service.currentUser() as any).password).toBeUndefined();
    });

    it('should handle registration error gracefully without creating session or saving token', () => {
      const payload = {
        name: 'Existing Applicant',
        email: 'exists@example.com',
        password: 'Password123'
      };

      let errorMessage = '';
      service.register(payload).subscribe({
        next: () => expect.fail('Registration should have failed'),
        error: (err: Error) => {
          errorMessage = err.message;
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/register`);
      req.flush(
        { success: false, message: 'An account with this email address already exists.' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(errorMessage).toBe('An account with this email address already exists.');
      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.currentUser()).toBeNull();
    });
  });

  describe('Login & Session Management', () => {
    it('should login, set session in localStorage, and update reactive state', () => {
      const loginPayload = {
        email: 'sagnik@example.com',
        password: 'SecurePassword123'
      };

      service.login(loginPayload).subscribe(res => {
        expect(res.success).toBe(true);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      req.flush(mockAuthResponse);

      expect(service.getToken()).toBe('jwt_mock_token_xyz');
      expect(service.isAuthenticated()).toBe(true);
      expect(service.currentUser()?.email).toBe('sagnik@example.com');
    });

    it('should handle invalid login credentials without storing token', () => {
      let errorReceived = '';
      service.login({ email: 'wrong@example.com', password: 'bad' }).subscribe({
        next: () => expect.fail('Expected login error'),
        error: (err: Error) => {
          errorReceived = err.message;
        }
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush({ success: false, message: 'Invalid email or password.' }, { status: 401, statusText: 'Unauthorized' });

      expect(errorReceived).toBe('Invalid email or password.');
      expect(service.getToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should authenticate admin through staffLogin to /auth/staff-login/admin', () => {
      const adminUser: User = {
        id: 'admin_123',
        name: 'Admin Boss',
        email: 'admin@uem.edu.in',
        role: 'admin'
      };
      const adminResponse: AuthResponse = {
        success: true,
        message: 'Staff authentication successful.',
        token: 'jwt_admin_token',
        user: adminUser
      };

      service.staffLogin({ email: 'admin@uem.edu.in', password: 'SecretPassword123' }, 'admin').subscribe(res => {
        expect(res.success).toBe(true);
        expect(res.user.role).toBe('admin');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/staff-login/admin`);
      expect(req.request.method).toBe('POST');
      req.flush(adminResponse);

      expect(service.getToken()).toBe('jwt_admin_token');
      expect(service.userRole()).toBe('admin');
    });

    it('should authenticate verification officer through staffLogin to /auth/staff-login/verification', () => {
      const officerUser: User = {
        id: 'off_123',
        name: 'Officer Jane',
        email: 'officer@uem.edu.in',
        role: 'verification_officer'
      };
      const officerResponse: AuthResponse = {
        success: true,
        message: 'Staff authentication successful.',
        token: 'jwt_officer_token',
        user: officerUser
      };

      service.staffLogin({ email: 'officer@uem.edu.in', password: 'OfficerPass123' }, 'verification').subscribe(res => {
        expect(res.success).toBe(true);
        expect(res.user.role).toBe('verification_officer');
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/staff-login/verification`);
      expect(req.request.method).toBe('POST');
      req.flush(officerResponse);

      expect(service.getToken()).toBe('jwt_officer_token');
      expect(service.userRole()).toBe('verification_officer');
    });

    it('should clear token, intended programme, currentUser, and navigate to / on logout()', () => {
      localStorage.setItem('uem_auth_token', 'token_to_clear');
      service.setIntendedProgramme('B.Tech - Computer Science & Engineering');
      const navigateSpy = vi.spyOn(router, 'navigate');

      service.logout();

      expect(service.getToken()).toBeNull();
      expect(localStorage.getItem('uem_auth_token')).toBeNull();
      expect(service.getIntendedProgramme()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.userRole()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
      expect(navigateSpy).not.toHaveBeenCalledWith(['/login']);
    });

    it('should clear token and navigate to / on signOut() from any portal', () => {
      localStorage.setItem('uem_auth_token', 'applicant_jwt_token');
      service.setIntendedProgramme('B.Tech - Computer Science & Engineering');
      const navigateSpy = vi.spyOn(router, 'navigate');

      service.signOut();

      expect(service.getToken()).toBeNull();
      expect(localStorage.getItem('uem_auth_token')).toBeNull();
      expect(service.getIntendedProgramme()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.userRole()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(['/']);
      expect(navigateSpy).not.toHaveBeenCalledWith(['/login']);
    });

    it('should clear token and user state without navigating when logout(null) is called', () => {
      localStorage.setItem('uem_auth_token', 'token_mismatch');
      const navigateSpy = vi.spyOn(router, 'navigate');

      service.logout(null);

      expect(service.getToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('should allow user to log in again through the portal after signing out', () => {
      // 1. Initial authenticated state
      localStorage.setItem('uem_auth_token', 'initial_token');
      service.signOut();

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();

      // 2. Perform fresh login
      let loginResult: AuthResponse | undefined;
      service.login({ email: 'sagnik@example.com', password: 'Password123' }).subscribe(res => {
        loginResult = res;
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush(mockAuthResponse);

      expect(loginResult).toBeDefined();
      expect(service.isAuthenticated()).toBe(true);
      expect(service.getToken()).toBe('jwt_mock_token_xyz');
      expect(service.currentUser()?.email).toBe('sagnik@example.com');
      expect(service.userRole()).toBe('applicant');
    });

    it('should ensure protected session data is completely removed and inaccessible after sign-out', () => {
      localStorage.setItem('uem_auth_token', 'admin_jwt_token');

      service.signOut();

      expect(service.isAuthenticated()).toBe(false);
      expect(service.userRole()).toBeNull();
      expect(service.getToken()).toBeNull();

      // checkAuthStatus without token should immediately return null observable without backend call
      let checkedUser: User | null = null;
      service.checkAuthStatus().subscribe(u => {
        checkedUser = u;
      });
      expect(checkedUser).toBeNull();
      httpMock.expectNone(`${environment.apiUrl}/auth/me`);
    });
  });

  describe('Intended Programme Preservation', () => {
    it('should store and retrieve canonical programme name from slug', () => {
      service.setIntendedProgramme('btech-cse');
      expect(service.getIntendedProgramme()).toBe('B.Tech - Computer Science & Engineering');
    });

    it('should store and retrieve canonical programme name directly if already formatted', () => {
      service.setIntendedProgramme('Master of Business Administration (MBA)');
      expect(service.getIntendedProgramme()).toBe('Master of Business Administration (MBA)');
    });

    it('should remove intended programme when cleared', () => {
      service.setIntendedProgramme('btech-ece');
      expect(service.getIntendedProgramme()).toBe('B.Tech - Electronics & Communication Engineering');

      service.clearIntendedProgramme();
      expect(service.getIntendedProgramme()).toBeNull();
    });

    it('should remove intended programme when given empty string', () => {
      service.setIntendedProgramme('btech-cse');
      service.setIntendedProgramme('');
      expect(service.getIntendedProgramme()).toBeNull();
    });

    it('should retrieve intended programme from backend user identity profile first even if localStorage is empty', () => {
      localStorage.clear();
      service.currentUser.set(mockUser);
      expect(service.getIntendedProgramme()).toBe('B.Tech - Computer Science & Engineering');
    });

    it('should retrieve registered phone from backend user identity profile', () => {
      service.currentUser.set(mockUser);
      expect(service.getRegisteredPhone()).toBe('+919876543210');
    });
  });

  describe('Authoritative Status Check (checkAuthStatus)', () => {
    it('should return null and clear state if no token in storage', () => {
      service.checkAuthStatus().subscribe(user => {
        expect(user).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
      });
    });

    it('should validate token with GET /api/auth/me and restore user state', () => {
      localStorage.setItem('uem_auth_token', 'valid_token');

      const profileResponse: UserProfileResponse = {
        success: true,
        user: mockUser
      };

      service.checkAuthStatus().subscribe(user => {
        expect(user).toEqual(mockUser);
        expect(service.currentUser()).toEqual(mockUser);
        expect(service.isAuthenticated()).toBe(true);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer valid_token');
      req.flush(profileResponse);
    });

    it('should clear session if backend returns 401 for expired token', () => {
      localStorage.setItem('uem_auth_token', 'expired_token');

      service.checkAuthStatus().subscribe(user => {
        expect(user).toBeNull();
        expect(service.getToken()).toBeNull();
        expect(service.currentUser()).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      req.flush({ success: false, message: 'Token expired' }, { status: 401, statusText: 'Unauthorized' });
    });
  });
});
