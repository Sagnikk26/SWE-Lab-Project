import { Component, signal, inject } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Form Model
  email = '';
  password = '';
  remember = false;

  // UI State Signals
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update(show => !show);
  }

  /**
   * Resolves the secure redirect destination based on the user's authoritative role
   * and any existing returnUrl query parameter.
   *
   * Rules:
   * - applicant -> /application
   * - verification_officer -> /verification
   * - admin -> /admin
   * - Valid returnUrl is preserved only if the role has permission to access it.
   * - Prevent open redirects and privilege escalation via returnUrl.
   */
  resolveRedirectUrl(role: string, returnUrl?: string | null): string {
    const defaultRoute =
      role === 'admin'
        ? '/admin'
        : role === 'verification_officer'
        ? '/verification'
        : '/application';

    if (!returnUrl) {
      return defaultRoute;
    }

    const trimmed = returnUrl.trim();

    // Prevent open redirect vulnerabilities (must start with single / and not // or contains backslash)
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
      return defaultRoute;
    }

    // If return destination is root home (/), redirect to the user's role-appropriate dashboard
    if (trimmed === '/') {
      return defaultRoute;
    }

    // Extract path without query parameters or hash fragments for authorization check
    const basePath = trimmed.split('?')[0].split('#')[0].toLowerCase();

    // Role-based boundary enforcement
    if (role === 'applicant') {
      // Applicants cannot access /admin or /verification
      if (
        basePath === '/admin' ||
        basePath.startsWith('/admin/') ||
        basePath === '/verification' ||
        basePath.startsWith('/verification/')
      ) {
        return defaultRoute;
      }
    } else if (role === 'verification_officer') {
      // Verification officers cannot access /admin
      if (basePath === '/admin' || basePath.startsWith('/admin/')) {
        return defaultRoute;
      }
    }

    return trimmed;
  }

  onLoginSubmit(event?: Event): void {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    const trimmedEmail = this.email.trim().toLowerCase();
    if (!trimmedEmail) {
      this.errorMessage.set('Please enter your registered email address.');
      return;
    }

    if (!this.password) {
      this.errorMessage.set('Please enter your account password.');
      return;
    }

    // Prevent duplicate submissions
    this.isLoading.set(true);

    this.authService
      .login({
        email: trimmedEmail,
        password: this.password
      })
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.successMessage.set(
            `Welcome back, ${res.user.name}! Authentication verified successfully.`
          );

          // Return to intended destination if authorized, or role-based default
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          const targetUrl = this.resolveRedirectUrl(res.user.role, returnUrl);
          this.router.navigateByUrl(targetUrl);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message);
        }
      });
  }
}
