import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService, User } from '../services/auth.service';
import { of, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

describe('authGuard', () => {
  let mockAuthService: any;
  let mockRouter: any;

  const mockApplicantUser: User = {
    id: 'user_1',
    name: 'Sagnik Applicant',
    email: 'sagnik@example.com',
    role: 'applicant'
  };

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
      getToken: vi.fn(),
      checkAuthStatus: vi.fn()
    };

    mockRouter = {
      createUrlTree: vi.fn((commands: any[], extras?: any) => ({
        toString: () => `/login?returnUrl=${extras?.queryParams?.returnUrl || ''}`,
        commands,
        extras
      }))
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    });
  });

  it('should allow access immediately when user is authenticated in reactive state', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/application' } as any)
    );

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect unauthenticated candidate to /login with returnUrl=/application when no token exists', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/application' } as any)
    ) as UrlTree;

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/application' }
    });
    expect(result).toBeDefined();
  });

  it('should verify token with authoritative backend and allow access if token is valid', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue('valid_token_xyz');
    mockAuthService.checkAuthStatus.mockReturnValue(of(mockApplicantUser));

    const observableResult = TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/application' } as any)
    ) as any;

    const result = await firstValueFrom(observableResult);
    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to /login with returnUrl if token is rejected by authoritative backend', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);
    mockAuthService.getToken.mockReturnValue('expired_token_xyz');
    mockAuthService.checkAuthStatus.mockReturnValue(of(null));

    const observableResult = TestBed.runInInjectionContext(() =>
      authGuard({} as any, { url: '/application' } as any)
    ) as any;

    const result = await firstValueFrom(observableResult);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/application' }
    });
    expect(result).toBeDefined();
  });
});
