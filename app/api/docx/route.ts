import { Document, Packer, Paragraph, TextRun } from "docx";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { resumeText?: string };
  const resumeText = typeof body.resumeText === "string" ? body.resumeText : "";

  if (!resumeText.trim()) {
    return NextResponse.json({ error: "缺少简历文本" }, { status: 400 });
  }

  const paragraphs = resumeText.split("\n").map((line) => {
    const text = line.trimEnd();
    const isHeading =
      text === "个人简介" ||
      text === "核心技能" ||
      text === "工作经历" ||
      text === "项目经历" ||
      text === "教育经历" ||
      text === "补充建议";

    if (!text) {
      return new Paragraph({ spacing: { after: 80 } });
    }

    return new Paragraph({
      spacing: { after: isHeading ? 120 : 80 },
      children: [
        new TextRun({
          text,
          bold: isHeading || (!text.startsWith("-") && text.length < 36),
          size: isHeading ? 24 : 21,
          font: "Microsoft YaHei",
        }),
      ],
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const fileBody = new Uint8Array(buffer);

  return new Response(fileBody, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="optimized-resume.docx"',
    },
  });
}
