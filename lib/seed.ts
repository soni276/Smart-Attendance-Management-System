import {
  KEYS,
  saveMany,
  saveSettings,
} from "@/lib/storage";
import { generateId } from "@/lib/utils";
import type {
  Admin,
  AttendanceRecord,
  ClassRoom,
  ScheduleSlot,
  Student,
  Teacher,
} from "@/types";

const FIRST_NAMES = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Vihaan",
  "Arjun",
  "Sai",
  "Reyansh",
  "Ayaan",
  "Krishna",
  "Ishaan",
  "Ananya",
  "Diya",
  "Priya",
  "Aadhya",
  "Kavya",
  "Saanvi",
  "Myra",
  "Kiara",
  "Ira",
  "Riya",
  "Rohan",
  "Kabir",
  "Dev",
  "Nikhil",
  "Yash",
  "Harsh",
  "Manav",
  "Karan",
  "Rahul",
  "Suresh",
  "Amit",
  "Deepak",
  "Pooja",
  "Neha",
  "Shreya",
  "Meera",
  "Tanvi",
  "Nisha",
  "Lakshmi",
  "Divya",
];

const LAST_NAMES = [
  "Sharma",
  "Patel",
  "Singh",
  "Kumar",
  "Gupta",
  "Reddy",
  "Nair",
  "Iyer",
  "Mehta",
  "Joshi",
  "Verma",
  "Kapoor",
  "Malhotra",
  "Chopra",
  "Bose",
  "Das",
  "Rao",
  "Pillai",
  "Agarwal",
  "Saxena",
];

function pickName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 7) % LAST_NAMES.length];
  return `${first} ${last}`;
}

function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayNameFromDate(d: Date): ScheduleSlot["day"] | null {
  const idx = d.getDay();
  if (idx === 0) return null;
  const names: ScheduleSlot["day"][] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return names[idx - 1];
}

function randomStatus(): AttendanceRecord["status"] {
  const r = Math.random();
  if (r < 0.88) return "present";
  if (r < 0.93) return "late";
  if (r < 0.96) return "half-day";
  return "absent";
}

function createStudents(
  classId: string,
  className: string,
  section: string,
  department: string,
  prefix: string,
  count: number
): Student[] {
  const students: Student[] = [];
  const enrolledBase = new Date();
  enrolledBase.setMonth(enrolledBase.getMonth() - 6);

  for (let i = 1; i <= count; i++) {
    const roll = `${prefix}${String(i).padStart(3, "0")}`;
    students.push({
      id: generateId(),
      name: pickName(i + prefix.charCodeAt(0)),
      rollNo: roll,
      email: `${roll.toLowerCase()}@sas.student.com`,
      classId,
      section,
      department,
      photoURL: "",
      faceDescriptor: null,
      enrolledAt: enrolledBase.toISOString(),
      isActive: true,
    });
  }
  return students;
}

function generateAttendance(
  students: Student[],
  classes: ClassRoom[],
  daysBack: number
): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const classMap = new Map(classes.map((c) => [c.id, c]));

  for (let d = 0; d < daysBack; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = formatYMD(date);
    const dayName = dayNameFromDate(date);
    if (!dayName) continue;

    for (const student of students) {
      const classroom = classMap.get(student.classId);
      if (!classroom) continue;

      const slots = classroom.schedule.filter((s) => s.day === dayName);
      for (const slot of slots) {
        const status = randomStatus();
        const markedAt = new Date(date);
        const [h, m] = slot.startTime.split(":").map(Number);
        markedAt.setHours(h, m + (status === "late" ? 12 : 2), 0, 0);

        records.push({
          id: generateId(),
          studentId: student.id,
          classId: student.classId,
          subjectId: slot.subjectId,
          date: dateStr,
          status,
          markedBy: classroom.teacherId,
          markedAt: markedAt.toISOString(),
          method:
            status === "absent"
              ? "manual"
              : Math.random() > 0.5
                ? "face-qr"
                : "face-only",
          ...(status === "late"
            ? { latenessMinutes: Math.floor(Math.random() * 15) + 5 }
            : {}),
        });
      }
    }
  }

  return records;
}

export interface SeedDeps {
  KEYS: typeof KEYS;
  saveMany: <T>(key: string, items: T[]) => void;
  saveSettings: (s: Partial<import("@/types").AppSettings>) => void;
  isInitialized: () => boolean;
  markInitialized: () => void;
}

export function runSeed(deps: SeedDeps): void {
  if (deps.isInitialized()) return;

  const adminId = generateId();
  const teacherIds = [generateId(), generateId(), generateId()];
  const classIds = [generateId(), generateId(), generateId()];

  const subMath10 = generateId();
  const subPhysics10 = generateId();
  const subStats11 = generateId();
  const subChem11 = generateId();
  const subCS12 = generateId();
  const subAI12 = generateId();

  const admins: Admin[] = [
    {
      id: adminId,
      name: "Super Admin",
      email: "admin@sas.com",
      password: "admin123",
      role: "admin",
    },
  ];

  const teachers: Teacher[] = [
    {
      id: teacherIds[0],
      name: "Mr. Rajesh Sharma",
      email: "sharma@sas.com",
      password: "teacher123",
      subjects: ["Mathematics", "Statistics"],
      classIds: [classIds[0]],
      role: "teacher",
    },
    {
      id: teacherIds[1],
      name: "Ms. Priya Kapoor",
      email: "kapoor@sas.com",
      password: "teacher123",
      subjects: ["Physics", "Chemistry"],
      classIds: [classIds[1]],
      role: "teacher",
    },
    {
      id: teacherIds[2],
      name: "Mr. Arun Verma",
      email: "verma@sas.com",
      password: "teacher123",
      subjects: ["Computer Science", "AI & ML"],
      classIds: [classIds[2]],
      role: "teacher",
    },
  ];

  const schedule10A: ScheduleSlot[] = [
    {
      day: "Monday",
      subject: "Mathematics",
      subjectId: subMath10,
      startTime: "09:00",
      endTime: "10:00",
    },
    {
      day: "Wednesday",
      subject: "Mathematics",
      subjectId: subMath10,
      startTime: "09:00",
      endTime: "10:00",
    },
    {
      day: "Friday",
      subject: "Mathematics",
      subjectId: subMath10,
      startTime: "09:00",
      endTime: "10:00",
    },
    {
      day: "Tuesday",
      subject: "Physics",
      subjectId: subPhysics10,
      startTime: "10:00",
      endTime: "11:00",
    },
    {
      day: "Thursday",
      subject: "Physics",
      subjectId: subPhysics10,
      startTime: "10:00",
      endTime: "11:00",
    },
  ];

  const schedule11B: ScheduleSlot[] = [
    {
      day: "Monday",
      subject: "Statistics",
      subjectId: subStats11,
      startTime: "11:00",
      endTime: "12:00",
    },
    {
      day: "Wednesday",
      subject: "Statistics",
      subjectId: subStats11,
      startTime: "11:00",
      endTime: "12:00",
    },
    {
      day: "Tuesday",
      subject: "Chemistry",
      subjectId: subChem11,
      startTime: "09:00",
      endTime: "10:00",
    },
    {
      day: "Thursday",
      subject: "Chemistry",
      subjectId: subChem11,
      startTime: "09:00",
      endTime: "10:00",
    },
  ];

  const schedule12C: ScheduleSlot[] = [
    {
      day: "Monday",
      subject: "Computer Science",
      subjectId: subCS12,
      startTime: "08:00",
      endTime: "09:00",
    },
    {
      day: "Wednesday",
      subject: "Computer Science",
      subjectId: subCS12,
      startTime: "08:00",
      endTime: "09:00",
    },
    {
      day: "Friday",
      subject: "Computer Science",
      subjectId: subCS12,
      startTime: "08:00",
      endTime: "09:00",
    },
    {
      day: "Tuesday",
      subject: "AI & ML",
      subjectId: subAI12,
      startTime: "14:00",
      endTime: "15:00",
    },
    {
      day: "Thursday",
      subject: "AI & ML",
      subjectId: subAI12,
      startTime: "14:00",
      endTime: "15:00",
    },
  ];

  const students10A = createStudents(
    classIds[0],
    "Class 10-A",
    "A",
    "Science",
    "10A",
    25
  );
  const students11B = createStudents(
    classIds[1],
    "Class 11-B",
    "B",
    "Commerce",
    "11B",
    25
  );
  const students12C = createStudents(
    classIds[2],
    "Class 12-C",
    "C",
    "Technology",
    "12C",
    25
  );
  const allStudents = [...students10A, ...students11B, ...students12C];

  const classes: ClassRoom[] = [
    {
      id: classIds[0],
      name: "Class 10-A",
      section: "A",
      department: "Science",
      teacherId: teacherIds[0],
      studentIds: students10A.map((s) => s.id),
      schedule: schedule10A,
    },
    {
      id: classIds[1],
      name: "Class 11-B",
      section: "B",
      department: "Commerce",
      teacherId: teacherIds[1],
      studentIds: students11B.map((s) => s.id),
      schedule: schedule11B,
    },
    {
      id: classIds[2],
      name: "Class 12-C",
      section: "C",
      department: "Technology",
      teacherId: teacherIds[2],
      studentIds: students12C.map((s) => s.id),
      schedule: schedule12C,
    },
  ];

  const attendance = generateAttendance(allStudents, classes, 60);

  deps.saveMany(deps.KEYS.ADMINS, admins);
  deps.saveMany(deps.KEYS.TEACHERS, teachers);
  deps.saveMany(deps.KEYS.CLASSES, classes);
  deps.saveMany(deps.KEYS.STUDENTS, allStudents);
  deps.saveMany(deps.KEYS.ATTENDANCE, attendance);
  deps.saveMany(deps.KEYS.QR_SESSIONS, []);
  deps.saveMany(deps.KEYS.CHAT_HISTORY, []);
  deps.saveMany(deps.KEYS.FEW_SHOTS, []);
  deps.saveMany(deps.KEYS.ANOMALIES, []);

  deps.saveSettings({
    schoolName: "Smart Attendance School",
    minAttendancePercent: 75,
    qrExpirySeconds: 60,
    faceMatchThreshold: 0.5,
    geoFencingEnabled: false,
    geoLat: 28.6139,
    geoLng: 77.209,
    geoRadiusMeters: 200,
    theme: "dark",
    latenessMinutes: 10,
    absentMinutes: 25,
  });

  deps.markInitialized();
}

export function seedDemoData(force = false): void {
  if (typeof window === "undefined") return;

  runSeed({
    KEYS,
    saveMany,
    saveSettings,
    isInitialized: () =>
      !force && localStorage.getItem(KEYS.INITIALIZED) === "true",
    markInitialized: () => localStorage.setItem(KEYS.INITIALIZED, "true"),
  });
}

export function resetDemoData(): void {
  if (typeof window === "undefined") return;
  const session = localStorage.getItem(KEYS.SESSION_USER);
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  if (session) localStorage.setItem(KEYS.SESSION_USER, session);
  seedDemoData(true);
}
