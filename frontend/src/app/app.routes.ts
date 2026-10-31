import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { ApplicationComponent } from './pages/application/application';
import { StatusComponent } from './pages/status/status';
import { AdminDashboardComponent } from './pages/admin/admin';
import { VerificationDashboardComponent } from './pages/verification/verification';
import { StaffSelectionComponent } from './pages/staff-login/staff-selection';
import { StaffRoleLoginComponent } from './pages/staff-login/staff-role-login';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { verificationGuard } from './guards/verification.guard';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'UEM Online Admission Portal | Home'
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Applicant Login | UEM Admission Portal'
  },
  {
    path: 'staff-login',
    component: StaffSelectionComponent,
    title: 'Staff Portal Access | UEM Admission Portal'
  },
  {
    path: 'staff-login/admin',
    component: StaffRoleLoginComponent,
    data: { portal: 'admin' },
    title: 'Administrator Login | UEM Admission Portal'
  },
  {
    path: 'staff-login/verification',
    component: StaffRoleLoginComponent,
    data: { portal: 'verification' },
    title: 'Verification Officer Login | UEM Admission Portal'
  },
  {
    path: 'register',
    component: RegisterComponent,
    title: 'New Applicant Registration | UEM Admission Portal'
  },
  {
    path: 'application',
    component: ApplicationComponent,
    canActivate: [authGuard],
    title: 'Online Admission Application | UEM Admission Portal'
  },
  {
    path: 'status',
    component: StatusComponent,
    canActivate: [authGuard],
    title: 'Application Status & Tracking | UEM Admission Portal'
  },
  {
    path: 'application-status',
    redirectTo: 'status',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [adminGuard],
    title: 'Admission Administration Dashboard | UEM Admission Portal'
  },
  {
    path: 'verification',
    component: VerificationDashboardComponent,
    canActivate: [verificationGuard],
    title: 'Document & Application Verification | UEM Admission Portal'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
