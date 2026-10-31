import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService, User } from '../services/auth.service';
import { of, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

describe('adminGuard', () => {
  let mockAuthService: any;
  let mockRouter: any;

  const mockAdminUser: User = {
    id: 'admin1',
    name: 'Registrar Admin',
    email: 'admin@uem.edu.in',
    role: 'admin'
  };

  const mockApplicantUser: User = {
    id: 'app1',
    name: 'Sagnik Applicant',
    email: 'sagnik@example.com',
    role: 'applicant'
  };

  const mockOfficerUser: User = {
    id: 'off1',
    name: 'Verification Officer',
    email: 'officer@uem.edu.in',
    role: 'verification_officer'
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

  it('should allow access if user is already authenticated as admin in state', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.currentUser.mockReturnValue(mockAdminUser);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin' } as any)
    );

    expect(result).toBe(true);
  });

  it('should redirect to portal home (/) if user is authenticated as an applicant', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.currentUser.mockReturnValue(mockApplicantUser);

    const fakeUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.mockReturnValue(fakeUrlTree);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin' } as any)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toBe(fakeUrlTree);
  });

  it('should redirect to verification portal (/verification) if user is authenticated as a verification officer', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.currentUser.mockReturnValue(mockOfficerUser);

    const fakeUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.mockReturnValue(fakeUrlTree);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin' } as any)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/verification']);
    expect(result).toBe(fakeUrlTree);
  });

  it('should redirect unauthenticated user without token to /login with returnUrl', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue(null);

    const fakeUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.mockReturnValue(fakeUrlTree);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin' } as any)
    );

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/admin' }
    });
    expect(result).toBe(fakeUrlTree);
  });

  it('should check with authoritative backend when token exists and allow if admin', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue('valid-admin-token');
    mockAuthService.checkAuthStatus.mockReturnValue(of(mockAdminUser));

    const result$ = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin' } as any)
    );

    const allowed = await firstValueFrom(result$ as any);
    expect(allowed).toBe(true);
  });

  it('should check with authoritative backend when token exists and redirect officer to /verification', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue('valid-officer-token');
    mockAuthService.checkAuthStatus.mockReturnValue(of(mockOfficerUser));
    const fakeUrlTree = {} as UrlTree;
    mockRouter.createUrlTree.mockReturnValue(fakeUrlTree);

    const result$ = TestBed.runInInjectionContext(() =>
      adminGuard({} as any, { url: '/admin' } as any)
    );

    const result = await firstValueFrom(result$ as any);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/verification']);
    expect(result).toBe(fakeUrlTree);
  });
});
