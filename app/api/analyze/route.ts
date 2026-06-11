import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

type AnalyzeRequest = {
  mode?: "analysis" | "generate";
  resumeText?: string;
  jdText?: string;
  targetCompany?: string;
  targetRole?: string;
  answers?: Record<string, string>;
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;
  const resumeText = body.resumeText?.trim() || "";
  const jdText = body.jdText?.trim() || "";
  const mode = body.mode === "generate" ? "generate" : "analysis";

  if (!resumeText || !jdText) {
    return NextResponse.json({ error: "缺少简历或 JD 文本" }, { status: 400 });
  }

  const fallbackAnalysis = buildFallbackAnalysis(resumeText, jdText);
  const fallbackResume = buildFallbackOptimizedResume({
    targetCompany: body.targetCompany || "",
    targetRole: body.targetRole || "",
    answers: body.answers || {},
    analysis: fallbackAnalysis,
  });

  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://api.deepseek.com";
  const model = process.env.AI_MODEL || "deepseek-chat";

  if (!apiKey) {
    return NextResponse.json({
      source: "fallback",
      notice: "未配置 AI_API_KEY，当前使用本地演示结果。",
      analysis: fallbackAnalysis,
      optimizedResume: mode === "generate" ? fallbackResume : undefined,
    });
  }

  try {
    const aiResult = await callTextModel({
      apiKey,
      baseUrl,
      model,
      payload: {
        mode,
        resumeText,
        jdText,
        targetCompany: body.targetCompany || "",
        targetRole: body.targetRole || "",
        answers: body.answers || {},
      },
    });

    const analysis = normalizeAnalysis(aiResult.analysis, fallbackAnalysis);
    const optimizedResume =
      mode === "generate" && typeof aiResult.optimizedResume === "string" && aiResult.optimizedResume.trim()
        ? aiResult.optimizedResume.trim()
        : mode === "generate"
          ? fallbackResume
          : undefined;

    return NextResponse.json({
      source: "ai",
      model,
      analysis,
      optimizedResume,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败";

    return NextResponse.json({
      source: "fallback",
      notice: `模型调用失败，当前使用本地演示结果：${message}`,
      analysis: fallbackAnalysis,
      optimizedResume: mode === "generate" ? fallbackResume : undefined,
    });
  }
}

async function callTextModel({
  apiKey,
  baseUrl,
  model,
  payload,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  payload: Required<Pick<AnalyzeRequest, "mode" | "resumeText" | "jdText" | "targetCompany" | "targetRole" | "answers">>;
}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: payload.mode === "generate" ? 4096 : 2200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(payload.mode),
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${errorText ? ` ${errorText.slice(0, 220)}` : ""}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("模型返回为空");
  }

  return JSON.parse(content) as { analysis?: unknown; optimizedResume?: unknown };
}

function buildSystemPrompt(mode: "analysis" | "generate") {
  return `你是一个面向中国求职者的 ATS 简历匹配与优化引擎。

必须遵守：
1. 只用中文输出。
2. 不编造公司、职位、项目、学历、证书、工具、指标和数据。
3. 只能改写“已匹配”或“可转译”的真实证据。
4. 缺失要求只能作为追问或风险提示，不能写进简历当成事实。
5. 低匹配时必须指出最关键的不匹配原因。
6. 分数是岗位匹配与 ATS 可读性的估计，不承诺通过 ATS。
7. 必须返回 JSON，不要输出 Markdown，不要输出解释性前后缀。

JSON 顶层结构：
{
  "analysis": {
    "currentScore": number,
    "optimizedScore": number,
    "scoreLabel": string,
    "recommendation": string,
    "isTransition": boolean,
    "dimensions": [
      {"label": "JD 关键词覆盖", "value": number},
      {"label": "工作/项目经历相关性", "value": number},
      {"label": "技能匹配度", "value": number},
      {"label": "ATS 格式友好度", "value": number},
      {"label": "年限/硬性门槛匹配", "value": number}
    ],
    "matchedKeywords": string[],
    "missingKeywords": string[],
    "lowRelevanceKeywords": string[],
    "issues": [{"title": string, "text": string, "severity": "high" | "medium"}],
    "tasks": [{"priority": "high" | "medium" | "quick", "title": string, "text": string}],
    "questions": [{"id": string, "title": string, "reason": string, "type"?: "role"}]
  }${mode === "generate" ? ',\n  "optimizedResume": string' : ""}
}

${mode === "generate" ? "optimizedResume 必须是一份完整的中文简历文本，包含个人简介、核心技能、工作经历、项目经历、教育经历等适用部分。" : "questions 必须包含 3-5 个最能提升匹配度的追问。"}`;
}

function normalizeAnalysis(input: unknown, fallback: Analysis): Analysis {
  const item = isRecord(input) ? input : {};
  const currentScore = clampNumber(item.currentScore, fallback.currentScore);
  const optimizedScore = Math.max(currentScore, clampNumber(item.optimizedScore, fallback.optimizedScore));

  return {
    currentScore,
    optimizedScore,
    scoreLabel: stringOr(item.scoreLabel, fallback.scoreLabel),
    recommendation: stringOr(item.recommendation, fallback.recommendation),
    isTransition: currentScore < 65 || item.isTransition === true,
    dimensions: normalizeDimensions(item.dimensions, fallback.dimensions),
    matchedKeywords: normalizeStrings(item.matchedKeywords, fallback.matchedKeywords),
    missingKeywords: normalizeStrings(item.missingKeywords, fallback.missingKeywords),
    lowRelevanceKeywords: normalizeStrings(item.lowRelevanceKeywords, fallback.lowRelevanceKeywords),
    issues: normalizeIssues(item.issues, fallback.issues),
    tasks: normalizeTasks(item.tasks, fallback.tasks),
    questions: normalizeQuestions(item.questions, fallback.questions),
  };
}

function normalizeDimensions(input: unknown, fallback: Dimension[]) {
  if (!Array.isArray(input)) return fallback;
  const list = input
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        label: stringOr(item.label, ""),
        value: clampNumber(item.value, 0),
      };
    })
    .filter((item): item is Dimension => Boolean(item?.label));

  return list.length ? list.slice(0, 5) : fallback;
}

function normalizeIssues(input: unknown, fallback: Issue[]) {
  if (!Array.isArray(input)) return fallback;
  const list = input
    .map((item) => {
      if (!isRecord(item)) return null;
      const severity = item.severity === "high" || item.severity === "medium" ? item.severity : "medium";
      return {
        title: stringOr(item.title, ""),
        text: stringOr(item.text, ""),
        severity,
      };
    })
    .filter((item): item is Issue => Boolean(item?.title && item.text));

  return list.length ? list.slice(0, 4) : fallback;
}

function normalizeTasks(input: unknown, fallback: Task[]) {
  if (!Array.isArray(input)) return fallback;
  const list = input
    .map((item) => {
      if (!isRecord(item)) return null;
      const priority = item.priority === "high" || item.priority === "medium" || item.priority === "quick" ? item.priority : "medium";
      return {
        priority,
        title: stringOr(item.title, ""),
        text: stringOr(item.text, ""),
      };
    })
    .filter((item): item is Task => Boolean(item?.title && item.text));

  return list.length ? list.slice(0, 4) : fallback;
}

function normalizeQuestions(input: unknown, fallback: Question[]): Question[] {
  if (!Array.isArray(input)) return fallback;
  const list: Question[] = input
    .map((item, index): Question | null => {
      if (!isRecord(item)) return null;
      return {
        id: stringOr(item.id, `q${index + 1}`),
        title: stringOr(item.title, ""),
        reason: stringOr(item.reason, ""),
        type:
          item.type === "role" && /(责任|角色|主导|协助|负责)/.test(stringOr(item.title, ""))
            ? "role"
            : undefined,
      };
    })
    .filter((item): item is Question => Boolean(item?.title && item.reason));

  return list.length ? list.slice(0, 5) : fallback;
}

function normalizeStrings(input: unknown, fallback: string[]) {
  if (!Array.isArray(input)) return fallback;
  const list = input.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  return list.length ? list.slice(0, 8) : fallback;
}

function clampNumber(input: unknown, fallback: number) {
  if (typeof input !== "number" || Number.isNaN(input)) return fallback;
  return Math.max(0, Math.min(100, Math.round(input)));
}

function stringOr(input: unknown, fallback: string) {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === "object" && !Array.isArray(input));
}

function buildFallbackAnalysis(resumeText: string, jdText: string): Analysis {
  const resume = resumeText.toLowerCase();
  const jd = jdText.toLowerCase();
  const hasAi = /ai|大模型|智能|自动化|客服|助手|agent|rag|llm/.test(resume) || resume.includes("知识库");
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

  return {
    currentScore,
    optimizedScore,
    scoreLabel: isTransition ? "匹配较弱" : currentScore >= 80 ? "较匹配" : "中等匹配",
    recommendation: isTransition ? "建议先补充真实经历，再作为转型尝试投递" : "建议使用优化版简历后投递",
    isTransition,
    dimensions: [
      { label: "JD 关键词覆盖", value: Math.min(92, currentScore + (hasAi ? 5 : -6)) },
      { label: "工作/项目经历相关性", value: Math.min(90, currentScore + (hasB2b ? 8 : -4)) },
      { label: "技能匹配度", value: Math.min(88, currentScore + (hasData ? 5 : -8)) },
      { label: "ATS 格式友好度", value: 84 },
      { label: "年限/硬性门槛匹配", value: 72 },
    ].map((item) => ({ ...item, value: Math.max(36, item.value) })),
    matchedKeywords: [hasB2b ? "企业后台" : "产品规划", "跨部门协作", hasAi ? "智能工具" : "需求分析", hasData ? "数据反馈" : "原型设计"],
    missingKeywords: [!hasAi ? "大模型/Agent" : "RAG", !hasData ? "SQL/BI" : "量化指标", "ATS 关键词", "业务结果"],
    lowRelevanceKeywords: ["内容运营", "活动执行", "通用沟通"],
    issues: [
      {
        title: hasAi ? "AI 相关经历需要更贴近 JD 语言" : "AI 产品经验没有形成明确证据",
        text: hasAi
          ? "简历里有智能客服或自动化相关经历，但还没有自然覆盖大模型、智能助手、AI 产品规划等高权重词。"
          : "JD 强调大模型、Agent 或 AI 产品经验，但当前简历缺少可以直接识别的 AI 项目证据。",
        severity: "high",
      },
      {
        title: hasData ? "数据分析结果表达偏弱" : "数据分析能力缺少证据",
        text: hasData ? "简历提到反馈和数据，但没有把工具、指标、业务结果写清楚。" : "JD 多次提到数据分析、SQL 或 BI，但简历没有明确工具和分析场景。",
        severity: "high",
      },
      {
        title: hasB2b ? "B 端经验可以进一步前置" : "B 端/SaaS 相关表达不足",
        text: hasB2b ? "企业后台和客户管理经历可转译为 B 端产品经验，建议放入个人简介和核心技能。" : "JD 要求企业客户场景或 SaaS 产品经验，当前简历没有明显对应内容。",
        severity: "medium",
      },
    ],
    tasks: [
      { priority: "high", title: "把最相关项目前置", text: "将智能客服、企业后台、自动化工具等经历放到个人简介和项目经历前半部分。" },
      { priority: "medium", title: "补充真实工具与指标", text: "只有在用户确认后，才把 SQL、BI、效率提升、转化率等内容写入优化版简历。" },
      { priority: "quick", title: "改成 ATS 友好结构", text: "使用单栏、标准标题、清晰技能区，避免复杂表格和图片化文字。" },
    ],
    questions: defaultQuestions,
  };
}

function buildFallbackOptimizedResume({
  targetRole,
  targetCompany,
  answers,
  analysis,
}: {
  targetRole: string;
  targetCompany: string;
  answers: Record<string, string>;
  analysis: Analysis;
}) {
  const role = targetRole || "AI 产品经理";
  const companyLine = targetCompany ? `目标公司：${targetCompany}` : "";
  const responsibility = answers.role || "负责模块";
  const transitionNote = analysis.isTransition ? "\n版本标记：转型尝试版。当前简历仍存在关键经历缺口，建议补充真实项目或作品集后再重点投递。\n" : "";

  return `张明
手机号：138 0000 0000 | 邮箱：zhangming@example.com | 上海

求职方向：${role}
${companyLine}${transitionNote}
个人简介
3 年产品经理经验，重点参与企业后台、内部效率工具、智能客服知识库和用户增长相关项目。熟悉需求调研、产品规划、原型设计、跨部门项目推进与上线迭代。

核心技能
- 产品能力：需求分析、用户调研、PRD 撰写、原型设计、版本规划、跨部门协作、项目推进。
- B 端产品：参与企业客户管理后台、内部效率工具或运营配置平台建设。
- ATS 关键词：AI 产品、智能客服、知识库、自动化工具、企业后台、工作流、数据反馈、用户体验优化。

工作经历
星河科技 | 产品经理 | 2022.03 - 至今
- ${responsibility}企业客户管理后台和内部效率工具的需求梳理与功能设计，围绕客户资料管理、运营配置和流程协作场景输出产品方案。
- 参与用户增长活动配置工具建设，梳理运营团队从活动创建、规则配置到效果复盘的完整流程，推动配置链路标准化。
- 基于用户反馈、客服问题和使用数据整理迭代需求，推动后台体验、配置效率和问题定位能力优化。

项目经历
智能客服知识库优化项目 | 产品负责人 | 2023.06 - 2023.12
- 梳理客服高频问题、知识库结构和问答配置流程，设计面向业务人员的知识维护和搜索推荐功能。
- 与技术团队协作上线知识库搜索、推荐和配置能力，减少客服重复查询时间，并为后续智能助手或 AI 问答场景沉淀标准化知识内容。

教育经历
上海大学 | 工商管理 | 本科

补充建议
- 若你确实有 SQL、BI、大模型、Agent、RAG 或具体量化结果，请补充真实使用场景后再生成最终投递版。`;
}
