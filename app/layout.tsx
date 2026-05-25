import type { Metadata, Viewport } from "next";
import { Inter, Syne } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { SeedProvider } from "@/components/providers/SeedProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Campus Attendance System",
  description:
    "AI-powered attendance for modern universities — face recognition, dynamic QR, course analytics.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

const themeBootstrap = `(function(){try{var s=localStorage.getItem("sas_settings");var t="dark";if(s){var p=JSON.parse(s);if(p&&(p.theme==="light"||p.theme==="dark"))t=p.theme;}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${syne.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full bg-[var(--background)] font-sans text-[var(--foreground)] antialiased">
        <SeedProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#12121a",
                color: "#f8fafc",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#818cf8", secondary: "#12121a" },
              },
              error: {
                iconTheme: { primary: "#f87171", secondary: "#12121a" },
              },
            }}
          />
        </SeedProvider>
      </body>
    </html>
  );
}
