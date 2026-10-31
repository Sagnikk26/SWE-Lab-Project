import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export interface Programme {
  id: string;
  name: string;
  canonicalProgramme: string;
  degree: string;
  level: 'ug' | 'pg';
  duration: string;
  department: string;
  specialisations: string[];
  description: string;
  featured?: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent {
  readonly authService = inject(AuthService);
  selectedCategory = signal<'all' | 'ug' | 'pg'>('all');

  programmes: Programme[] = [
    {
      id: 'btech-cse',
      name: 'B.Tech in Computer Science & Engineering',
      canonicalProgramme: 'B.Tech - Computer Science & Engineering',
      degree: 'Bachelor of Technology',
      level: 'ug',
      duration: '4 Years (8 Semesters)',
      department: 'Department of Computer Science & Engineering',
      specialisations: ['Artificial Intelligence & Machine Learning', 'Data Science', 'Cyber Security', 'Cloud Computing'],
      description: 'Comprehensive curriculum focused on core computer science foundations, algorithms, modern software architecture, and real-world industry capstone projects.',
      featured: true
    },
    {
      id: 'btech-ece',
      name: 'B.Tech in Electronics & Communication Engineering',
      canonicalProgramme: 'B.Tech - Electronics & Communication Engineering',
      degree: 'Bachelor of Technology',
      level: 'ug',
      duration: '4 Years (8 Semesters)',
      department: 'Department of Electronics & Communication',
      specialisations: ['VLSI Design', 'Embedded Systems & Robotics', 'Internet of Things (IoT)', 'Wireless Communication'],
      description: 'In-depth education covering semiconductor devices, digital signal processing, modern communication networks, and embedded systems engineering.',
      featured: false
    },
    {
      id: 'bca',
      name: 'Bachelor of Computer Applications (BCA)',
      canonicalProgramme: 'Bachelor of Computer Applications (BCA)',
      degree: 'Bachelor Degree',
      level: 'ug',
      duration: '3 Years (6 Semesters)',
      department: 'Department of Information Technology',
      specialisations: ['Full-Stack Web Development', 'Mobile Application Development', 'Database Administration'],
      description: 'Hands-on practical programme preparing students in software programming languages, database technologies, and web application development.',
      featured: false
    },
    {
      id: 'bba',
      name: 'Bachelor of Business Administration (BBA)',
      canonicalProgramme: 'Bachelor of Business Administration (BBA)',
      degree: 'Bachelor Degree',
      level: 'ug',
      duration: '3 Years (6 Semesters)',
      department: 'Department of Management Studies',
      specialisations: ['Digital Marketing', 'Financial Management', 'Business Analytics', 'Human Resource Management'],
      description: 'Rigorous management education bridging leadership skills, financial acumen, marketing strategies, and organisational behavior.',
      featured: false
    },
    {
      id: 'mca',
      name: 'Master of Computer Applications (MCA)',
      canonicalProgramme: 'Master of Computer Applications (MCA)',
      degree: 'Master Degree',
      level: 'pg',
      duration: '2 Years (4 Semesters)',
      department: 'Department of Computer Applications',
      specialisations: ['Enterprise Software Systems', 'Cloud DevOps', 'Big Data Engineering'],
      description: 'Advanced postgraduate curriculum designed for engineering robust software systems, distributed computing, and emerging technology frameworks.',
      featured: true
    },
    {
      id: 'mba',
      name: 'Master of Business Administration (MBA)',
      canonicalProgramme: 'Master of Business Administration (MBA)',
      degree: 'Master Degree',
      level: 'pg',
      duration: '2 Years (4 Semesters)',
      department: 'Department of Management Studies',
      specialisations: ['Strategic Management', 'Fintech & Investment', 'Data Analytics for Leaders'],
      description: 'Postgraduate management education combining strategic leadership, quantitative business modeling, global case studies, and corporate mentorship.',
      featured: true
    }
  ];

  filteredProgrammes = computed(() => {
    const category = this.selectedCategory();
    if (category === 'all') {
      return this.programmes;
    }
    return this.programmes.filter(p => p.level === category);
  });

  setCategory(category: 'all' | 'ug' | 'pg'): void {
    this.selectedCategory.set(category);
  }
}
