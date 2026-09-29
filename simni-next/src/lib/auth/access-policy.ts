import { Role } from '@/types/auth';

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  superuser: [
    'dashboard', 'students', 'attendance', 'grades', 
    'journal', 'notes', 'documents', 'gadm', 'lps', 
    'btq', 'settings', 'accounts', 'backup', 'archive', 'reset'
  ],
  vip: [
    'dashboard', 'attendance', 'grades', 'journal', 'notes', 'lps'
  ],
  teacher: [
    'dashboard', 'students', 'attendance', 'grades', 
    'journal', 'notes', 'documents', 'gadm', 'lps', 
    'btq', 'settings', 'backup'
  ]
};

export function hasFeature(role: Role, feature: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(feature) ?? false;
}

export function allowedSubjectForRole(role: Role, subject: string): boolean {
  if (role === 'vip') {
    return subject.toUpperCase() === 'PJOK';
  }
  return true;
}
