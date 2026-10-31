import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'uem_auth_token';

/**
 * Functional HTTP Interceptor
 * Automatically attaches the Bearer JWT token to outgoing HTTP requests
 * when the user has an active session.
 * Reads token directly from browser storage to avoid circular DI dependencies with AuthService.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    token = localStorage.getItem(TOKEN_KEY);
  }

  // If request already has an Authorization header or token is missing, forward as-is
  if (req.headers.has('Authorization') || !token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};
