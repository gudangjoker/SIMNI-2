import { ClassId } from '@/types/auth';

export const OWNER_EMAIL = 'unggaran.sditbm@gmail.com';
export const VIP_EMAIL = 'anur.auliya01@gmail.com';

export function workspaceIdForClass(classId: ClassId): string {
  if (classId === 'PJOK') return 'ws_pjok';
  return `ws_kelas${classId.toLowerCase()}`;
}

export function isOwnerEmail(email: string): boolean {
  return email?.toLowerCase().trim() === OWNER_EMAIL;
}

export function isVipEmail(email: string): boolean {
  return email?.toLowerCase().trim() === VIP_EMAIL;
}
