"use client";

import { Download, FileText, LockKeyhole, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

type SharedAnalysis = {
  currentScore?: number;
  optimizedScore?: number;
  recommendation?: string;
};

type SharedPayload = {
  targetCompany?: string;
  targetRole?: string;
  optimizedResume?: string;
  analysis?: SharedAnalysis;
  createdAt?: string;
};

function decodePayload(data: string | null): SharedPayload | null {
  if (!data) return null;

  try {
    return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(data))))) as SharedPayload;
  } catch {
    return null;
  }
}

function hideContact(text: string) {
  return text
    .replace(/1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/g, "手机号已隐藏")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "邮箱已隐藏");
}

export default function SharedResultPage() {
  const payload = useMemo(() => {
    if (typeof window === "undefined") return null;
    return decodePayload(new URLSearchParams(window.location.search).get("data"));
  }, []);

  const resumeText = hideContact(payload?.optimizedResume || "");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Share2 size={20} />
          </div>
          <div>
            <h1 className="brand-title">简历优化结果分享</h1>
            <p className="brand-subtitle">联系方式默认隐藏，适合发给朋友查看。</p>
          </div>
        </div>
        <div className="top-actions">
          <Link className="button secondary" href="/">
            返回工作台
          </Link>
        </div>
      </header>

      <section className="workspace" style={{ gridTemplateColumns: "minmax(0, 1fr) 340px" }}>
        <section className="column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <FileText size={17} color="#1d4ed8" />
                  <h2 className="panel-title">优化版简历</h2>
                </div>
                <p className="panel-kicker">
                  {payload?.targetCompany || "目标公司"} / {payload?.targetRole || "目标岗位"}
                </p>
              </div>
            </div>
            <div className="panel-body">
              {resumeText ? (
                <article className="resume-doc">{resumeText}</article>
              ) : (
                <div className="empty-state">
                  <FileText size={34} color="#1d4ed8" />
                  <h2>分享内容不可用</h2>
                  <p>这个分享链接没有包含有效结果，请回到工作台重新生成并分享。</p>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <ShieldCheck size={17} color="#059669" />
                  <h2 className="panel-title">匹配摘要</h2>
                </div>
                <p className="panel-kicker">分享页仅展示生成结果，不公开原始文件。</p>
              </div>
            </div>
            <div className="panel-body stack">
              <div className="score-comparison">
                <div className="mini-score">
                  <div className="mini-score-label">当前匹配度</div>
                  <div className="mini-score-value">{payload?.analysis?.currentScore ?? "-"}</div>
                </div>
                <div className="mini-score">
                  <div className="mini-score-label">优化后预计</div>
                  <div className="mini-score-value">{payload?.analysis?.optimizedScore ?? "-"}</div>
                </div>
              </div>
              <div className="callout success">{payload?.analysis?.recommendation || "建议结合真实经历继续完善后投递。"}</div>
              <div className="privacy-note">
                <LockKeyhole size={15} />
                <span>分享结果已隐藏手机号和邮箱。请不要把包含隐私的原始文件直接发给陌生人。</span>
              </div>
              <button className="button secondary full" type="button" disabled>
                <Download size={16} />
                下载请回到工作台
              </button>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
