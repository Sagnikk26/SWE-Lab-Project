import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { StaffSelectionComponent } from './staff-selection';
import { AuthService, User } from '../../services/auth.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('StaffSelectionComponent', () => {
  let component: StaffSelectionComponent;
  let mockAuthService: any;
  let router: Router;

  const mockAdminUser: User = {
    id: 'adm_1',
    name: 'Admin Boss',
    email: 'admin@uem.edu.in',
    role: 'admin'
  };

  const mockOfficerUser: User = {
    id: 'off_1',
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
      imports: [StaffSelectionComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(StaffSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture };
  };

  it('should create the staff selection component', () => {
    const { fixture } = setupComponent(null);
    expect(component).toBeTruthy();
  });

  it('should display exactly two primary options: Admin Login and Verification Officer Login', () => {
    const { fixture } = setupComponent(null);
    const element: HTMLElement = fixture.nativeElement;

    const cards = element.querySelectorAll('.portal-card');
    expect(cards.length).toBe(2);

    const adminOption = element.querySelector('.btn-admin-option');
    expect(adminOption).toBeTruthy();
    expect(adminOption?.textContent).toContain('Admin Login');
    expect(adminOption?.getAttribute('href')).toBe('/staff-login/admin');

    const officerOption = element.querySelector('.btn-officer-option');
    expect(officerOption).toBeTruthy();
    expect(officerOption?.textContent).toContain('Verification Officer Login');
    expect(officerOption?.getAttribute('href')).toBe('/staff-login/verification');
  });

  it('should display clear labels and brief descriptions for each option', () => {
    const { fixture } = setupComponent(null);
    const element: HTMLElement = fixture.nativeElement;

    const adminCard = element.querySelector('.card-admin');
    expect(adminCard?.querySelector('.portal-name')?.textContent).toBe('Admin Login');
    expect(adminCard?.querySelector('.portal-description')?.textContent).toContain(
      'Admissions Committee and Central Administrators'
    );

    const officerCard = element.querySelector('.card-officer');
    expect(officerCard?.querySelector('.portal-name')?.textContent).toBe('Verification Officer Login');
    expect(officerCard?.querySelector('.portal-description')?.textContent).toContain(
      'Document Verification Officers'
    );
  });

  it('should provide a link directing applicants to the applicant login page', () => {
    const { fixture } = setupComponent(null);
    const element: HTMLElement = fixture.nativeElement;

    const applicantLink = element.querySelector('.link-applicant');
    expect(applicantLink).toBeTruthy();
    expect(applicantLink?.getAttribute('href')).toBe('/login');
  });

  it('should automatically redirect authenticated admin directly to /admin', () => {
    setupComponent(mockAdminUser);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('should automatically redirect authenticated verification officer directly to /verification', () => {
    setupComponent(mockOfficerUser);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/verification');
  });

  it('should not redirect unauthenticated visitors', () => {
    setupComponent(null);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
