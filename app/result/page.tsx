"use client";

import { ArrowLeft, Copy, Download, FileText, Share2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";

type ResultPayload = {
  targetCompany?: string;
  targetRole?: string;
  resumeText?: string;
  optimizedResume?: string;
  analysis?: {
    currentScore?: number;
    optimizedScore?: number;
    recommendation?: string;
  };
};

function decodePayload(data: string | null): ResultPayload | null {
  if (!data) return null;

  try {
    const base64 = decodeURIComponent(data);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as ResultPayload;
  } catch {
    return null;
  }
}

function readStoredPayload(id: string | null) {
  if (!id) return null;

  try {
    const rawPayload = window.sessionStorage.getItem(`jdalign-result-${id}`);
    return rawPayload ? (JSON.parse(rawPayload) as ResultPayload) : null;
  } catch {
    return null;
  }
}

const resumeSectionHeadings = new Set(["个人简介", "个人总结", "核心技能", "专业技能", "技能", "工作经历", "项目经历", "教育经历", "实习经历", "校园经历", "证书", "补充建议"]);
const projectLabelPattern = /^(\s*[-•]?\s*)(项目背景|需求分析|产品规划|数据准备|方案设计|测试验证|测试迭代与优化|测试迭代|测试优化|工程护栏|运营优化|协作推进|售前支持|落地成果|落地成效|场景泛化)([：:])(\s*.*)$/;

function normalizeText(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function normalizeLine(line: string) {
  return normalizeText(line.replace(/^[\s\-•]+/, ""));
}

function shouldHighlightShortAddition(line: string, originalText: string) {
  const normalized = normalizeLine(line);
  if (!normalized || normalized.length > 34) return false;
  if (originalText.includes(normalized)) return false;
  return /^(求职方向|版本标记|目标公司|售前支持|转型尝试版)|[：:]/.test(normalized);
}

function HighlightedResume({ originalText, optimizedText }: { originalText: string; optimizedText: string }) {
  const normalizedOriginal = useMemo(() => normalizeText(originalText), [originalText]);
  const lines = optimizedText.split("\n");

  return (
    <article className="resume-doc compare-doc">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const normalizedLine = normalizeLine(line);
        const labelMatch = line.match(projectLabelPattern);
        const headingIsNew = resumeSectionHeadings.has(trimmed) && !normalizedOriginal.includes(normalizedLine);
        const shortAddition = shouldHighlightShortAddition(line, normalizedOriginal);

        return (
          <Fragment key={`${line}-${index}`}>
            {labelMatch ? (
              <span>
                {labelMatch[1]}
                {!normalizedOriginal.includes(normalizeText(labelMatch[2])) ? (
                  <mark className="diff-mark">
                    <strong className="resume-key-label">{labelMatch[2]}</strong>
                  </mark>
                ) : (
                  <strong className="resume-key-label">{labelMatch[2]}</strong>
                )}
                {labelMatch[3]}
                {labelMatch[4]}
              </span>
            ) : headingIsNew || shortAddition ? (
              <mark className="diff-mark">{line || " "}</mark>
            ) : (
              <span>{line || " "}</span>
            )}
            {index < lines.length - 1 ? "\n" : null}
          </Fragment>
        );
      })}
    </article>
  );
}

async function downloadDocx(resumeText: string) {
  const response = await fetch("/api/docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText }),
  });

  const blob = response.ok ? await response.blob() : new Blob([resumeText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = response.ok ? "JDAlign优化版简历.docx" : "JDAlign优化版简历.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ResultPage() {
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [payload, setPayload] = useState<ResultPayload | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPayload(readStoredPayload(params.get("id")) || decodePayload(params.get("data")));
    setHasLoaded(true);
  }, []);

  const originalText = payload?.resumeText || "";
  const optimizedText = payload?.optimizedResume || "";

  async function copyResume() {
    await navigator.clipboard.writeText(optimizedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1600);
  }

  return (
    <main className="app-shell result-page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">J</div>
          <div>
            <h1 className="brand-title">JDAlign</h1>
            <p className="brand-subtitle">帮你把简历和 JD 对齐，修改成 HR 想要的模样</p>
          </div>
        </div>
        <div className="result-summary">
          <span>{payload?.targetCompany || "目标公司"}</span>
          <span>/</span>
          <span>{payload?.targetRole || "目标岗位"}</span>
          <strong>{payload?.analysis?.currentScore ?? "-"} → {payload?.analysis?.optimizedScore ?? "-"}</strong>
        </div>
        <div className="top-actions">
          <Link className="button secondary" href="/">
            <ArrowLeft size={16} />
            返回工作台
          </Link>
          <button className="button primary" type="button" onClick={copyResume} disabled={!optimizedText}>
            <Copy size={16} />
            {copied ? "已复制" : "复制优化版"}
          </button>
          <button className="button secondary" type="button" onClick={() => downloadDocx(optimizedText)} disabled={!optimizedText}>
            <Download size={16} />
            下载 Word
          </button>
          <button className="button secondary" type="button" onClick={copyShareLink} disabled={!optimizedText}>
            <Share2 size={16} />
            {shareCopied ? "已复制" : "分享"}
          </button>
        </div>
      </header>

      <section className="result-hero">
        <div>
          <p className="eyebrow">优化版完整简历</p>
          <h2>左侧看原始简历，右侧看 JDAlign 改后的版本</h2>
          <div className="diff-legend">
            <span className="legend-swatch" />
            黄色标记代表新增或明显改写内容
          </div>
        </div>
        <p>{payload?.analysis?.recommendation || "黄色高亮表示相对原简历新增或明显改写的内容，建议投递前再人工确认真实性。"}</p>
      </section>

      {!hasLoaded ? (
        <section className="panel result-empty">
          <div className="empty-state">
            <FileText size={34} color="#1d4ed8" />
            <h2>正在读取生成结果</h2>
            <p>请稍候，系统正在加载本次优化版简历。</p>
          </div>
        </section>
      ) : optimizedText ? (
        <section className="compare-grid">
          <section className="panel compare-panel">
            <div className="panel-header">
              <div className="panel-title-row">
                <FileText size={17} color="#475569" />
                <h2 className="panel-title">原始简历</h2>
              </div>
            </div>
            <div className="panel-body">
              <article className="resume-doc compare-doc">{originalText}</article>
            </div>
          </section>

          <section className="panel compare-panel">
            <div className="panel-header">
              <div className="panel-title-row">
                <FileText size={17} color="#1d4ed8" />
                <h2 className="panel-title">优化版简历</h2>
              </div>
            </div>
            <div className="panel-body">
              <HighlightedResume originalText={originalText} optimizedText={optimizedText} />
            </div>
          </section>
        </section>
      ) : (
        <section className="panel result-empty">
          <div className="empty-state">
            <FileText size={34} color="#1d4ed8" />
            <h2>没有读取到本次生成结果</h2>
            <p>可能是页面被刷新、浏览器会话过期，或旧链接内容过长。请返回工作台重新生成一次。</p>
          </div>
        </section>
      )}
    </main>
  );
}
