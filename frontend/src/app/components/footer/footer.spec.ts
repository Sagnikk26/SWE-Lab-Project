import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer';
import { AuthService, User } from '../../services/auth.service';
import { vi } from 'vitest';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let mockAuthService: any;

  const mockApplicantUser: User = {
    id: 'user_app_1',
    name: 'Sagnik Applicant',
    email: 'sagnik@example.com',
    role: 'applicant'
  };

  const mockAdminUser: User = {
    id: 'user_adm_1',
    name: 'Admin Boss',
    email: 'admin@uem.edu.in',
    role: 'admin'
  };

  const mockOfficerUser: User = {
    id: 'user_off_1',
    name: 'Officer Jane',
    email: 'officer@uem.edu.in',
    role: 'verification_officer'
  };

  const setupComponent = (user: User | null = null) => {
    mockAuthService = {
      isAuthenticated: vi.fn(() => !!user),
      currentUser: vi.fn(() => user)
    };

    TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture };
  };

  it('should render unauthenticated view with Staff Login link pointing to /staff-login', () => {
    const { fixture } = setupComponent(null);
    const element: HTMLElement = fixture.nativeElement;

    const staffLink = element.querySelector('.footer-staff-link');
    expect(staffLink).toBeTruthy();
    expect(staffLink?.textContent).toContain('Staff Login');
    expect(staffLink?.getAttribute('href')).toBe('/staff-login');
  });

  it('should hide Staff Login from the footer for authenticated applicants', () => {
    const { fixture } = setupComponent(mockApplicantUser);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).not.toContain('Staff Login');
    expect(element.textContent).toContain('My Application Status');
  });

  it('should render Admin Dashboard and Verification Portal links for authenticated administrator', () => {
    const { fixture } = setupComponent(mockAdminUser);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Admin Dashboard');
    expect(element.textContent).toContain('Verification Portal');
    expect(element.textContent).not.toContain('Staff Login');
  });

  it('should render Verification Dashboard link for authenticated verification officer', () => {
    const { fixture } = setupComponent(mockOfficerUser);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Verification Dashboard');
    expect(element.textContent).not.toContain('Admin Dashboard');
    expect(element.textContent).not.toContain('Staff Login');
  });
});
