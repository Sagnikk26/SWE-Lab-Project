import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  ApplicationService,
  AdmissionApplication,
  AdmissionDocument,
  CreateApplicationPayload
} from '../../services/application.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-application',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, DatePipe],
  templateUrl: './application.html',
  styleUrl: './application.scss'
})
export class ApplicationComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly applicationService = inject(ApplicationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // UI State Signals
  readonly isLoadingInitial = signal(true);
  readonly isSubmitting = signal(false);
  readonly isSavingDetails = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly existingApplication = signal<AdmissionApplication | null>(null);
  readonly submittedApplication = signal<AdmissionApplication | null>(null);
  readonly isRefreshing = signal(false);
  readonly copiedAppId = signal(false);
  readonly showConfirmModal = signal(false);

  // Multi-step workflow state: 'form' (Academic/Personal Details) -> 'documents' (Document Upload Center)
  readonly activeStep = signal<'form' | 'documents'>('form');
  readonly isFinalSubmitting = signal(false);
  readonly finalSubmitError = signal<string | null>(null);

  // Document Management & Upload Signals
  readonly uploadedDocuments = signal<AdmissionDocument[]>([]);
  readonly isLoadingDocuments = signal(false);
  readonly isUploadingDocument = signal(false);
  readonly isDeletingDocument = signal<string | null>(null);
  readonly documentUploadError = signal<string | null>(null);
  readonly documentUploadSuccess = signal<string | null>(null);
  readonly selectedDocType = signal<string>('Class 10 Marksheet');
  readonly selectedFile = signal<File | null>(null);
  readonly selectedFileError = signal<string | null>(null);

  // Document Correction / Replacement Modal Signals (for backward compatibility if needed)
  readonly showReplaceModal = signal(false);
  readonly replacingDoc = signal<AdmissionDocument | null>(null);
  readonly replacementFile = signal<File | null>(null);
  readonly replacementFileError = signal<string | null>(null);
  readonly isUploadingReplacement = signal(false);
  readonly showHistoricalDocs = signal(false);

  // Active documents (excluding superseded/replaced documents)
  readonly activeDocuments = computed(() => {
    return this.uploadedDocuments().filter(doc => !doc.isReplaced);
  });

  // Replaced / superseded documents (version history)
  readonly historicalDocuments = computed(() => {
    return this.uploadedDocuments().filter(doc => doc.isReplaced === true);
  });

  // Mandatory documents required for final submission
  readonly mandatoryDocuments: string[] = [
    'Class 10 Marksheet',
    'Class 12 Marksheet',
    'Identity Proof'
  ];

  // Set of uploaded document types
  readonly uploadedDocTypes = computed(() => {
    return new Set(this.activeDocuments().map(doc => doc.documentType));
  });

  // Missing mandatory document types
  readonly missingMandatoryDocs = computed(() => {
    const uploaded = this.uploadedDocTypes();
    return this.mandatoryDocuments.filter(type => !uploaded.has(type));
  });

  // Whether all mandatory documents are uploaded
  readonly isMandatoryDocsComplete = computed(() => {
    return this.missingMandatoryDocs().length === 0;
  });

  // Whether all mandatory documents are uploaded to enable final submission (Requirement 8)
  canFinalSubmit(): boolean {
    return this.isMandatoryDocsComplete();
  }

  // Live document review statistics (calculated strictly on active documents to avoid double-counting)
  readonly docStats = computed(() => {
    const active = this.activeDocuments();
    const total = active.length;
    const verified = active.filter(d => d.verificationStatus === 'Verified').length;
    const rejected = active.filter(d => d.verificationStatus === 'Rejected').length;
    const pending = active.filter(d => d.verificationStatus === 'Pending').length;
    const reviewed = verified + rejected;
    const completionPercentage = total > 0 ? Math.round((reviewed / total) * 100) : 0;

    return {
      total,
      verified,
      rejected,
      pending,
      reviewed,
      completionPercentage
    };
  });

  // Allowed document types for new uploads (Requirement 3: "Other" category strictly removed)
  readonly documentTypes: string[] = [
    'Class 10 Marksheet',
    'Class 12 Marksheet',
    'Identity Proof',
    'Passport Photo',
    'Signature',
    'Entrance Exam Admit/Rank Card'
  ];

  // Available Programmes List
  readonly programmeOptions: { value: string; label: string; level: string }[] = [
    { value: 'B.Tech - Computer Science & Engineering', label: 'B.Tech - Computer Science & Engineering', level: 'Undergraduate' },
    { value: 'B.Tech - CSE (Artificial Intelligence & Machine Learning)', label: 'B.Tech - CSE (AI & Machine Learning)', level: 'Undergraduate' },
    { value: 'B.Tech - Electronics & Communication Engineering', label: 'B.Tech - Electronics & Communication Engineering', level: 'Undergraduate' },
    { value: 'B.Tech - Electrical Engineering', label: 'B.Tech - Electrical Engineering', level: 'Undergraduate' },
    { value: 'B.Tech - Mechanical Engineering', label: 'B.Tech - Mechanical Engineering', level: 'Undergraduate' },
    { value: 'Bachelor of Computer Applications (BCA)', label: 'Bachelor of Computer Applications (BCA)', level: 'Undergraduate' },
    { value: 'Bachelor of Business Administration (BBA)', label: 'Bachelor of Business Administration (BBA)', level: 'Undergraduate' },
    { value: 'Master of Computer Applications (MCA)', label: 'Master of Computer Applications (MCA)', level: 'Postgraduate' },
    { value: 'Master of Business Administration (MBA)', label: 'Master of Business Administration (MBA)', level: 'Postgraduate' },
    { value: 'M.Tech - Computer Science & Engineering', label: 'M.Tech - Computer Science & Engineering', level: 'Postgraduate' }
  ];

  // Current year for date bounds
  readonly currentYear = new Date().getFullYear();

  // Reactive Form Definition
  readonly applicationForm = new FormGroup(
    {
      selectedProgramme: new FormControl('', [Validators.required]),
      personalDetails: new FormGroup({
        fullName: new FormControl('', [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(100)
        ]),
        dateOfBirth: new FormControl('', [
          Validators.required,
          this.validateDateOfBirth.bind(this)
        ]),
        phone: new FormControl('', [
          Validators.required,
          Validators.pattern(/^\+?[0-9]{10,15}$/)
        ]),
        address: new FormGroup({
          line1: new FormControl('', [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(200)
          ]),
          line2: new FormControl('', [Validators.maxLength(200)]),
          city: new FormControl('', [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100)
          ]),
          state: new FormControl('', [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100)
          ]),
          pincode: new FormControl('', [
            Validators.required,
            Validators.pattern(/^[0-9]{5,10}$/)
          ]),
          country: new FormControl('India', [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100)
          ])
        })
      }),
      academicDetails: new FormGroup({
        class10: new FormGroup({
          board: new FormControl('', [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100)
          ]),
          passingYear: new FormControl<number | null>(null, [
            Validators.required,
            Validators.min(1990),
            Validators.max(this.currentYear)
          ]),
          marksPercentage: new FormControl<number | null>(null, [
            Validators.required,
            Validators.min(0),
            Validators.max(100)
          ]),
          rollNumber: new FormControl('', [Validators.maxLength(50)])
        }),
        class12: new FormGroup({
          board: new FormControl('', [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100)
          ]),
          passingYear: new FormControl<number | null>(null, [
            Validators.required,
            Validators.min(1990),
            Validators.max(this.currentYear + 1)
          ]),
          stream: new FormControl('Science', [
            Validators.required,
            Validators.maxLength(50)
          ]),
          marksPercentage: new FormControl<number | null>(null, [
            Validators.required,
            Validators.min(0),
            Validators.max(100)
          ]),
          rollNumber: new FormControl('', [Validators.maxLength(50)])
        }),
        entranceExam: new FormGroup({
          examName: new FormControl('', [Validators.maxLength(100)]),
          rollNumber: new FormControl('', [Validators.maxLength(50)]),
          scoreOrRank: new FormControl('', [Validators.maxLength(50)]),
          year: new FormControl<number | null>(null, [
            Validators.min(2015),
            Validators.max(this.currentYear + 1)
          ])
        })
      }),
      declaration: new FormControl(false, [Validators.requiredTrue])
    },
    { validators: [this.validatePassingYears.bind(this)] }
  );

  /**
   * Resolves and validates an incoming programme parameter (canonical name, slug, or label)
   * against the authoritative supported programmeOptions list.
   * Returns canonical programme string if valid, or null if invalid/unsupported.
   */
  resolveSupportedProgramme(input: string | null | undefined): string | null {
    if (!input || typeof input !== 'string' || !input.trim()) {
      return null;
    }

    const trimmed = input.trim();

    // 1. Direct match with canonical value in programmeOptions
    const exactMatch = this.programmeOptions.find(
      opt => opt.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch.value;
    }

    // 2. Known slug mappings to canonical names
    const slugMap: Record<string, string> = {
      'btech-cse': 'B.Tech - Computer Science & Engineering',
      'btech-cse-aiml': 'B.Tech - CSE (Artificial Intelligence & Machine Learning)',
      'btech-ece': 'B.Tech - Electronics & Communication Engineering',
      'btech-ee': 'B.Tech - Electrical Engineering',
      'btech-me': 'B.Tech - Mechanical Engineering',
      'bca': 'Bachelor of Computer Applications (BCA)',
      'bba': 'Bachelor of Business Administration (BBA)',
      'mca': 'Master of Computer Applications (MCA)',
      'mba': 'Master of Business Administration (MBA)',
      'mtech-cse': 'M.Tech - Computer Science & Engineering'
    };

    const mappedFromSlug = slugMap[trimmed.toLowerCase()];
    if (mappedFromSlug) {
      const match = this.programmeOptions.find(opt => opt.value === mappedFromSlug);
      if (match) {
        return match.value;
      }
    }

    // 3. Match by flexible normalized text (e.g. "B.Tech in Computer Science & Engineering")
    const normalizeText = (s: string) =>
      s
        .toLowerCase()
        .replace(/\b(in|of|and)\b/g, '')
        .replace(/[^a-z0-9]/g, '');

    const inputClean = normalizeText(trimmed);
    const flexibleMatch = this.programmeOptions.find(opt => {
      const optClean = normalizeText(opt.value);
      return optClean === inputClean || optClean.includes(inputClean) || inputClean.includes(optClean);
    });
    if (flexibleMatch) {
      return flexibleMatch.value;
    }

    return null;
  }

  /**
   * Initializes programme selection in the application form following precedence:
   * 1. Route state / query parameter explicitly selected from home programme card (highest priority)
   * 2. Preserved intended programme from registration (fallback)
   * 3. Manual selection (empty) if missing or invalid
   */
  initProgrammeSelection(): void {
    // Check query params
    const queryProg = this.route.snapshot.queryParamMap.get('programme');

    // Check Router navigation extras state (or browser history state)
    const navState = this.router.getCurrentNavigation()?.extras?.state as
      | { selectedProgramme?: string; programme?: string }
      | undefined;
    const historyState =
      typeof history !== 'undefined' && history.state
        ? (history.state as { selectedProgramme?: string; programme?: string })
        : undefined;

    const routeProgParam =
      queryProg ||
      navState?.selectedProgramme ||
      navState?.programme ||
      historyState?.selectedProgramme ||
      historyState?.programme;

    const resolvedFromRoute = this.resolveSupportedProgramme(routeProgParam);

    if (resolvedFromRoute) {
      // Priority 1: Programme explicitly selected through clicked programme card takes priority
      this.applicationForm.get('selectedProgramme')?.setValue(resolvedFromRoute);
      return;
    }

    // Priority 2: Fallback to intended programme saved during registration
    const fallbackIntended = this.resolveSupportedProgramme(this.authService.getIntendedProgramme());
    if (fallbackIntended && !this.applicationForm.get('selectedProgramme')?.value) {
      this.applicationForm.get('selectedProgramme')?.setValue(fallbackIntended);
    }
  }

  /**
   * Autofills matching registration details (full name, phone, intended programme)
   * from the authenticated user profile retrieved from the authoritative backend.
   * Does NOT overwrite fields if already populated (e.g. from an existing draft).
   */
  autofillFromRegistrationProfile(user?: any): void {
    const candidate = user || this.authService.currentUser();
    if (!candidate) {
      return;
    }

    // 1. Prefill Full Name from registration profile
    if (candidate.name && !this.applicationForm.get('personalDetails.fullName')?.value) {
      this.applicationForm.get('personalDetails.fullName')?.setValue(candidate.name);
    }

    // 2. Prefill Phone Number from registration profile
    if (candidate.phone && !this.applicationForm.get('personalDetails.phone')?.value) {
      this.applicationForm.get('personalDetails.phone')?.setValue(candidate.phone);
    }

    // 3. Programme selection: initialize following precedence rules
    if (!this.applicationForm.get('selectedProgramme')?.value) {
      this.initProgrammeSelection();
    }
  }

  ngOnInit(): void {
    // Initialize programme selection following precedence rules
    this.initProgrammeSelection();

    // Listen to query param changes if in-place navigation occurs with a new programme
    this.route.queryParamMap.subscribe(params => {
      const prog = params.get('programme');
      if (prog) {
        const resolved = this.resolveSupportedProgramme(prog);
        if (resolved) {
          this.applicationForm.get('selectedProgramme')?.setValue(resolved);
        }
      }
    });

    // Autofill matching registration details from backend auth profile
    const current = this.authService.currentUser();
    if (current) {
      this.autofillFromRegistrationProfile(current);
    } else {
      this.authService.checkAuthStatus().subscribe(freshUser => {
        if (freshUser && !this.existingApplication()) {
          this.autofillFromRegistrationProfile(freshUser);
        }
      });
    }

    this.checkExistingApplications();
  }

  /**
   * Checks with authoritative backend whether applicant already has an application
   */
  checkExistingApplications(): void {
    this.isLoadingInitial.set(true);
    this.errorMessage.set(null);

    this.applicationService.getMyApplications().subscribe({
      next: (res) => {
        this.isLoadingInitial.set(false);
        if (res.applications && res.applications.length > 0) {
          const app = res.applications[0];
          this.existingApplication.set(app);

          // If application was already final-submitted (status !== 'Draft'), navigate to status page
          if (app.status !== 'Draft') {
            this.router.navigate(['/status']);
            return;
          }

          // If application is in 'Draft', pre-populate the form and open Document Upload Center (Step 2)
          // Preserves draft data completely without overwriting with registration defaults
          this.populateForm(app);
          this.activeStep.set('documents');
          this.loadApplicationDocuments();
          return;
        }

        // No prior application: start at Step 1 (Academic Details & Personal Particulars)
        this.activeStep.set('form');

        // Autofill matching registration details from backend auth profile
        this.autofillFromRegistrationProfile();
      },
      error: (err: Error) => {
        this.isLoadingInitial.set(false);
        this.errorMessage.set(err.message);
      }
    });
  }

  private populateForm(app: AdmissionApplication): void {
    if (app.selectedProgramme) {
      this.applicationForm.get('selectedProgramme')?.setValue(app.selectedProgramme);
    }
    if (app.personalDetails) {
      this.applicationForm.get('personalDetails.fullName')?.setValue(app.personalDetails.fullName);
      if (app.personalDetails.dateOfBirth) {
        const dobStr = new Date(app.personalDetails.dateOfBirth).toISOString().split('T')[0];
        this.applicationForm.get('personalDetails.dateOfBirth')?.setValue(dobStr);
      }
      this.applicationForm.get('personalDetails.phone')?.setValue(app.personalDetails.phone);
      if (app.personalDetails.address) {
        this.applicationForm.get('personalDetails.address.line1')?.setValue(app.personalDetails.address.line1);
        this.applicationForm.get('personalDetails.address.line2')?.setValue(app.personalDetails.address.line2 || '');
        this.applicationForm.get('personalDetails.address.city')?.setValue(app.personalDetails.address.city);
        this.applicationForm.get('personalDetails.address.state')?.setValue(app.personalDetails.address.state);
        this.applicationForm.get('personalDetails.address.pincode')?.setValue(app.personalDetails.address.pincode);
        this.applicationForm.get('personalDetails.address.country')?.setValue(app.personalDetails.address.country || 'India');
      }
    }
    if (app.academicDetails) {
      if (app.academicDetails.class10) {
        this.applicationForm.get('academicDetails.class10.board')?.setValue(app.academicDetails.class10.board);
        this.applicationForm.get('academicDetails.class10.passingYear')?.setValue(app.academicDetails.class10.passingYear);
        this.applicationForm.get('academicDetails.class10.marksPercentage')?.setValue(app.academicDetails.class10.marksPercentage);
        this.applicationForm.get('academicDetails.class10.rollNumber')?.setValue(app.academicDetails.class10.rollNumber || '');
      }
      if (app.academicDetails.class12) {
        this.applicationForm.get('academicDetails.class12.board')?.setValue(app.academicDetails.class12.board);
        this.applicationForm.get('academicDetails.class12.passingYear')?.setValue(app.academicDetails.class12.passingYear);
        this.applicationForm.get('academicDetails.class12.stream')?.setValue(app.academicDetails.class12.stream || 'Science');
        this.applicationForm.get('academicDetails.class12.marksPercentage')?.setValue(app.academicDetails.class12.marksPercentage);
        this.applicationForm.get('academicDetails.class12.rollNumber')?.setValue(app.academicDetails.class12.rollNumber || '');
      }
      if (app.academicDetails.entranceExam) {
        this.applicationForm.get('academicDetails.entranceExam.examName')?.setValue(app.academicDetails.entranceExam.examName || '');
        this.applicationForm.get('academicDetails.entranceExam.rollNumber')?.setValue(app.academicDetails.entranceExam.rollNumber || '');
        this.applicationForm.get('academicDetails.entranceExam.scoreOrRank')?.setValue(app.academicDetails.entranceExam.scoreOrRank || '');
        if (app.academicDetails.entranceExam.year) {
          this.applicationForm.get('academicDetails.entranceExam.year')?.setValue(app.academicDetails.entranceExam.year);
        }
      }
    }
    this.applicationForm.get('declaration')?.setValue(true);
  }

  /**
   * Custom validator for date of birth (must be past date and age >= 12)
   */
  private validateDateOfBirth(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const dob = new Date(control.value);
    if (isNaN(dob.getTime())) {
      return { invalidDate: true };
    }
    const today = new Date();
    if (dob >= today) {
      return { futureDate: true };
    }
    const minAgeDate = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
    if (dob > minAgeDate) {
      return { underage: true };
    }
    return null;
  }

  /**
   * Cross-field validator ensuring Class 12 passing year is >= Class 10 passing year
   */
  private validatePassingYears(group: AbstractControl): ValidationErrors | null {
    const class10Year = group.get('academicDetails.class10.passingYear')?.value;
    const class12Year = group.get('academicDetails.class12.passingYear')?.value;

    if (class10Year && class12Year && Number(class12Year) < Number(class10Year)) {
      return { passingYearPrecedes: true };
    }
    return null;
  }

  /**
   * Form submission initiator with validation and confirmation dialog
   */
  onInitiateSubmit(): void {
    this.errorMessage.set(null);

    if (this.applicationForm.invalid) {
      this.applicationForm.markAllAsTouched();
      this.errorMessage.set('Please correct the highlighted validation errors before submitting.');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (!this.isMandatoryDocsComplete()) {
      const missing = this.missingMandatoryDocs().join(', ');
      this.errorMessage.set(`Please upload all mandatory documents before final submission: ${missing}.`);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    // Open final review and confirmation dialog
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    if (!this.isSubmitting()) {
      this.showConfirmModal.set(false);
    }
  }

  /**
   * Constructs the strongly-typed payload from application form values
   */
  buildPayload(): CreateApplicationPayload {
    const formValue = this.applicationForm.value;
    return {
      selectedProgramme: formValue.selectedProgramme!.trim(),
      personalDetails: {
        fullName: formValue.personalDetails!.fullName!.trim(),
        dateOfBirth: formValue.personalDetails!.dateOfBirth!,
        phone: formValue.personalDetails!.phone!.trim(),
        address: {
          line1: formValue.personalDetails!.address!.line1!.trim(),
          line2: formValue.personalDetails!.address!.line2 ? formValue.personalDetails!.address!.line2.trim() : '',
          city: formValue.personalDetails!.address!.city!.trim(),
          state: formValue.personalDetails!.address!.state!.trim(),
          pincode: formValue.personalDetails!.address!.pincode!.trim(),
          country: formValue.personalDetails!.address!.country ? formValue.personalDetails!.address!.country.trim() : 'India'
        }
      },
      academicDetails: {
        class10: {
          board: formValue.academicDetails!.class10!.board!.trim(),
          passingYear: Number(formValue.academicDetails!.class10!.passingYear),
          marksPercentage: Number(formValue.academicDetails!.class10!.marksPercentage),
          rollNumber: formValue.academicDetails!.class10!.rollNumber ? formValue.academicDetails!.class10!.rollNumber.trim() : ''
        },
        class12: {
          board: formValue.academicDetails!.class12!.board!.trim(),
          passingYear: Number(formValue.academicDetails!.class12!.passingYear),
          stream: formValue.academicDetails!.class12!.stream ? formValue.academicDetails!.class12!.stream.trim() : 'Science',
          marksPercentage: Number(formValue.academicDetails!.class12!.marksPercentage),
          rollNumber: formValue.academicDetails!.class12!.rollNumber ? formValue.academicDetails!.class12!.rollNumber.trim() : ''
        },
        entranceExam: {
          examName: formValue.academicDetails!.entranceExam?.examName ? formValue.academicDetails!.entranceExam.examName.trim() : '',
          rollNumber: formValue.academicDetails!.entranceExam?.rollNumber ? formValue.academicDetails!.entranceExam.rollNumber.trim() : '',
          scoreOrRank: formValue.academicDetails!.entranceExam?.scoreOrRank ? formValue.academicDetails!.entranceExam.scoreOrRank.trim() : '',
          year: formValue.academicDetails!.entranceExam?.year ? Number(formValue.academicDetails!.entranceExam.year) : undefined
        }
      }
    };
  }

  /**
   * Step 1 handler: Validates academic details form and saves draft application to get Application ID.
   * On success, advances to Step 2: Document Upload Center.
   */
  onProceedToDocuments(): void {
    this.errorMessage.set(null);

    if (this.applicationForm.invalid) {
      this.applicationForm.markAllAsTouched();
      this.errorMessage.set('Please fill out all required academic and personal details before proceeding to document upload.');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const payload = this.buildPayload();
    this.isSavingDetails.set(true);
    this.isSubmitting.set(true);

    const existing = this.existingApplication();
    const save$ = (existing && existing.status === 'Draft' && this.applicationService.updateApplication)
      ? this.applicationService.updateApplication(existing._id, payload)
      : this.applicationService.createApplication(payload);

    save$.subscribe({
      next: (res) => {
        this.isSavingDetails.set(false);
        this.isSubmitting.set(false);
        this.existingApplication.set(res.application);
        this.activeStep.set('documents');
        this.loadApplicationDocuments();
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      error: (err: any) => {
        this.isSavingDetails.set(false);
        this.isSubmitting.set(false);
        const errMsg = err.error?.message || err.message || 'Failed to save application details. Please try again.';
        this.errorMessage.set(errMsg);
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  }

  /**
   * Returns from Step 2 (Document Upload Center) back to Step 1 (Academic Details) to review/edit
   */
  backToFormStep(): void {
    this.activeStep.set('form');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Final submission of the admission application from Step 2 (Document Upload Center)
   * Enforces mandatory documents (Class 10 Marksheet, Class 12 Marksheet, Identity Proof).
   * Transitions status to 'Submitted' and redirects to /status.
   */
  onFinalSubmit(): void {
    if (this.isFinalSubmitting()) {
      return;
    }

    this.finalSubmitError.set(null);

    if (!this.canFinalSubmit()) {
      const missing = this.missingMandatoryDocs().join(', ');
      this.finalSubmitError.set(`Please upload all mandatory documents before final submission: ${missing}.`);
      return;
    }

    const app = this.existingApplication();
    if (!app) {
      this.finalSubmitError.set('Application details not found. Please complete Step 1 first.');
      return;
    }

    this.isFinalSubmitting.set(true);

    this.applicationService.finalSubmitApplication(app._id).subscribe({
      next: (res) => {
        this.isFinalSubmitting.set(false);
        this.submittedApplication.set(res.application);
        this.existingApplication.set(res.application);
        this.authService.clearIntendedProgramme();
        this.router.navigate(['/status']);
      },
      error: (err: any) => {
        this.isFinalSubmitting.set(false);
        const errMsg = err.error?.message || err.message || 'Failed to submit application. Please try again.';
        this.finalSubmitError.set(errMsg);
      }
    });
  }

  /**
   * Form submission handler: submits verified payload to backend
   */
  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.errorMessage.set(null);

    if (this.applicationForm.invalid) {
      this.applicationForm.markAllAsTouched();
      this.errorMessage.set('Please correct the highlighted validation errors before submitting.');
      this.showConfirmModal.set(false);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (!this.isMandatoryDocsComplete()) {
      const missing = this.missingMandatoryDocs().join(', ');
      this.errorMessage.set(`Please upload all mandatory documents before final submission: ${missing}.`);
      this.showConfirmModal.set(false);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const payload = this.buildPayload();
    this.isSubmitting.set(true);

    this.applicationService.createApplication(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.showConfirmModal.set(false);
        this.submittedApplication.set(res.application);
        this.existingApplication.set(res.application);
        this.authService.clearIntendedProgramme();
        // Redirect to status page on success!
        this.router.navigate(['/status']);
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        this.showConfirmModal.set(false);
        const errMsg = err.error?.message || err.message || 'Submission failed. Please try again.';
        if (err.status === 409) {
          // Duplicate-submission protection: navigate to status
          this.router.navigate(['/status']);
        } else {
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
        this.errorMessage.set(errMsg);
      }
    });
  }

  retryLoading(): void {
    this.checkExistingApplications();
  }

  refreshDashboardData(): void {
    this.isRefreshing.set(true);
    this.errorMessage.set(null);

    this.applicationService.getMyApplications().subscribe({
      next: (res) => {
        if (res.applications && res.applications.length > 0) {
          this.existingApplication.set(res.applications[0]);
        }
        this.applicationService.getMyDocuments().subscribe({
          next: (docRes) => {
            this.isRefreshing.set(false);
            this.uploadedDocuments.set(docRes.documents);
          },
          error: (docErr: Error) => {
            this.isRefreshing.set(false);
            this.documentUploadError.set(docErr.message);
          }
        });
      },
      error: (err: Error) => {
        this.isRefreshing.set(false);
        this.errorMessage.set(err.message);
      }
    });
  }

  copyApplicationId(id: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id).then(() => {
        this.copiedAppId.set(true);
        setTimeout(() => this.copiedAppId.set(false), 2000);
      });
    }
  }

  toggleHistoricalDocs(): void {
    this.showHistoricalDocs.update(show => !show);
  }

  /**
   * Opens correction modal to replace a rejected document
   */
  openReplaceModal(doc: AdmissionDocument): void {
    if (doc.verificationStatus !== 'Rejected') return;
    if (this.existingApplication()?.status === 'Selected') return;

    this.replacingDoc.set(doc);
    this.replacementFile.set(null);
    this.replacementFileError.set(null);
    this.showReplaceModal.set(true);
  }

  closeReplaceModal(): void {
    if (!this.isUploadingReplacement()) {
      this.showReplaceModal.set(false);
      this.replacingDoc.set(null);
      this.replacementFile.set(null);
      this.replacementFileError.set(null);
    }
  }

  onReplacementFileSelected(event: Event): void {
    this.replacementFileError.set(null);
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.replacementFile.set(null);
      return;
    }

    const file = input.files[0];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      this.replacementFileError.set(
        'Invalid file format. Only PDF, JPEG, PNG, and WebP documents are supported.'
      );
      this.replacementFile.set(null);
      input.value = '';
      return;
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSizeBytes) {
      this.replacementFileError.set(
        `Selected file (${this.formatFileSize(file.size)}) exceeds the 10 MB limit.`
      );
      this.replacementFile.set(null);
      input.value = '';
      return;
    }

    this.replacementFile.set(file);
  }

  onSubmitReplacement(fileInput?: HTMLInputElement): void {
    this.replacementFileError.set(null);
    const file = this.replacementFile();
    const doc = this.replacingDoc();
    const app = this.existingApplication();

    if (!file || !doc || !app) {
      this.replacementFileError.set('Please select a replacement file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', doc.documentType);
    formData.append('applicationId', app._id);
    formData.append('replacesDocumentId', doc._id);

    this.isUploadingReplacement.set(true);

    this.applicationService.uploadDocument(formData).subscribe({
      next: (res) => {
        this.isUploadingReplacement.set(false);
        this.showReplaceModal.set(false);
        this.replacingDoc.set(null);
        this.replacementFile.set(null);
        if (fileInput) {
          fileInput.value = '';
        }

        this.documentUploadSuccess.set(
          `Replacement for ${doc.documentType} uploaded successfully and returned to Pending review.`
        );

        this.loadApplicationDocuments();
        this.refreshDashboardData();
      },
      error: (err: Error) => {
        this.isUploadingReplacement.set(false);
        this.replacementFileError.set(err.message);
      }
    });
  }

  viewApplicationDetails(): void {
    const submitted = this.submittedApplication();
    if (submitted) {
      this.existingApplication.set(submitted);
      this.submittedApplication.set(null);
      this.loadApplicationDocuments();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  /**
   * Loads documents associated with the applicant's existing application
   */
  loadApplicationDocuments(): void {
    this.isLoadingDocuments.set(true);
    this.applicationService.getMyDocuments().subscribe({
      next: (res) => {
        this.isLoadingDocuments.set(false);
        this.uploadedDocuments.set(res.documents);
      },
      error: (err: Error) => {
        this.isLoadingDocuments.set(false);
        this.documentUploadError.set(err.message);
      }
    });
  }

  /**
   * Handles file selection with client-side extension and 10MB bounds checks
   */
  onFileSelected(event: Event): void {
    this.selectedFileError.set(null);
    this.documentUploadError.set(null);
    this.documentUploadSuccess.set(null);

    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.selectedFile.set(null);
      return;
    }

    const file = input.files[0];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      this.selectedFileError.set(
        'Invalid file format. Only PDF, JPEG, PNG, and WebP documents are supported.'
      );
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSizeBytes) {
      this.selectedFileError.set(
        `Selected file (${this.formatFileSize(file.size)}) exceeds the 10 MB limit. Please select a smaller file.`
      );
      this.selectedFile.set(null);
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
  }

  onDocTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedDocType.set(select.value);
  }

  /**
   * Submits document file and metadata to POST /api/documents via FormData
   */
  onUploadDocument(fileInput: HTMLInputElement): void {
    this.documentUploadError.set(null);
    this.documentUploadSuccess.set(null);

    const file = this.selectedFile();
    if (!file) {
      this.documentUploadError.set('Please choose a document file to upload.');
      return;
    }

    const docType = this.selectedDocType();
    if (docType === 'Other') {
      this.documentUploadError.set('The "Other" document category has been removed and is no longer accepted.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', docType);

    const app = this.existingApplication();
    if (app) {
      formData.append('applicationId', app._id);
    }

    this.isUploadingDocument.set(true);

    this.applicationService.uploadDocument(formData).subscribe({
      next: (res) => {
        this.isUploadingDocument.set(false);
        this.documentUploadSuccess.set(`${res.document.documentType} uploaded successfully.`);
        this.selectedFile.set(null);
        fileInput.value = '';
        this.uploadedDocuments.update((docs) => [res.document, ...docs]);
      },
      error: (err: any) => {
        this.isUploadingDocument.set(false);
        const msg = err.error?.message || err.message || 'Failed to upload document.';
        this.documentUploadError.set(msg);
      }
    });
  }

  /**
   * Removes an uploaded document prior to final submission or correction (Requirement 2)
   */
  onDeleteDocument(doc: AdmissionDocument): void {
    if (this.isDeletingDocument()) return;

    if (!confirm(`Are you sure you want to remove the uploaded "${doc.documentType}" (${doc.originalFilename})?`)) {
      return;
    }

    this.isDeletingDocument.set(doc._id);
    this.documentUploadError.set(null);
    this.documentUploadSuccess.set(null);

    this.applicationService.deleteDocument(doc._id).subscribe({
      next: () => {
        this.isDeletingDocument.set(null);
        this.uploadedDocuments.update((docs) => docs.filter((d) => d._id !== doc._id));
        this.documentUploadSuccess.set(`"${doc.documentType}" was removed successfully.`);
      },
      error: (err: any) => {
        this.isDeletingDocument.set(null);
        const msg = err.error?.message || err.message || 'Failed to remove document.';
        this.documentUploadError.set(msg);
      }
    });
  }

  /**
   * Authenticated download or preview of uploaded document
   */
  downloadDocument(doc: AdmissionDocument): void {
    this.applicationService.downloadDocumentFile(doc._id).subscribe({
      next: (blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = doc.originalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);
      },
      error: (err: Error) => {
        this.documentUploadError.set(`Failed to retrieve file: ${err.message}`);
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  printSummary(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }
}
