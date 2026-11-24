// TypeScript port of the Template V2 content hydration helpers from
// servers/fastapi/api/v1/ppt/endpoints/presentation.py and templates/v2/content.py
import { getRepeatedTopLevelGroupSchemaName } from "./templateSchema";
import type { JsonObject } from "./types";

type Dict = Record<string, any>;

const GENERATED_VALUE_ELEMENT_TYPES = new Set([
  "text",
  "math",
  "image",
  "text-list",
  "table",
  "chart",
  "infographic",
]);

const GENERATED_TABLE_TEXT_FONT = {
  family: "Sniglet",
  size: 12,
  color: "#082314",
};
const GENERATED_TABLE_HEADER_FONT = {
  ...GENERATED_TABLE_TEXT_FONT,
  bold: true,
};
const GENERATED_TABLE_CELL_FILL = { color: "#F8F4E9", opacity: 1 };
const GENERATED_TABLE_CELL_STROKE = { color: "#D8D3C4", opacity: 1, width: 1 };

const STRONG_DELIMITERS = ["**", "__"];
const EMPHASIS_DELIMITERS = ["*", "_"];
const MARKDOWN_DELIMITERS = [...STRONG_DELIMITERS, ...EMPHASIS_DELIMITERS];

const LATEX_TAG_PATTERN = /<latex>([\s\S]*?)<\/latex>/gi;

function isRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function repeatedSuffixNameIndex(name: string): string {
  return name.replace(/_\d+(?=_|$)/g, "");
}

export function normalizeLatex(value: string): string {
  const normalized = value.trim();
  if (
    normalized.startsWith("$$") &&
    normalized.endsWith("$$") &&
    normalized.length > 4
  ) {
    return normalized.slice(2, -2).trim().slice(0, 4000);
  }
  if (
    normalized.startsWith("\\[") &&
    normalized.endsWith("\\]") &&
    normalized.length > 4
  ) {
    return normalized.slice(2, -2).trim().slice(0, 4000);
  }
  return normalized.slice(0, 4000);
}

// ---------------------------------------------------------------------------
// Asset content helpers
// ---------------------------------------------------------------------------

export function setAssetUrl(asset: Dict, assetType: "image" | "icon", url: string) {
  asset[`${assetType}_url`] = url;
  asset[`__${assetType}_url__`] = url;
}

export function assetUrlKey(assetType: "image" | "icon") {
  return `${assetType}_url`;
}

// ---------------------------------------------------------------------------
// Repeated groups
// ---------------------------------------------------------------------------

export function repeatedChildSourceIndex(
  index: number,
  options: {
    templateCount: number;
    contentCount: number;
    centerWhenReduced: boolean;
  },
): number {
  const { templateCount, contentCount, centerWhenReduced } = options;
  if (centerWhenReduced && contentCount < templateCount) {
    const start = Math.floor((templateCount - contentCount) / 2);
    return start + index;
  }
  return Math.min(index, templateCount - 1);
}

export function hydrateRepeatedTopLevelGroups(
  elements: any[],
  content: unknown,
  applyItem: (element: any, item: unknown) => any,
): any[] | null {
  if (!isRecord(content)) return null;

  const fieldName = getRepeatedTopLevelGroupSchemaName(elements);
  if (!fieldName) return null;

  const values = content[fieldName];
  if (!Array.isArray(values) || !elements.length) return null;

  const hydrated: any[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const sourceIndex = repeatedChildSourceIndex(index, {
      templateCount: elements.length,
      contentCount: values.length,
      centerWhenReduced: true,
    });
    const source = clone(elements[sourceIndex]);
    if (!isRecord(source)) return null;
    hydrated.push(applyItem(source, values[index]));
  }
  return hydrated;
}

// ---------------------------------------------------------------------------
// Markdown / text runs
// ---------------------------------------------------------------------------

function readMarkdownDelimiter(text: string, index: number, delimiters: string[]) {
  for (const delimiter of delimiters) {
    if (text.startsWith(delimiter, index)) return delimiter;
  }
  return null;
}

function nextMarkdownDelimiterIndex(text: string, start: number): number {
  let result = -1;
  for (const delimiter of MARKDOWN_DELIMITERS) {
    const index = text.indexOf(delimiter, start);
    if (index !== -1 && (result === -1 || index < result)) result = index;
  }
  return result;
}

function parseMarkdownText(text: string): [string, Dict][] {
  const parsed: [string, Dict][] = [];
  let index = 0;

  while (index < text.length) {
    const strong = readMarkdownDelimiter(text, index, STRONG_DELIMITERS);
    if (strong) {
      const close = text.indexOf(strong, index + strong.length);
      if (close > index + strong.length) {
        parsed.push([text.slice(index + strong.length, close), { bold: true }]);
        index = close + strong.length;
        continue;
      }
    }

    const emphasis = readMarkdownDelimiter(text, index, EMPHASIS_DELIMITERS);
    if (emphasis) {
      const close = text.indexOf(emphasis, index + emphasis.length);
      if (close > index + emphasis.length) {
        parsed.push([
          text.slice(index + emphasis.length, close),
          { italic: true },
        ]);
        index = close + emphasis.length;
        continue;
      }
    }

    const nextIndex = nextMarkdownDelimiterIndex(text, index + 1);
    parsed.push([
      text.slice(index, nextIndex === -1 ? text.length : nextIndex),
      {},
    ]);
    index = nextIndex === -1 ? text.length : nextIndex;
  }

  return parsed;
}

function appendTextRun(runs: Dict[], run: Dict) {
  const text = run.text;
  if (typeof text !== "string" || text === "") return;

  const previous = runs[runs.length - 1];
  if (isRecord(previous)) {
    const previousStyle = Object.fromEntries(
      Object.entries(previous).filter(([key]) => key !== "text"),
    );
    const nextStyle = Object.fromEntries(
      Object.entries(run).filter(([key]) => key !== "text"),
    );
    if (
      JSON.stringify(previousStyle) === JSON.stringify(nextStyle) &&
      typeof previous.text === "string"
    ) {
      previous.text += text;
      return;
    }
  }

  runs.push(run);
}

function splitLatexTags(text: string): Dict[] | null {
  if (!text.toLowerCase().includes("<latex>")) return null;

  const runs: Dict[] = [];
  let lastIndex = 0;
  let sawLatex = false;
  LATEX_TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LATEX_TAG_PATTERN.exec(text))) {
    if (match.index > lastIndex) {
      runs.push({ text: text.slice(lastIndex, match.index) });
    }
    const latex = normalizeLatex(match[1]);
    if (!latex) return null;
    runs.push({ type: "latex", latex });
    sawLatex = true;
    lastIndex = match.index + match[0].length;
  }
  if (!sawLatex) return null;
  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex) });
  if (/<latex>/i.test(runs.map((run) => run.text ?? "").join(""))) return null;
  return runs;
}

function mergeRunStyles(first: Dict, second: Dict): Dict {
  return {
    ...(isRecord(first.font) ? clone(first.font) : {}),
    ...(isRecord(second) ? second : {}),
  };
}

function applyStyleToTextRuns(
  runs: Dict[],
  baseRun: Dict,
  fallbackFont: unknown,
): Dict[] {
  const results: Dict[] = [];
  for (const run of runs) {
    if (run.type === "latex") {
      const next: Dict = { ...clone(baseRun), type: "latex", latex: run.latex };
      delete next.text;
      if (!isRecord(next.font) && isRecord(fallbackFont)) {
        next.font = clone(fallbackFont);
      }
      results.push(next);
      continue;
    }

    const segments = parseMarkdownText(String(run.text ?? ""));
    for (const [segmentText, style] of segments) {
      const next: Dict = clone(baseRun);
      next.text = segmentText;
      if (Object.keys(style).length) {
        next.font = mergeRunStyles(next.font, style);
      }
      appendTextRun(results, next);
    }
  }
  return results;
}

export function textRunsFromMarkdown(
  text: string,
  firstRun: unknown,
  fallbackFont: unknown = null,
): Dict[] {
  const templateRun = isRecord(firstRun) ? clone(firstRun) : {};

  const latexRuns = splitLatexTags(text);
  const parsed = latexRuns
    ? latexRuns
    : parseMarkdownText(text).map(([value, style]) => ({ text: value, ...style }));

  const hasMarkdownStyle = parsed.some(
    (run) => run.type !== "latex" && (run.bold || run.italic),
  );

  let baseRun: Dict = isRecord(templateRun) ? clone(templateRun) : {};
  if (isRecord(fallbackFont)) {
    baseRun.font = {
      ...clone(fallbackFont),
      ...(isRecord(baseRun.font) ? clone(baseRun.font) : {}),
    };
  }
  if (hasMarkdownStyle && isRecord(baseRun.font)) {
    delete baseRun.font.bold;
    delete baseRun.font.italic;
  }

  const styleRuns = latexRuns
    ? parsed
    : parseMarkdownText(text).map(([value, style]) => ({ text: value, ...style }));
  const runs = applyStyleToTextRuns(styleRuns, baseRun, fallbackFont);
  if (runs.length) return runs;
  return [{ ...baseRun, text: " " }];
}

// ---------------------------------------------------------------------------
// Value appliers
// ---------------------------------------------------------------------------

function readTemplateText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && !Number.isNaN(value)) return String(value);
  if (isRecord(value)) {
    if (typeof value.text === "string") return value.text;
    if (typeof value.text === "number") return String(value.text);
  }
  return null;
}

function applyTextContent(element: Dict, value: unknown): Dict {
  const text = readTemplateText(value);
  if (text === null || text === "") return clone(element);

  const updated = clone(element);
  const firstRun = Array.isArray(element.runs) && isRecord(element.runs[0])
    ? element.runs[0]
    : {};
  updated.runs = textRunsFromMarkdown(text, firstRun, element.font ?? null);
  delete updated.text;
  return updated;
}

function applyMathContent(element: Dict, value: unknown): Dict {
  const latex = readTemplateText(value);
  if (latex === null || latex.trim() === "") return clone(element);

  const updated = clone(element);
  updated.latex = normalizeLatex(latex);
  return updated;
}

function hasImageClipPath(element: Dict): boolean {
  for (const key of ["clip_path", "clipPath", "clippath"]) {
    const value = element[key];
    if (
      typeof value === "string" &&
      value.trim() &&
      value.trim().toLowerCase() !== "none"
    ) {
      return true;
    }
  }
  return false;
}

function looksLikeSvgAssetReference(value: string | null): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("data:image/svg+xml")) return true;
  return normalized.split("?")[0].split("#")[0].endsWith(".svg");
}

function normalizeGeneratedImageFit(element: Dict, assetUrl: string) {
  if (element.is_icon === true || element.fit === "cover") return;
  if (hasImageClipPath(element)) return;
  if (looksLikeSvgAssetReference(assetUrl)) return;
  element.fit = "cover";
}

function assetPrompt(value: unknown, isIcon: boolean): string | null {
  if (!isRecord(value)) return null;
  const keys = isIcon
    ? ["icon_query", "__icon_query__", "query", "prompt"]
    : ["image_prompt", "__image_prompt__", "prompt", "query"];
  for (const key of keys) {
    const prompt = value[key];
    if (typeof prompt === "string" && prompt.trim()) return prompt;
  }
  return null;
}

function applyImageContent(element: Dict, value: unknown): Dict {
  if (!isRecord(value)) return clone(element);

  let url: string | null = null;
  for (const key of [
    "image_url",
    "icon_url",
    "__image_url__",
    "__icon_url__",
    "url",
  ]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate) {
      url = candidate;
      break;
    }
  }
  if (!url) return clone(element);

  const updated = clone(element);
  updated.data = url;
  normalizeGeneratedImageFit(updated, url);
  const prompt = assetPrompt(value, element.is_icon === true);
  if (prompt) updated.prompt = prompt;
  return updated;
}

function applyTextListContent(element: Dict, value: unknown): Dict {
  if (!Array.isArray(value)) return clone(element);

  const existingItems = Array.isArray(element.items) ? element.items : [];
  const items: Dict[][] = [];
  value.forEach((item, index) => {
    const text = readTemplateText(item);
    if (text === null || text === "") return;
    const existingRuns = Array.isArray(existingItems[index])
      ? existingItems[index]
      : null;
    const firstRun =
      existingRuns && isRecord(existingRuns[0]) ? existingRuns[0] : {};
    items.push(textRunsFromMarkdown(text, firstRun, element.font ?? null));
  });

  const updated = clone(element);
  updated.items = items;
  return updated;
}

function readTemplatePrimitiveTableText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value).toLowerCase();
  if (typeof value === "number") return String(value);
  return null;
}

function readTemplateTableText(value: unknown): string | null {
  const primitive = readTemplatePrimitiveTableText(value);
  if (primitive !== null) return primitive.slice(0, 80);
  if (!isRecord(value)) return null;

  if (Array.isArray(value.runs)) {
    const runText = value.runs
      .filter(isRecord)
      .map((run) => (typeof run.text === "string" ? run.text : ""))
      .join("");
    if (runText) return runText.slice(0, 80);
  }

  for (const key of ["text", "value"]) {
    const text = readTemplatePrimitiveTableText(value[key]);
    if (text !== null) return text.slice(0, 80);
  }
  return null;
}

function firstTemplateTextRun(runs: unknown): Dict {
  return Array.isArray(runs) && isRecord(runs[0]) ? runs[0] : {};
}

function replaceTemplateTableCellText(
  cell: unknown,
  text: string,
  isHeader: boolean,
): Dict {
  const font = isHeader ? GENERATED_TABLE_HEADER_FONT : GENERATED_TABLE_TEXT_FONT;
  if (!isRecord(cell)) {
    return {
      color: GENERATED_TABLE_CELL_FILL,
      stroke: GENERATED_TABLE_CELL_STROKE,
      font,
      runs: textRunsFromMarkdown(text, { font }, null),
    };
  }

  const updated = clone(cell);
  const firstRun = firstTemplateTextRun(cell.runs);
  const runFont = isRecord(firstRun.font) ? firstRun.font : null;
  const nextFont = runFont ?? cell.font ?? font;
  updated.color = cell.color ?? cell.fill ?? GENERATED_TABLE_CELL_FILL;
  updated.stroke = cell.stroke ?? GENERATED_TABLE_CELL_STROKE;
  updated.font = cell.font ?? nextFont;
  updated.runs = textRunsFromMarkdown(text, firstRun, nextFont);
  delete updated.text;
  delete updated.fill;
  return updated;
}

function mergeTemplateTableRowToLength(
  templateCells: any[],
  generatedTexts: (string | null)[],
  isHeader: boolean,
): Dict[] {
  const fallbackCell = templateCells[templateCells.length - 1] ?? null;
  return generatedTexts.map((text, index) => {
    const cell = index < templateCells.length ? templateCells[index] : fallbackCell;
    return replaceTemplateTableCellText(cell, text ?? "", isHeader);
  });
}

function applyTableContent(element: Dict, value: unknown): Dict {
  if (!isRecord(value)) return clone(element);

  const templateColumns = Array.isArray(element.columns) ? element.columns : [];
  const templateRows = Array.isArray(element.rows)
    ? element.rows.filter(Array.isArray)
    : [];

  const generatedColumns = Array.isArray(value.columns)
    ? value.columns.map(readTemplateTableText)
    : [];
  const generatedRows = Array.isArray(value.rows)
    ? value.rows
        .filter(Array.isArray)
        .map((row: any[]) => row.map(readTemplateTableText))
    : [];
  const fallbackRow = templateRows.length
    ? templateRows[templateRows.length - 1]
    : templateColumns;

  const updated = clone(element);
  updated.columns = generatedColumns.length
    ? mergeTemplateTableRowToLength(templateColumns, generatedColumns, true)
    : clone(templateColumns);
  updated.rows = generatedRows.length
    ? generatedRows.map((row: (string | null)[], index: number) =>
        mergeTemplateTableRowToLength(
          index < templateRows.length ? templateRows[index] : fallbackRow,
          row,
          false,
        ),
      )
    : clone(templateRows);
  return updated;
}

function readTemplateDataLabels(value: unknown): string | null {
  if (value === true) return "top";
  if (value === false || value == null) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["base", "mid", "top", "outside"].includes(normalized)) return normalized;
  }
  return null;
}

function applyChartContent(element: Dict, value: unknown): Dict {
  const updated = clone(element);
  delete updated.data_labels_color;
  delete updated.grid;
  if (!isRecord(value)) return updated;

  const chartType = value.chartType ?? value.chart_type;
  if (
    [
      "area",
      "bar",
      "bubble",
      "donut",
      "horizontal_bar",
      "horizontal_stacked_bar",
      "line",
      "pie",
      "polar_area",
      "radar",
      "scatter",
      "stacked_bar",
    ].includes(chartType)
  ) {
    updated.chart_type = chartType;
  }
  if (typeof value.title === "string") updated.title = value.title;
  if (Array.isArray(value.categories) && value.categories.length) {
    updated.categories = value.categories;
  }
  if (Array.isArray(value.series) && value.series.length) {
    updated.series = value.series;
  }
  if (Array.isArray(value.colors) && value.colors.length) {
    updated.colors = value.colors;
  }

  const stringFields: [string, string][] = [
    ["axisColor", "axis_color"],
    ["axis_color", "axis_color"],
    ["gridColor", "grid_color"],
    ["grid_color", "grid_color"],
    ["legendColor", "legend_color"],
    ["legend_color", "legend_color"],
    ["xAxisTitle", "x_axis_title"],
    ["x_axis_title", "x_axis_title"],
    ["yAxisTitle", "y_axis_title"],
    ["y_axis_title", "y_axis_title"],
    ["source", "source"],
  ];
  for (const [sourceKey, targetKey] of stringFields) {
    if (typeof value[sourceKey] === "string") updated[targetKey] = value[sourceKey];
  }

  const booleanFields: [string, string][] = [
    ["xAxis", "x_axis"],
    ["x_axis", "x_axis"],
    ["yAxis", "y_axis"],
    ["y_axis", "y_axis"],
    ["xAxisGrid", "x_axis_grid"],
    ["x_axis_grid", "x_axis_grid"],
    ["yAxisGrid", "y_axis_grid"],
    ["y_axis_grid", "y_axis_grid"],
  ];
  for (const [sourceKey, targetKey] of booleanFields) {
    if (typeof value[sourceKey] === "boolean") updated[targetKey] = value[sourceKey];
  }

  for (const sourceKey of ["dataLabels", "data_labels"]) {
    if (sourceKey in value) {
      updated.data_labels = readTemplateDataLabels(value[sourceKey]);
    }
  }
  return updated;
}

const INLINE_MARKDOWN_PATTERNS = [
  /!\[([^\]]*)\]\([^)]*\)/g,
  /\[([^\]]+)\]\([^)]*\)/g,
  /`([^`]+)`/g,
  /~~([^~]+)~~/g,
  /\*\*\*([^*]+)\*\*\*/g,
  /___([^_]+)___/g,
  /\*\*([^*]+)\*\*/g,
  /__([^_]+)__/g,
  /\*([^*]+)\*/g,
  /(?<!\w)_([^_]+)_(?!\w)/g,
];

export function infographicMarkdownToPlainText(value: unknown): any {
  if (typeof value === "string") {
    let text = value;
    for (const pattern of INLINE_MARKDOWN_PATTERNS) {
      text = text.replace(pattern, "$1");
    }
    return text;
  }
  if (Array.isArray(value)) return value.map(infographicMarkdownToPlainText);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        infographicMarkdownToPlainText(item),
      ]),
    );
  }
  return value;
}

function applyInfographicContent(element: Dict, value: unknown): Dict {
  const updated = clone(element);
  if (!isRecord(value)) return updated;

  const data = value.data;
  if (isRecord(data)) {
    const currentData = updated.data;
    const incomingData = infographicMarkdownToPlainText(data);
    if (isRecord(currentData)) {
      if (typeof currentData.type === "string") {
        incomingData.type = currentData.type;
      }
      updated.data = { ...clone(currentData), ...incomingData };
    } else {
      updated.data = incomingData;
    }
  }

  if (Array.isArray(value.colors) && value.colors.length) {
    updated.colors = clone(value.colors);
  }
  return updated;
}

export function applyTemplateContentValue(element: Dict, value: unknown): Dict {
  const elementType = element.type;
  if (elementType === "text") return applyTextContent(element, value);
  if (elementType === "math") return applyMathContent(element, value);
  if (elementType === "image") return applyImageContent(element, value);
  if (elementType === "text-list") return applyTextListContent(element, value);
  if (elementType === "table") return applyTableContent(element, value);
  if (elementType === "chart") return applyChartContent(element, value);
  if (elementType === "infographic") return applyInfographicContent(element, value);
  return clone(element);
}

// ---------------------------------------------------------------------------
// Tree walk
// ---------------------------------------------------------------------------

function contentNameCandidates(name: string): string[] {
  const withoutNumericToken = repeatedSuffixNameIndex(name);
  const withoutPrefix = withoutNumericToken.includes("_")
    ? withoutNumericToken.split("_").slice(1).join("_")
    : withoutNumericToken;

  const candidates: string[] = [];
  for (const candidate of [name, withoutNumericToken, withoutPrefix]) {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  }
  return candidates;
}

function templateContentValue(
  content: Dict,
  name: string,
  preferredKeys?: string[] | null,
): [boolean, any] {
  const candidates: string[] = [];
  for (const candidate of [
    ...(preferredKeys ?? []),
    ...contentNameCandidates(name),
  ]) {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  }
  for (const candidate of candidates) {
    if (candidate in content) return [true, content[candidate]];
  }
  return [false, null];
}

function repeatedContentKeysForName(
  name: string,
  content: Dict,
  nameOccurrences: Map<string, number>,
): string[] | null {
  const occurrenceIndex = nameOccurrences.get(name) ?? 0;
  nameOccurrences.set(name, occurrenceIndex + 1);
  if (occurrenceIndex === 0) return null;
  const suffixedKey = `${name}_${occurrenceIndex + 1}`;
  return suffixedKey in content ? [suffixedKey] : null;
}

function normalizeRepeatedNames(value: unknown, index: number) {
  if (Array.isArray(value)) {
    value.forEach((item) => normalizeRepeatedNames(item, index));
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.name === "string") {
    value.name = value.name.replace(/_\d+(?=_|$)/g, `_${index + 1}`);
  }
  for (const nested of Object.values(value)) {
    normalizeRepeatedNames(nested, index);
  }
}

function repeatedChildForIndex(
  children: any[],
  index: number,
  options: { contentCount: number; centerWhenReduced: boolean },
): any {
  const sourceIndex = repeatedChildSourceIndex(index, {
    templateCount: children.length,
    contentCount: options.contentCount,
    centerWhenReduced: options.centerWhenReduced,
  });
  const source = clone(children[sourceIndex]);
  if (!isRecord(source)) return source;
  delete source.__presenton_manual_position;
  if (index >= children.length) normalizeRepeatedNames(source, index);
  return source;
}

function applyTemplateContentToElementList(
  elements: any[],
  content: unknown,
  options: {
    directValue?: boolean;
    nameOccurrences?: Map<string, number> | null;
  } = {},
): any[] {
  const nameOccurrences = options.nameOccurrences ?? new Map<string, number>();
  return elements.map((element) =>
    applyTemplateContentToElement(element, content, {
      directValue: options.directValue,
      nameOccurrences,
    }),
  );
}

function applyTemplateContentToChildren(
  children: any[],
  value: unknown,
  content: unknown,
  options: {
    directValue?: boolean;
    nameOccurrences?: Map<string, number> | null;
    centerRepeatedChildren?: boolean;
  } = {},
): any[] {
  if (Array.isArray(value) && children.length) {
    return value.map((item, index) =>
      applyTemplateContentToElement(
        repeatedChildForIndex(children, index, {
          contentCount: value.length,
          centerWhenReduced: options.centerRepeatedChildren === true,
        }),
        item,
        { directValue: true },
      ),
    );
  }

  return applyTemplateContentToElementList(children, content, {
    directValue: options.directValue,
    nameOccurrences: options.nameOccurrences,
  });
}

export function applyTemplateContentToElement(
  element: unknown,
  content: unknown,
  options: {
    directValue?: boolean;
    preferredContentKeys?: string[] | null;
    nameOccurrences?: Map<string, number> | null;
  } = {},
): any {
  if (!isRecord(element)) return element;

  const contentValues = isRecord(content) ? content : {};
  const elementType = element.type;
  const name = typeof element.name === "string" ? element.name : null;
  let hasValue = false;
  let value: any = null;
  let preferredKeys = options.preferredContentKeys ?? null;

  if (name) {
    if (
      options.directValue &&
      ["container", "flex", "grid", "group"].includes(elementType)
    ) {
      if (name in contentValues) {
        hasValue = true;
        value = contentValues[name];
      } else if (Object.keys(contentValues).length === 1) {
        for (const candidate of contentNameCandidates(name).slice(1)) {
          if (candidate in contentValues) {
            hasValue = true;
            value = contentValues[candidate];
            break;
          }
        }
      }
    } else {
      if (!preferredKeys && options.nameOccurrences) {
        preferredKeys = repeatedContentKeysForName(
          name,
          contentValues,
          options.nameOccurrences,
        );
      }
      [hasValue, value] = templateContentValue(
        contentValues,
        name,
        preferredKeys,
      );
    }
  }

  if (
    element.decorative === false &&
    name &&
    hasValue &&
    GENERATED_VALUE_ELEMENT_TYPES.has(elementType)
  ) {
    return applyTemplateContentValue(element, value);
  }

  // Repeated flex/grid schemas can make the array item itself the value for a
  // decorative-false child element.
  if (
    options.directValue &&
    !hasValue &&
    element.decorative === false &&
    GENERATED_VALUE_ELEMENT_TYPES.has(elementType)
  ) {
    return applyTemplateContentValue(element, content);
  }

  const nestedContent = isRecord(value) ? value : contentValues;
  const nestedDirectValue = Boolean(options.directValue) && !hasValue;
  const nestedNameOccurrences =
    hasValue && isRecord(value) ? new Map() : options.nameOccurrences;

  if (elementType === "container") {
    const updated = clone(element);
    updated.child = applyTemplateContentToElement(element.child, nestedContent, {
      directValue: nestedDirectValue,
      nameOccurrences: nestedNameOccurrences,
    });
    return updated;
  }

  if (["flex", "grid", "group"].includes(elementType)) {
    const updated = clone(element);
    const children = Array.isArray(element.children) ? element.children : [];
    updated.children = applyTemplateContentToChildren(children, value, nestedContent, {
      directValue: nestedDirectValue,
      nameOccurrences: nestedNameOccurrences,
      centerRepeatedChildren: elementType === "group",
    });
    return updated;
  }

  return clone(element);
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export function templateComponentContentKeys(components: any[]): string[] {
  const ids = components.map((component, index) =>
    isRecord(component) && typeof component.id === "string"
      ? component.id
      : `component_${index}`,
  );

  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  const indexes = new Map<string, number>();
  const used = new Set<string>();
  const keys: string[] = [];
  for (const id of ids) {
    const occurrenceIndex = indexes.get(id) ?? 0;
    indexes.set(id, occurrenceIndex + 1);
    const base =
      (counts.get(id) ?? 0) > 1 ? `${id}_${occurrenceIndex}` : id;

    let key = base;
    let suffix = 1;
    while (used.has(key)) {
      key = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(key);
    keys.push(key);
  }
  return keys;
}

export function applyTemplateContentToUi(
  ui: unknown,
  content: unknown,
): any {
  if (!isRecord(ui)) return ui;
  const components = Array.isArray(ui.components) ? ui.components : null;
  if (!components || !components.length) return ui;

  const contentValues = isRecord(content) ? content : {};
  const componentKeys = templateComponentContentKeys(components);
  const hydrated = clone(ui);
  const hydratedComponents = Array.isArray(hydrated.components)
    ? hydrated.components
    : null;
  if (!hydratedComponents) return hydrated;

  hydratedComponents.forEach((component: any, index: number) => {
    if (!isRecord(component)) return;

    const componentId = component.id;
    let componentContent = contentValues[componentKeys[index]];
    if (!isRecord(componentContent) && typeof componentId === "string") {
      componentContent = contentValues[componentId];
    }
    if (!isRecord(componentContent)) componentContent = {};

    const elements = component.elements;
    if (!Array.isArray(elements)) return;

    const repeatedGroups = hydrateRepeatedTopLevelGroups(
      elements,
      componentContent,
      (element, item) =>
        applyTemplateContentToElement(element, item, { directValue: true }),
    );
    component.elements =
      repeatedGroups ??
      applyTemplateContentToElementList(elements, componentContent);
  });

  return hydrated;
}
