import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'applicant' | 'verification_officer' | 'admin';
  phone?: string;
  intendedProgramme?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  programme?: string;
  intendedProgramme?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  portal?: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

export interface UserProfileResponse {
  success: boolean;
  user: User;
}

/**
 * Authentication Service
 *
 * Security Architecture & Token Storage Notice:
 * ----------------------------------------------------
 * 1. Scope: This service stores the returned JWT in browser localStorage under 'uem_auth_token'.
 *    Passwords and server secrets are NEVER stored on the client.
 * 2. Limitations: Storing tokens in localStorage leaves them accessible to JavaScript running
 *    in the same origin. An XSS vulnerability could allow unauthorized extraction. In enterprise
 *    production systems, storing tokens inside HttpOnly, Secure, SameSite=Strict cookies mitigates
 *    XSS token theft (while requiring CSRF protection).
 * 3. Authoritative Verification: The client NEVER assumes token validity or relies on client-side
 *    decoding for access control. The authoritative backend validates every token via 'GET /api/auth/me'
 *    before confirming the active session.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router, { optional: true });
  private readonly baseUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'uem_auth_token';
  private readonly INTENDED_PROGRAMME_KEY = 'uem_intended_programme';

  // Reactive state using Angular Signals
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.role || null);

  constructor() {
    // Check initial authentication state against authoritative backend on startup
    this.checkAuthStatus().subscribe();
  }

  /**
   * Retrieves the stored JWT token from client storage
   */
  getToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  /**
   * Preserves the applicant's intended programme choice entered during registration.
   */
  setIntendedProgramme(programme: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (programme && programme.trim()) {
        const slugMap: Record<string, string> = {
          'btech-cse': 'B.Tech - Computer Science & Engineering',
          'btech-cse-aiml': 'B.Tech - CSE (Artificial Intelligence & Machine Learning)',
          'btech-ece': 'B.Tech - Electronics & Communication Engineering',
          'bca': 'Bachelor of Computer Applications (BCA)',
          'bba': 'Bachelor of Business Administration (BBA)',
          'mca': 'Master of Computer Applications (MCA)',
          'mba': 'Master of Business Administration (MBA)'
        };
        const normalized = slugMap[programme.trim()] || programme.trim();
        localStorage.setItem(this.INTENDED_PROGRAMME_KEY, normalized);
      } else {
        localStorage.removeItem(this.INTENDED_PROGRAMME_KEY);
      }
    }
  }

  /**
   * Retrieves the applicant's preserved intended programme choice.
   * Checks the authenticated user's profile from the backend first, then falls back to local storage.
   */
  getIntendedProgramme(): string | null {
    const fromProfile = this.currentUser()?.intendedProgramme;
    if (fromProfile && fromProfile.trim()) {
      return fromProfile.trim();
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(this.INTENDED_PROGRAMME_KEY);
    }
    return null;
  }

  /**
   * Retrieves the applicant's registered phone number from their backend profile.
   */
  getRegisteredPhone(): string | null {
    return this.currentUser()?.phone || null;
  }

  /**
   * Clears the preserved intended programme choice.
   */
  clearIntendedProgramme(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.INTENDED_PROGRAMME_KEY);
    }
  }

  /**
   * Registers a new applicant.
   * Public registration always targets the applicant role.
   */
  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload).pipe(
      tap(res => {
        if (res.token && res.user) {
          this.setSession(res.token, res.user);
        }
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Authenticates candidate credentials and establishes a session.
   * By default authenticates applicants against the applicant login endpoint.
   * If a portal is specified ('admin' or 'verification'), routes to the staff endpoint.
   */
  login(payload: LoginPayload, portal?: string): Observable<AuthResponse> {
    const targetPortal = portal || payload.portal;
    if (targetPortal === 'admin' || targetPortal === 'verification') {
      return this.staffLogin(payload, targetPortal);
    }

    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload).pipe(
      tap(res => {
        if (res.token && res.user) {
          this.setSession(res.token, res.user);
        }
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Authenticates staff credentials for the designated portal ('admin' or 'verification').
   * Rejects mismatching roles, applicant credentials, or invalid passwords.
   */
  staffLogin(payload: LoginPayload, portal: 'admin' | 'verification' | string): Observable<AuthResponse> {
    const targetRole = portal === 'verification' ? 'verification_officer' : 'admin';
    const body: LoginPayload = { ...payload, portal, role: targetRole };

    return this.http.post<AuthResponse>(`${this.baseUrl}/staff-login/${portal}`, body).pipe(
      catchError((primaryErr: HttpErrorResponse) => {
        // Fallback to /login with portal/role in body if the server endpoint returned 404
        if (primaryErr.status === 404) {
          return this.http.post<AuthResponse>(`${this.baseUrl}/login`, body);
        }
        return throwError(() => primaryErr);
      }),
      tap(res => {
        if (res.token && res.user) {
          this.setSession(res.token, res.user);
        }
      }),
      catchError(err => this.handleError(err))
    );
  }

  /**
   * Validates the stored token against the authoritative backend endpoint (GET /api/auth/me).
   * Automatically clears session if token is invalid or expired.
   */
  checkAuthStatus(): Observable<User | null> {
    const token = this.getToken();
    if (!token) {
      this.clearSession();
      return of(null);
    }

    return this.http
      .get<UserProfileResponse>(`${this.baseUrl}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .pipe(
        map(res => {
          if (res.success && res.user) {
            this.currentUser.set(res.user);
            return res.user;
          }
          this.clearSession();
          return null;
        }),
        catchError(() => {
          // Token expired or invalid on the backend
          this.clearSession();
          return of(null);
        })
      );
  }

  /**
   * Clears the authentication session and resets the user state.
   * If a redirect path is provided (defaults to '/'), navigates to that path.
   * Pass null to clear the session without performing navigation.
   */
  logout(redirectTo: string | null = '/'): void {
    this.clearSession();
    if (redirectTo && this.router) {
      this.router.navigate([redirectTo]);
    }
  }

  /**
   * Centralized sign-out logic for all portals (Applicant, Admin, Verification Officer).
   * Properly clears all authentication tokens and user session data,
   * then navigates to the public Home page ('/').
   */
  signOut(redirectTo: string = '/'): void {
    this.logout(redirectTo);
  }

  private setSession(token: string, user: User): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
    this.currentUser.set(user);
  }

  private clearSession(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.INTENDED_PROGRAMME_KEY);
    }
    this.currentUser.set(null);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred. Please check your network connection and try again.';

    if (error.error && typeof error.error === 'object' && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.status === 0) {
      errorMessage = 'Unable to reach the backend server (http://localhost:5000). Please ensure the backend is running.';
    } else if (error.status === 401) {
      errorMessage = 'Invalid email or password.';
    } else if (error.status === 409) {
      errorMessage = 'An account with this email address already exists.';
    }

    return throwError(() => new Error(errorMessage));
  }
}
