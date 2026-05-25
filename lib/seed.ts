import {
  KEYS,
  saveMany,
  saveSettings,
} from "@/lib/storage";
import { generateId } from "@/lib/utils";
import type {
  Admin,
  AppSettings,
  AttendanceRecord,
  Course,
  Faculty,
  ScheduleSlot,
  Semester,
  Student,
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

function pickName(seed: number): string {
  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const last = LAST_NAMES[(seed * 7) % LAST_NAMES.length];
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

// Realistic attendance: ~78–92% target average
function randomStatus(): AttendanceRecord["status"] {
  const r = Math.random();
  if (r < 0.84) return "present";
  if (r < 0.91) return "late";
  if (r < 0.94) return "half-day";
  return "absent";
}

interface CourseSeed {
  id: string;
  courseCode: string;
  courseName: string;
  department: string;
  semester: Semester;
  batch: string;
  facultyId: string;
  credits: number;
  enrollmentPrefix: string; // e.g. CSE22
  schedule: Omit<ScheduleSlot, "subjectId">[];
}

function buildSchedule(
  course: CourseSeed
): ScheduleSlot[] {
  const subjectId = `${course.courseCode}-paper`;
  return course.schedule.map((s) => ({
    ...s,
    subjectId,
  }));
}

function createStudentsForCourse(
  course: CourseSeed,
  count: number,
  startIndex: number
): Student[] {
  const enrolledBase = new Date();
  enrolledBase.setMonth(enrolledBase.getMonth() - 8);

  const students: Student[] = [];
  for (let i = 1; i <= count; i++) {
    const enrollNo = `${course.enrollmentPrefix}${String(i).padStart(3, "0")}`;
    students.push({
      id: generateId(),
      name: pickName(startIndex + i * 3),
      enrollmentNo: enrollNo,
      email: `${enrollNo.toLowerCase()}@git.edu.in`,
      phone: `+91 9${String(800000000 + ((startIndex + i) * 71) % 99999999).padStart(9, "0")}`,
      department: course.department,
      semester: course.semester,
      batch: course.batch,
      courseIds: [course.id],
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
  courses: Course[],
  daysBack: number
): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  for (let d = 0; d < daysBack; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = formatYMD(date);
    const dayName = dayNameFromDate(date);
    if (!dayName) continue;

    for (const student of students) {
      for (const courseId of student.courseIds) {
        const course = courseMap.get(courseId);
        if (!course) continue;

        const slots = course.schedule.filter((s) => s.day === dayName);
        for (const slot of slots) {
          const status = randomStatus();
          const markedAt = new Date(date);
          const [h, m] = slot.startTime.split(":").map(Number);
          markedAt.setHours(h, m + (status === "late" ? 12 : 2), 0, 0);

          records.push({
            id: generateId(),
            studentId: student.id,
            courseId,
            subjectId: slot.subjectId,
            date: dateStr,
            status,
            markedBy: course.facultyId,
            facultyId: course.facultyId,
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
  }

  return records;
}

export interface SeedDeps {
  KEYS: typeof KEYS;
  saveMany: <T>(key: string, items: T[]) => void;
  saveSettings: (s: Partial<AppSettings>) => void;
  isInitialized: () => boolean;
  markInitialized: () => void;
}

export function runSeed(deps: SeedDeps): void {
  if (deps.isInitialized()) return;

  const adminId = generateId();
  const facultyIds = [
    generateId(),
    generateId(),
    generateId(),
    generateId(),
    generateId(),
    generateId(),
  ];

  const admins: Admin[] = [
    {
      id: adminId,
      name: "Dr. Anand Verma (Registrar)",
      email: "admin@git.edu.in",
      password: "admin123",
      role: "admin",
    },
  ];

  const courseSeeds: CourseSeed[] = [
    {
      id: generateId(),
      courseCode: "CS301",
      courseName: "Data Structures & Algorithms",
      department: "Computer Science & Engineering",
      semester: "3rd",
      batch: "2022-2026",
      facultyId: facultyIds[0],
      credits: 4,
      enrollmentPrefix: "CSE22",
      schedule: [
        { day: "Monday", subject: "DSA Lecture", startTime: "09:00", endTime: "10:00", room: "CSE-301" },
        { day: "Wednesday", subject: "DSA Lecture", startTime: "09:00", endTime: "10:00", room: "CSE-301" },
        { day: "Friday", subject: "DSA Lab", startTime: "14:00", endTime: "16:00", room: "CSE-Lab-1" },
      ],
    },
    {
      id: generateId(),
      courseCode: "CS401",
      courseName: "Machine Learning",
      department: "Computer Science & Engineering",
      semester: "5th",
      batch: "2021-2025",
      facultyId: facultyIds[1],
      credits: 4,
      enrollmentPrefix: "CSE21",
      schedule: [
        { day: "Tuesday", subject: "ML Lecture", startTime: "10:00", endTime: "11:00", room: "CSE-302" },
        { day: "Thursday", subject: "ML Lecture", startTime: "10:00", endTime: "11:00", room: "CSE-302" },
        { day: "Saturday", subject: "ML Lab", startTime: "09:00", endTime: "11:00", room: "CSE-Lab-2" },
      ],
    },
    {
      id: generateId(),
      courseCode: "EC301",
      courseName: "Digital Signal Processing",
      department: "Electronics & Communication",
      semester: "3rd",
      batch: "2022-2026",
      facultyId: facultyIds[2],
      credits: 3,
      enrollmentPrefix: "ECE22",
      schedule: [
        { day: "Monday", subject: "DSP Lecture", startTime: "11:00", endTime: "12:00", room: "ECE-201" },
        { day: "Wednesday", subject: "DSP Lecture", startTime: "11:00", endTime: "12:00", room: "ECE-201" },
        { day: "Friday", subject: "DSP Tutorial", startTime: "11:00", endTime: "12:00", room: "ECE-201" },
      ],
    },
    {
      id: generateId(),
      courseCode: "EC401",
      courseName: "VLSI Design",
      department: "Electronics & Communication",
      semester: "5th",
      batch: "2021-2025",
      facultyId: facultyIds[3],
      credits: 3,
      enrollmentPrefix: "ECE21",
      schedule: [
        { day: "Tuesday", subject: "VLSI Lecture", startTime: "14:00", endTime: "15:00", room: "ECE-202" },
        { day: "Thursday", subject: "VLSI Lecture", startTime: "14:00", endTime: "15:00", room: "ECE-202" },
        { day: "Saturday", subject: "VLSI Lab", startTime: "11:00", endTime: "13:00", room: "ECE-Lab-1" },
      ],
    },
    {
      id: generateId(),
      courseCode: "ME301",
      courseName: "Thermodynamics",
      department: "Mechanical Engineering",
      semester: "3rd",
      batch: "2022-2026",
      facultyId: facultyIds[4],
      credits: 4,
      enrollmentPrefix: "ME22",
      schedule: [
        { day: "Monday", subject: "Thermo Lecture", startTime: "08:00", endTime: "09:00", room: "ME-101" },
        { day: "Wednesday", subject: "Thermo Lecture", startTime: "08:00", endTime: "09:00", room: "ME-101" },
        { day: "Friday", subject: "Thermo Tutorial", startTime: "10:00", endTime: "11:00", room: "ME-101" },
      ],
    },
    {
      id: generateId(),
      courseCode: "ME401",
      courseName: "Robotics & Automation",
      department: "Mechanical Engineering",
      semester: "5th",
      batch: "2021-2025",
      facultyId: facultyIds[5],
      credits: 3,
      enrollmentPrefix: "ME21",
      schedule: [
        { day: "Tuesday", subject: "Robotics Lecture", startTime: "11:00", endTime: "12:00", room: "ME-202" },
        { day: "Thursday", subject: "Robotics Lecture", startTime: "11:00", endTime: "12:00", room: "ME-202" },
        { day: "Saturday", subject: "Robotics Lab", startTime: "14:00", endTime: "16:00", room: "ME-Lab-1" },
      ],
    },
  ];

  const courses: Course[] = courseSeeds.map((c) => ({
    id: c.id,
    courseCode: c.courseCode,
    courseName: c.courseName,
    department: c.department,
    semester: c.semester,
    batch: c.batch,
    facultyId: c.facultyId,
    studentIds: [],
    credits: c.credits,
    schedule: buildSchedule(c),
  }));

  const allStudents: Student[] = [];
  courseSeeds.forEach((cs, idx) => {
    const studentsForCourse = createStudentsForCourse(cs, 20, idx * 137);
    allStudents.push(...studentsForCourse);
    const target = courses.find((c) => c.id === cs.id);
    if (target) {
      target.studentIds = studentsForCourse.map((s) => s.id);
    }
  });

  const faculty: Faculty[] = [
    {
      id: facultyIds[0],
      name: "Dr. Rajesh Sharma",
      email: "rajesh.sharma@git.edu.in",
      password: "faculty123",
      employeeId: "FAC001",
      designation: "Associate Professor",
      department: "Computer Science & Engineering",
      specialisation: ["Algorithms", "Data Structures", "Competitive Programming"],
      courseIds: [courseSeeds[0].id],
      role: "faculty",
    },
    {
      id: facultyIds[1],
      name: "Dr. Priya Kapoor",
      email: "priya.kapoor@git.edu.in",
      password: "faculty123",
      employeeId: "FAC002",
      designation: "Assistant Professor",
      department: "Computer Science & Engineering",
      specialisation: ["Machine Learning", "Deep Learning", "AI"],
      courseIds: [courseSeeds[1].id],
      role: "faculty",
    },
    {
      id: facultyIds[2],
      name: "Prof. Arun Verma",
      email: "arun.verma@git.edu.in",
      password: "faculty123",
      employeeId: "FAC003",
      designation: "Professor",
      department: "Electronics & Communication",
      specialisation: ["Signal Processing", "Communication Systems"],
      courseIds: [courseSeeds[2].id],
      role: "faculty",
    },
    {
      id: facultyIds[3],
      name: "Dr. Sunita Mehta",
      email: "sunita.mehta@git.edu.in",
      password: "faculty123",
      employeeId: "FAC004",
      designation: "Assistant Professor",
      department: "Electronics & Communication",
      specialisation: ["VLSI", "Embedded Systems"],
      courseIds: [courseSeeds[3].id],
      role: "faculty",
    },
    {
      id: facultyIds[4],
      name: "Prof. Vikram Singh",
      email: "vikram.singh@git.edu.in",
      password: "faculty123",
      employeeId: "FAC005",
      designation: "Professor",
      department: "Mechanical Engineering",
      specialisation: ["Thermodynamics", "Heat Transfer"],
      courseIds: [courseSeeds[4].id],
      role: "faculty",
    },
    {
      id: facultyIds[5],
      name: "Dr. Neha Joshi",
      email: "neha.joshi@git.edu.in",
      password: "faculty123",
      employeeId: "FAC006",
      designation: "Assistant Professor",
      department: "Mechanical Engineering",
      specialisation: ["Robotics", "Automation", "Control Systems"],
      courseIds: [courseSeeds[5].id],
      role: "faculty",
    },
  ];

  const attendance = generateAttendance(allStudents, courses, 60);

  deps.saveMany(deps.KEYS.ADMINS, admins);
  deps.saveMany(deps.KEYS.FACULTY, faculty);
  deps.saveMany(deps.KEYS.COURSES, courses);
  deps.saveMany(deps.KEYS.STUDENTS, allStudents);
  deps.saveMany(deps.KEYS.ATTENDANCE, attendance);
  deps.saveMany(deps.KEYS.QR_SESSIONS, []);
  deps.saveMany(deps.KEYS.CHAT_HISTORY, []);
  deps.saveMany(deps.KEYS.FEW_SHOTS, []);
  deps.saveMany(deps.KEYS.ANOMALIES, []);

  deps.saveSettings({
    institutionName: "Greenfield Institute of Technology",
    academicYear: "2025-2026",
    semesterName: "Even Semester 2025-26",
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
  // Also clear any legacy v1 keys so users migrating from school version get clean state
  const legacyKeys = ["sas_initialized", "sas_classes", "sas_teachers"];
  legacyKeys.forEach((k) => localStorage.removeItem(k));
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  if (session) localStorage.setItem(KEYS.SESSION_USER, session);
  seedDemoData(true);
}
