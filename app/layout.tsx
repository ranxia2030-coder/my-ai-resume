import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 简历 ATS 优化工作台",
  description: "上传简历和目标 JD，生成匹配评分、关键差距和优化版简历。",
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
