import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService, AuthResponse } from '../../services/auth.service';

@Component({
  selector: 'app-staff-role-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './staff-role-login.html',
  styleUrl: './staff-role-login.scss'
})
export class StaffRoleLoginComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Portal configuration derived from route
  portalType: 'admin' | 'verification' = 'admin';
  portalTitle = 'Administrator Portal Login';
  portalSubtitle = 'Central Admissions Committee & System Administration';
  badgeLabel = 'Admin Access';
  expectedRole: 'admin' | 'verification_officer' = 'admin';
  targetDashboard = '/admin';
  otherPortalLink = '/staff-login/verification';
  otherPortalName = 'Verification Officer Portal';

  // Form Model
  email = '';
  password = '';
  remember = false;

  // UI State Signals
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  roleMismatch = signal(false);
  mismatchDetails = signal<{ role: string; name: string } | null>(null);

  ngOnInit(): void {
    const portalData = this.route.snapshot.data['portal'] || '';
    const urlSegment = this.route.snapshot.url[0]?.path || '';

    if (portalData === 'verification' || urlSegment === 'verification') {
      this.portalType = 'verification';
      this.portalTitle = 'Verification Officer Login';
      this.portalSubtitle = 'Candidate Document Verification & Audit Desk';
      this.badgeLabel = 'Verification Officer';
      this.expectedRole = 'verification_officer';
      this.targetDashboard = '/verification';
      this.otherPortalLink = '/staff-login/admin';
      this.otherPortalName = 'Administrator Portal';
    } else {
      this.portalType = 'admin';
      this.portalTitle = 'Administrator Portal Login';
      this.portalSubtitle = 'Central Admissions Committee & System Administration';
      this.badgeLabel = 'Admin Access';
      this.expectedRole = 'admin';
      this.targetDashboard = '/admin';
      this.otherPortalLink = '/staff-login/verification';
      this.otherPortalName = 'Verification Officer Portal';
    }

    // If already authenticated with the correct role, proceed directly to the dashboard
    if (this.authService.isAuthenticated()) {
      const currentUser = this.authService.currentUser();
      if (currentUser?.role === this.expectedRole) {
        this.router.navigateByUrl(this.targetDashboard);
      } else if (currentUser) {
        // User is authenticated but with an mismatched role
        this.roleMismatch.set(true);
        this.mismatchDetails.set({
          role: currentUser.role,
          name: currentUser.name
        });
      }
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(show => !show);
  }

  formatRoleName(role?: string): string {
    if (role === 'admin') return 'Administrator';
    if (role === 'verification_officer') return 'Verification Officer';
    if (role === 'applicant') return 'Applicant';
    return role || 'Unknown';
  }

  onLoginSubmit(event?: Event): void {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.roleMismatch.set(false);
    this.mismatchDetails.set(null);

    const trimmedEmail = this.email.trim().toLowerCase();
    if (!trimmedEmail) {
      this.errorMessage.set('Please enter your registered staff email address.');
      return;
    }

    if (!this.password) {
      this.errorMessage.set('Please enter your staff account password.');
      return;
    }

    this.isLoading.set(true);

    const login$: Observable<AuthResponse> = typeof (this.authService as any).staffLogin === 'function'
      ? (this.authService as any).staffLogin(
          { email: trimmedEmail, password: this.password },
          this.portalType
        )
      : this.authService.login({
          email: trimmedEmail,
          password: this.password
        });

    login$.subscribe({
      next: (res: AuthResponse) => {
          this.isLoading.set(false);

          if (res.user.role === this.expectedRole) {
            // Authorized role matches portal requirement
            this.successMessage.set(
              `Authentication verified. Redirecting to ${this.badgeLabel} Dashboard...`
            );
            this.router.navigateByUrl(this.targetDashboard);
          } else {
            // Role mismatch: do not grant access to this portal
            this.roleMismatch.set(true);
            this.mismatchDetails.set({
              role: res.user.role,
              name: res.user.name
            });
          }
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message || 'Invalid email or password.');
        }
      });
  }

  proceedToAssignedDashboard(): void {
    const details = this.mismatchDetails();
    if (!details) {
      this.router.navigateByUrl('/staff-login');
      return;
    }

    if (details.role === 'admin') {
      this.router.navigateByUrl('/admin');
    } else if (details.role === 'verification_officer') {
      this.router.navigateByUrl('/verification');
    } else {
      this.router.navigateByUrl('/application');
    }
  }

  onSignOut(): void {
    this.authService.logout(null);
    this.roleMismatch.set(false);
    this.mismatchDetails.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.password = '';
  }
}
