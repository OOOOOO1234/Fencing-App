import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabre Stats",
  description: "Upload a sabre bout and see how often each action worked.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
