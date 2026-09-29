import { ClassId } from '@/types/auth';
import { workspaceIdForClass } from '../auth/workspace-registry';

export function resolveDatabasePath(
  logicalPath: string, 
  classId: ClassId, 
  academicYear: string
): string {
  const wsId = workspaceIdForClass(classId);
  const normalizedPath = logicalPath.startsWith('/') ? logicalPath.slice(1) : logicalPath;
  
  if (normalizedPath.startsWith('Pengaturan/Identitas')) {
    return `workspaces/${wsId}/settings/identity`;
  }
  
  return `workspaces/${wsId}/academicYears/${academicYear}/${normalizedPath}`;
}
