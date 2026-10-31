import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { HomeComponent } from './home';
import { AuthService, User } from '../../services/auth.service';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: any;
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

  const setupComponent = async (user: User | null = null) => {
    mockAuthService = {
      isAuthenticated: vi.fn(() => !!user),
      currentUser: vi.fn(() => user)
    };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component };
  };

  it('should create the home component', async () => {
    await setupComponent(null);
    expect(component).toBeTruthy();
  });

  it('should render a single Staff Login button pointing to /staff-login for unauthenticated visitors', async () => {
    const { fixture } = await setupComponent(null);
    const element: HTMLElement = fixture.nativeElement;

    // Hero section staff login button
    const heroStaffBtn = element.querySelector('.hero-actions .btn-staff-access');
    expect(heroStaffBtn).toBeTruthy();
    expect(heroStaffBtn?.textContent).toContain('Staff Login');
    expect(heroStaffBtn?.getAttribute('href')).toBe('/staff-login');

    // Bottom CTA banner staff login button
    const ctaButtons = element.querySelectorAll('.cta-buttons a');
    const ctaStaffBtn = Array.from(ctaButtons).find(btn => btn.textContent?.includes('Staff Login'));
    expect(ctaStaffBtn).toBeTruthy();
    expect(ctaStaffBtn?.getAttribute('href')).toBe('/staff-login');

    // Must NOT contain separate Admin Login or Verification Officer Login buttons on the home page
    expect(element.textContent).not.toContain('Verification Officer Login');
    expect(element.textContent).not.toContain('Admin Login');
  });

  it('should hide Staff Login from home page for authenticated applicants', async () => {
    const { fixture } = await setupComponent(mockApplicantUser);
    const element: HTMLElement = fixture.nativeElement;

    const heroActions = element.querySelector('.hero-actions');
    expect(heroActions?.textContent).not.toContain('Staff Login');
    expect(heroActions?.textContent).toContain('Continue Admission Application');

    const ctaSection = element.querySelector('.cta-buttons');
    expect(ctaSection?.textContent).not.toContain('Staff Login');
    expect(ctaSection?.textContent).toContain('My Application Status');
  });

  it('should display Admin Dashboard navigation for authenticated administrators and hide Verification Portal', async () => {
    const { fixture } = await setupComponent(mockAdminUser);
    const element: HTMLElement = fixture.nativeElement;

    const heroActions = element.querySelector('.hero-actions');
    expect(heroActions?.textContent).not.toContain('Staff Login');
    expect(heroActions?.textContent).toContain('Admin Dashboard');
    expect(heroActions?.textContent).not.toContain('Verification Portal');
    expect(heroActions?.textContent).not.toContain('Verification Dashboard');

    const ctaSection = element.querySelector('.cta-buttons');
    expect(ctaSection?.textContent).toContain('Admin Dashboard');
    expect(ctaSection?.textContent).not.toContain('Verification Portal');
  });

  it('should display Verification Dashboard navigation for authenticated verification officers and hide Admin Dashboard', async () => {
    const { fixture } = await setupComponent(mockOfficerUser);
    const element: HTMLElement = fixture.nativeElement;

    const heroActions = element.querySelector('.hero-actions');
    expect(heroActions?.textContent).not.toContain('Staff Login');
    expect(heroActions?.textContent).toContain('Verification Dashboard');
    expect(heroActions?.textContent).not.toContain('Admin Dashboard');

    const ctaSection = element.querySelector('.cta-buttons');
    expect(ctaSection?.textContent).toContain('Verification Dashboard');
    expect(ctaSection?.textContent).not.toContain('Admin Dashboard');
  });

  it('should not display either staff dashboard option when an applicant is logged in', async () => {
    const { fixture } = await setupComponent(mockApplicantUser);
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).not.toContain('Admin Dashboard');
    expect(element.textContent).not.toContain('Verification Dashboard');
    expect(element.textContent).not.toContain('Verification Portal');
    expect(element.textContent).toContain('Continue Admission Application');
  });

  it('should define all 6 academic programmes with valid canonical programme names', async () => {
    await setupComponent(null);
    expect(component.programmes.length).toBe(6);

    const cse = component.programmes.find(p => p.id === 'btech-cse');
    expect(cse?.canonicalProgramme).toBe('B.Tech - Computer Science & Engineering');

    const ece = component.programmes.find(p => p.id === 'btech-ece');
    expect(ece?.canonicalProgramme).toBe('B.Tech - Electronics & Communication Engineering');

    const bca = component.programmes.find(p => p.id === 'bca');
    expect(bca?.canonicalProgramme).toBe('Bachelor of Computer Applications (BCA)');

    const bba = component.programmes.find(p => p.id === 'bba');
    expect(bba?.canonicalProgramme).toBe('Bachelor of Business Administration (BBA)');

    const mca = component.programmes.find(p => p.id === 'mca');
    expect(mca?.canonicalProgramme).toBe('Master of Computer Applications (MCA)');

    const mba = component.programmes.find(p => p.id === 'mba');
    expect(mba?.canonicalProgramme).toBe('Master of Business Administration (MBA)');
  });

  it('should filter programmes by UG and PG categories', async () => {
    await setupComponent(null);
    component.setCategory('ug');
    fixture.detectChanges();
    expect(component.filteredProgrammes().every(p => p.level === 'ug')).toBe(true);
    expect(component.filteredProgrammes().length).toBe(4);

    component.setCategory('pg');
    fixture.detectChanges();
    expect(component.filteredProgrammes().every(p => p.level === 'pg')).toBe(true);
    expect(component.filteredProgrammes().length).toBe(2);

    component.setCategory('all');
    fixture.detectChanges();
    expect(component.filteredProgrammes().length).toBe(6);
  });

  it('should render Apply for this Program action buttons on programme cards targeting /application with queryParams', async () => {
    await setupComponent(null);
    const applyButtons = fixture.debugElement.queryAll(By.css('.programme-card .card-footer a'));
    expect(applyButtons.length).toBe(6);

    applyButtons.forEach((buttonDebug: any, index: number) => {
      const prog = component.programmes[index];
      expect(buttonDebug.nativeElement.textContent).toContain('Apply for this Program');
      const routerLinkDirective = buttonDebug.injector.get(RouterLink);
      expect(routerLinkDirective.queryParams).toEqual({ programme: prog.canonicalProgramme });
      const href = buttonDebug.nativeElement.getAttribute('href') || routerLinkDirective.urlTree?.toString();
      expect(href).toContain('/application');
    });
  });
});
