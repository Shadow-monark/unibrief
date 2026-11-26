import mammoth from "mammoth";
import { extractText } from "unpdf";

export type SupportedDocumentKind = "pdf" | "image" | "docx" | "txt";

export interface ParsedDocumentInput {
  fileName: string;
  mimeType: string;
  kind: SupportedDocumentKind;
  base64Data?: string;
  textContent?: string;
  pageTexts?: string[];
  dataUrl?: string;
}

const IMAGE_MIME_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function inferExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : "";
}

export function detectDocumentKind(
  fileName: string,
  mimeType: string
): { kind: SupportedDocumentKind; normalizedMime: string } | null {
  const lowerMime = mimeType.toLowerCase();
  const ext = inferExtension(fileName);

  if (lowerMime === "application/pdf" || ext === "pdf") {
    return { kind: "pdf", normalizedMime: "application/pdf" };
  }

  if (
    lowerMime.startsWith("image/") ||
    ext in IMAGE_MIME_MAP
  ) {
    const resolved =
      lowerMime === "image/png" ||
      lowerMime === "image/jpeg" ||
      lowerMime === "image/webp"
        ? lowerMime
        : IMAGE_MIME_MAP[ext] ?? "image/png";
    return { kind: "image", normalizedMime: resolved };
  }

  if (
    lowerMime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return {
      kind: "docx",
      normalizedMime:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  if (lowerMime.startsWith("text/") || ext === "txt" || ext === "md") {
    return { kind: "txt", normalizedMime: "text/plain" };
  }

  return null;
}

export async function parseUploadedFile(
  file: File
): Promise<ParsedDocumentInput> {
  const detected = detectDocumentKind(file.name, file.type);
  if (!detected) {
    throw new Error(
      `Unsupported file format for "${file.name}". Please upload PDF, DOCX, TXT, PNG, JPG, or WEBP.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (detected.kind === "txt") {
    const textContent = buffer.toString("utf8").trim();
    if (!textContent) {
      throw new Error(`Text file "${file.name}" is empty.`);
    }
    return {
      fileName: file.name,
      mimeType: detected.normalizedMime,
      kind: "txt",
      textContent,
    };
  }

  if (detected.kind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    const textContent = result.value.trim();
    if (!textContent) {
      throw new Error(`DOCX file "${file.name}" contained no readable text.`);
    }
    return {
      fileName: file.name,
      mimeType: detected.normalizedMime,
      kind: "docx",
      textContent,
    };
  }

  if (detected.kind === "image") {
    const base64Data = buffer.toString("base64");
    const dataUrl =
      buffer.byteLength <= 2 * 1024 * 1024
        ? `data:${detected.normalizedMime};base64,${base64Data}`
        : undefined;
    return {
      fileName: file.name,
      mimeType: detected.normalizedMime,
      kind: "image",
      base64Data,
      dataUrl,
    };
  }

  // PDF: extract text page-by-page via unpdf and preserve base64 payload
  const base64Data = buffer.toString("base64");
  let pageTexts: string[] = [];
  let textContent = "";
  try {
    const extracted = await extractText(new Uint8Array(arrayBuffer), {
      mergePages: false,
    });
    pageTexts = Array.isArray(extracted.text)
      ? extracted.text.map((t) => t.trim())
      : [];
    textContent = pageTexts
      .map((pageText, index) => `[Page ${index + 1}]\n${pageText}`)
      .join("\n\n")
      .trim();
  } catch {
    // Scanned PDF without embedded text layer
    pageTexts = [];
    textContent = "";
  }

  return {
    fileName: file.name,
    mimeType: "application/pdf",
    kind: "pdf",
    base64Data,
    textContent: textContent || undefined,
    pageTexts: pageTexts.length > 0 ? pageTexts : undefined,
  };
}

export function createTextDocumentInput(
  rawText: string,
  titleHint?: string
): ParsedDocumentInput {
  const clean = rawText.trim();
  if (!clean) {
    throw new Error("Circular text cannot be empty.");
  }
  const safeName = titleHint?.trim()
    ? `${titleHint.trim().replace(/[^a-zA-Z0-9_-]+/g, "_")}.txt`
    : `pasted_circular_${Date.now()}.txt`;
  return {
    fileName: safeName,
    mimeType: "text/plain",
    kind: "txt",
    textContent: clean,
  };
}
