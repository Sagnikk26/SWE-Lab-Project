import { Component, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Form Model
  name = '';
  email = '';
  phone = '';
  programme = '';
  password = '';
  confirmPassword = '';
  terms = false;

  // UI State Signals
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  registeredUser = signal<User | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update(show => !show);
  }

  onRegisterSubmit(event?: Event): void {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    // Reset alert states
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Client-side validations
    const trimmedName = this.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      this.errorMessage.set('Please enter your full legal name (minimum 2 characters).');
      return;
    }

    const trimmedEmail = this.email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    if (!this.password || this.password.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters in length.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match. Please verify your password entry.');
      return;
    }

    if (!this.terms) {
      this.errorMessage.set('You must accept the admission declaration to register.');
      return;
    }

    const trimmedPhone = this.phone ? this.phone.trim().replace(/[\s-]/g, '') : '';
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (this.phone && !phoneRegex.test(trimmedPhone)) {
      this.errorMessage.set('Please enter a valid 10 to 15 digit mobile phone number.');
      return;
    }

    // Prevent duplicate submissions
    this.isLoading.set(true);

    const payload: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      programme?: string;
    } = {
      name: trimmedName,
      email: trimmedEmail,
      password: this.password,
    };

    if (trimmedPhone) {
      payload.phone = trimmedPhone;
    }

    if (this.programme && this.programme.trim()) {
      payload.programme = this.programme.trim();
    }

    // Submit registration details to authoritative backend.
    // Public registration explicitly cannot pass an admin/officer role.
    this.authService
      .register(payload)
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.registeredUser.set(res.user);

          // Preserve intended field of study entered during registration
          if (this.programme) {
            this.authService.setIntendedProgramme(this.programme);
          }

          // Automatically authenticate and redirect to home page immediately
          this.router.navigate(['/']);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message);
        }
      });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}
