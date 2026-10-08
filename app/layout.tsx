import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";
import { NavShell } from "@/components/NavShell";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Fadeke's Job Desk",
  description: "Private remote VA job search, application kits and tracker",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F2B705",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${display.variable} ${body.variable} min-h-screen font-sans antialiased`}>
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}
