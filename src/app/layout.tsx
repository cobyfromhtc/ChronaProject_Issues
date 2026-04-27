import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthFetchProvider } from "@/components/auth-fetch-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chrona - Roleplay Universe",
  description: "Immersive roleplay universe with personas, storylines, and real-time chat.",
  keywords: ["Chrona", "roleplay", "storylines", "personas", "chat", "creative writing"],
  authors: [{ name: "Chrona Team" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "Chrona - Roleplay Universe",
    description: "Immersive roleplay universe with personas, storylines, and real-time chat",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chrona - Roleplay Universe",
    description: "Immersive roleplay universe with personas, storylines, and real-time chat",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark theme-dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('chrona-theme');
                  var theme = stored || 'dark';
                  var root = document.documentElement;
                  root.classList.remove('theme-dark', 'theme-midnight', 'theme-forest', 'theme-light', 'dark');
                  root.classList.add('theme-' + theme);
                  if (theme !== 'light') root.classList.add('dark');
                } catch(e) {}
                try {
                  var uiStored = localStorage.getItem('chrona-ui-variant');
                  var uiVariant = uiStored || 'chrona';
                  var validVariants = ['chrona', 'chrona-v2', 'chrona-v3', 'horizon', 'pulse', 'nexus'];
                  // Migrate old variants
                  if (validVariants.indexOf(uiVariant) === -1) {
                    uiVariant = 'chrona';
                    localStorage.setItem('chrona-ui-variant', 'chrona');
                  }
                  root.classList.remove('ui-chrona', 'ui-chrona-v2', 'ui-chrona-v3', 'ui-horizon', 'ui-pulse', 'ui-nexus', 'ui-minimal', 'ui-bold', 'ui-elegant', 'ui-neon-cyber', 'ui-aurora', 'ui-retro-terminal');
                  root.classList.add('ui-' + uiVariant);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <AuthFetchProvider>
          {children}
        </AuthFetchProvider>
        <Toaster />
      </body>
    </html>
  );
}
