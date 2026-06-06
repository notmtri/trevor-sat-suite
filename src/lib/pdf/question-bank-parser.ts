import type {
  Difficulty,
  Question,
  QuestionAsset,
  Section,
} from "@/lib/domain";
import { saveLocalAsset } from "@/lib/local-assets";
import { makeAcceptedAnswers } from "@/lib/scoring";
import { sha256 } from "@/lib/utils";

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type PdfLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  items: PdfTextItem[];
};

export type PdfPageStructure = {
  pageNumber: number;
  width: number;
  height: number;
  lines: PdfLine[];
  text: string;
  questionId?: string;
};

export type QuestionSpan = {
  sourceId: string;
  startPageIndex: number;
  endPageIndex: number;
  assessment: string;
  section: Section;
  domain: string;
  skill: string;
  difficulty: Difficulty;
  answerText: string;
  responseType: "multiple_choice" | "student_produced";
  promptSegments: Array<{ pageIndex: number; top: number; bottom: number }>;
  rationaleSegments: Array<{ pageIndex: number; top: number; bottom: number }>;
  extractedText: string;
  warnings: string[];
};

type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
};

type PdfPageLike = {
  getViewport: (options: { scale: number }) => {
    width: number;
    height: number;
    convertToViewportPoint: (x: number, y: number) => [number, number];
  };
  getTextContent: () => Promise<{ items: Array<PdfTextItem | object> }>;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
};

async function getPdfJs() {
  const pdfjs =
    typeof window === "undefined"
      ? await import("pdfjs-dist/legacy/build/pdf.mjs")
      : await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

function isTextItem(item: PdfTextItem | object): item is PdfTextItem {
  return "str" in item && "transform" in item;
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function buildLines(
  items: PdfTextItem[],
  viewport: ReturnType<PdfPageLike["getViewport"]>,
) {
  const positioned = items
    .filter((item) => normalizeText(item.str))
    .map((item) => {
      const [x, baselineY] = viewport.convertToViewportPoint(
        item.transform[4],
        item.transform[5],
      );
      const height = Math.max(
        Math.abs(item.transform[3] ?? 0),
        item.height ?? 0,
        5,
      );
      return {
        item,
        x,
        y: baselineY - height,
        width: item.width,
        height,
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const groups: typeof positioned[] = [];
  for (const item of positioned) {
    const group = groups.find(
      (candidate) =>
        Math.abs(candidate.reduce((sum, part) => sum + part.y, 0) / candidate.length - item.y) <
        2.5,
    );
    if (group) group.push(item);
    else groups.push([item]);
  }

  return groups
    .map((group) => {
      group.sort((a, b) => a.x - b.x);
      const text = normalizeText(group.map((part) => part.item.str).join(" "));
      const x = Math.min(...group.map((part) => part.x));
      const y = Math.min(...group.map((part) => part.y));
      const right = Math.max(
        ...group.map((part) => part.x + Math.max(part.width, 1)),
      );
      const bottom = Math.max(
        ...group.map((part) => part.y + part.height),
      );
      return {
        text,
        x,
        y,
        width: right - x,
        height: bottom - y,
        items: group.map((part) => part.item),
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function findLine(
  page: PdfPageStructure,
  matcher: RegExp,
  occurrence = 0,
) {
  return page.lines.filter((line) => matcher.test(line.text))[occurrence];
}

function valueInHeaderColumn(
  page: PdfPageStructure,
  label: string,
  nextLabel?: string,
) {
  const headerLine = page.lines.find(
    (line) =>
      line.text.includes("Assessment") && line.text.includes("Difficulty"),
  );
  if (!headerLine) return "";
  const itemX = (text: string) =>
    headerLine.items.find((item) => item.str === text)?.transform[4];
  const assessmentX = itemX("Assessment");
  const domainX = itemX("Domain");
  const skillX = itemX("Skill");
  const difficultyX = itemX("Difficulty");
  const testX = headerLine.items.find(
    (item) =>
      assessmentX !== undefined &&
      domainX !== undefined &&
      item.transform[4] > assessmentX &&
      item.transform[4] < domainX,
  )?.transform[4];
  const columns: Record<string, number | undefined> = {
    Assessment: assessmentX,
    Test: testX,
    Domain: domainX,
    Skill: skillX,
    Difficulty: difficultyX,
  };
  const startX = columns[label];
  const endX = nextLabel ? columns[nextLabel] : page.width;
  if (startX === undefined || endX === undefined) return "";
  const questionLabel = page.lines.find((line) => line.text === "Question");
  const valueItems = page.lines
    .filter(
      (line) =>
        line.y > headerLine.y + headerLine.height &&
        line.y < (questionLabel?.y ?? page.height),
    )
    .flatMap((line) =>
      line.items.map((item) => ({
        item,
        x: item.transform[4],
        y: line.y,
      })),
    )
    .filter(({ x }) => x >= startX - 2 && x < endX - 2)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  let result = "";
  let previousRight = 0;
  let previousY = -1;
  for (const { item, x, y } of valueItems) {
    const newLine = previousY >= 0 && Math.abs(y - previousY) > 3;
    const gap = x - previousRight;
    const separator = !result
      ? ""
      : newLine || gap > 1.5
        ? " "
        : "";
    result += `${separator}${item.str}`;
    previousRight = x + item.width;
    previousY = y;
  }
  return normalizeText(result);
}

function parseMetadata(page: PdfPageStructure) {
  const assessment = valueInHeaderColumn(page, "Assessment", "Test") || "SAT";
  const test = valueInHeaderColumn(page, "Test", "Domain");
  const domain = valueInHeaderColumn(page, "Domain", "Skill") || "Uncategorized";
  const skill = valueInHeaderColumn(page, "Skill", "Difficulty") || "Uncategorized";
  const difficultyRaw = valueInHeaderColumn(page, "Difficulty");
  const difficulty = (["Easy", "Medium", "Hard"].find((value) =>
    difficultyRaw.includes(value),
  ) ?? "Medium") as Difficulty;
  const section: Section = /reading|writing/i.test(test)
    ? "Reading and Writing"
    : "Math";
  return { assessment, section, domain, skill, difficulty };
}

export async function readQuestionBankStructure(
  data: ArrayBuffer | Uint8Array,
) {
  const pdfjs = await getPdfJs();
  const bytes =
    data instanceof Uint8Array
      ? new Uint8Array(data)
      : new Uint8Array(data.slice(0));
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const document = (await loadingTask.promise) as unknown as PdfDocumentLike;
  if (document.numPages > 250) {
    await loadingTask.destroy();
    throw new Error("PDF imports are limited to 250 pages.");
  }
  const pages: PdfPageStructure[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const items = textContent.items.filter(isTextItem);
      const lines = buildLines(items, viewport);
      const text = lines.map((line) => line.text).join("\n");
      const questionId = text.match(/Question ID:\s*([0-9a-z-]+)/i)?.[1];
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        lines,
        text,
        questionId,
      });
    }
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Some WebKit builds reject worker teardown after a successful parse.
    }
  }

  return pages;
}

export function createQuestionSpans(pages: PdfPageStructure[]) {
  const starts = pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => page.questionId);

  return starts.map(({ page: firstPage, index: startPageIndex }, startIndex) => {
    const endPageIndex = starts[startIndex + 1]?.index ?? pages.length;
    const spanPages = pages.slice(startPageIndex, endPageIndex);
    const metadata = parseMetadata(firstPage);
    const warnings: string[] = [];
    const questionLabel = firstPage.lines.find(
      (line) => line.text === "Question",
    );

    if (!questionLabel) warnings.push("Student-visible Question marker not found.");

    let answerText = "";
    let correctPageIndex = -1;
    let correctLine: PdfLine | undefined;
    let rationalePageIndex = -1;
    let rationaleLine: PdfLine | undefined;

    for (let index = 0; index < spanPages.length; index += 1) {
      const page = spanPages[index];
      const foundCorrect = findLine(page, /^Correct Answer:/i);
      if (foundCorrect && !correctLine) {
        correctLine = foundCorrect;
        correctPageIndex = startPageIndex + index;
        answerText = normalizeText(
          foundCorrect.text.replace(/^Correct Answer:\s*/i, ""),
        );
      }
      const foundRationale = findLine(page, /^Rationale$/i);
      if (foundRationale && !rationaleLine) {
        rationaleLine = foundRationale;
        rationalePageIndex = startPageIndex + index;
      }
    }

    if (!correctLine || !answerText) warnings.push("Correct answer not found.");
    if (!rationaleLine) warnings.push("Rationale marker not found.");

    const promptSegments: QuestionSpan["promptSegments"] = [];
    if (questionLabel && correctLine) {
      for (
        let pageIndex = startPageIndex;
        pageIndex <= correctPageIndex;
        pageIndex += 1
      ) {
        const page = pages[pageIndex];
        const top =
          pageIndex === startPageIndex
            ? questionLabel.y + questionLabel.height + 3
            : 8;
        const bottom =
          pageIndex === correctPageIndex ? correctLine.y - 4 : page.height - 8;
        if (bottom > top + 2) promptSegments.push({ pageIndex, top, bottom });
      }
    }

    const rationaleSegments: QuestionSpan["rationaleSegments"] = [];
    if (rationaleLine) {
      for (
        let pageIndex = rationalePageIndex;
        pageIndex < endPageIndex;
        pageIndex += 1
      ) {
        const page = pages[pageIndex];
        const top =
          pageIndex === rationalePageIndex
            ? rationaleLine.y + rationaleLine.height + 3
            : 8;
        const bottom = page.height - 8;
        if (bottom > top + 2) rationaleSegments.push({ pageIndex, top, bottom });
      }
    }

    const extractedText = normalizeText(
      spanPages.map((page) => page.text).join(" "),
    );
    return {
      sourceId: firstPage.questionId!,
      startPageIndex,
      endPageIndex,
      ...metadata,
      answerText,
      responseType: /^[A-D]$/i.test(answerText)
        ? ("multiple_choice" as const)
        : ("student_produced" as const),
      promptSegments,
      rationaleSegments,
      extractedText,
      warnings,
    };
  });
}

function trimCanvas(source: HTMLCanvasElement, padding = 24) {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  const { width, height } = source;
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width;
  let right = 0;
  let top = height;
  let bottom = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const offset = (y * width + x) * 4;
      const visible =
        pixels[offset + 3] > 10 &&
        (pixels[offset] < 248 ||
          pixels[offset + 1] < 248 ||
          pixels[offset + 2] < 248);
      if (visible) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right <= left || bottom <= top) return source;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(width, right + padding);
  bottom = Math.min(height, bottom + padding);
  const target = document.createElement("canvas");
  target.width = right - left;
  target.height = bottom - top;
  target
    .getContext("2d")
    ?.drawImage(
      source,
      left,
      top,
      target.width,
      target.height,
      0,
      0,
      target.width,
      target.height,
    );
  return target;
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG rendering failed."))),
      "image/png",
    );
  });
}

async function renderAssets(
  document: PdfDocumentLike,
  sourceId: string,
  kind: "prompt" | "rationale",
  segments: QuestionSpan["promptSegments"],
) {
  const assets: QuestionAsset[] = [];
  for (let order = 0; order < segments.length; order += 1) {
    const segment = segments[order];
    const page = await document.getPage(segment.pageIndex + 1);
    const viewport = page.getViewport({ scale: 3 });
    const fullCanvas = window.document.createElement("canvas");
    fullCanvas.width = Math.ceil(viewport.width);
    fullCanvas.height = Math.ceil(viewport.height);
    const context = fullCanvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas is not supported in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const crop = window.document.createElement("canvas");
    const top = Math.max(0, Math.floor(segment.top * 3));
    const bottom = Math.min(
      fullCanvas.height,
      Math.ceil(segment.bottom * 3),
    );
    crop.width = fullCanvas.width;
    crop.height = Math.max(1, bottom - top);
    crop
      .getContext("2d")
      ?.drawImage(
        fullCanvas,
        0,
        top,
        fullCanvas.width,
        crop.height,
        0,
        0,
        fullCanvas.width,
        crop.height,
      );
    const trimmed = trimCanvas(crop);
    const blob = await canvasToBlob(trimmed);
    const key = `${sourceId}-${kind}-${order}-${crypto.randomUUID()}`;
    const storagePath = await saveLocalAsset(key, blob);
    assets.push({
      id: key,
      kind,
      order,
      sourcePage: segment.pageIndex + 1,
      storagePath,
      width: trimmed.width,
      height: trimmed.height,
    });
  }
  return assets;
}

export type ImportProgress = {
  phase: "reading" | "rendering" | "complete";
  current: number;
  total: number;
  message: string;
};

export async function importQuestionBankPdf(
  file: File,
  onProgress?: (progress: ImportProgress) => void,
) {
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > 50 * 1024 * 1024) {
    throw new Error("PDF imports are limited to 50 MB.");
  }
  const signature = new TextDecoder("ascii").decode(buffer.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new Error("The selected file is not a valid PDF.");
  }
  const sourceHash = await sha256(buffer);
  let sourceDocumentPath: string;
  try {
    sourceDocumentPath = await saveLocalAsset(
      `source-pdf-${sourceHash}`,
      new Blob([buffer], { type: "application/pdf" }),
    );
  } catch (error) {
    throw new Error(
      `Source PDF audit storage failed: ${
        error instanceof Error ? error.message : "unknown browser error"
      }`,
    );
  }
  onProgress?.({
    phase: "reading",
    current: 0,
    total: 1,
    message: "Reading Question Bank structure",
  });
  let pages: PdfPageStructure[];
  try {
    pages = await readQuestionBankStructure(buffer);
  } catch (error) {
    throw new Error(
      `PDF structure parsing failed: ${
        error instanceof Error ? error.message : "unknown browser error"
      }`,
    );
  }
  const spans = createQuestionSpans(pages);
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer.slice(0)),
  });
  const document = (await loadingTask.promise) as unknown as PdfDocumentLike;
  const questions: Question[] = [];

  try {
    for (let index = 0; index < spans.length; index += 1) {
      const span = spans[index];
      onProgress?.({
        phase: "rendering",
        current: index,
        total: spans.length,
        message: `Rendering question ${span.sourceId}`,
      });
      let promptAssets: QuestionAsset[];
      let rationaleAssets: QuestionAsset[];
      try {
        promptAssets = await renderAssets(
          document,
          span.sourceId,
          "prompt",
          span.promptSegments,
        );
        rationaleAssets = await renderAssets(
          document,
          span.sourceId,
          "rationale",
          span.rationaleSegments,
        );
      } catch (error) {
        throw new Error(
          `Rendering question ${span.sourceId} failed: ${
            error instanceof Error ? error.message : "unknown browser error"
          }`,
        );
      }
      const answerValues = span.answerText.split(",").map((value) => value.trim());
      const versionHash = await sha256(
        `${span.sourceId}|${span.extractedText}|${span.answerText}`,
      );
      questions.push({
        id: crypto.randomUUID(),
        sourceId: span.sourceId,
        versionHash,
        assessment: span.assessment,
        section: span.section,
        domain: span.domain,
        skill: span.skill,
        difficulty: span.difficulty,
        responseType: span.responseType,
        acceptedAnswers: makeAcceptedAnswers(answerValues),
        promptAssets,
        rationaleAssets,
        extractedText: span.extractedText,
        sourceFileName: file.name,
        sourceDocumentPath,
        importedAt: new Date().toISOString(),
        status: "draft",
        reviewNotes: span.warnings.join(" "),
      });
    }
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // Rendered assets are already durable; cleanup must not discard them.
    }
  }

  onProgress?.({
    phase: "complete",
    current: spans.length,
    total: spans.length,
    message: `${spans.length} questions ready for review`,
  });
  return { questions, pages, spans };
}
