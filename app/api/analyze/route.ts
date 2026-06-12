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

type TermCategory = "hardSkill" | "responsibility" | "domain" | "tool" | "title" | "hardRequirement";

type TermDefinition = {
  label: string;
  category: TermCategory;
  weight: number;
  patterns: RegExp[];
};

type EvaluatedTerm = TermDefinition & {
  matched: boolean;
};

const termDefinitions: TermDefinition[] = [
  { label: "AI 产品", category: "domain", weight: 3, patterns: [/AI\s*产品/i, /人工智能产品/] },
  { label: "大模型", category: "hardSkill", weight: 3, patterns: [/大模型|大语言模型|LLM|GPT|DeepSeek|OpenAI/i] },
  { label: "智能体/Agent", category: "hardSkill", weight: 3, patterns: [/智能体|Agent/i] },
  { label: "RAG", category: "hardSkill", weight: 3, patterns: [/RAG|检索增强|向量数据库|Embedding/i] },
  { label: "Prompt", category: "hardSkill", weight: 2, patterns: [/Prompt|提示词|Few-Shot|CoT/i] },
  { label: "Dify/Coze", category: "tool", weight: 2, patterns: [/Dify|Coze/i] },
  { label: "SQL", category: "hardSkill", weight: 3, patterns: [/\bSQL\b|MySQL|PostgreSQL|数据库查询/i] },
  { label: "Excel", category: "tool", weight: 1.5, patterns: [/Excel|表格/i] },
  { label: "BI 工具", category: "tool", weight: 2.5, patterns: [/\bBI\b|Tableau|Power\s?BI|FineBI|帆软/i] },
  { label: "数据分析", category: "hardSkill", weight: 3, patterns: [/数据分析|指标分析|经营分析|用户分析/] },
  { label: "数据看板", category: "responsibility", weight: 2, patterns: [/数据看板|驾驶舱|报表/] },
  { label: "B 端/SaaS", category: "domain", weight: 3, patterns: [/B\s*端|B端|SaaS|企业服务|企业级/i] },
  { label: "企业后台", category: "domain", weight: 2.5, patterns: [/企业后台|管理后台|内部工具|管理平台/] },
  { label: "工作流", category: "domain", weight: 2, patterns: [/工作流|流程引擎|审批流|SOP/i] },
  { label: "需求分析", category: "responsibility", weight: 2.5, patterns: [/需求分析|需求调研|需求梳理|需求挖掘/] },
  { label: "产品规划", category: "responsibility", weight: 2.5, patterns: [/产品规划|路线图|版本规划|产品策略/] },
  { label: "功能设计", category: "responsibility", weight: 2, patterns: [/功能设计|方案设计|流程设计|交互设计/] },
  { label: "原型/PRD", category: "responsibility", weight: 2, patterns: [/原型|PRD|需求文档|产品文档/] },
  { label: "项目推进", category: "responsibility", weight: 2, patterns: [/项目推进|项目管理|里程碑|交付|上线/] },
  { label: "跨部门协作", category: "responsibility", weight: 1.5, patterns: [/跨部门|协同|协作|拉通|推动/] },
  { label: "用户调研", category: "responsibility", weight: 2, patterns: [/用户调研|访谈|问卷|用户旅程/] },
  { label: "竞品分析", category: "responsibility", weight: 1.5, patterns: [/竞品分析|市场分析|行业分析/] },
  { label: "测试迭代", category: "responsibility", weight: 2, patterns: [/测试|验证|迭代|优化|A\/B|AB测试/i] },
  { label: "量化成果", category: "responsibility", weight: 2, patterns: [/%|提升|降低|减少|增长|缩短|节省|准确率|转化率|满意度|采纳率/] },
  { label: "产品经理", category: "title", weight: 2, patterns: [/产品经理|Product\s*Manager/i] },
  { label: "解决方案", category: "title", weight: 1.5, patterns: [/解决方案|售前|方案经理/] },
];

const genericTermTriggers = /产品|运营|销售|市场|数据|算法|设计|研发|测试|项目|客户|用户|业务|管理|分析|增长|转化|内容|交付|系统|平台|模型|智能|AI|SaaS|CRM|ERP/i;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzeRequest;
  const resumeText = body.resumeText?.trim() || "";
  const jdText = body.jdText?.trim() || "";
  const mode = body.mode === "generate" ? "generate" : "analysis";
  const answers = body.answers || {};

  if (!resumeText || !jdText) {
    return NextResponse.json({ error: "缺少简历或 JD 文本" }, { status: 400 });
  }

  const deterministicAnalysis = buildDeterministicAnalysis({
    resumeText,
    jdText,
    targetRole: body.targetRole || "",
  });

  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://api.deepseek.com";
  const model = process.env.AI_MODEL || "deepseek-chat";

  if (!apiKey) {
    return NextResponse.json({ error: "AI 模型未配置，当前功能无法使用。请配置 AI_API_KEY 后重试。" }, { status: 503 });
  }

  try {
    let aiResult: { analysis?: unknown; optimizedResume?: unknown } | null = null;
    let optimizedResume: string | undefined;
    let repairHint = "";

    for (let attempt = 0; attempt < (mode === "generate" ? 2 : 1); attempt += 1) {
      aiResult = await callTextModel({
        apiKey,
        baseUrl,
        model,
        payload: {
          mode,
          resumeText,
          jdText,
          targetCompany: body.targetCompany || "",
          targetRole: body.targetRole || "",
          answers,
          deterministicAnalysis,
          repairHint,
        },
      });

      const rawOptimizedResume = mode === "generate" ? extractOptimizedResume(aiResult) : undefined;

      if (mode !== "generate") {
        break;
      }

      if (!rawOptimizedResume) {
        repairHint = "上一次没有返回 optimizedResume。请返回一份完整中文简历，并严格使用 optimizedResume 作为字段名。";
        continue;
      }

      const sanitizedResume = sanitizeOptimizedResume({
        optimizedResume: rawOptimizedResume,
        resumeText,
        answers,
      });

      try {
        if (!sanitizedResume || sanitizedResume.length < 120) {
          throw new Error("模型返回的优化版简历无效，正文长度不足");
        }
        assertOptimizedResumeFormat(sanitizedResume);
        optimizedResume = sanitizedResume;
        break;
      } catch (formatError) {
        const message = formatError instanceof Error ? formatError.message : "项目经历格式不合格";
        repairHint = `上一次 optimizedResume 未通过格式校验：${message}。请重新生成完整简历，项目经历中每个项目必须有 4-6 条小点，每条格式为“4-9 个中文字符标签：40-150 个中文字符正文”。不要解释原因，只返回 JSON。`;
      }
    }

    if (!aiResult) {
      throw new Error("模型返回为空");
    }

    const analysis = normalizeAnalysis(aiResult.analysis, deterministicAnalysis);
    if (mode === "generate" && !optimizedResume) {
      throw new Error("模型未返回优化版简历");
    }

    return NextResponse.json({
      source: "ai",
      model,
      analysis,
      optimizedResume,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败";

    return NextResponse.json({ error: `AI 模型调用失败，当前功能无法使用：${message}` }, { status: 503 });
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
  payload: Required<Pick<AnalyzeRequest, "mode" | "resumeText" | "jdText" | "targetCompany" | "targetRole" | "answers">> & {
    deterministicAnalysis: Analysis;
    repairHint?: string;
  };
}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: payload.mode === "generate" ? 6000 : 2600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(payload.mode),
        },
        {
          role: "user",
          content: JSON.stringify({
            ...payload,
            scoringLock: {
              currentScore: payload.deterministicAnalysis.currentScore,
              optimizedScore: payload.deterministicAnalysis.optimizedScore,
              scoreLabel: payload.deterministicAnalysis.scoreLabel,
              recommendation: payload.deterministicAnalysis.recommendation,
              isTransition: payload.deterministicAnalysis.isTransition,
              dimensions: payload.deterministicAnalysis.dimensions,
              matchedKeywords: payload.deterministicAnalysis.matchedKeywords,
              missingKeywords: payload.deterministicAnalysis.missingKeywords,
              lowRelevanceKeywords: payload.deterministicAnalysis.lowRelevanceKeywords,
            },
            repairHint: payload.repairHint || undefined,
          }),
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
7. 用户追问答案为空，代表该信息未确认，不能当作事实。
8. 不要把“数据看板/反馈整理”推断成 SQL、BI、Tableau、Power BI。
9. 不要把“知识库/智能客服”推断成大模型、RAG、Agent、LLM，除非原简历或追问答案明确写到。
10. 不要编造任何百分比、人数、金额、时长、效率提升数值。
11. 用户消息里的 scoringLock 是固定评分结果，analysis.currentScore、optimizedScore、scoreLabel、recommendation、isTransition、dimensions、matchedKeywords、missingKeywords、lowRelevanceKeywords 必须逐字照抄，不得重新打分。
12. 评分解释必须围绕这套固定规则：JD 关键词覆盖 35%，工作/项目经历相关性 25%，技能匹配度 20%，ATS 格式友好度 10%，年限/硬性门槛匹配 10%。
13. 必须返回 JSON，不要输出 Markdown，不要输出解释性前后缀。

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

${mode === "generate" ? `optimizedResume 必须是一份完整的中文简历文本，包含个人简介、核心技能、工作经历、项目经历、教育经历等适用部分。
optimizedResume 必须是 JSON 顶层字段，字段值必须是字符串，不要把简历拆成对象或数组。
整体结构参考优秀中文产品经理简历：顶部保留姓名和联系方式；个人简介用 3-5 条概括年限、方向、核心能力、可证明成果；核心技能按 JD 高频能力聚合；工作经历保持公司、岗位、时间；项目经历是重点。
项目经历必须结构清晰，每个项目优先使用：
项目名称 | 岗位名称/责任角色 | 时间段
- 项目背景：具体内容
- 产品规划：具体内容
- 数据准备：具体内容
- 方案设计：具体内容
- 测试迭代：具体内容
- 落地成果：具体内容
每个项目不得少于 4 条小点，通常 4-6 条，最多 6 条。
每条小点必须输出“标签：内容”的纯文本格式；标签必须是 4-9 个中文字符，正文内容必须是 40-150 个中文字符。
可用标签包括：项目背景、需求分析、产品规划、数据准备、方案设计、测试验证、测试迭代、工程护栏、运营优化、协作推进、售前支持、落地成果、场景泛化。
同一个项目内标签不要重复；如果原简历只有 1 个项目，也必须把这个项目扩展成 4-6 条结构化小点，但不能编造新项目。
每条小点要包含动作、方法/工具、协作对象或业务结果中的至少两类信息；有量化指标时只能使用原简历或追问答案已出现的数字。
没有证据的 JD 关键词只能放在分析和追问里，不能放进 optimizedResume；项目名称、岗位名称、时间段缺失时保留原文，不要补造。` : "questions 必须包含 3-5 个最能提升匹配度的追问。"}`;
}

function extractOptimizedResume(result: unknown) {
  if (!isRecord(result)) return undefined;
  if (typeof result.optimizedResume === "string" && result.optimizedResume.trim()) {
    return result.optimizedResume.trim();
  }

  const candidates = ["optimized_resume", "resume", "optimizedText", "optimized_text", "简历", "优化版简历"];
  for (const key of candidates) {
    const value = result[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const key of candidates) {
    const value = result[key];
    const flattened = flattenResumeValue(value);
    if (flattened) return flattened;
  }

  return undefined;
}

function flattenResumeValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const lines = value.map(flattenResumeValue).filter((item): item is string => Boolean(item));
    return lines.length ? lines.join("\n") : undefined;
  }
  if (isRecord(value)) {
    const lines = Object.values(value).map(flattenResumeValue).filter((item): item is string => Boolean(item));
    return lines.length ? lines.join("\n") : undefined;
  }
  return undefined;
}

function sanitizeOptimizedResume({
  optimizedResume,
  resumeText,
  answers,
}: {
  optimizedResume: string;
  resumeText: string;
  answers: Record<string, string>;
}) {
  const evidenceText = `${resumeText}\n${Object.values(answers).join("\n")}`;
  const normalizedResume = normalizeGeneratedResumeText(optimizedResume, evidenceText);
  const lines = normalizedResume.split("\n").filter((line) => {
    const result = unsupportedLineReason(line, evidenceText);
    if (result) {
      return false;
    }
    return true;
  });
  const cleanedLines = removePlaceholderSections(lines);
  return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeGeneratedResumeText(text: string, evidenceText: string) {
  return text
    .split("\n")
    .map(stripPlaceholderClauses)
    .map((line) => stripUnsupportedExperienceYears(line, evidenceText))
    .map((line) => stripUnsupportedOutcomeClauses(line, evidenceText))
    .join("\n");
}

function stripPlaceholderClauses(line: string) {
  return line
    .replace(/[（(][^）)]*(?:请补充|待补充|暂无|需确认|待确认|留空|具体[^）)]*确认)[^）)]*[）)]/g, "")
    .replace(/[（(][^）)]*建议补充[^）)]*[）)]/g, "")
    .replace(/[，。；,;]?[^，。；,;\n]*(?:请补充|待补充|暂无|需确认|待确认|建议补充|可补充|留空)[^，。；,;\n]*[，。；,;]?/g, "")
    .trimEnd();
}

function stripUnsupportedExperienceYears(line: string, evidenceText: string) {
  return line.replace(/(\d+)\s*年(?:以上)?(?=[^，。；\n]{0,18}经验)/g, (match, year: string) => {
    const exactYearPattern = new RegExp(`${year}\\s*年`);
    return exactYearPattern.test(evidenceText) ? match : "";
  });
}

function stripUnsupportedOutcomeClauses(line: string, evidenceText: string) {
  const guardedMetricTerms = ["准确率", "转化率", "留存率", "覆盖率", "满意度", "成本", "收入", "GMV", "客单价", "续费率"];
  let nextLine = line;

  for (const term of guardedMetricTerms) {
    if (nextLine.includes(term) && !evidenceText.includes(term)) {
      const escapedTerm = escapeRegExp(term);
      nextLine = nextLine.replace(new RegExp(`[，。；,;]?[^，。；,;\\n]*(?:提升|提高|改善|优化|降低|减少|增长)[^，。；,;\\n]*${escapedTerm}[^，。；,;\\n]*[，。；,;]?`, "g"), "");
      nextLine = nextLine.replace(new RegExp(`[，。；,;]?[^，。；,;\\n]*${escapedTerm}[^，。；,;\\n]*(?:提升|提高|改善|优化|降低|减少|增长)[^，。；,;\\n]*[，。；,;]?`, "g"), "");
    }
  }

  return nextLine.replace(/\s{2,}/g, " ").trimEnd();
}

function unsupportedLineReason(line: string, evidenceText: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/请补充|待补充|暂无|无相关经历|需确认|待确认|建议补充|可补充|留空|\(请补充\)|（请补充）/.test(trimmed)) {
    return "占位内容";
  }

  const guardedTerms = [
    { label: "SQL", pattern: /\bSQL\b|MySQL|PostgreSQL|数据库查询/i },
    { label: "BI 工具", pattern: /\bBI\b|Tableau|Power\s?BI|FineBI|帆软/i },
    { label: "大模型", pattern: /大模型|大语言模型|\bLLM\b|GPT|OpenAI|DeepSeek|LangChain/i },
    { label: "RAG", pattern: /\bRAG\b|检索增强|向量数据库|Embedding/i },
    { label: "Agent", pattern: /\bAgent\b|智能体/i },
    { label: "Axure", pattern: /\bAxure\b/i },
    { label: "Jira", pattern: /\bJira\b/i },
    { label: "敏捷管理", pattern: /敏捷开发|敏捷管理|Scrum/i },
    { label: "查询日志", pattern: /查询日志|埋点日志|行为日志/ },
    { label: "准确率", pattern: /准确率/ },
    { label: "转化率", pattern: /转化率/ },
    { label: "留存率", pattern: /留存率/ },
    { label: "覆盖率", pattern: /覆盖率/ },
    { label: "满意度", pattern: /满意度/ },
    { label: "成本", pattern: /成本/ },
  ];

  for (const term of guardedTerms) {
    if (term.pattern.test(trimmed) && !term.pattern.test(evidenceText)) {
      return term.label;
    }
  }

  const unsupportedMetric = findUnsupportedMetric(trimmed, evidenceText);
  return unsupportedMetric ? "量化指标" : null;
}

function removePlaceholderSections(lines: string[]) {
  const headings = new Set(["个人简介", "核心技能", "技能", "专业技能", "工作经历", "项目经历", "教育经历", "实习经历", "校园经历", "证书", "证书与技能", "补充建议"]);
  const withoutPlaceholders = lines.filter((line) => !/请补充|待补充|暂无|无相关经历|需确认|待确认|建议补充|可补充|留空|\(请补充\)|（请补充）/.test(line.trim()));

  return withoutPlaceholders.filter((line, index) => {
    const trimmed = line.trim();
    if (!headings.has(trimmed)) return true;

    const nextContentIndex = withoutPlaceholders.findIndex((item, itemIndex) => itemIndex > index && Boolean(item.trim()));
    if (nextContentIndex === -1) return false;
    const nextContent = withoutPlaceholders[nextContentIndex].trim();
    if (headings.has(nextContent)) return false;
    if (trimmed !== "项目经历") return true;
    const nextHeadingIndex = withoutPlaceholders.findIndex((item, itemIndex) => itemIndex > index && headings.has(item.trim()));
    const sectionEnd = nextHeadingIndex === -1 ? withoutPlaceholders.length : nextHeadingIndex;
    return withoutPlaceholders.slice(index + 1, sectionEnd).some((item) => item.trim().startsWith("-"));
  });
}

function assertOptimizedResumeFormat(optimizedResume: string) {
  const projectSection = extractProjectSection(optimizedResume);
  if (!projectSection) return;

  const projects = splitProjectBlocks(projectSection);
  const invalidProject = projects.find((project) => {
    const bullets = project.lines.filter((line) => /^[-•]\s*/.test(line.trim()));
    if (bullets.length < 4 || bullets.length > 6) {
      project.error = `项目小点数量为 ${bullets.length} 条`;
      return true;
    }

    return bullets.some((line) => {
      const match = line.trim().match(/^[-•]\s*([\u4e00-\u9fa5]{4,9})[：:]\s*(.+)$/);
      if (!match) {
        project.error = `小点格式错误：${line.trim().slice(0, 40)}`;
        return true;
      }
      const contentLength = countChineseContentLength(match[2]);
      if (contentLength < 40 || contentLength > 150) {
        project.error = `“${match[1]}”正文长度为 ${contentLength} 字`;
        return true;
      }
      return false;
    });
  });

  if (invalidProject) {
    throw new Error(`模型返回的项目经历格式不合格：${invalidProject.title}，${invalidProject.error || "小点不满足要求"}`);
  }
}

function extractProjectSection(text: string) {
  const lines = text.split("\n");
  const startIndex = lines.findIndex((line) => /^项目经历\s*[：:]?\s*$/.test(line.trim()));
  if (startIndex === -1) return null;
  const endIndex = lines.findIndex((line, index) => index > startIndex && isResumeSectionHeading(line));
  return lines.slice(startIndex + 1, endIndex === -1 ? lines.length : endIndex).filter((line) => line.trim());
}

function isResumeSectionHeading(line: string) {
  return /^(个人简介|个人总结|求职方向|核心技能|专业技能|技能|工作经历|项目经历|实习经历|教育经历|校园经历|证书|补充建议)\s*[：:]?\s*$/.test(line.trim());
}

function splitProjectBlocks(lines: string[]) {
  const projects: Array<{ title: string; lines: string[]; error?: string }> = [];
  let current: { title: string; lines: string[]; error?: string } | null = null;

  for (const line of lines) {
    if (!/^[-•]\s*/.test(line.trim())) {
      current = { title: line.trim(), lines: [] };
      projects.push(current);
      continue;
    }
    current?.lines.push(line);
  }

  return projects.filter((project) => project.lines.length);
}

function countChineseContentLength(text: string) {
  return text.replace(/\s+/g, "").length;
}

function findUnsupportedMetric(line: string, evidenceText: string) {
  if (!/(提升|降低|减少|增长|节省|缩短|扩大|转化率|效率|成本|覆盖率|准确率)/.test(line)) {
    return false;
  }

  const numbers = line.match(/\d+(?:\.\d+)?%?/g) || [];
  return numbers.some((number) => {
    if (/^20\d{2}$/.test(number) || /^20\d{2}\.\d{1,2}$/.test(number)) {
      return false;
    }
    return !evidenceText.includes(number);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAnalysis(input: unknown, fallback: Analysis): Analysis {
  const item = isRecord(input) ? input : {};

  return {
    currentScore: fallback.currentScore,
    optimizedScore: fallback.optimizedScore,
    scoreLabel: fallback.scoreLabel,
    recommendation: fallback.recommendation,
    isTransition: fallback.isTransition,
    dimensions: fallback.dimensions,
    matchedKeywords: fallback.matchedKeywords,
    missingKeywords: fallback.missingKeywords,
    lowRelevanceKeywords: fallback.lowRelevanceKeywords,
    issues: normalizeIssues(item.issues, fallback.issues),
    tasks: normalizeTasks(item.tasks, fallback.tasks),
    questions: normalizeQuestions(item.questions, fallback.questions),
  };
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

function stringOr(input: unknown, fallback: string) {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === "object" && !Array.isArray(input));
}

function buildDeterministicAnalysis({
  resumeText,
  jdText,
  targetRole,
}: {
  resumeText: string;
  jdText: string;
  targetRole: string;
}) {
  const evaluatedTerms = evaluateJdTerms(jdText, resumeText, targetRole);
  const matchedTerms = evaluatedTerms.filter((term) => term.matched);
  const missingTerms = evaluatedTerms.filter((term) => !term.matched);
  const hardSkillTerms = evaluatedTerms.filter((term) => term.category === "hardSkill" || term.category === "tool");
  const experienceTerms = evaluatedTerms.filter((term) => term.category === "responsibility" || term.category === "domain" || term.category === "title");
  const hardRequirementScore = scoreHardRequirements(resumeText, jdText, targetRole);
  const keywordScore = weightedCoverage(evaluatedTerms);
  const skillScore = hardSkillTerms.length ? weightedCoverage(hardSkillTerms) : keywordScore;
  const experienceScore = scoreExperienceRelevance(experienceTerms, resumeText, targetRole);
  const atsScore = scoreAtsFormat(resumeText);
  const currentScore = clampScore(Math.round(keywordScore * 0.35 + experienceScore * 0.25 + skillScore * 0.2 + atsScore * 0.1 + hardRequirementScore * 0.1));
  const missingHighWeight = missingTerms.filter((term) => term.weight >= 2.5).length;
  const optimizationGain = currentScore < 60 ? 16 : currentScore < 75 ? 12 : 8;
  const optimizedScore = clampScore(Math.min(95, currentScore + optimizationGain + Math.min(5, missingHighWeight)));
  const isTransition = currentScore < 65;
  const dimensions: Dimension[] = [
    { label: "JD 关键词覆盖", value: keywordScore },
    { label: "工作/项目经历相关性", value: experienceScore },
    { label: "技能匹配度", value: skillScore },
    { label: "ATS 格式友好度", value: atsScore },
    { label: "年限/硬性门槛匹配", value: hardRequirementScore },
  ];
  const matchedKeywords = matchedTerms.map((term) => term.label).slice(0, 8);
  const missingKeywords = missingTerms
    .filter((term) => term.weight >= 2)
    .map((term) => term.label)
    .slice(0, 8);
  const lowRelevanceKeywords = findLowRelevanceKeywords(resumeText, jdText);

  return {
    currentScore,
    optimizedScore,
    scoreLabel: getScoreLabel(currentScore),
    recommendation: getRecommendation(currentScore, missingKeywords),
    isTransition,
    dimensions,
    matchedKeywords: matchedKeywords.length ? matchedKeywords : ["需求分析", "项目推进"],
    missingKeywords: missingKeywords.length ? missingKeywords : ["量化成果", "JD 关键词前置"],
    lowRelevanceKeywords,
    issues: buildDeterministicIssues({
      currentScore,
      missingKeywords,
      matchedKeywords,
      lowRelevanceKeywords,
      dimensions,
    }),
    tasks: buildDeterministicTasks(missingKeywords, dimensions),
    questions: buildDeterministicQuestions(missingKeywords, evaluatedTerms),
  };
}

function evaluateJdTerms(jdText: string, resumeText: string, targetRole: string) {
  const jd = normalizeForMatching(`${targetRole}\n${jdText}`);
  const resume = normalizeForMatching(resumeText);
  const selected = termDefinitions
    .filter((term) => term.patterns.some((pattern) => pattern.test(jd)))
    .map((term) => ({
      ...term,
      matched: term.patterns.some((pattern) => pattern.test(resume)),
    }));
  const genericTerms = extractGenericJdTerms(jdText)
    .filter((label) => !selected.some((term) => term.label === label))
    .slice(0, 10)
    .map((label) => ({
      label,
      category: "responsibility" as const,
      weight: 1.2,
      patterns: [new RegExp(escapeRegExp(label), "i")],
      matched: resume.includes(normalizeForMatching(label)),
    }));
  const terms = [...selected, ...genericTerms];

  if (terms.length) return terms;

  return termDefinitions.slice(14, 22).map((term) => ({
    ...term,
    matched: term.patterns.some((pattern) => pattern.test(resume)),
  }));
}

function normalizeForMatching(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function extractGenericJdTerms(jdText: string) {
  const normalized = jdText.replace(/[，。；、,.!?！？:：()（）【】\[\]0-9]/g, "\n");
  const candidates = normalized
    .split(/\n|\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 10 && genericTermTriggers.test(item));
  return Array.from(new Set(candidates));
}

function weightedCoverage(terms: EvaluatedTerm[]) {
  if (!terms.length) return 50;

  const totalWeight = terms.reduce((sum, term) => sum + term.weight, 0);
  const matchedWeight = terms.filter((term) => term.matched).reduce((sum, term) => sum + term.weight, 0);
  return clampScore(Math.round((matchedWeight / totalWeight) * 100));
}

function scoreExperienceRelevance(terms: EvaluatedTerm[], resumeText: string, targetRole: string) {
  const coverage = terms.length ? weightedCoverage(terms) : 55;
  const projectScore = scoreProjectEvidence(resumeText);
  const titleScore = scoreRoleSimilarity(resumeText, targetRole);

  return clampScore(Math.round(coverage * 0.55 + projectScore * 0.3 + titleScore * 0.15));
}

function scoreRoleSimilarity(resumeText: string, targetRole: string) {
  if (!targetRole.trim()) return /产品经理|解决方案|项目经理|运营/.test(resumeText) ? 72 : 58;

  const targetTerms = targetRole
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2);
  if (!targetTerms.length) return 58;

  const normalizedResume = normalizeForMatching(resumeText);
  const matched = targetTerms.filter((term) => normalizedResume.includes(normalizeForMatching(term))).length;
  return clampScore(Math.round((matched / targetTerms.length) * 100));
}

function scoreProjectEvidence(resumeText: string) {
  let score = 38;
  const projectHeadings = resumeText.match(/项目经历|【项目经历|项目\d|项目[一二三四五六七八九十]/g)?.length || 0;
  const labeledBullets = resumeText.match(/项目背景|需求分析|产品规划|数据准备|方案设计|测试验证|测试迭代|工程护栏|落地成果|落地成效/g)?.length || 0;
  const metricLines = resumeText.match(/%|提升|降低|减少|增长|缩短|节省|准确率|满意度|采纳率|成本/g)?.length || 0;
  const collaborationLines = resumeText.match(/协同|跨部门|拉通|推动|组织|主导|负责/g)?.length || 0;

  score += Math.min(18, projectHeadings * 6);
  score += Math.min(20, labeledBullets * 3);
  score += Math.min(14, metricLines * 2);
  score += Math.min(10, collaborationLines);
  return clampScore(score);
}

function scoreAtsFormat(resumeText: string) {
  const sectionNames = ["个人简介", "个人总结", "核心技能", "专业技能", "工作经历", "项目经历", "教育经历"];
  const sectionScore = sectionNames.filter((section) => resumeText.includes(section)).length * 8;
  const lineCount = resumeText.split("\n").filter((line) => line.trim()).length;
  const enoughTextScore = resumeText.length >= 800 ? 18 : resumeText.length >= 400 ? 12 : 6;
  const lineScore = lineCount >= 20 ? 14 : lineCount >= 10 ? 9 : 5;
  const bulletScore = /^[-•]|^\d+[.)、]/m.test(resumeText) ? 10 : 4;
  const tablePenalty = /│|┌|┬|┐|└|┴|┘/.test(resumeText) ? 10 : 0;
  const imagePenalty = resumeText.length < 120 ? 18 : 0;

  return clampScore(32 + sectionScore + enoughTextScore + lineScore + bulletScore - tablePenalty - imagePenalty);
}

function scoreHardRequirements(resumeText: string, jdText: string, targetRole: string) {
  let score = 70;
  const requiredYears = extractRequiredYears(jdText);
  const resumeYears = extractResumeYears(resumeText);

  if (requiredYears > 0) {
    if (resumeYears >= requiredYears) score += 15;
    else if (resumeYears > 0 && resumeYears >= requiredYears - 1) score += 5;
    else score -= 18;
  }

  if (/本科|硕士|研究生|211|985|双一流/.test(jdText)) {
    score += /本科|硕士|研究生|211|985|双一流|学士|硕士/.test(resumeText) ? 8 : -10;
  }

  if (/产品经理|AI产品|AI\s*产品|解决方案/.test(`${targetRole}\n${jdText}`)) {
    score += /产品经理|产品负责人|解决方案|项目经理/.test(resumeText) ? 7 : -8;
  }

  return clampScore(score);
}

function extractRequiredYears(jdText: string) {
  const yearMatches = Array.from(jdText.matchAll(/(\d+)\s*年(?:以上)?(?:产品|工作|相关|项目|经验)/g));
  if (!yearMatches.length) return 0;
  return Math.max(...yearMatches.map((match) => Number(match[1])).filter(Number.isFinite));
}

function extractResumeYears(resumeText: string) {
  const directYears = Array.from(resumeText.matchAll(/(\d+)\s*年(?:以上)?(?:产品|工作|相关|项目|经验)/g))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  if (directYears.length) return Math.max(...directYears);

  const yearRanges = Array.from(resumeText.matchAll(/(20\d{2})[.\-/年]\d{0,2}[^0-9]{0,8}(?:至今|现在|20\d{2})/g)).length;
  return yearRanges ? Math.min(8, yearRanges * 2) : 0;
}

function findLowRelevanceKeywords(resumeText: string, jdText: string) {
  const possible = ["内容运营", "活动执行", "纯销售", "行政事务", "平面设计", "传统建筑设计", "课程运营", "客服执行", "市场投放"];
  const normalizedJd = normalizeForMatching(jdText);
  const list = possible.filter((keyword) => resumeText.includes(keyword) && !normalizedJd.includes(normalizeForMatching(keyword)));
  return list.length ? list.slice(0, 5) : ["泛化职责", "未量化表达"];
}

function getScoreLabel(score: number) {
  if (score >= 85) return "高度匹配";
  if (score >= 75) return "较匹配";
  if (score >= 65) return "中等匹配";
  if (score >= 50) return "匹配较弱";
  return "低匹配";
}

function getRecommendation(score: number, missingKeywords: string[]) {
  const missingText = missingKeywords.slice(0, 2).join("、");
  if (score >= 85) return "可以较有信心投递，建议优化关键词顺序和项目表达后提交";
  if (score >= 75) return "建议生成优化版后投递，重点补强项目证据和 JD 关键词";
  if (score >= 65) return `建议先补齐${missingText || "关键证据"}，再使用优化版投递`;
  if (score >= 50) return `建议作为转型尝试版处理，最需要补充${missingText || "岗位核心能力"}的真实证据`;
  return `当前不建议直接投递，最不匹配的是${missingText || "岗位核心能力"}，需要先补充真实项目或作品集`;
}

function buildDeterministicIssues({
  currentScore,
  missingKeywords,
  matchedKeywords,
  lowRelevanceKeywords,
  dimensions,
}: {
  currentScore: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  lowRelevanceKeywords: string[];
  dimensions: Dimension[];
}) {
  const weakestDimension = [...dimensions].sort((a, b) => a.value - b.value)[0];
  const mainMissing = missingKeywords.slice(0, 3).join("、") || "岗位核心关键词";
  const mainMatched = matchedKeywords.slice(0, 3).join("、") || "已有项目经验";
  const issues: Issue[] = [
    {
      title: currentScore < 65 ? "整体匹配度偏低" : `${weakestDimension.label}偏弱`,
      text: currentScore < 65
        ? `当前最关键的缺口是${mainMissing}，如果没有真实经历补充，只能生成转型尝试版，不建议把缺失能力写成事实。`
        : `当前主要短板集中在${weakestDimension.label}，建议围绕${mainMissing}补充真实项目证据。`,
      severity: "high",
    },
    {
      title: "已有经历需要更贴近 JD",
      text: `简历中已有${mainMatched}等可用证据，但需要前置到个人简介、核心技能和项目经历中，减少泛化表达。`,
      severity: "medium",
    },
  ];

  if (lowRelevanceKeywords.length) {
    issues.push({
      title: "低相关内容需要降权",
      text: `${lowRelevanceKeywords.slice(0, 3).join("、")}与目标 JD 的直接关联较弱，建议压缩篇幅，把空间留给岗位高频要求。`,
      severity: "medium",
    });
  }

  return issues.slice(0, 4);
}

function buildDeterministicTasks(missingKeywords: string[], dimensions: Dimension[]) {
  const weakestDimension = [...dimensions].sort((a, b) => a.value - b.value)[0];
  const missingText = missingKeywords.slice(0, 3).join("、") || "岗位核心关键词";

  return [
    {
      priority: "high" as const,
      title: "补齐关键证据",
      text: `优先确认是否有${missingText}相关真实经历；没有确认前，只能作为风险提示或追问，不能写入最终简历。`,
    },
    {
      priority: "medium" as const,
      title: "重写项目经历",
      text: "每个项目改成项目名称、角色、时间段加 4-6 条结构化小点，突出项目背景、方案设计、测试迭代和落地成果。",
    },
    {
      priority: "quick" as const,
      title: `优化${weakestDimension.label}`,
      text: "把 JD 高频词自然放进个人简介、核心技能和项目首句，提高 ATS 可识别度，但不新增未经确认的事实。",
    },
  ];
}

function buildDeterministicQuestions(missingKeywords: string[], evaluatedTerms: EvaluatedTerm[]) {
  const questions: Question[] = [];
  const missingSet = new Set(missingKeywords);

  if (["AI 产品", "大模型", "智能体/Agent", "RAG", "Prompt"].some((keyword) => missingSet.has(keyword))) {
    questions.push(defaultQuestions[0]);
  }
  if (["SQL", "BI 工具", "数据分析", "数据看板"].some((keyword) => missingSet.has(keyword))) {
    questions.push(defaultQuestions[1]);
  }
  if (["B 端/SaaS", "企业后台", "工作流"].some((keyword) => missingSet.has(keyword))) {
    questions.push(defaultQuestions[2]);
  }
  if (missingSet.has("量化成果") || evaluatedTerms.some((term) => term.label === "量化成果" && !term.matched)) {
    questions.push(defaultQuestions[3]);
  }
  questions.push(defaultQuestions[4]);

  return dedupeQuestions(questions.length >= 3 ? questions : defaultQuestions).slice(0, 5);
}

function dedupeQuestions(questions: Question[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    if (seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
}

function clampScore(input: number) {
  return Math.max(0, Math.min(100, Math.round(input)));
}
