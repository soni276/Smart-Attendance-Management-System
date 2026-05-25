export type Semester =
  | "1st"
  | "2nd"
  | "3rd"
  | "4th"
  | "5th"
  | "6th"
  | "7th"
  | "8th";

export interface Student {
  id: string;
  name: string;
  enrollmentNo: string;
  email: string;
  phone: string;
  department: string;
  semester: Semester;
  batch: string;
  courseIds: string[];
  photoURL: string;
  faceDescriptor: number[] | null;
  enrolledAt: string;
  isActive: boolean;
}

export type FacultyDesignation =
  | "Assistant Professor"
  | "Associate Professor"
  | "Professor"
  | "Visiting Faculty"
  | "Lecturer";

export interface Faculty {
  id: string;
  name: string;
  email: string;
  password: string;
  employeeId: string;
  designation: FacultyDesignation;
  department: string;
  specialisation: string[];
  courseIds: string[];
  role: "faculty";
  avatar?: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin";
}

export interface Course {
  id: string;
  courseName: string;
  courseCode: string;
  department: string;
  semester: Semester;
  batch: string;
  facultyId: string;
  studentIds: string[];
  credits: number;
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
  room?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  courseId: string;
  subjectId: string;
  date: string;
  status: "present" | "absent" | "late" | "half-day";
  markedBy: string;
  facultyId: string;
  markedAt: string;
  method: "face-qr" | "manual" | "face-only";
  latenessMinutes?: number;
}

export interface QRSession {
  id: string;
  courseId: string;
  subjectId: string;
  subject: string;
  facultyId: string;
  facultyName: string;
  courseName: string;
  courseCode: string;
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
  courseId: string;
  subjectId: string;
  facultyId: string;
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
  institutionName: string;
  institutionLogo?: string;
  academicYear: string;
  semesterName: string;
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
  role: "admin" | "faculty" | "student";
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
