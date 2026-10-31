import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

/**
 * Functional Route Guard for Verification Officer Access
 * Protects verification portal routes, ensuring only authenticated users with the
 * 'verification_officer' role can access the dashboard.
 * - Unauthenticated users are redirected to /login with returnUrl query param.
 * - Authenticated Administrators are redirected to their authorized dashboard (/admin).
 * - Authenticated applicants are denied and redirected to home (/).
 */
export const verificationGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // If already authenticated in application state, check role immediately
  if (authService.isAuthenticated()) {
    const role = authService.currentUser()?.role;
    if (role === 'verification_officer') {
      return true;
    }
    if (role === 'admin') {
      return router.createUrlTree(['/admin']);
    }
    // Authenticated applicants are denied access to staff verification features
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
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }

      if (user.role === 'verification_officer') {
        return true;
      }

      if (user.role === 'admin') {
        return router.createUrlTree(['/admin']);
      }

      // Applicants are redirected to portal home
      return router.createUrlTree(['/']);
    })
  );
};
