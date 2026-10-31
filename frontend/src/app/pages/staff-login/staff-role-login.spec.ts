import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { StaffRoleLoginComponent } from './staff-role-login';
import { AuthService, User, AuthResponse } from '../../services/auth.service';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

describe('StaffRoleLoginComponent', () => {
  let component: StaffRoleLoginComponent;
  let mockAuthService: any;
  let router: Router;

  const mockAdminUser: User = {
    id: 'adm_1',
    name: 'Admin Boss',
    email: 'admin@uem.edu.in',
    role: 'admin'
  };

  const mockOfficerUser: User = {
    id: 'off_1',
    name: 'Officer Jane',
    email: 'officer@uem.edu.in',
    role: 'verification_officer'
  };

  const mockApplicantUser: User = {
    id: 'app_1',
    name: 'Applicant Sam',
    email: 'sam@example.com',
    role: 'applicant'
  };

  const createAuthResponse = (user: User): AuthResponse => ({
    success: true,
    message: 'Login successful',
    token: `jwt_mock_${user.id}`,
    user
  });

  const setupComponent = (
    portal: 'admin' | 'verification',
    currentUser: User | null = null
  ) => {
    mockAuthService = {
      login: vi.fn(),
      isAuthenticated: vi.fn(() => !!currentUser),
      currentUser: vi.fn(() => currentUser),
      logout: vi.fn()
    };

    const mockActivatedRoute = {
      snapshot: {
        data: { portal },
        url: [{ path: portal }]
      }
    };

    TestBed.configureTestingModule({
      imports: [StaffRoleLoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(StaffRoleLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture };
  };

  describe('Administrator Portal Configuration & Workflow', () => {
    it('should configure component properly for Administrator Login', () => {
      const { fixture } = setupComponent('admin');
      const element: HTMLElement = fixture.nativeElement;

      expect(component.portalType).toBe('admin');
      expect(component.expectedRole).toBe('admin');
      expect(component.portalTitle).toBe('Administrator Portal Login');
      expect(element.textContent).toContain('Administrator Portal Login');
      expect(element.textContent).toContain('Central Admissions Committee');
    });

    it('should successfully authenticate admin and redirect to /admin', () => {
      setupComponent('admin');
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockAdminUser)));

      component.email = 'admin@uem.edu.in';
      component.password = 'SuperSecret123';
      component.onLoginSubmit();

      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'admin@uem.edu.in',
        password: 'SuperSecret123'
      });
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
      expect(component.roleMismatch()).toBe(false);
    });

    it('should deny access to /admin when a verification officer signs in and show role mismatch', () => {
      setupComponent('admin');
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockOfficerUser)));

      component.email = 'officer@uem.edu.in';
      component.password = 'OfficerSecret123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).not.toHaveBeenCalledWith('/admin');
      expect(component.roleMismatch()).toBe(true);
      expect(component.mismatchDetails()?.role).toBe('verification_officer');
    });

    it('should deny access to /admin when an applicant signs in and show role mismatch', () => {
      setupComponent('admin');
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sam@example.com';
      component.password = 'CandidatePass123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).not.toHaveBeenCalledWith('/admin');
      expect(component.roleMismatch()).toBe(true);
      expect(component.mismatchDetails()?.role).toBe('applicant');
    });

    it('should immediately redirect to /admin if user is already authenticated as admin', () => {
      setupComponent('admin', mockAdminUser);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('should show role mismatch warning if user is already authenticated as verification officer', () => {
      setupComponent('admin', mockOfficerUser);
      expect(router.navigateByUrl).not.toHaveBeenCalledWith('/admin');
      expect(component.roleMismatch()).toBe(true);
      expect(component.mismatchDetails()?.role).toBe('verification_officer');
    });
  });

  describe('Verification Officer Portal Configuration & Workflow', () => {
    it('should configure component properly for Verification Officer Login', () => {
      const { fixture } = setupComponent('verification');
      const element: HTMLElement = fixture.nativeElement;

      expect(component.portalType).toBe('verification');
      expect(component.expectedRole).toBe('verification_officer');
      expect(component.portalTitle).toBe('Verification Officer Login');
      expect(element.textContent).toContain('Verification Officer Login');
      expect(element.textContent).toContain('Candidate Document Verification');
    });

    it('should successfully authenticate verification officer and redirect to /verification', () => {
      setupComponent('verification');
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockOfficerUser)));

      component.email = 'officer@uem.edu.in';
      component.password = 'OfficerSecret123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');
      expect(component.roleMismatch()).toBe(false);
    });

    it('should deny access to /verification when an admin signs in and show role mismatch', () => {
      setupComponent('verification');
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockAdminUser)));

      component.email = 'admin@uem.edu.in';
      component.password = 'AdminSecret123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).not.toHaveBeenCalledWith('/verification');
      expect(component.roleMismatch()).toBe(true);
      expect(component.mismatchDetails()?.role).toBe('admin');
    });

    it('should deny access to /verification when an applicant signs in and show role mismatch', () => {
      setupComponent('verification');
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sam@example.com';
      component.password = 'ApplicantPass123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).not.toHaveBeenCalledWith('/verification');
      expect(component.roleMismatch()).toBe(true);
      expect(component.mismatchDetails()?.role).toBe('applicant');
    });

    it('should immediately redirect to /verification if user is already authenticated as verification officer', () => {
      setupComponent('verification', mockOfficerUser);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');
    });
  });

  describe('General Validation & Interactions', () => {
    it('should require staff email and password', () => {
      setupComponent('admin');

      component.email = '';
      component.password = 'pass123';
      component.onLoginSubmit();
      expect(component.errorMessage()).toContain('staff email address');
      expect(mockAuthService.login).not.toHaveBeenCalled();

      component.email = 'admin@uem.edu.in';
      component.password = '';
      component.onLoginSubmit();
      expect(component.errorMessage()).toContain('staff account password');
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should handle authentication errors gracefully', () => {
      setupComponent('admin');
      mockAuthService.login.mockReturnValue(
        throwError(() => new Error('Invalid email or password.'))
      );

      component.email = 'admin@uem.edu.in';
      component.password = 'wrongPassword';
      component.onLoginSubmit();

      expect(component.errorMessage()).toBe('Invalid email or password.');
      expect(component.isLoading()).toBe(false);
    });

    it('should toggle password visibility', () => {
      setupComponent('admin');
      expect(component.showPassword()).toBe(false);
      component.togglePasswordVisibility();
      expect(component.showPassword()).toBe(true);
    });

    it('should handle proceeding to assigned dashboard from mismatch state', () => {
      setupComponent('admin');
      component.mismatchDetails.set({ role: 'verification_officer', name: 'Jane' });
      component.proceedToAssignedDashboard();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');

      component.mismatchDetails.set({ role: 'admin', name: 'Boss' });
      component.proceedToAssignedDashboard();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');

      component.mismatchDetails.set({ role: 'applicant', name: 'Sam' });
      component.proceedToAssignedDashboard();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/application');
    });

    it('should call authService.logout() when signing out from mismatch state', () => {
      setupComponent('admin');
      component.roleMismatch.set(true);
      component.mismatchDetails.set({ role: 'applicant', name: 'Sam' });

      component.onSignOut();

      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(component.roleMismatch()).toBe(false);
      expect(component.mismatchDetails()).toBeNull();
    });
  });
});
