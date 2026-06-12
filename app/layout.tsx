import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JDAlign",
  description: "帮你把简历和 JD 对齐，修改成 HR 想要的模样。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
