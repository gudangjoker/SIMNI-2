export type Role = 'superuser' | 'vip' | 'teacher';

export type ClassId = 
  | '1A' | '1B' | '2A' | '2B' | '3A' | '3B' 
  | '4A' | '4B' | '5A' | '5B' | '6A' | '6B' 
  | 'PJOK';

export interface UserProfile {
  uid: string;
  email: string;
  status: 'active' | 'suspended' | 'pending_approval';
  role: Role;
  workspaceId: string;
  classId: ClassId;
  activeAcademicYearId: string;
  assignmentRevision: number;
}

export interface AccessContext {
  uid: string;
  email: string;
  role: Role;
  workspaceId: string;
  classId: ClassId;
  activeAcademicYearId: string;
  status: string;
  assignmentRevision: number;
  offlineLeaseExpiresAt?: number;
}
