import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext"; // Import AuthProvider
import ServiceWorkerRegistration from "./_components/ServiceWorkerRegistration";
import PushNotificationProvider from "./_components/PushNotificationProvider";
import PushPermissionPrompt from "./_components/PushPermissionPrompt";
import { ToastProvider } from "@/components/toast/ToastProvider";

const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-body",
});

const plusJakartaSans = localFont({
  src: "./fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-headline",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
  themeColor: "#f5f7f9",
};

const DESCRIPTION =
  "An AI agent checks each expense claim against policy, pays clean low-risk claims to the employee's PayPal in seconds, and sends everything else to HR with the evidence. Automation where it's safe, judgment where it matters.";

export const metadata: Metadata = {
  title: "Reclaim Pay",
  description: DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reclaim Pay",
  },
  icons: {
    icon: "/images/logo.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Reclaim Pay",
    description: DESCRIPTION,
    images: [
      {
        url: "/images/logo.svg",
        width: 800,
        height: 600,
        alt: "Reclaim Pay logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reclaim Pay",
    description: DESCRIPTION,
    images: ["/images/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthProvider>
            <PushNotificationProvider>
              {children}
              <PushPermissionPrompt />
              <ServiceWorkerRegistration />
            </PushNotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
