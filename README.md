# Smart Attendance Management System

AI-powered, dynamic-QR + face-recognition attendance system built with Next.js 16, TypeScript and Tailwind CSS. The entire app runs against `localStorage` (mirrored to a server-side JSON store for API routes) so it works as a full demo without any database setup.

## Features

- **Three role dashboards** — Admin, Teacher, Student. Cookie-based session protection via middleware.
- **Dynamic, HMAC-signed QR codes** that rotate every 60 seconds. A student scans on their phone, the QR is validated, and a face match + liveness check completes the attendance.
- **Face recognition** with `face-api.js` (SSD Mobilenet + 68-landmark model + recognition model). Liveness via blink, head turn, and smile detection.
- **Live session feed** for teachers — see students mark in real time, then auto-mark the rest absent on session end.
- **Manual attendance** mode with class roster, P/L/A/H radios, mark-all shortcuts and live counters.
- **CSV import/export** with column mapping, duplicate detection and progress UI (`papaparse`).
- **Analytics** with date-range filters, weekly trend, class-wise / subject-wise charts, defaulter list (with classes-needed math), anomaly detection, and AI insights (OpenAI).
- **AI chatbot (`SAS-Bot`)** that streams answers from GPT-4o-mini and reads the live attendance roster — knows who is absent today, late, and below the threshold.
- **Reports** for both admin and teacher with print stylesheet and CSV export (proper escaping + UTF-8 BOM).
- **Settings**: school name + logo, attendance thresholds, QR expiry, face match threshold, geo-fencing, OpenAI API key + model, theme toggle (dark/light), data export/import, demo reset.
- **Notifications panel** in the header (defaulters, live sessions, anomalies — scoped to the current role).

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
NEXT_PUBLIC_APP_NAME=Smart Attendance System
NEXT_PUBLIC_SCHOOL_NAME=Greenfield International Academy
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

Demo data is seeded into `localStorage` automatically on first load.

| Role    | Email                       | Password   |
| ------- | --------------------------- | ---------- |
| Admin   | `admin@sas.com`             | `admin123` |
| Teacher | `sharma@sas.com`            | `teacher123` |
| Student | `10a001@sas.student.com`    | `10A001`   |

## Routes

- `/login` — role-tabbed sign in
- `/admin` — dashboard, students, classes, mark-attendance, analytics, reports, settings
- `/teacher` — dashboard, mark-attendance, my-classes, reports
- `/student` — attendance overview, schedule
- `/scan` — mobile-first QR scan + face verification flow

## Build

```bash
npm run build
npm start
```

## Notes

- All client data lives in `localStorage` under `sas_*` keys (`lib/storage.ts`).
- API routes mirror the client snapshot to `data/sas-store.json` (gitignored) so HMAC validation, AI insights and the chatbot can read live data server-side.
- The `data/` directory and all `.env*` files are gitignored — never commit them.
- If you accidentally exposed an OpenAI key while developing, rotate it at https://platform.openai.com/api-keys.

## License

MIT
