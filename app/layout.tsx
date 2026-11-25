import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./motion.css";
import "katex/dist/katex.min.css";
import { Providers } from "./providers";
import MixpanelInitializer from "./MixpanelInitializer";
import { Toaster } from "@/components/ui/sonner";
import { NavigationProgress } from "@/components/ui/navigation-progress";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://presenton.ai"),
  title: "Pixa, by Framewrk - AI presentation generator",
  description:
    "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export.",
  keywords: [
    "AI presentation generator",
    "data storytelling",
    "data visualization tool",
    "AI data presentation",
    "presentation generator",
    "data to presentation",
    "interactive presentations",
    "professional slides",
  ],
  openGraph: {
    title: "Pixa, by Framewrk - AI presentation generator",
    description:
      "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export.",
    url: "https://presenton.ai",
    siteName: "Pixa, by Framewrk",
    images: [
      {
        url: "/mainlogo.png",
        width: 1200,
        height: 630,
        alt: "Pixa, by Framewrk Logo",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  alternates: {
    canonical: "https://presenton.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pixa, by Framewrk - AI presentation generator",
    description:
      "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export.",
    images: ["/mainlogo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground transition-colors duration-200">
        <NavigationProgress />
        <Providers>
          <MixpanelInitializer>

            {children}

          </MixpanelInitializer>
        </Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
