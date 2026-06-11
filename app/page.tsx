"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
  RotateCcw,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserCircle,
} from "lucide-react";
import { ChangeEvent, CSSProperties, useState } from "react";

type Stage = "input" | "analysis" | "result";
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
  source?: "ai" | "fallback";
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

const sampleResume = `张明
手机号：138 0000 0000 | 邮箱：zhangming@example.com | 上海

求职方向：产品经理

个人简介
3 年产品经验，参与企业内部工具、用户增长和内容运营相关项目。熟悉需求调研、竞品分析、原型设计和跨部门协作。

工作经历
星河科技 | 产品经理 | 2022.03 - 至今
- 负责企业客户管理后台的需求梳理和功能设计，协同研发、设计、测试推进版本上线。
- 参与用户增长活动配置工具建设，支持运营团队提升活动上线效率。
- 跟踪用户反馈和使用数据，整理迭代需求并推动功能优化。

项目经历
智能客服知识库优化项目 | 产品负责人 | 2023.06 - 2023.12
- 梳理客服高频问题和知识库结构，设计问答配置流程。
- 协同技术团队上线知识库搜索与推荐功能，减少客服重复查询时间。

教育经历
上海大学 | 工商管理 | 本科`;

const sampleJd = `AI 产品经理

岗位职责：
1. 负责 AI 产品方向的需求分析、产品规划和功能设计，推动大模型应用能力落地。
2. 与算法、研发、设计、运营团队协作，持续优化用户体验和业务指标。
3. 围绕企业客户场景，设计 B 端 SaaS 或内部效率工具产品。
4. 基于用户反馈和数据分析，持续迭代产品策略。

任职要求：
1. 3 年以上产品经验，有 AI 产品、大模型、智能助手、Agent 或 RAG 项目经验优先。
2. 熟悉 B 端 SaaS、企业后台、工作流或数据看板类产品。
3. 具备较强的数据分析能力，熟悉 SQL、Excel 或 BI 工具优先。
4. 能独立完成需求文档、原型设计、跨部门项目推进。`;

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

function buildAnalysis(resumeText: string, jdText: string): Analysis {
  const combined = `${resumeText} ${jdText}`.toLowerCase();
  const resume = resumeText.toLowerCase();
  const jd = jdText.toLowerCase();

  const hasAi =
    /ai|大模型|智能|自动化|客服|助手|agent|rag|llm/.test(resume) ||
    resume.includes("知识库");
  const hasB2b = /b端|b 端|saas|企业|后台|管理平台|内部工具|客户管理/.test(resume);
  const hasData = /sql|数据|excel|bi|看板|指标|转化率|增长/.test(resume);
  const hasMetrics = /%|提升|降低|减少|增长|效率|成本/.test(resume);
  const jdAi = /ai|大模型|agent|rag|智能/.test(jd);
  const jdData = /sql|数据|bi|看板|指标/.test(jd);

  let currentScore = 54;
  if (hasAi) currentScore += 10;
  if (hasB2b) currentScore += 12;
  if (hasData) currentScore += 9;
  if (hasMetrics) currentScore += 7;
  if (resume.length > 260) currentScore += 5;
  if (!jdAi) currentScore += 4;
  if (!jdData) currentScore += 3;
  currentScore = Math.min(88, currentScore);

  const optimizedScore = Math.min(94, currentScore + (currentScore < 65 ? 18 : 13));
  const isTransition = currentScore < 65;

  const dimensions = [
    { label: "JD 关键词覆盖", value: Math.min(92, currentScore + (hasAi ? 5 : -6)) },
    { label: "工作/项目经历相关性", value: Math.min(90, currentScore + (hasB2b ? 8 : -4)) },
    { label: "技能匹配度", value: Math.min(88, currentScore + (hasData ? 5 : -8)) },
    { label: "ATS 格式友好度", value: 84 },
    { label: "年限/硬性门槛匹配", value: 72 },
  ].map((item) => ({ ...item, value: Math.max(36, item.value) }));

  const matchedKeywords = [
    hasB2b ? "企业后台" : "产品规划",
    "跨部门协作",
    hasAi ? "智能工具" : "需求分析",
    hasData ? "数据反馈" : "原型设计",
  ];

  const missingKeywords = [
    !hasAi ? "大模型/Agent" : "RAG",
    !hasData ? "SQL/BI" : "量化指标",
    "ATS 关键词",
    "业务结果",
  ];

  const lowRelevanceKeywords = ["内容运营", "活动执行", "通用沟通"];

  const issues: Issue[] = [
    {
      title: hasAi ? "AI 相关经历需要更贴近 JD 语言" : "AI 产品经验没有形成明确证据",
      text: hasAi
        ? "简历里有智能客服或自动化相关经历，但还没有自然覆盖大模型、智能助手、AI 产品规划等高权重词。"
        : "JD 强调大模型、Agent 或 AI 产品经验，但当前简历缺少可以直接识别的 AI 项目证据。",
      severity: "high",
    },
    {
      title: hasData ? "数据分析结果表达偏弱" : "数据分析能力缺少证据",
      text: hasData
        ? "简历提到反馈和数据，但没有把工具、指标、业务结果写清楚，ATS 和 HR 难以判断强度。"
        : "JD 多次提到数据分析、SQL 或 BI，但简历没有明确工具和分析场景。",
      severity: "high",
    },
    {
      title: hasB2b ? "B 端经验可以进一步前置" : "B 端/SaaS 相关表达不足",
      text: hasB2b
        ? "企业后台和客户管理经历可转译为 B 端产品经验，建议放入个人简介和核心技能。"
        : "JD 要求企业客户场景或 SaaS 产品经验，当前简历没有明显对应内容。",
      severity: "medium",
    },
  ];

  const tasks: Task[] = [
    {
      priority: "high",
      title: "把最相关项目前置",
      text: "将智能客服、企业后台、自动化工具等经历放到个人简介和项目经历前半部分。",
    },
    {
      priority: "medium",
      title: "补充真实工具与指标",
      text: "只有在用户确认后，才把 SQL、BI、效率提升、转化率等内容写入优化版简历。",
    },
    {
      priority: "quick",
      title: "改成 ATS 友好结构",
      text: "使用单栏、标准标题、清晰技能区，避免复杂表格和图片化文字。",
    },
  ];

  return {
    currentScore,
    optimizedScore,
    scoreLabel: isTransition ? "匹配较弱" : currentScore >= 80 ? "较匹配" : "中等匹配",
    recommendation: isTransition ? "建议先补充真实经历，再作为转型尝试投递" : "建议使用优化版简历后投递",
    isTransition,
    dimensions,
    matchedKeywords,
    missingKeywords,
    lowRelevanceKeywords,
    issues,
    tasks,
    questions: defaultQuestions,
  };
}

function buildOptimizedResume(params: {
  targetRole: string;
  targetCompany: string;
  answers: Record<string, string>;
  analysis: Analysis;
}) {
  const { targetRole, targetCompany, answers, analysis } = params;
  const role = targetRole || "AI 产品经理";
  const companyLine = targetCompany ? `目标公司：${targetCompany}` : "";
  const responsibility = answers.role || "负责模块";
  const aiAnswer = answers.ai?.trim();
  const dataAnswer = answers.data?.trim();
  const b2bAnswer = answers.b2b?.trim();
  const metricAnswer = answers.metric?.trim();

  const aiLine = aiAnswer
    ? `- 结合过往 ${aiAnswer}，将智能工具、知识库或自动化相关经历转译为 AI 产品落地经验。`
    : "- 具备智能客服、知识库配置、自动化工具相关项目经验，可围绕 AI 产品场景继续补充真实案例。";

  const dataLine = dataAnswer
    ? `- 数据分析：${dataAnswer}，能够基于反馈和指标推动产品迭代。`
    : "- 数据分析：具备用户反馈整理和基础指标跟踪经验；如确有 SQL/BI 使用经历，建议补充具体场景。";

  const b2bLine = b2bAnswer
    ? `- B 端产品：${b2bAnswer}，熟悉企业用户场景、后台流程和跨角色协作。`
    : "- B 端产品：参与企业客户管理后台、内部效率工具或运营配置平台建设。";

  const metricLine = metricAnswer
    ? `，${metricAnswer}`
    : "，支持业务团队提升配置效率与问题处理效率";

  const transitionNote = analysis.isTransition
    ? "\n版本标记：转型尝试版。当前简历仍存在关键经历缺口，建议补充真实项目或作品集后再重点投递。\n"
    : "";

  return `张明
手机号：138 0000 0000 | 邮箱：zhangming@example.com | 上海

求职方向：${role}
${companyLine}${transitionNote}
个人简介
3 年产品经理经验，重点参与企业后台、内部效率工具、智能客服知识库和用户增长相关项目。熟悉需求调研、产品规划、原型设计、跨部门项目推进与上线迭代。能够围绕目标岗位 JD 中的 AI 产品、B 端系统、数据分析和业务效率提升要求，梳理真实经历并输出可落地的产品方案。

核心技能
- 产品能力：需求分析、用户调研、PRD 撰写、原型设计、版本规划、跨部门协作、项目推进。
${b2bLine}
${aiLine}
${dataLine}
- ATS 关键词：AI 产品、智能客服、知识库、自动化工具、企业后台、工作流、数据反馈、用户体验优化。

工作经历
星河科技 | 产品经理 | 2022.03 - 至今
- ${responsibility}企业客户管理后台和内部效率工具的需求梳理与功能设计，围绕客户资料管理、运营配置和流程协作场景输出产品方案，并协同研发、设计、测试推进版本上线。
- 参与用户增长活动配置工具建设，梳理运营团队从活动创建、规则配置到效果复盘的完整流程，推动配置链路标准化${metricLine}。
- 基于用户反馈、客服问题和使用数据整理迭代需求，推动后台体验、配置效率和问题定位能力优化。

项目经历
智能客服知识库优化项目 | 产品负责人 | 2023.06 - 2023.12
- 梳理客服高频问题、知识库结构和问答配置流程，设计面向业务人员的知识维护和搜索推荐功能。
- 与技术团队协作上线知识库搜索、推荐和配置能力，减少客服重复查询时间，并为后续智能助手或 AI 问答场景沉淀标准化知识内容。
- 将原有“知识库优化”经历转译为与目标 JD 更相关的智能工具、自动化问答和 AI 产品基础能力，但不虚构未确认的大模型研发职责。

企业客户管理后台项目 | 产品经理 | 2022.06 - 2023.05
- 面向销售、运营、客服等多角色使用场景，完成客户信息、跟进记录、权限配置和数据查看等模块设计。
- 输出需求文档和原型，协调研发排期、设计评审、测试验收和上线反馈，保障功能按版本计划落地。
- 通过统一字段、规范流程和优化页面信息层级，提升内部团队对客户状态和服务进展的识别效率。

教育经历
上海大学 | 工商管理 | 本科

补充建议
- 若你确实有 SQL、BI、大模型、Agent、RAG 或具体量化结果，请补充真实使用场景后再生成最终投递版。
- 面试时请围绕上述经历准备可解释案例，避免使用无法证明的技能或结果。`;
}

function getColor(value: number) {
  if (value >= 80) return "#059669";
  if (value >= 65) return "#d97706";
  return "#dc2626";
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadDocx(resumeText: string) {
  const response = await fetch("/api/docx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resumeText }),
  });

  if (!response.ok) {
    downloadTextFile("优化版简历.txt", resumeText);
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "优化版简历.docx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("input");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [fileName, setFileName] = useState("");
  const [jdFileName, setJdFileName] = useState("");
  const [resumeParseStatus, setResumeParseStatus] = useState("支持 PDF、DOCX、TXT；扫描版图片请先复制文字后粘贴。");
  const [jdParseStatus, setJdParseStatus] = useState("支持 PDF、DOCX、TXT；招聘截图和链接请先复制 JD 文字。");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isParsingJd, setIsParsingJd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(() => buildAnalysis(sampleResume, sampleJd));
  const [optimizedResume, setOptimizedResume] = useState("");
  const [resultNotice, setResultNotice] = useState("当前还未调用模型。点击左侧按钮后会优先请求 DeepSeek，失败时使用本地兜底。");
  const [resultSource, setResultSource] = useState<"pending" | "ai" | "fallback">("pending");
  const [answers, setAnswers] = useState<Record<string, string>>({
    role: "负责模块",
  });
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [saved, setSaved] = useState(false);

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
    setResumeParseStatus("正在解析简历文件...");

    try {
      const text = await parseFile(file);
      setResumeText(text);
      setResumeParseStatus(`已解析 ${file.name}，请检查文本是否准确。`);
      markInputsChanged();
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
    setJdParseStatus("正在解析 JD 文件...");

    try {
      const text = await parseFile(file);
      setJdText(text);
      setJdParseStatus(`已解析 ${file.name}，请检查 JD 文本是否完整。`);
      markInputsChanged();
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
    setResultNotice("输入内容已修改，请重新生成匹配诊断。");
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

  async function startAnalysis() {
    if (isParsingResume || isParsingJd || isLoading) return;
    const values = getCurrentFormValues();
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
    setIsLoading(true);
    setStage("analysis");
    setResultNotice("正在请求模型生成匹配诊断。如果模型不可用，会自动切换到本地演示结果。");

    try {
      const data = await callAnalyzeApi("analysis", values);
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
      setResultSource(data.source === "ai" ? "ai" : "fallback");
      setResultNotice(
        data.source === "ai"
          ? `已使用真实模型生成诊断结果：${data.model || "当前模型"}。`
          : data.notice || "当前使用本地演示结果。",
      );
    } catch (error) {
      const fallback = buildAnalysis(values.resumeText, values.jdText);
      setAnalysis(fallback);
      setResultSource("fallback");
      setResultNotice(error instanceof Error ? `模型请求失败，已使用本地演示结果：${error.message}` : "模型请求失败，已使用本地演示结果。");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateResume() {
    if (isLoading) return;
    const values = getCurrentFormValues();
    setIsLoading(true);
    setResultNotice("正在生成优化版完整简历。系统会遵守不编造经历的边界。");

    try {
      const data = await callAnalyzeApi("generate", values);
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
      if (data.optimizedResume) {
        setOptimizedResume(data.optimizedResume);
      } else {
        setOptimizedResume(buildOptimizedResume({ targetRole: values.targetRole, targetCompany: values.targetCompany, answers: values.answers, analysis }));
      }
      setResultSource(data.source === "ai" ? "ai" : "fallback");
      setResultNotice(
        data.source === "ai"
          ? `已使用真实模型生成优化版简历：${data.model || "当前模型"}。`
          : data.notice || "当前使用本地演示结果。",
      );
      setStage("result");
    } catch (error) {
      setOptimizedResume(buildOptimizedResume({ targetRole: values.targetRole, targetCompany: values.targetCompany, answers: values.answers, analysis }));
      setResultSource("fallback");
      setResultNotice(error instanceof Error ? `模型请求失败，已使用本地演示简历：${error.message}` : "模型请求失败，已使用本地演示简历。");
      setStage("result");
    } finally {
      setIsLoading(false);
    }
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
      if (data.analysis) {
        setAnalysis(data.analysis);
      }
      if (data.optimizedResume) {
        setOptimizedResume(data.optimizedResume);
      } else {
        setOptimizedResume(buildOptimizedResume({ targetRole: values.targetRole, targetCompany: values.targetCompany, answers: defaultAnswers, analysis }));
      }
      setResultSource(data.source === "ai" ? "ai" : "fallback");
      setResultNotice(
        data.source === "ai"
          ? `已使用真实模型生成优化版简历：${data.model || "当前模型"}。`
          : data.notice || "当前使用本地演示结果。",
      );
      setStage("result");
    } catch (error) {
      setOptimizedResume(buildOptimizedResume({ targetRole: values.targetRole, targetCompany: values.targetCompany, answers: defaultAnswers, analysis }));
      setResultSource("fallback");
      setResultNotice(error instanceof Error ? `模型请求失败，已使用本地演示简历：${error.message}` : "模型请求失败，已使用本地演示简历。");
      setStage("result");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResume() {
    await navigator.clipboard.writeText(optimizedResume);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyShareLink() {
    const payload = {
      targetCompany,
      targetRole,
      analysis,
      optimizedResume,
      createdAt: new Date().toISOString(),
    };
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    const link = `${window.location.origin}/share/result?data=${encoded}`;
    await navigator.clipboard.writeText(link);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1600);
  }

  const scoreStyle = {
    "--score": analysis.currentScore,
    "--score-color": getColor(analysis.currentScore),
  } as CSSProperties;
  const canAnalyze = !isParsingResume && !isParsingJd && !isLoading;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="brand-title">AI 简历 ATS 优化工作台</h1>
            <p className="brand-subtitle">面向中国求职者的 JD 匹配诊断与简历生成</p>
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
          <button className="button secondary" type="button" onClick={() => downloadDocx(optimizedResume || resumeText)} disabled={!optimizedResume && !resumeText}>
            <Download size={16} />
            导出
          </button>
          <button className="button ghost" type="button">
            <UserCircle size={18} />
            访客
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <FileText size={17} color="#1d4ed8" />
                  <h2 className="panel-title">简历输入</h2>
                </div>
                <p className="panel-kicker">支持 PDF、DOCX，解析失败时可直接粘贴文本。</p>
              </div>
            </div>
            <div className="panel-body stack">
              <div className="upload-box">
                <div className="upload-icon">
                  <Upload size={20} />
                </div>
                <div className="upload-main">
                  <p className="upload-title">{fileName ? `已选择：${fileName}` : "上传简历文件"}</p>
                  <p className="upload-help">{isParsingResume ? "正在解析，请稍候..." : resumeParseStatus}</p>
                  <input className="file-input" type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} disabled={isParsingResume} />
                </div>
              </div>

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

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title-row">
                  <Target size={17} color="#1d4ed8" />
                  <h2 className="panel-title">目标岗位 JD</h2>
                </div>
                <p className="panel-kicker">直接粘贴招聘网站上的岗位描述即可。</p>
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
                <div className="upload-box">
                  <div className="upload-icon">
                    <Upload size={20} />
                  </div>
                  <div className="upload-main">
                    <p className="upload-title">{jdFileName ? `已选择：${jdFileName}` : "上传 JD 文件"}</p>
                    <p className="upload-help">{isParsingJd ? "正在解析，请稍候..." : jdParseStatus}</p>
                    <input className="file-input" type="file" accept=".pdf,.docx,.txt" onChange={handleJdFileChange} disabled={isParsingJd} />
                  </div>
                </div>
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
                {isParsingResume || isParsingJd ? "正在解析文件..." : isLoading ? "正在生成..." : "生成匹配评分和优化简历"}
              </button>
            </div>
          </section>
        </aside>

        <section className="column">
          <section className="panel">
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
                <div className="empty-state">
                  <ShieldCheck size={34} color="#1d4ed8" />
                  <h2>准备生成第一份诊断报告</h2>
                  <p>请先上传或粘贴简历，再上传或粘贴目标岗位 JD。系统会生成评分、差距、追问和优化版完整简历。</p>
                </div>
              ) : isLoading ? (
                <LoadingSteps />
              ) : (
                <div className="stack">
                  <div className={`callout ${resultSource === "ai" ? "success" : "warning"}`}>
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

                  <div className="section-divider" />
                  <ProgressList dimensions={analysis.dimensions} />
                  <div className="section-divider" />
                  <KeywordCoverage analysis={analysis} />
                  <div className="section-divider" />
                  <IssueList issues={analysis.issues} />
                </div>
              )}
            </div>
          </section>

          {stage === "result" ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="panel-title-row">
                    <FileText size={17} color="#1d4ed8" />
                    <h2 className="panel-title">优化版完整简历</h2>
                  </div>
                  <p className="panel-kicker">这是本 MVP 的主交付物，可直接复制或下载 Word。</p>
                </div>
              </div>
              <div className="panel-body">
                <div className="result-layout">
                  <article className="resume-doc">{optimizedResume}</article>
                  <aside className="result-side">
                    <button className="button primary full" type="button" onClick={copyResume}>
                      <Copy size={16} />
                      {copied ? "已复制" : "复制简历"}
                    </button>
                    <button className="button secondary full" type="button" onClick={() => downloadDocx(optimizedResume)}>
                      <Download size={16} />
                      下载 Word
                    </button>
                    <button className="button secondary full" type="button" onClick={copyShareLink}>
                      <Share2 size={16} />
                      {shareCopied ? "链接已复制" : "分享结果链接"}
                    </button>
                    <button className="button ghost full" type="button" onClick={() => setStage("analysis")}>
                      <RotateCcw size={16} />
                      修改追问答案
                    </button>
                    <div className="callout warning">
                      分享页默认隐藏手机号、邮箱。Word 下载会使用 ATS 友好的单栏模板生成。
                    </div>
                  </aside>
                </div>
              </div>
            </section>
          ) : null}
        </section>

        <aside className="column">
          <section className="panel">
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
                <div className="empty-state">
                  <AlertTriangle size={30} color="#d97706" />
                  <h2>等待分析</h2>
                  <p>生成当前匹配评分后，这里会展示高优先级问题、补充追问和生成优化版简历入口。</p>
                </div>
              ) : isLoading ? (
                <LoadingSteps />
              ) : (
                <div className="stack">
                  <TaskList tasks={analysis.tasks} />
                  <div className="section-divider" />
                  <QuestionList questions={analysis.questions} answers={answers} setAnswers={setAnswers} />
                  <button className="button primary full large" type="button" onClick={generateResume} disabled={isLoading}>
                    <Sparkles size={17} />
                    {isLoading ? "正在生成..." : "生成标准优化版简历"}
                  </button>
                  <button className="button secondary full" type="button" onClick={skipQuestionsAndGenerate} disabled={isLoading}>
                    跳过追问，直接生成
                  </button>
                </div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
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

function ProgressList({ dimensions }: { dimensions: Dimension[] }) {
  return (
    <div className="progress-list">
      {dimensions.map((dimension) => (
        <div className="progress-item" key={dimension.label}>
          <div className="progress-head">
            <span>{dimension.label}</span>
            <strong>{dimension.value}</strong>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${dimension.value}%`, "--bar-color": getColor(dimension.value) } as CSSProperties}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function KeywordCoverage({ analysis }: { analysis: Analysis }) {
  return (
    <div className="stack">
      <div>
        <p className="field-label">已匹配关键词</p>
        <div className="chips">
          {analysis.matchedKeywords.map((keyword) => (
            <span className="chip success" key={keyword}>{keyword}</span>
          ))}
        </div>
      </div>
      <div>
        <p className="field-label">缺失或待确认关键词</p>
        <div className="chips">
          {analysis.missingKeywords.map((keyword) => (
            <span className="chip warning" key={keyword}>{keyword}</span>
          ))}
        </div>
      </div>
      <div>
        <p className="field-label">低相关表达</p>
        <div className="chips">
          {analysis.lowRelevanceKeywords.map((keyword) => (
            <span className="chip gray" key={keyword}>{keyword}</span>
          ))}
        </div>
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
