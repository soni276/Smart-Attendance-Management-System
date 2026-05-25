export interface Student {
  id: string;
  name: string;
  rollNo: string;
  email: string;
  classId: string;
  section: string;
  department: string;
  photoURL: string;
  faceDescriptor: number[] | null;
  enrolledAt: string;
  isActive: boolean;
  phone?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  password: string;
  subjects: string[];
  classIds: string[];
  role: "teacher";
  avatar?: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin";
}

export interface ClassRoom {
  id: string;
  name: string;
  section: string;
  department: string;
  teacherId: string;
  studentIds: string[];
  schedule: ScheduleSlot[];
}

export interface ScheduleSlot {
  day:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday";
  subject: string;
  subjectId: string;
  startTime: string;
  endTime: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  subjectId: string;
  date: string;
  status: "present" | "absent" | "late" | "half-day";
  markedBy: string;
  markedAt: string;
  method: "face-qr" | "manual" | "face-only";
  latenessMinutes?: number;
}

export interface QRSession {
  id: string;
  classId: string;
  subjectId: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  className: string;
  date: string;
  windowSlot: string;
  startTime: string;
  endTime: string;
  lateAfterMinutes: number;
  absentAfterMinutes: number;
  isActive: boolean;
  markedStudentIds: string[];
  currentNonce: string;
  currentSignature: string;
  lastRotatedAt: string;
  createdAt: string;
}

export interface QRPayload {
  sessionId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  windowSlot: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signature: string;
}

export interface LivenessChallenge {
  type: "blink" | "turn-left" | "turn-right" | "smile";
  instruction: string;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface FewShotExample {
  question: string;
  answer: string;
  timestamp: string;
}

export interface AppSettings {
  schoolName: string;
  schoolLogo?: string;
  minAttendancePercent: number;
  qrExpirySeconds: number;
  faceMatchThreshold: number;
  geoFencingEnabled: boolean;
  geoLat: number;
  geoLng: number;
  geoRadiusMeters: number;
  theme: "dark" | "light";
  latenessMinutes: number;
  absentMinutes: number;
  openaiApiKey?: string;
  openaiModel?: "gpt-4o" | "gpt-4o-mini";
}

export interface SessionUser {
  userId: string;
  role: "admin" | "teacher" | "student";
  name: string;
  email: string;
  token: string;
}

export interface AnomalyFlag {
  id: string;
  type:
    | "proxy-group"
    | "location-mismatch"
    | "repeated-failure"
    | "speed-scan";
  studentIds: string[];
  description: string;
  detectedAt: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
}
