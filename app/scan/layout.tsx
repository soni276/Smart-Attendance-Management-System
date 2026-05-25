import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Mark Attendance | Campus Attendance System",
  description: "Mark your attendance by scanning the lecture QR code",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0f",
  viewportFit: "cover",
};

export default function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white antialiased">
      {children}
    </div>
  );
}
