import { Student } from './student';

export interface LPSTemplateSection {
  id: string;
  title: string;
  aspects: {
    id: string;
    label: string;
    criteria?: string[];
  }[];
}

export interface LPSTemplate {
  templateVersion: number;
  reportType: 'LPS' | 'BLP';
  sections: LPSTemplateSection[]; // Maksimal 26 bagian
}

export interface LPSReport {
  id: string;
  period: 'lps_mid_s1' | 'blp_final_s1' | 'lps_mid_s2' | 'blp_final_s2';
  status: 'draft' | 'final';
  hash?: string;          // Checksum SHA-256 (Wajib ada saat status 'final')
  gregorianDate: string;
  hijriDate: string;
  templateSnapshot: LPSTemplate;
  studentSnapshot: Student;
  evaluations: Record<string, string | number>;
  notes?: {
    waliKelas?: string;
    guruPendamping?: string;
    orangTua?: string;
  };
}
