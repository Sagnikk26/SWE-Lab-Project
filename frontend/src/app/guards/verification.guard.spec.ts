import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { verificationGuard } from './verification.guard';
import { AuthService, User } from '../services/auth.service';
import { of, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

describe('verificationGuard', () => {
  let mockAuthService: any;
  let mockRouter: any;

  const mockAdminUser: User = {
    id: 'admin1',
    name: 'Registrar Admin',
    email: 'admin@uem.edu.in',
    role: 'admin'
  };

  const mockOfficerUser: User = {
    id: 'off1',
    name: 'Verification Officer',
    email: 'officer@uem.edu.in',
    role: 'verification_officer'
  };

  const mockApplicantUser: User = {
    id: 'app1',
    name: 'Sagnik Applicant',
    email: 'sagnik@example.com',
    role: 'applicant'
  };

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
      currentUser: vi.fn(),
      getToken: vi.fn(),
      checkAuthStatus: vi.fn()
    };
    mockRouter = {
      createUrlTree: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });
  });

  it('should allow access if user is already authenticated as verification officer in state', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.currentUser.mockReturnValue(mockOfficerUser);

    const result = TestBed.runInInjectionContext(() =>
      verificationGuard({} as any, { url: '/verification' } as any)
    );

    expect(result).toBe(true);
  });

  it('should deny and redirect admin to admin dashboard (/admin) if already in state', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.currentUser.mockReturnValue(mockAdminUser);
    const dummyUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.mockReturnValue(dummyUrlTree);

    const result = TestBed.runInInjectionContext(() =>
      verificationGuard({} as any, { url: '/verification' } as any)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/admin']);
    expect(result).toBe(dummyUrlTree);
  });

  it('should deny and redirect applicant to portal home if already in state', () => {
    const dummyUrlTree = {} as UrlTree;
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.currentUser.mockReturnValue(mockApplicantUser);
    mockRouter.createUrlTree.mockReturnValue(dummyUrlTree);

    const result = TestBed.runInInjectionContext(() =>
      verificationGuard({} as any, { url: '/verification' } as any)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toBe(dummyUrlTree);
  });

  it('should redirect unauthenticated user to login if no token stored', () => {
    const dummyUrlTree = {} as UrlTree;
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue(null);
    mockRouter.createUrlTree.mockReturnValue(dummyUrlTree);

    const result = TestBed.runInInjectionContext(() =>
      verificationGuard({} as any, { url: '/verification' } as any)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/verification' }
    });
    expect(result).toBe(dummyUrlTree);
  });

  it('should validate token with checkAuthStatus and allow officer', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue('valid-jwt-token');
    mockAuthService.checkAuthStatus.mockReturnValue(of(mockOfficerUser));

    const result$ = TestBed.runInInjectionContext(() =>
      verificationGuard({} as any, { url: '/verification' } as any)
    );

    const result = await firstValueFrom(result$ as any);
    expect(result).toBe(true);
  });

  it('should validate token with checkAuthStatus and deny applicant', async () => {
    const dummyUrlTree = {} as UrlTree;
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue('valid-jwt-token');
    mockAuthService.checkAuthStatus.mockReturnValue(of(mockApplicantUser));
    mockRouter.createUrlTree.mockReturnValue(dummyUrlTree);

    const result$ = TestBed.runInInjectionContext(() =>
      verificationGuard({} as any, { url: '/verification' } as any)
    );

    const result = await firstValueFrom(result$ as any);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toBe(dummyUrlTree);
  });

  it('should validate token with checkAuthStatus and redirect admin to /admin', async () => {
    const dummyUrlTree = {} as UrlTree;
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue('valid-admin-token');
    mockAuthService.checkAuthStatus.mockReturnValue(of(mockAdminUser));
    mockRouter.createUrlTree.mockReturnValue(dummyUrlTree);

    const result$ = TestBed.runInInjectionContext(() =>
      verificationGuard({} as any, { url: '/verification' } as any)
    );

    const result = await firstValueFrom(result$ as any);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/admin']);
    expect(result).toBe(dummyUrlTree);
  });
});
