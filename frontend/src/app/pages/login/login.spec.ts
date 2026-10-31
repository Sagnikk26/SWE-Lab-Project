import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { LoginComponent } from './login';
import { AuthService, User, AuthResponse } from '../../services/auth.service';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let mockAuthService: any;
  let router: Router;
  let mockActivatedRoute: any;

  const mockApplicantUser: User = {
    id: 'user_applicant_1',
    name: 'Sagnik Applicant',
    email: 'sagnik@example.com',
    role: 'applicant'
  };

  const mockOfficerUser: User = {
    id: 'user_officer_1',
    name: 'Verification Officer',
    email: 'officer@uem.edu.in',
    role: 'verification_officer'
  };

  const mockAdminUser: User = {
    id: 'user_admin_1',
    name: 'Portal Administrator',
    email: 'admin@uem.edu.in',
    role: 'admin'
  };

  const createAuthResponse = (user: User): AuthResponse => ({
    success: true,
    message: 'Login successful',
    token: `jwt_mock_token_${user.id}`,
    user
  });

  const setupTestBed = async (queryParams: Record<string, string> = {}) => {
    mockAuthService = {
      login: vi.fn(),
      currentUser: vi.fn(),
      isAuthenticated: vi.fn()
    };

    mockActivatedRoute = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => queryParams[key] || null
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should create the login component', async () => {
    await setupTestBed();
    expect(component).toBeTruthy();
    expect(component.isLoading()).toBe(false);
    expect(component.errorMessage()).toBeNull();
  });

  it('should validate email is required', async () => {
    await setupTestBed();
    component.email = '';
    component.password = 'password123';

    component.onLoginSubmit();

    expect(component.errorMessage()).toContain('enter your registered email');
    expect(mockAuthService.login).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should validate password is required', async () => {
    await setupTestBed();
    component.email = 'sagnik@example.com';
    component.password = '';

    component.onLoginSubmit();

    expect(component.errorMessage()).toContain('enter your account password');
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  describe('Role-based Redirection and Authorization', () => {
    it('should redirect applicant to /application when no returnUrl is specified', async () => {
      await setupTestBed({});
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sagnik@example.com';
      component.password = 'SecurePassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/application');
      expect(component.successMessage()).toContain('Welcome back, Sagnik Applicant');
    });

    it('should redirect applicant to /application when returnUrl is root (/)', async () => {
      await setupTestBed({ returnUrl: '/' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sagnik@example.com';
      component.password = 'SecurePassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/application');
    });

    it('should preserve valid applicant return destination with query params', async () => {
      await setupTestBed({ returnUrl: '/application?programme=btech' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sagnik@example.com';
      component.password = 'SecurePassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/application?programme=btech');
    });

    it('should prevent applicant from redirecting to /admin and route to /application', async () => {
      await setupTestBed({ returnUrl: '/admin' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sagnik@example.com';
      component.password = 'SecurePassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/application');
    });

    it('should prevent applicant from redirecting to /verification and route to /application', async () => {
      await setupTestBed({ returnUrl: '/verification' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sagnik@example.com';
      component.password = 'SecurePassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/application');
    });

    it('should redirect verification officer to /verification by default', async () => {
      await setupTestBed({});
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockOfficerUser)));

      component.email = 'officer@uem.edu.in';
      component.password = 'OfficerPassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');
    });

    it('should prevent verification officer from redirecting to /admin and route to /verification', async () => {
      await setupTestBed({ returnUrl: '/admin' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockOfficerUser)));

      component.email = 'officer@uem.edu.in';
      component.password = 'OfficerPassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');
    });

    it('should allow verification officer with returnUrl=/verification', async () => {
      await setupTestBed({ returnUrl: '/verification?tab=pending' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockOfficerUser)));

      component.email = 'officer@uem.edu.in';
      component.password = 'OfficerPassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/verification?tab=pending');
    });

    it('should redirect administrator to /admin by default', async () => {
      await setupTestBed({});
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockAdminUser)));

      component.email = 'admin@uem.edu.in';
      component.password = 'AdminPassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('should allow administrator to access any valid internal route such as /verification', async () => {
      await setupTestBed({ returnUrl: '/verification' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockAdminUser)));

      component.email = 'admin@uem.edu.in';
      component.password = 'AdminPassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');
    });

    it('should guard against protocol-relative open redirect attacks', async () => {
      await setupTestBed({ returnUrl: '//evil.example.com' });
      mockAuthService.login.mockReturnValue(of(createAuthResponse(mockApplicantUser)));

      component.email = 'sagnik@example.com';
      component.password = 'SecurePassword123';
      component.onLoginSubmit();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/application');
    });
  });

  it('should handle login error gracefully without navigating', async () => {
    await setupTestBed({ returnUrl: '/application' });
    mockAuthService.login.mockReturnValue(
      throwError(() => new Error('Invalid email or password.'))
    );

    component.email = 'sagnik@example.com';
    component.password = 'wrongPassword';

    component.onLoginSubmit();

    expect(component.errorMessage()).toBe('Invalid email or password.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('should toggle password visibility signal', async () => {
    await setupTestBed();
    expect(component.showPassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);
  });
});
