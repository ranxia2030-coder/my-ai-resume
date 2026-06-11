import mammoth from "mammoth";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

const maxFileSize = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "没有收到文件" }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return NextResponse.json({ error: "文件过大，请上传 8MB 以内的 PDF 或 DOCX" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text = "";

    if (file.type === "application/pdf" || fileName.endsWith(".pdf")) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.type.startsWith("text/") || fileName.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json({ error: "当前仅支持 PDF、DOCX 和 TXT。老版 DOC 请先另存为 DOCX，或直接粘贴文本。" }, { status: 400 });
    }

    const cleanedText = normalizeText(text);

    if (cleanedText.length < 30) {
      return NextResponse.json({ error: "没有解析到足够文本。可能是扫描版 PDF，请直接粘贴简历文本。" }, { status: 422 });
    }

    return NextResponse.json({ text: cleanedText });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: `简历解析失败：${message}。请直接粘贴简历文本。` }, { status: 500 });
  }
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
