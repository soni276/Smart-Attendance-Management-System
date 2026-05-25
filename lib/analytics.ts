import { calculateAttendancePercent } from "@/lib/utils";
import type {
  AttendanceRecord,
  Course,
  Student,
} from "@/types";

export interface Summary {
  total: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  presentPercent: number;
  latePercent: number;
  absentPercent: number;
}

export interface DayTrend {
  date: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  percent: number;
}

export interface CourseSummary {
  courseId: string;
  courseName: string;
  courseCode: string;
  presentPercent: number;
  studentCount: number;
}

export interface SubjectSummary {
  subjectId: string;
  subject: string;
  presentPercent: number;
  totalSessions: number;
}

export interface Defaulter {
  student: Student;
  currentPercent: number;
  sessionsNeeded: number;
  streak: number;
}

export interface PotentialAnomaly {
  type: "proxy-group" | "speed-scan" | "correlation";
  description: string;
  studentIds: string[];
  severity: "low" | "medium" | "high";
}

function isAttended(status: AttendanceRecord["status"]): boolean {
  return status === "present" || status === "late" || status === "half-day";
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getAttendanceSummary(
  records: AttendanceRecord[],
  _students: Student[]
): Summary {
  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const halfDay = records.filter((r) => r.status === "half-day").length;

  return {
    total,
    present,
    late,
    absent,
    halfDay,
    presentPercent: total ? Math.round((present / total) * 100) : 0,
    latePercent: total ? Math.round((late / total) * 100) : 0,
    absentPercent: total ? Math.round((absent / total) * 100) : 0,
  };
}

export function getWeeklyTrend(
  records: AttendanceRecord[],
  days: number = 7
): DayTrend[] {
  const result: DayTrend[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = dateOffset(i);
    const dayRecs = records.filter((r) => r.date === date);
    const presentCount = dayRecs.filter((r) => r.status === "present").length;
    const lateCount = dayRecs.filter((r) => r.status === "late").length;
    const absentCount = dayRecs.filter((r) => r.status === "absent").length;
    const attended = dayRecs.filter((r) => isAttended(r.status)).length;
    const percent =
      dayRecs.length === 0
        ? 0
        : Math.round((attended / dayRecs.length) * 100);

    result.push({
      date,
      presentCount,
      lateCount,
      absentCount,
      percent,
    });
  }

  return result;
}

export function getCoursewiseSummary(
  records: AttendanceRecord[],
  courses: Course[],
  students: Student[]
): CourseSummary[] {
  return courses.map((c) => {
    const courseRecs = records.filter((r) => r.courseId === c.id);
    const attended = courseRecs.filter((r) => isAttended(r.status)).length;
    const studentCount = students.filter(
      (s) => s.courseIds.includes(c.id) && s.isActive
    ).length;

    return {
      courseId: c.id,
      courseName: c.courseName,
      courseCode: c.courseCode,
      presentPercent:
        courseRecs.length === 0
          ? 0
          : Math.round((attended / courseRecs.length) * 100),
      studentCount,
    };
  });
}

export function getSubjectwiseSummary(
  records: AttendanceRecord[],
  courses: Course[]
): SubjectSummary[] {
  const subjectMap = new Map<
    string,
    { subject: string; attended: number; total: number; sessions: Set<string> }
  >();

  const nameLookup = new Map<string, string>();
  courses.forEach((c) =>
    c.schedule.forEach((s) => nameLookup.set(s.subjectId, s.subject))
  );

  records.forEach((r) => {
    const key = r.subjectId;
    const entry = subjectMap.get(key) ?? {
      subject: nameLookup.get(key) ?? key,
      attended: 0,
      total: 0,
      sessions: new Set<string>(),
    };
    entry.total++;
    if (isAttended(r.status)) entry.attended++;
    entry.sessions.add(`${r.courseId}_${r.date}`);
    subjectMap.set(key, entry);
  });

  return Array.from(subjectMap.entries()).map(([subjectId, v]) => ({
    subjectId,
    subject: v.subject,
    presentPercent:
      v.total === 0 ? 0 : Math.round((v.attended / v.total) * 100),
    totalSessions: v.sessions.size,
  }));
}

function consecutiveAbsenceStreak(
  records: AttendanceRecord[],
  studentId: string
): number {
  const dates = [
    ...new Set(
      records.filter((r) => r.studentId === studentId).map((r) => r.date)
    ),
  ].sort()
    .reverse();

  let streak = 0;
  for (const date of dates) {
    const dayRecs = records.filter(
      (r) => r.studentId === studentId && r.date === date
    );
    const allAbsent = dayRecs.every((r) => r.status === "absent");
    if (allAbsent && dayRecs.length > 0) streak++;
    else break;
  }
  return streak;
}

export function sessionsNeededToReachThreshold(
  currentPercent: number,
  totalSessions: number,
  attendedSessions: number,
  threshold: number
): number {
  if (currentPercent >= threshold) return 0;
  if (threshold >= 100) return 0;
  const t = threshold / 100;
  const needed = (t * totalSessions - attendedSessions) / (1 - t);
  return Math.max(0, Math.ceil(needed));
}

export function getDefaulters(
  records: AttendanceRecord[],
  students: Student[],
  threshold: number
): Defaulter[] {
  return students
    .filter((s) => s.isActive)
    .map((student) => {
      const studentRecs = records.filter((r) => r.studentId === student.id);
      const currentPercent = calculateAttendancePercent(records, student.id);
      const attended = studentRecs.filter((r) => isAttended(r.status)).length;

      return {
        student,
        currentPercent,
        sessionsNeeded: sessionsNeededToReachThreshold(
          currentPercent,
          studentRecs.length,
          attended,
          threshold
        ),
        streak: consecutiveAbsenceStreak(records, student.id),
      };
    })
    .filter((d) => d.currentPercent < threshold)
    .sort((a, b) => a.currentPercent - b.currentPercent);
}

export function getStudentTrend(
  records: AttendanceRecord[],
  studentId: string,
  days: number = 30
): DayTrend[] {
  const studentRecs = records.filter((r) => r.studentId === studentId);
  const result: DayTrend[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = dateOffset(i);
    const dayRecs = studentRecs.filter((r) => r.date === date);
    const presentCount = dayRecs.filter((r) => r.status === "present").length;
    const lateCount = dayRecs.filter((r) => r.status === "late").length;
    const absentCount = dayRecs.filter((r) => r.status === "absent").length;
    const attended = dayRecs.filter((r) => isAttended(r.status)).length;
    result.push({
      date,
      presentCount,
      lateCount,
      absentCount,
      percent:
        dayRecs.length === 0
          ? 0
          : Math.round((attended / dayRecs.length) * 100),
    });
  }

  return result;
}

export function getAnomalyData(
  records: AttendanceRecord[],
  students: Student[]
): PotentialAnomaly[] {
  const anomalies: PotentialAnomaly[] = [];
  const pairCounts = new Map<string, number>();

  const buckets = new Map<string, AttendanceRecord[]>();
  records.forEach((r) => {
    const key = `${r.courseId}_${r.subjectId}_${r.date}`;
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  });

  buckets.forEach((bucket) => {
    const sorted = [...bucket].sort(
      (a, b) =>
        new Date(a.markedAt).getTime() - new Date(b.markedAt).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const delta = Math.abs(
          new Date(a.markedAt).getTime() - new Date(b.markedAt).getTime()
        );
        if (delta <= 10000) {
          const ids = [a.studentId, b.studentId].sort();
          const key = ids.join("|");
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
  });

  pairCounts.forEach((count, key) => {
    if (count >= 3) {
      const studentIds = key.split("|");
      const names = studentIds
        .map((id) => students.find((s) => s.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      anomalies.push({
        type: "proxy-group",
        description: `${names} marked attendance within 10 seconds of each other ${count} times (possible proxy scanning)`,
        studentIds,
        severity: count >= 6 ? "high" : count >= 4 ? "medium" : "low",
      });
    }
  });

  const byStudent = new Map<string, number[]>();
  records.forEach((r) => {
    const mins =
      new Date(r.markedAt).getHours() * 60 +
      new Date(r.markedAt).getMinutes();
    const list = byStudent.get(r.studentId) ?? [];
    list.push(mins);
    byStudent.set(r.studentId, list);
  });

  const studentIds = [...byStudent.keys()];
  for (let i = 0; i < studentIds.length; i++) {
    for (let j = i + 1; j < studentIds.length; j++) {
      const a = byStudent.get(studentIds[i])!;
      const b = byStudent.get(studentIds[j])!;
      if (a.length < 5 || b.length < 5) continue;

      const minLen = Math.min(a.length, b.length);
      let matches = 0;
      for (let k = 0; k < minLen; k++) {
        if (Math.abs(a[k] - b[k]) <= 2) matches++;
      }
      const correlation = matches / minLen;
      if (correlation >= 0.95) {
        anomalies.push({
          type: "correlation",
          description: `Students show ${Math.round(correlation * 100)}% scan-time correlation (possible coordinated attendance)`,
          studentIds: [studentIds[i], studentIds[j]],
          severity: "high",
        });
      }
    }
  }

  const rapidScans = records.filter((r) => {
    const bucket = buckets.get(`${r.courseId}_${r.subjectId}_${r.date}`) ?? [];
    const sorted = bucket.sort(
      (a, b) =>
        new Date(a.markedAt).getTime() - new Date(b.markedAt).getTime()
    );
    const idx = sorted.findIndex((x) => x.id === r.id);
    if (idx <= 0) return false;
    const prev = sorted[idx - 1];
    return (
      new Date(r.markedAt).getTime() - new Date(prev.markedAt).getTime() < 3000
    );
  });

  if (rapidScans.length >= 5) {
    const ids = [...new Set(rapidScans.map((r) => r.studentId))];
    anomalies.push({
      type: "speed-scan",
      description: `${rapidScans.length} attendance marks occurred less than 3 seconds apart`,
      studentIds: ids,
      severity: "medium",
    });
  }

  return anomalies;
}

export function getBestWorstStudents(
  records: AttendanceRecord[],
  students: Student[],
  n: number = 5
): { best: Student[]; worst: Student[] } {
  const ranked = students
    .filter((s) => s.isActive)
    .map((s) => ({
      student: s,
      percent: calculateAttendancePercent(records, s.id),
    }))
    .sort((a, b) => b.percent - a.percent);

  return {
    best: ranked.slice(0, n).map((r) => r.student),
    worst: ranked.slice(-n).reverse().map((r) => r.student),
  };
}

export function generateAIInsights(
  summary: Summary,
  trends: DayTrend[],
  defaulters: Defaulter[],
  courseSummaries: CourseSummary[],
  subjectSummaries: SubjectSummary[]
): string {
  const trendLines = trends
    .map(
      (t) =>
        `${t.date}: ${t.percent}% attended (${t.presentCount} present, ${t.lateCount} late, ${t.absentCount} absent)`
    )
    .join("\n");

  const defaulterLines = defaulters
    .slice(0, 10)
    .map(
      (d) =>
        `${d.student.name} (${d.student.enrollmentNo}): ${d.currentPercent}%, needs ${d.sessionsNeeded} more sessions, ${d.streak} day absence streak`
    )
    .join("\n");

  const courseLines = courseSummaries
    .map((c) => `${c.courseCode} ${c.courseName}: ${c.presentPercent}% (${c.studentCount} students)`)
    .join("\n");

  const subjectLines = subjectSummaries
    .map((s) => `${s.subject}: ${s.presentPercent}% over ${s.totalSessions} sessions`)
    .join("\n");

  return `You are an expert university attendance analyst. Analyze this real attendance data and provide 4-5 actionable insights in markdown format.

Use this exact structure for EACH insight:
### [Emoji] Title
**Severity:** low|medium|high
Description sentence with specific numbers.

DATA SUMMARY:
- Total records: ${summary.total}
- Present: ${summary.present} (${summary.presentPercent}%)
- Late: ${summary.late} (${summary.latePercent}%)
- Absent: ${summary.absent} (${summary.absentPercent}%)
- Half-day: ${summary.halfDay}

WEEKLY TREND:
${trendLines}

COURSE PERFORMANCE:
${courseLines}

SUBJECT/PAPER PERFORMANCE:
${subjectLines}

DEFAULTERS (below university minimum attendance norm):
${defaulterLines || "None"}

Provide insights about patterns, risks, and recommendations for faculty and administrators. Use university terminology (course, faculty, enrollment number, batch). Be specific with percentages and day names.`;
}
