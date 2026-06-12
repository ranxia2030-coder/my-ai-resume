import mammoth from "mammoth";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import pdfParse from "pdf-parse/lib/pdf-parse";
import { createWorker } from "tesseract.js";

export const runtime = "nodejs";

const maxFileSize = 8 * 1024 * 1024;
const imageOcrTimeoutMs = 25000;
const tessdataDir = path.join("/tmp", "jd-align-tessdata");

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "没有收到文件" }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return NextResponse.json({ error: "文件过大，请上传 8MB 以内的 PDF、DOCX、TXT 或图片" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text = "";

    if (file.type === "application/pdf" || fileName.endsWith(".pdf")) {
      const result = await pdfParse(buffer);
      text = result.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.type.startsWith("text/") || fileName.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(fileName)) {
      text = await extractImageText(buffer);
    } else {
      return NextResponse.json({ error: "当前支持 PDF、DOCX、TXT、PNG、JPG、WEBP。老版 DOC 请先另存为 DOCX，或直接粘贴文本。" }, { status: 400 });
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

async function extractImageText(buffer: Buffer) {
  await prepareTessdata();
  const worker = await withTimeout(
    createWorker("chi_sim+eng", 1, {
      workerPath: path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
      langPath: tessdataDir,
      cachePath: path.join("/tmp", "jd-align-ocr-cache"),
    }),
    imageOcrTimeoutMs,
  );

  try {
    const result = await withTimeout(worker.recognize(buffer), imageOcrTimeoutMs);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

async function prepareTessdata() {
  await fs.mkdir(tessdataDir, { recursive: true });
  await Promise.all([
    copyIfMissing(
      path.join(process.cwd(), "node_modules", "@tesseract.js-data", "chi_sim", "4.0.0_best_int", "chi_sim.traineddata.gz"),
      path.join(tessdataDir, "chi_sim.traineddata.gz"),
    ),
    copyIfMissing(
      path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"),
      path.join(tessdataDir, "eng.traineddata.gz"),
    ),
  ]);
}

async function copyIfMissing(source: string, destination: string) {
  try {
    await fs.access(destination);
  } catch {
    await fs.copyFile(source, destination);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("图片 OCR 超时，请直接粘贴文本，或换一张更清晰的截图。"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
