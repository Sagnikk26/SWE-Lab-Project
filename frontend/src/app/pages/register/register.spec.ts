import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RegisterComponent } from './register';
import { AuthService, User, AuthResponse } from '../../services/auth.service';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let mockAuthService: any;
  let router: Router;

  const mockRegisteredUser: User = {
    id: 'user_new_1',
    name: 'Sagnik Applicant',
    email: 'sagnik.applicant@example.com',
    role: 'applicant',
    phone: '+919876543210',
    intendedProgramme: 'B.Tech - Computer Science & Engineering'
  };

  const mockAuthResponse: AuthResponse = {
    success: true,
    message: 'Account registered successfully.',
    token: 'jwt_registered_token_xyz',
    user: mockRegisteredUser
  };

  beforeEach(async () => {
    mockAuthService = {
      register: vi.fn(),
      setIntendedProgramme: vi.fn(),
      currentUser: vi.fn(),
      isAuthenticated: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the register component', () => {
    expect(component).toBeTruthy();
    expect(component.isLoading()).toBe(false);
    expect(component.errorMessage()).toBeNull();
  });

  it('should validate legal name minimum length', () => {
    component.name = 'A';
    component.email = 'valid@example.com';
    component.password = 'password123';
    component.confirmPassword = 'password123';
    component.terms = true;

    component.onRegisterSubmit();

    expect(component.errorMessage()).toContain('minimum 2 characters');
    expect(mockAuthService.register).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should validate email format', () => {
    component.name = 'Valid Name';
    component.email = 'not-an-email';
    component.password = 'password123';
    component.confirmPassword = 'password123';
    component.terms = true;

    component.onRegisterSubmit();

    expect(component.errorMessage()).toContain('valid email address');
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('should validate password minimum length', () => {
    component.name = 'Valid Name';
    component.email = 'valid@example.com';
    component.password = '12345';
    component.confirmPassword = '12345';
    component.terms = true;

    component.onRegisterSubmit();

    expect(component.errorMessage()).toContain('at least 6 characters');
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('should validate passwords match', () => {
    component.name = 'Valid Name';
    component.email = 'valid@example.com';
    component.password = 'password123';
    component.confirmPassword = 'differentPassword';
    component.terms = true;

    component.onRegisterSubmit();

    expect(component.errorMessage()).toContain('Passwords do not match');
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('should validate declaration acceptance', () => {
    component.name = 'Valid Name';
    component.email = 'valid@example.com';
    component.password = 'password123';
    component.confirmPassword = 'password123';
    component.terms = false;

    component.onRegisterSubmit();

    expect(component.errorMessage()).toContain('accept the admission declaration');
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('should validate phone number format if provided', () => {
    component.name = 'Valid Name';
    component.email = 'valid@example.com';
    component.phone = '123'; // Too short / invalid phone
    component.password = 'password123';
    component.confirmPassword = 'password123';
    component.terms = true;

    component.onRegisterSubmit();

    expect(component.errorMessage()).toContain('valid 10 to 15 digit mobile phone number');
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('should successfully register, preserve intended programme, and immediately redirect to home page', () => {
    mockAuthService.register.mockReturnValue(of(mockAuthResponse));

    component.name = 'Sagnik Applicant';
    component.email = 'sagnik.applicant@example.com';
    component.phone = '+919876543210';
    component.password = 'SecurePassword123';
    component.confirmPassword = 'SecurePassword123';
    component.programme = 'B.Tech - Computer Science & Engineering';
    component.terms = true;

    component.onRegisterSubmit();

    expect(mockAuthService.register).toHaveBeenCalledWith({
      name: 'Sagnik Applicant',
      email: 'sagnik.applicant@example.com',
      password: 'SecurePassword123',
      phone: '+919876543210',
      programme: 'B.Tech - Computer Science & Engineering'
    });
    expect(mockAuthService.setIntendedProgramme).toHaveBeenCalledWith('B.Tech - Computer Science & Engineering');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(component.registeredUser()).toEqual(mockRegisteredUser);
    expect(component.isLoading()).toBe(false);
  });

  it('should handle registration failure gracefully without redirecting or creating session', () => {
    mockAuthService.register.mockReturnValue(
      throwError(() => new Error('An account with this email address already exists.'))
    );

    component.name = 'Existing User';
    component.email = 'existing@example.com';
    component.password = 'SecurePassword123';
    component.confirmPassword = 'SecurePassword123';
    component.programme = 'btech-cse';
    component.terms = true;

    component.onRegisterSubmit();

    expect(mockAuthService.register).toHaveBeenCalled();
    expect(component.errorMessage()).toBe('An account with this email address already exists.');
    expect(component.isLoading()).toBe(false);
    expect(component.registeredUser()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockAuthService.setIntendedProgramme).not.toHaveBeenCalled();
  });

  it('should toggle password visibility signal', () => {
    expect(component.showPassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBe(false);
  });
});
