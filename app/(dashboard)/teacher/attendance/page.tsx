import { redirect } from "next/navigation";

export default function TeacherAttendanceRedirect() {
  redirect("/teacher/mark-attendance");
}
