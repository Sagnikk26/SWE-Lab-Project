import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Functional Route Guard for Administrator Access
 * Protects administrative routes, ensuring only authenticated users with the 'admin'
 * role can access the dashboard.
 * - Unauthenticated users are redirected to /login with returnUrl.
 * - Authenticated Verification Officers are redirected to their authorized portal (/verification).
 * - Authenticated applicants are denied and redirected to home (/).
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already authenticated in memory, check role immediately
  if (authService.isAuthenticated()) {
    const role = authService.currentUser()?.role;
    if (role === 'admin') {
      return true;
    }
    if (role === 'verification_officer') {
      return router.createUrlTree(['/verification']);
    }
    // Authenticated but not an admin (e.g. applicant)
    return router.createUrlTree(['/']);
  }

  // Check stored token in localStorage
  const token = authService.getToken();
  if (!token) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  // Validate session with authoritative backend (GET /api/auth/me)
  return authService.checkAuthStatus().pipe(
    map(user => {
      if (!user) {
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }

      if (user.role === 'admin') {
        return true;
      }

      if (user.role === 'verification_officer') {
        return router.createUrlTree(['/verification']);
      }

      // Non-admin roles (applicants) are redirected to portal home
      return router.createUrlTree(['/']);
    })
  );
};
