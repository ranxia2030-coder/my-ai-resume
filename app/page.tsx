"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  FileText,
  LockKeyhole,
  ScanText,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserCircle,
} from "lucide-react";
import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from "react";

type Stage = "input" | "analysis";
type Severity = "high" | "medium";
type Priority = "high" | "medium" | "quick";

type Dimension = {
  label: string;
  value: number;
};

type Issue = {
  title: string;
  text: string;
  severity: Severity;
};

type Task = {
  priority: Priority;
  title: string;
  text: string;
};

type Question = {
  id: string;
  title: string;
  reason: string;
  type?: "role";
};

type Analysis = {
  currentScore: number;
  optimizedScore: number;
  scoreLabel: string;
  recommendation: string;
  isTransition: boolean;
  dimensions: Dimension[];
  matchedKeywords: string[];
  missingKeywords: string[];
  lowRelevanceKeywords: string[];
  issues: Issue[];
  tasks: Task[];
  questions: Question[];
};

type AnalyzeResponse = {
  source?: "ai";
  model?: string;
  notice?: string;
  analysis?: Analysis;
  optimizedResume?: string;
  error?: string;
};

type ParseResponse = {
  text?: string;
  error?: string;
};

type FormValues = {
  resumeText: string;
  jdText: string;
  targetCompany: string;
  targetRole: string;
  answers: Record<string, string>;
};

type ResultPayload = {
  targetCompany: string;
  targetRole: string;
  resumeText: string;
  jdText: string;
  analysis: Analysis;
  optimizedResume: string;
  createdAt: string;
};

const defaultQuestions: Question[] = [
  {
    id: "ai",
    title: "你是否做过 AI、大模型、自动化工具、智能客服、智能助手相关项目？",
    reason: "该 JD 高度强调 AI 产品经验，如果你有相近经历，补充后能明显提升岗位相关性。",
  },
  {
    id: "data",
    title: "你是否使用过 SQL、Excel、BI 工具、数据看板做过分析？",
    reason: "数据分析是该岗位的高权重要求，系统不会在未确认的情况下把 SQL 写入技能栏。",
  },
  {
    id: "b2b",
    title: "你是否参与过 B 端系统、SaaS 产品、企业后台、管理平台类项目？",
    reason: "如果有企业后台或内部效率工具经验，可以转译成更贴近 JD 的表达。",
  },
  {
    id: "metric",
    title: "你有没有可以量化的结果，例如效率提升、转化率提升、成本下降、用户增长？",
    reason: "量化结果会让优化版简历更可信，也能增强 ATS 和 HR 对成果的识别。",
  },
  {
    id: "role",
    title: "在最相关的项目中，你的责任强度是什么？",
    reason: "系统不会把“协助”写成“主导”，需要根据你的真实角色决定表达强度。",
    type: "role",
  },
];

const roleOptions = ["主导", "负责模块", "协助参与"];

function getColor(value: number) {
  if (value >= 80) return "#059669";
  if (value >= 65) return "#d97706";
  return "#dc2626";
}

const emptyAnalysis: Analysis = {
  currentScore: 0,
  optimizedScore: 0,
  scoreLabel: "等待评分",
  recommendation: "请上传简历和 JD 后生成匹配诊断",
  isTransition: false,
  dimensions: [
    { label: "JD 关键词覆盖", value: 0 },
    { label: "工作/项目经历相关性", value: 0 },
    { label: "技能匹配度", value: 0 },
    { label: "ATS 格式友好度", value: 0 },
    { label: "年限/硬性门槛匹配", value: 0 },
  ],
  matchedKeywords: [],
  missingKeywords: [],
  lowRelevanceKeywords: [],
  issues: [],
  tasks: [],
  questions: defaultQuestions,
};

export default function Home() {
  const [stage, setStage] = useState<Stage>("input");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [fileName, setFileName] = useState("");
  const [jdFileName, setJdFileName] = useState("");
  const [resumeParseStatus, setResumeParseStatus] = useState("支持 PDF、DOCX、TXT、PNG、JPG。图片会自动 OCR 识别。");
  const [jdParseStatus, setJdParseStatus] = useState("支持粘贴 JD，也支持上传 JD 截图做 OCR。");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isParsingJd, setIsParsingJd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(emptyAnalysis);
  const [resultNotice, setResultNotice] = useState("当前还未调用模型。请上传简历和 JD 后生成匹配评分。");
  const [resultSource, setResultSource] = useState<"pending" | "ai" | "error">("pending");
  const [answers, setAnswers] = useState<Record<string, string>>({
    role: "负责模块",
  });
  const [saved, setSaved] = useState(false);
  const autoAnalysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoAnalysisKeyRef = useRef("");

  async function parseFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/parse-resume", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json().catch(() => ({}))) as ParseResponse;

    if (!response.ok || !data.text) {
      throw new Error(data.error || "文件解析失败，请直接粘贴文本。");
    }

    return data.text;
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsParsingResume(true);
    setResumeParseStatus(file.type.startsWith("image/") ? "正在 OCR 识别简历图片..." : "正在解析简历文件...");

    try {
      const text = await parseFile(file);
      setResumeText(text);
      setResumeParseStatus(`已解析 ${file.name}，请检查文本是否准确。`);
      markInputsChanged();
      const nextValues = { resumeText: text, jdText, targetCompany, targetRole, answers };
      if (text.trim().length >= 20 && jdText.trim().length >= 20) {
        void runAnalysis(nextValues, "auto");
      }
    } catch (error) {
      setResumeParseStatus(error instanceof Error ? error.message : "简历解析失败，请直接粘贴文本。");
      markInputsChanged();
    } finally {
      setIsParsingResume(false);
    }
  }

  async function handleJdFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setJdFileName(file.name);
    setIsParsingJd(true);
    setJdParseStatus(file.type.startsWith("image/") ? "正在 OCR 识别 JD 图片..." : "正在解析 JD 文件...");

    try {
      const text = await parseFile(file);
      setJdText(text);
      setJdParseStatus(`已解析 ${file.name}，请检查 JD 文本是否完整。`);
      markInputsChanged();
      const nextValues = { resumeText, jdText: text, targetCompany, targetRole, answers };
      if (resumeText.trim().length >= 20 && text.trim().length >= 20) {
        void runAnalysis(nextValues, "auto");
      }
    } catch (error) {
      setJdParseStatus(error instanceof Error ? error.message : "JD 解析失败，请直接粘贴文本。");
      markInputsChanged();
    } finally {
      setIsParsingJd(false);
    }
  }

  function readFieldValue(id: string) {
    const element = document.getElementById(id);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    return "";
  }

  function getCurrentFormValues(nextAnswers = answers): FormValues {
    const latestResumeText = readFieldValue("resumeText") || resumeText;
    const latestJdText = readFieldValue("jdText") || jdText;
    const latestTargetCompany = readFieldValue("company") || targetCompany;
    const latestTargetRole = readFieldValue("role") || targetRole;

    if (latestResumeText !== resumeText) setResumeText(latestResumeText);
    if (latestJdText !== jdText) setJdText(latestJdText);
    if (latestTargetCompany !== targetCompany) setTargetCompany(latestTargetCompany);
    if (latestTargetRole !== targetRole) setTargetRole(latestTargetRole);

    return {
      resumeText: latestResumeText,
      jdText: latestJdText,
      targetCompany: latestTargetCompany,
      targetRole: latestTargetRole,
      answers: nextAnswers,
    };
  }

  async function callAnalyzeApi(mode: "analysis" | "generate", values: FormValues) {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode,
        resumeText: values.resumeText,
        jdText: values.jdText,
        targetCompany: values.targetCompany,
        targetRole: values.targetRole,
        answers: values.answers,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as AnalyzeResponse;

    if (!response.ok) {
      throw new Error(data.error || `请求失败：${response.status}`);
    }

    return data;
  }

  function markInputsChanged() {
    setResultSource("pending");
    setResultNotice("输入内容已修改，系统会在简历和 JD 都完整后自动刷新匹配评分。");
  }

  function saveDraft() {
    const draft = {
      targetCompany,
      targetRole,
      resumeText,
      jdText,
      answers,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem("resume-ai-draft", JSON.stringify(draft));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function buildAnalysisKey(values: FormValues) {
    return JSON.stringify({
      resumeText: values.resumeText.trim(),
      jdText: values.jdText.trim(),
      targetCompany: values.targetCompany.trim(),
      targetRole: values.targetRole.trim(),
    });
  }

  async function runAnalysis(values: FormValues, trigger: "auto" | "manual") {
    if (isParsingResume || isParsingJd || isLoading) return;
    if (!values.resumeText.trim() || !values.jdText.trim()) {
      setStage("input");
      setResultSource("pending");
      setResultNotice("请先上传或粘贴简历和目标岗位 JD，再生成匹配评分。");
      if (!values.resumeText.trim()) {
        setResumeParseStatus("还没有简历文本。请上传 PDF/DOCX/TXT，或直接粘贴简历全文。");
      }
      if (!values.jdText.trim()) {
        setJdParseStatus("还没有 JD 文本。请上传 PDF/DOCX/TXT，或直接粘贴岗位描述。");
      }
      return;
    }
    lastAutoAnalysisKeyRef.current = buildAnalysisKey(values);
    setIsLoading(true);
    setStage("analysis");
    setResultNotice(trigger === "auto" ? "已检测到简历和 JD，正在自动生成匹配诊断。" : "正在请求模型生成匹配诊断。");

    try {
      const data = await callAnalyzeApi("analysis", values);
      if (!data.analysis) {
        throw new Error("模型没有返回匹配诊断结果");
      }
      setAnalysis(data.analysis);
      setResultSource("ai");
      setResultNotice(`已使用真实模型生成诊断结果：${data.model || "当前模型"}。`);
    } catch (error) {
      setAnalysis(emptyAnalysis);
      setResultSource("error");
      setResultNotice(error instanceof Error ? `AI 模型暂时无法使用，无法生成匹配评分：${error.message}` : "AI 模型暂时无法使用，无法生成匹配评分。");
    } finally {
      setIsLoading(false);
    }
  }

  async function startAnalysis() {
    const values = getCurrentFormValues();
    await runAnalysis(values, "manual");
  }

  async function generateResume() {
    if (isLoading) return;
    const values = getCurrentFormValues();
    setIsLoading(true);
    setResultNotice("正在生成优化版完整简历。系统会遵守不编造经历的边界。");

    try {
      const data = await callAnalyzeApi("generate", values);
      if (!data.analysis || !data.optimizedResume) {
        throw new Error("模型没有返回可用的优化版简历");
      }
      setAnalysis(data.analysis);
      const nextAnalysis = data.analysis;
      const nextOptimizedResume = data.optimizedResume;
      setResultSource("ai");
      setResultNotice(`已使用真实模型生成优化版简历：${data.model || "当前模型"}。`);
      openResultPage({
        values,
        nextAnalysis,
        nextOptimizedResume,
      });
    } catch (error) {
      setResultSource("error");
      setResultNotice(error instanceof Error ? `AI 模型暂时无法使用，无法生成优化版简历：${error.message}` : "AI 模型暂时无法使用，无法生成优化版简历。");
    } finally {
      setIsLoading(false);
    }
  }

  function openResultPage({
    values,
    nextAnalysis,
    nextOptimizedResume,
  }: {
    values: FormValues;
    nextAnalysis: Analysis;
    nextOptimizedResume: string;
  }) {
    const payload: ResultPayload = {
      targetCompany: values.targetCompany,
      targetRole: values.targetRole,
      resumeText: values.resumeText,
      jdText: values.jdText,
      analysis: nextAnalysis,
      optimizedResume: nextOptimizedResume,
      createdAt: new Date().toISOString(),
    };
    const resultId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
    window.sessionStorage.setItem(`jdalign-result-${resultId}`, JSON.stringify(payload));
    window.location.href = `/result?id=${encodeURIComponent(resultId)}`;
  }

  async function skipQuestionsAndGenerate() {
    const defaultAnswers = { role: "负责模块" };
    const values = getCurrentFormValues(defaultAnswers);
    setAnswers(defaultAnswers);
    setIsLoading(true);
    setResultNotice("正在生成优化版完整简历。系统会只基于已上传内容，不补写未确认经历。");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "generate",
          resumeText: values.resumeText,
          jdText: values.jdText,
          targetCompany: values.targetCompany,
          targetRole: values.targetRole,
          answers: defaultAnswers,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as AnalyzeResponse;

      if (!response.ok) {
        throw new Error(data.error || `请求失败：${response.status}`);
      }
      if (!data.analysis || !data.optimizedResume) {
        throw new Error("模型没有返回可用的优化版简历");
      }
      setAnalysis(data.analysis);
      const nextAnalysis = data.analysis;
      const nextOptimizedResume = data.optimizedResume;
      setResultSource("ai");
      setResultNotice(`已使用真实模型生成优化版简历：${data.model || "当前模型"}。`);
      openResultPage({
        values,
        nextAnalysis,
        nextOptimizedResume,
      });
    } catch (error) {
      setResultSource("error");
      setResultNotice(error instanceof Error ? `AI 模型暂时无法使用，无法生成优化版简历：${error.message}` : "AI 模型暂时无法使用，无法生成优化版简历。");
    } finally {
      setIsLoading(false);
    }
  }

  const scoreStyle = {
    "--score": analysis.currentScore,
    "--score-color": getColor(analysis.currentScore),
  } as CSSProperties;
  const canAnalyze = !isParsingResume && !isParsingJd && !isLoading;

  useEffect(() => {
    if (autoAnalysisTimerRef.current) {
      clearTimeout(autoAnalysisTimerRef.current);
    }

    const nextValues: FormValues = {
      resumeText,
      jdText,
      targetCompany,
      targetRole,
      answers,
    };
    const hasEnoughInput = resumeText.trim().length >= 20 && jdText.trim().length >= 20;
    const nextKey = buildAnalysisKey(nextValues);

    if (!hasEnoughInput || isParsingResume || isParsingJd || isLoading || nextKey === lastAutoAnalysisKeyRef.current) {
      return;
    }

    autoAnalysisTimerRef.current = setTimeout(() => {
      void runAnalysis(nextValues, "auto");
    }, 900);

    return () => {
      if (autoAnalysisTimerRef.current) {
        clearTimeout(autoAnalysisTimerRef.current);
      }
    };
  }, [resumeText, jdText, targetCompany, targetRole, isParsingResume, isParsingJd, isLoading]);

  return (
    <main className="app-shell dashboard-page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            J
          </div>
          <div>
            <h1 className="brand-title">JDAlign</h1>
            <p className="brand-subtitle">帮你把简历和 JD 对齐，修改成 HR 想要的模样</p>
          </div>
        </div>
        <div className="project-status">
          <span className="status-dot" />
          <span>当前项目：{targetCompany || "未填写公司"} / {targetRole || "未填写岗位"}</span>
        </div>
        <div className="top-actions">
          <button className="button secondary" type="button" onClick={saveDraft}>
            <Save size={16} />
            {saved ? "已保存" : "保存"}
          </button>
          <button className="button ghost" type="button">
            <UserCircle size={18} />
            访客
          </button>
        </div>
      </header>

      <section className="product-hero">
        <div>
          <p className="eyebrow">ATS 简历对齐工作台</p>
          <h2>上传简历和 JD，先看匹配差距，再生成可投递版本</h2>
        </div>
        <div className="hero-steps">
          <span>上传/粘贴</span>
          <ArrowRight size={16} />
          <span>匹配评分</span>
          <ArrowRight size={16} />
          <span>生成对照版</span>
        </div>
      </section>

      <section className="workspace dashboard-grid">
        <aside className="column input-column">
          <section className="panel resume-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <FileText size={17} color="#1d4ed8" />
                  <h2 className="panel-title">简历输入</h2>
                </div>
                <p className="panel-kicker">支持 PDF、DOCX、TXT、图片 OCR，也可以直接粘贴文本。</p>
              </div>
            </div>
            <div className="panel-body stack">
              <label className="upload-box" htmlFor="resumeFile">
                <div className="upload-icon">
                  <Upload size={20} />
                </div>
                <div className="upload-main">
                  <p className="upload-title">{fileName ? `已选择：${fileName}` : "上传简历文件"}</p>
                  <p className="upload-help">{isParsingResume ? "正在解析，请稍候..." : resumeParseStatus}</p>
                  <span className="upload-action">点击此处选择本地文件</span>
                  <input id="resumeFile" className="file-input" type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" onChange={handleFileChange} disabled={isParsingResume} />
                </div>
              </label>

              <div className="field">
                <label className="field-label" htmlFor="resumeText">简历解析文本</label>
                <textarea
                  id="resumeText"
                  className="textarea tall"
                  value={resumeText}
                  placeholder="上传简历后会自动填入解析文本；如果解析不完整，也可以直接粘贴简历全文。"
                  onChange={(event) => {
                    setResumeText(event.target.value);
                    setResumeParseStatus(event.target.value.trim() ? "已手动填写简历文本，可继续生成匹配评分。" : "还没有简历文本。请上传 PDF/DOCX/TXT，或直接粘贴简历全文。");
                    markInputsChanged();
                  }}
                />
              </div>

              <div className="privacy-note">
                <LockKeyhole size={15} />
                <span>简历仅用于本次分析。分享结果时默认隐藏联系方式，后续可删除上传文件和分析记录。</span>
              </div>
            </div>
          </section>

        </aside>

        <section className="column jd-column">
          <section className="panel jd-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <Target size={17} color="#1d4ed8" />
                  <h2 className="panel-title">目标岗位 JD</h2>
                </div>
                <p className="panel-kicker">粘贴 JD 文本，或上传岗位截图自动 OCR。</p>
              </div>
            </div>
            <div className="panel-body stack">
              <div className="field">
                <label className="field-label" htmlFor="company">目标公司</label>
                <input
                  id="company"
                  className="input"
                  value={targetCompany}
                  onChange={(event) => {
                    setTargetCompany(event.target.value);
                    markInputsChanged();
                  }}
                  placeholder="例如：字节跳动"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="role">目标岗位</label>
                <input
                  id="role"
                  className="input"
                  value={targetRole}
                  onChange={(event) => {
                    setTargetRole(event.target.value);
                    markInputsChanged();
                  }}
                  placeholder="例如：AI 产品经理"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="jdText">JD 原文</label>
                <label className="upload-box" htmlFor="jdFile">
                  <div className="upload-icon">
                    <ScanText size={20} />
                  </div>
                  <div className="upload-main">
                    <p className="upload-title">{jdFileName ? `已选择：${jdFileName}` : "上传 JD 文件或截图"}</p>
                    <p className="upload-help">{isParsingJd ? "正在解析，请稍候..." : jdParseStatus}</p>
                    <span className="upload-action">支持 PNG/JPG 截图 OCR</span>
                    <input id="jdFile" className="file-input" type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" onChange={handleJdFileChange} disabled={isParsingJd} />
                  </div>
                </label>
                <textarea
                  id="jdText"
                  className="textarea tall"
                  value={jdText}
                  placeholder="粘贴岗位职责、任职要求、加分项等完整 JD 文本。"
                  onChange={(event) => {
                    setJdText(event.target.value);
                    setJdParseStatus(event.target.value.trim() ? "已手动填写 JD 文本，可继续生成匹配评分。" : "还没有 JD 文本。请上传 PDF/DOCX/TXT，或直接粘贴岗位描述。");
                    markInputsChanged();
                  }}
                />
              </div>
              <button className="button primary full large" type="button" onClick={startAnalysis} disabled={!canAnalyze}>
                <Sparkles size={17} />
                {isParsingResume || isParsingJd ? "正在解析文件..." : isLoading ? "正在生成..." : stage === "analysis" ? "重新生成匹配评分" : "生成匹配评分"}
              </button>
            </div>
          </section>
        </section>

        <section className="column report-column">
          <section className="panel report-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <BarChart3 size={17} color="#1d4ed8" />
                  <h2 className="panel-title">匹配诊断报告</h2>
                </div>
                <p className="panel-kicker">当前评分、优化后预计评分和关键差距会在这里汇总。</p>
              </div>
            </div>
            <div className="panel-body">
              {stage === "input" ? (
                <InitialReportPreview />
              ) : isLoading ? (
                <LoadingSteps />
              ) : resultSource === "error" ? (
                <UnavailableState message={resultNotice} />
              ) : (
                <div className="stack">
                  <div className="callout success">
                    {resultNotice}
                  </div>
                  <div className="score-card">
                    <div className="score-ring" style={scoreStyle}>
                      <div className="score-content">
                        <div className="score-number">{analysis.currentScore}</div>
                        <div className="score-unit">/ 100</div>
                      </div>
                    </div>
                    <div className="score-meta">
                      <p className="score-label">{analysis.scoreLabel}，{analysis.recommendation}</p>
                      <p className="score-description">
                        评分基于 JD 关键词覆盖、经历相关性、技能匹配、ATS 可读性和硬性门槛。分数不是承诺通过 ATS，而是用于判断优化优先级。
                      </p>
                      <div className="score-comparison">
                        <div className="mini-score">
                          <div className="mini-score-label">当前匹配度</div>
                          <div className="mini-score-value">{analysis.currentScore}</div>
                        </div>
                        <div className="mini-score">
                          <div className="mini-score-label">优化后预计</div>
                          <div className="mini-score-value">{analysis.optimizedScore}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {analysis.isTransition ? (
                    <div className="callout warning">
                      当前属于低匹配场景。系统可以生成“转型尝试版”，但不会把缺失经历写成事实，建议补充真实项目或作品集后再重点投递。
                    </div>
                  ) : (
                    <div className="callout success">
                      当前经历存在可转译空间。补充追问后，系统会把真实经历改写成更贴近目标 JD 和 ATS 的表达。
                    </div>
                  )}

                  <QuickMatchSummary analysis={analysis} />
                  <div className="section-divider" />
                  <IssueList issues={analysis.issues} />
                </div>
              )}
            </div>
          </section>

          <section className="panel action-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <Sparkles size={17} color="#1d4ed8" />
                  <h2 className="panel-title">AI 追问与优化建议</h2>
                </div>
                <p className="panel-kicker">追问只针对能明显提升匹配度的关键信息。</p>
              </div>
            </div>
            <div className="panel-body">
              {stage === "input" ? (
                <InitialActionPreview />
              ) : isLoading ? (
                <LoadingSteps />
              ) : resultSource === "error" ? (
                <UnavailableState message="模型恢复后，系统会继续基于同一份简历和 JD 生成追问与优化版简历。" />
              ) : (
                <div className="stack">
                  <TaskList tasks={analysis.tasks} />
                  <div className="section-divider" />
                  <QuestionList questions={analysis.questions} answers={answers} setAnswers={setAnswers} />
                  <button className="button primary full large" type="button" onClick={generateResume} disabled={isLoading}>
                    <Sparkles size={17} />
                    {isLoading ? "正在生成..." : "生成并跳转到对照页"}
                  </button>
                  <button className="button secondary full" type="button" onClick={skipQuestionsAndGenerate} disabled={isLoading}>
                    跳过追问，直接生成
                  </button>
                </div>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function InitialReportPreview() {
  return (
    <div className="initial-preview">
      <div className="preview-score-card">
        <div className="preview-score-icon">
          <ShieldCheck size={22} />
        </div>
        <div>
          <p className="preview-title">等待生成评分</p>
          <p className="preview-text">完成左侧两栏输入后，会显示当前分、优化后预计分和最不匹配的关键点。</p>
        </div>
      </div>
      <div className="preview-grid">
        <div className="preview-item">
          <span>当前匹配度</span>
          <strong>--</strong>
        </div>
        <div className="preview-item">
          <span>优化后预计</span>
          <strong>--</strong>
        </div>
      </div>
      <div className="compact-list">
        <span>关键词覆盖</span>
        <span>项目相关性</span>
        <span>ATS 可读性</span>
      </div>
    </div>
  );
}

function InitialActionPreview() {
  return (
    <div className="initial-preview">
      <div className="preview-score-card amber">
        <div className="preview-score-icon">
          <Sparkles size={22} />
        </div>
        <div>
          <p className="preview-title">生成后直接进入最终简历页</p>
          <p className="preview-text">系统会先问 3-5 个关键问题，再生成左右对照的优化版完整简历。</p>
        </div>
      </div>
      <div className="output-preview">
        <span>项目经历结构化</span>
        <span>关键改动标黄</span>
        <span>支持下载 Word</span>
      </div>
    </div>
  );
}

function QuickMatchSummary({ analysis }: { analysis: Analysis }) {
  return (
    <div className="quick-match">
      <div>
        <p className="field-label">匹配点</p>
        <div className="chips">
          {analysis.matchedKeywords.slice(0, 4).map((keyword) => (
            <span className="chip success" key={keyword}>{keyword}</span>
          ))}
        </div>
      </div>
      <div>
        <p className="field-label">不匹配 / 待确认</p>
        <div className="chips">
          {analysis.missingKeywords.slice(0, 4).map((keyword) => (
            <span className="chip warning" key={keyword}>{keyword}</span>
          ))}
        </div>
      </div>
      <div className="compact-issues">
        {analysis.issues.slice(0, 2).map((issue) => (
          <div className="compact-issue" key={issue.title}>
            <strong>{issue.title}</strong>
            <span>{issue.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingSteps() {
  const steps = ["正在解析简历", "正在分析 JD", "正在匹配简历证据", "正在生成优化建议"];
  return (
    <div className="loading-steps">
      {steps.map((step) => (
        <div className="loading-step" key={step}>
          <span className="spinner" />
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function UnavailableState({ message }: { message: string }) {
  return (
    <div className="initial-preview">
      <div className="preview-score-card amber">
        <div className="preview-score-icon">
          <AlertTriangle size={22} />
        </div>
        <div>
          <p className="preview-title">AI 模型暂时无法使用</p>
          <p className="preview-text">{message}</p>
        </div>
      </div>
      <div className="compact-list">
        <span>不会生成假评分</span>
        <span>不会生成假简历</span>
        <span>请稍后重试</span>
      </div>
    </div>
  );
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <div className="issue" key={issue.title}>
          <div className={`issue-icon ${issue.severity}`}>
            <AlertTriangle size={16} />
          </div>
          <div>
            <p className="issue-title">{issue.title}</p>
            <p className="issue-text">{issue.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskList({ tasks }: { tasks: Task[] }) {
  const labels: Record<Priority, string> = {
    high: "高优先级",
    medium: "中优先级",
    quick: "快速优化",
  };

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <div className="task" key={task.title}>
          <div className="task-head">
            <p className="task-title">{task.title}</p>
            <span className={`priority ${task.priority}`}>{labels[task.priority]}</span>
          </div>
          <p className="task-text">{task.text}</p>
        </div>
      ))}
    </div>
  );
}

function QuestionList({
  questions,
  answers,
  setAnswers,
}: {
  questions: Question[];
  answers: Record<string, string>;
  setAnswers: (value: Record<string, string>) => void;
}) {
  return (
    <div className="question-list">
      {questions.map((question) => (
        <div className="question" key={question.id}>
          <p className="question-title">{question.title}</p>
          <p className="question-reason">{question.reason}</p>
          {question.type === "role" ? (
            <div className="role-options">
              {roleOptions.map((option) => (
                <button
                  className={`option-button ${answers[question.id] === option ? "active" : ""}`}
                  key={option}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [question.id]: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              className="textarea"
              value={answers[question.id] || ""}
              onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
              placeholder="可选填写。没有相关经历可以留空。"
            />
          )}
        </div>
      ))}
    </div>
  );
}
