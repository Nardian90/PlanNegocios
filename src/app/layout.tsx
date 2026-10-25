import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PLANEX Cuba — Plan de Negocios de Inversión Extranjera",
  description:
    "Aplicación local para elaborar planes de negocios de propuestas con inversión extranjera conforme a las Bases Metodológicas GOC-2026-O57: motor de cálculo configurable, exportación PDF y Excel con fórmulas reales, e intercambio de proyectos por JSON.",
  keywords: ["PLANEX", "Cuba", "inversión extranjera", "plan de negocios", "GOC-2026-O57", "Ley 118"],
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="planex.tema">
          {children}
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
