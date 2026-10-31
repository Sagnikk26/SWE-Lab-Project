import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-staff-selection',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './staff-selection.html',
  styleUrl: './staff-selection.scss'
})
export class StaffSelectionComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      const role = this.authService.currentUser()?.role;
      if (role === 'admin') {
        this.router.navigateByUrl('/admin');
      } else if (role === 'verification_officer') {
        this.router.navigateByUrl('/verification');
      }
    }
  }
}
