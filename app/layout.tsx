import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Ticket Word Network",
  description:
    "Client-side word co-occurrence network explorer for IT tickets — upload a CSV, see problem groupings, drill into incidents.",
};

/**
 * Applied before paint so there is no theme flash. Respects a stored choice,
 * falls back to the OS preference.
 */
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored === "dark" ||
      (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
