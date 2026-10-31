import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavbarComponent } from './navbar';
import { AuthService, User } from '../../services/auth.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let mockAuthService: any;
  let router: Router;

  const mockApplicantUser: User = {
    id: 'user_app_1',
    name: 'Sagnik Applicant',
    email: 'sagnik@example.com',
    role: 'applicant'
  };

  const mockOfficerUser: User = {
    id: 'user_off_1',
    name: 'Officer Jane',
    email: 'jane@uem.edu.in',
    role: 'verification_officer'
  };

  const mockAdminUser: User = {
    id: 'user_adm_1',
    name: 'Admin Boss',
    email: 'admin@uem.edu.in',
    role: 'admin'
  };

  const setupComponent = (user: User | null = null) => {
    const isAuthSignal = signal<boolean>(!!user);
    const currentUserSignal = signal<User | null>(user);

    mockAuthService = {
      isAuthenticated: isAuthSignal,
      currentUser: currentUserSignal,
      logout: vi.fn(() => {
        isAuthSignal.set(false);
        currentUserSignal.set(null);
      })
    };

    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture };
  };

  it('should render unauthenticated view with Applicant and Staff Login options', () => {
    const { fixture } = setupComponent(null);
    const element: HTMLElement = fixture.nativeElement;

    // Discoverable staff login options targeting /staff-login
    const staffLoginLink = element.querySelector('.top-staff-link');
    expect(staffLoginLink).toBeTruthy();
    expect(staffLoginLink?.textContent).toContain('Staff Login');
    expect(staffLoginLink?.getAttribute('href')).toBe('/staff-login');

    const staffLoginBtn = element.querySelector('.btn-staff-login');
    expect(staffLoginBtn).toBeTruthy();
    expect(staffLoginBtn?.textContent).toContain('Staff Login');
    expect(staffLoginBtn?.getAttribute('href')).toBe('/staff-login');

    const applicantLoginBtn = element.querySelector('.nav-actions a[routerLink="/login"]');
    expect(applicantLoginBtn?.textContent).toContain('Applicant Login');
    expect(applicantLoginBtn?.getAttribute('href')).toBe('/login');

    // Should not show dashboards or user badge
    expect(element.querySelector('.user-badge')).toBeNull();
    expect(element.textContent).not.toContain('Admin Dashboard');
    expect(element.textContent).not.toContain('Verification Dashboard');
  });

  it('should render applicant view with "Application Form", "Application Status", and applicant badge without staff dashboards or staff login', () => {
    const { fixture } = setupComponent(mockApplicantUser);
    const element: HTMLElement = fixture.nativeElement;

    // Applicant specific navigation
    expect(element.textContent).toContain('Application Form');
    expect(element.textContent).toContain('Application Status');
    expect(element.textContent).toContain('Sagnik Applicant');
    expect(element.textContent).toContain('Applicant');

    // Must NOT have staff dashboards or staff login links
    expect(element.textContent).not.toContain('Admin Dashboard');
    expect(element.textContent).not.toContain('Verification Dashboard');
    expect(element.textContent).not.toContain('Staff Login');

    // Must have sign out
    expect(element.textContent).toContain('Sign Out');
  });

  it('should render verification officer view with "Verification Dashboard" and officer badge', () => {
    const { fixture } = setupComponent(mockOfficerUser);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Verification Dashboard');
    expect(element.textContent).toContain('Officer Jane');
    expect(element.textContent).toContain('Verification Officer');

    // Must NOT have admin dashboard or staff login
    expect(element.textContent).not.toContain('Admin Dashboard');
    expect(element.textContent).not.toContain('Staff Login');
    expect(element.textContent).not.toContain('My Application');
  });

  it('should render administrator view with "Admin Dashboard" and admin badge without Verification Portal link', () => {
    const { fixture } = setupComponent(mockAdminUser);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Admin Dashboard');
    expect(element.textContent).not.toContain('Verification');
    expect(element.textContent).not.toContain('Verification Dashboard');
    expect(element.textContent).toContain('Admin Boss');
    expect(element.textContent).toContain('Administrator');
    expect(element.textContent).not.toContain('Staff Login');
  });

  it('should call authService.logout() and navigate to / when signing out as applicant', () => {
    setupComponent(mockApplicantUser);
    component.onLogout();

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(router.navigate).not.toHaveBeenCalledWith(['/login']);
  });

  it('should call authService.logout() and navigate to / when signing out as administrator from navbar', () => {
    setupComponent(mockAdminUser);
    component.onLogout();

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(router.navigate).not.toHaveBeenCalledWith(['/login']);
  });

  it('should call authService.logout() and navigate to / when signing out as verification officer from navbar', () => {
    setupComponent(mockOfficerUser);
    component.onLogout();

    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(router.navigate).not.toHaveBeenCalledWith(['/login']);
  });
});
