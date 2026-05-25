# Campus Attendance System

AI-powered, dynamic-QR + face-recognition attendance system for colleges and universities, built with Next.js 16, TypeScript and Tailwind CSS. The entire app runs against `localStorage` (mirrored to a server-side JSON store for API routes) so it works as a full demo without any database setup.

## Features

- **Three role dashboards** — Administrator, Faculty, Student. Cookie-based session protection via middleware.
- **Dynamic, HMAC-signed QR codes** that rotate every 60 seconds. A student scans on their phone, the QR is validated, and a face match + liveness check completes the attendance.
- **Face recognition** with `face-api.js` (SSD Mobilenet + 68-landmark model + recognition model). Liveness via blink, head turn, and smile detection.
- **Live session feed** for faculty — see students mark in real time, then auto-mark the rest absent on session end.
- **Manual attendance** mode with course roster, P/L/A/H radios, mark-all shortcuts and live counters.
- **CSV import/export** with column mapping, duplicate detection and progress UI (`papaparse`).
- **Analytics** with date-range filters, weekly trend, course-wise / subject-wise charts, defaulter list (with sessions-needed math), anomaly detection, and AI insights (OpenAI).
- **AI chatbot (`CampusBot`)** that streams answers from GPT-4o-mini and reads the live attendance roster — knows who is absent today, late, and below the university norm.
- **Reports** for both admin and faculty with print stylesheet and CSV export (proper escaping + UTF-8 BOM).
- **Settings**: institution name + logo, academic year, current semester, attendance thresholds, QR expiry, face match threshold, geo-fencing, OpenAI API key + model, theme toggle (dark/light), data export/import, demo reset.
- **Notifications panel** in the header (defaulters, live sessions, anomalies — scoped to the current role).

## College data model

- **Course** — `courseCode`, `courseName`, `department`, `semester`, `batch`, `credits`, `facultyId`, `studentIds`, schedule with rooms.
- **Faculty** — `name`, `employeeId`, `designation` (Assistant Professor / Associate Professor / Professor), `department`, `specialisation`, `courseIds`.
- **Student** — `name`, `enrollmentNo`, `department`, `semester`, `batch`, `courseIds`.

## Tech stack

- Next.js 16.2 (App Router, Turbopack)
- React 19, TypeScript 5
- Tailwind CSS v4
- Framer Motion
- face-api.js (TensorFlow.js)
- OpenAI Node SDK (`responses.stream`)
- Recharts
- react-hot-toast
- crypto-js (HMAC-SHA256 for QR signing)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file and fill in your own values:

```bash
cp .env.example .env.local
```

Required:

```bash
OPENAI_API_KEY=sk-...                  # Optional — settings UI also lets you paste a key
NEXT_PUBLIC_QR_SECRET=replace-me        # HMAC secret for QR codes
```

Optional defaults:

```bash
NEXT_PUBLIC_APP_NAME=Campus Attendance System
NEXT_PUBLIC_INSTITUTION_NAME=Greenfield Institute of Technology
NEXT_PUBLIC_QR_EXPIRY_SECONDS=60
NEXT_PUBLIC_GEO_LAT=28.6139
NEXT_PUBLIC_GEO_LNG=77.2090
NEXT_PUBLIC_GEO_RADIUS_METERS=200
```

### 3. Download face-api.js model weights

Place the following files inside `public/models/`:

- `ssd_mobilenetv1_model-weights_manifest.json` + shard files
- `face_landmark_68_model-weights_manifest.json` + shard files
- `face_recognition_model-weights_manifest.json` + shard files

See [`public/models/README.md`](public/models/README.md) for direct download links.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo credentials

Demo data is seeded into `localStorage` automatically on first load (Greenfield Institute of Technology — 6 faculty, 6 courses, 120 students).

| Role          | Email                            | Password      |
| ------------- | -------------------------------- | ------------- |
| Administrator | `admin@git.edu.in`               | `admin123`    |
| Faculty       | `rajesh.sharma@git.edu.in`       | `faculty123`  |
| Student       | `cse22001@git.edu.in`            | `CSE22001`    |

> Tip: each student's password is their enrollment number (case-sensitive).

## Routes

- `/login` — role-tabbed sign in (Administrator / Faculty / Student)
- `/admin` — dashboard, students, faculty, courses, take-attendance, analytics, reports, settings
- `/faculty` — dashboard, take-attendance, my-courses, reports
- `/student` — attendance overview, timetable
- `/scan` — mobile-first QR scan + face verification flow

## Build

```bash
npm run build
npm start
```

## Notes

- All client data lives in `localStorage` under `sas_*` keys (`lib/storage.ts`). When upgrading from the old "school" version, legacy keys are automatically wiped on first load and the new college seed runs.
- API routes mirror the client snapshot to `data/sas-store.json` (gitignored) so HMAC validation, AI insights and the chatbot can read live data server-side.
- The `data/` directory and all `.env*` files are gitignored — never commit them.
- If you accidentally exposed an OpenAI key while developing, rotate it at https://platform.openai.com/api-keys.

## License

MIT
