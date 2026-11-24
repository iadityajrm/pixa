// TypeScript port of servers/fastapi/templates/v2/schema.py
import type { JsonObject } from "./types";

export const CONTENT_TYPES = new Set([
  "text",
  "image",
  "text-list",
  "table",
  "chart",
  "infographic",
]);

export const CHART_TYPE_VALUES = [
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
];

export const INFOGRAPHIC_TYPES = [
  "progress_bar",
  "gauge",
  "gantt",
  "timeline",
  "roadmap",
  "milestone_timeline",
  "staircase",
  "supply_chain",
  "stair_step_blocks",
  "maturity_model",
  "pillar_framework",
  "transformation_hub",
  "diagonal_circles",
  "risk_matrix",
  "chevron_process",
  "radial_cycle",
  "conversion_funnel",
  "vertical_funnel",
  "pyramid",
  "segmented_wheel",
  "customer_journey",
  "before_after",
  "impact_effort_matrix",
  "comparison_matrix",
  "org_chart",
  "decision_tree",
  "mind_map",
] as const;

const REPEATED_NAME_SUFFIX = /_\d+$/;
const COMPONENT_REPEATED_NAME_TOKEN = /_\d+(?=_|$)/;
const COMPONENT_SCHEMA_METADATA_KEYS = new Set([
  "$schema",
  "title",
  "description",
  "x-element-type",
  "x-element-path",
]);

const TABLE_CELL_HORIZONTAL_PADDING = 12;
const TABLE_CELL_VERTICAL_PADDING = 6;
const TABLE_DEFAULT_FONT_SIZE = 14;
const TABLE_TEXT_CAPACITY_SAFETY_FACTOR = 0.85;

type Dict = Record<string, any>;
type SchemaNode = [string, Dict];

function isRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isEditableElement(element: Dict): boolean {
  return element.decorative === false;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function nonnegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function primitiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function withoutNone<T>(value: T): any {
  if (Array.isArray(value)) return value.map(withoutNone);
  if (isRecord(value)) {
    const result: Dict = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== null && item !== undefined) result[key] = withoutNone(item);
    }
    return result;
  }
  return value;
}

function compact(value: Dict): Dict {
  const result: Dict = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== null && item !== undefined) result[key] = item;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Table text limits
// ---------------------------------------------------------------------------

function tableCellText(cell: Dict): string {
  const runs = Array.isArray(cell.runs) ? cell.runs : [];
  return runs
    .map((run: any) => (isRecord(run) ? String(run.text ?? run.latex ?? "") : ""))
    .join("");
}

function tableCellTypography(cells: Dict[]): [number, number] {
  const fonts: Dict[] = [];
  for (const cell of cells) {
    if (isRecord(cell.font)) fonts.push(cell.font);
    const runs = Array.isArray(cell.runs) ? cell.runs : [];
    for (const run of runs) {
      if (isRecord(run) && isRecord(run.font)) fonts.push(run.font);
    }
  }
  if (!fonts.length) fonts.push({});

  const glyphWidths: number[] = [];
  const lineHeights: number[] = [];
  for (const font of fonts) {
    const fontSize = positiveNumber(font.size) ?? TABLE_DEFAULT_FONT_SIZE;
    const widthFactor = font.bold === true ? 0.62 : 0.58;
    const letterSpacing = nonnegativeNumber(font.letter_spacing) ?? 0;
    glyphWidths.push(fontSize * widthFactor + letterSpacing);

    const rawLineHeight = positiveNumber(font.line_height);
    if (rawLineHeight === null) lineHeights.push(fontSize * 1.2);
    else if (rawLineHeight > 2) lineHeights.push(rawLineHeight);
    else lineHeights.push(fontSize * rawLineHeight);
  }

  return [Math.max(...glyphWidths), Math.max(...lineHeights)];
}

function tableSectionTextLimits(
  cells: Dict[],
  options: {
    cellWidth: number;
    cellHeight: number;
    fallbackCells?: Dict[];
  },
): [number, number] {
  const { cellWidth, cellHeight } = options;
  const typographyCells = cells.length
    ? cells
    : options.fallbackCells?.length
      ? options.fallbackCells
      : [];
  const [glyphWidth, lineHeight] = tableCellTypography(typographyCells);
  const charactersPerLine = Math.max(1, Math.floor(cellWidth / glyphWidth));
  const lineCount = Math.max(1, Math.floor(cellHeight / lineHeight + 0.15));
  const estimatedMaximum = Math.max(
    1,
    Math.floor(charactersPerLine * lineCount * TABLE_TEXT_CAPACITY_SAFETY_FACTOR),
  );
  const texts = cells.map(tableCellText);
  const observedMaximum = texts.reduce((max, text) => Math.max(max, text.length), 0);
  const minimum = texts.length && texts.every((text) => text.trim()) ? 1 : 0;
  return [minimum, Math.max(estimatedMaximum, observedMaximum)];
}

export function tableTextLimits(
  element: Dict,
): [[number | null, number | null], [number | null, number | null]] {
  const size = isRecord(element.size) ? element.size : null;
  if (!size) return [[null, null], [null, null]];

  const width = positiveNumber(size.width);
  const height = positiveNumber(size.height);
  if (width === null || height === null) return [[null, null], [null, null]];

  const columns = Array.isArray(element.columns)
    ? element.columns.filter(isRecord)
    : [];
  const rows = Array.isArray(element.rows)
    ? element.rows.filter(Array.isArray)
    : [];
  const bodyCells = rows.flatMap((row: any[]) => row.filter(isRecord));

  const declaredColumns = primitiveInt(element.max_columns);
  const columnCount = Math.max(1, declaredColumns ?? columns.length);
  const declaredRows = primitiveInt(element.max_rows);
  const rowCount = Math.max(0, declaredRows ?? rows.length);

  const cellWidth = Math.max(
    1,
    width / columnCount - 2 * TABLE_CELL_HORIZONTAL_PADDING,
  );
  const cellHeight = Math.max(
    1,
    height / (rowCount + 1) - 2 * TABLE_CELL_VERTICAL_PADDING,
  );

  return [
    tableSectionTextLimits(columns, { cellWidth, cellHeight }),
    tableSectionTextLimits(bodyCells, {
      cellWidth,
      cellHeight,
      fallbackCells: columns,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Content schemas
// ---------------------------------------------------------------------------

function elementName(element: Dict): string | null {
  if (typeof element.name !== "string") return null;
  const stripped = element.name.trim();
  return stripped || null;
}

function contentSchemaForElement(element: Dict): Dict {
  const elementType = element.type;

  if (elementType === "text") {
    // Provide 40% headroom on maxLength so the model can express complete, deep thoughts;
    // the text auto-fitter dynamically reduces font size down to 40% to fit the box cleanly.
    const expandedMaxLength = typeof element.max_length === "number"
      ? Math.round(element.max_length * 1.4)
      : undefined;

    return compact({
      type: "string",
      minLength: element.min_length,
      maxLength: expandedMaxLength,
    });
  }

  if (elementType === "image") {
    const key = element.is_icon === true ? "icon_query" : "image_prompt";
    return objectSchema({ [key]: { type: "string" } });
  }

  if (elementType === "text-list") {
    return compact({
      type: "array",
      minItems: element.min_items,
      maxItems: element.max_items,
      items: compact({
        type: "string",
        minLength: element.min_item_length,
        maxLength: element.max_item_length,
      }),
    });
  }

  if (elementType === "table") {
    const [, bodyLimits] = tableTextLimits(element);
    return compact({
      type: "array",
      minItems: element.min_rows,
      maxItems: element.max_rows,
      items: compact({
        type: "array",
        minItems: element.min_columns,
        maxItems: element.max_columns,
        items: compact({
          type: "string",
          minLength: bodyLimits[0],
          maxLength: bodyLimits[1],
        }),
      }),
    });
  }

  if (elementType === "chart") return chartContentSchema(element);
  if (elementType === "infographic") return infographicContentSchema(element);

  throw new Error(`unsupported content element type: ${elementType}`);
}

function chartContentSchema(element: Dict): Dict {
  const properties: Dict = {
    chart_type: { type: "string", enum: CHART_TYPE_VALUES },
  };
  if (typeof element.title === "string" && element.title.trim()) {
    properties.title = { type: "string" };
  }
  properties.categories = {
    type: "array",
    items: { type: "string" },
    maxItems: 24,
  };
  properties.series = {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        values: { type: "array", items: { type: "number" }, maxItems: 24 },
      },
      required: ["name", "values"],
    },
    maxItems: 12,
  };
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

function infographicTextItemSchema(hierarchy = false): Dict {
  const properties: Dict = {
    heading: { type: "string" },
    description: { type: "string" },
    label: { type: "string" },
    focus: { type: "string" },
    icon: {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string" },
        color: { type: "string" },
      },
      required: ["url", "color"],
    },
  };
  if (hierarchy) {
    properties.id = { type: "string" };
    properties.parent_id = { type: ["string", "null"] };
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(hierarchy ? { required: ["id", "heading"] } : {}),
  };
}

function infographicDataContentSchema(infographicType: string): Dict {
  const properties: Dict = {
    type: { type: "string", const: infographicType },
  };
  const required = ["type"];

  if (["progress_bar", "gauge"].includes(infographicType)) {
    properties.min_value = { type: "number" };
    properties.max_value = { type: "number" };
    properties.value = { type: "number" };
    required.push("min_value", "max_value", "value");
  } else if (infographicType === "gantt") {
    const position = {
      type: "object",
      additionalProperties: false,
      properties: {
        column: { type: "integer", minimum: 0 },
        offset: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["column", "offset"],
    };
    properties.columns = {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" } },
        required: ["label"],
      },
    };
    properties.rows = {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                start: position,
                end: position,
              },
              required: ["name", "start", "end"],
            },
          },
        },
        required: ["label", "items"],
      },
    };
    required.push("columns", "rows");
  } else if (infographicType === "comparison_matrix") {
    const itemSchema = infographicTextItemSchema();
    itemSchema.properties.values = {
      type: "array",
      items: { type: "string" },
    };
    itemSchema.required = ["heading", "values"];
    properties.criteria = {
      type: "array",
      minItems: 1,
      items: { type: "string" },
    };
    properties.items = { type: "array", minItems: 1, items: itemSchema };
    required.push("criteria", "items");
  } else {
    const hierarchy = ["org_chart", "decision_tree"].includes(infographicType);
    const itemSchema = infographicTextItemSchema(hierarchy);
    if (["conversion_funnel", "vertical_funnel"].includes(infographicType)) {
      itemSchema.properties.value = { type: "number" };
      itemSchema.required = ["value", "heading"];
    }
    if (infographicType === "mind_map") {
      itemSchema.properties.items = {
        type: "array",
        items: infographicTextItemSchema(),
      };
    }
    properties.items = {
      type: "array",
      minItems: 1,
      ...(["conversion_funnel", "vertical_funnel"].includes(infographicType)
        ? { maxItems: 8 }
        : {}),
      items: itemSchema,
    };
    required.push("items");

    const extraFields: Record<string, string[]> = {
      pillar_framework: ["title"],
      transformation_hub: ["center_label"],
      risk_matrix: ["center_label"],
      before_after: ["before_label", "after_label"],
      impact_effort_matrix: [
        "x_axis_label",
        "y_axis_label",
        "low_label",
        "high_label",
      ],
    };
    for (const field of extraFields[infographicType] ?? []) {
      properties[field] = { type: "string" };
      required.push(field);
    }
    if (infographicType === "radial_cycle") {
      properties.center_image = { type: ["string", "null"] };
    }
    if (infographicType === "customer_journey") {
      properties.start_color = { type: ["string", "null"] };
    }
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function infographicContentSchema(element?: Dict | null): Dict {
  const data = element && isRecord(element.data) ? element.data : null;
  const infographicType = data && typeof data.type === "string" ? data.type : null;
  if (
    infographicType &&
    (INFOGRAPHIC_TYPES as readonly string[]).includes(infographicType)
  ) {
    return {
      type: "object",
      additionalProperties: false,
      properties: {
        data: infographicDataContentSchema(infographicType),
      },
      required: ["data"],
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      data: {
        oneOf: [
          infographicDataContentSchema("progress_bar"),
          infographicDataContentSchema("gauge"),
        ],
      },
    },
    required: ["data"],
  };
}

function objectSchema(properties: Dict, required?: string[]): Dict {
  return {
    type: "object",
    properties,
    required: required ?? Object.keys(properties),
    additionalProperties: false,
  };
}

// ---------------------------------------------------------------------------
// Component schema
// ---------------------------------------------------------------------------

function addProperty(properties: Dict, name: string, schema: Dict): void {
  let key = name;
  let suffix = 2;
  while (key in properties) {
    key = `${name}_${suffix}`;
    suffix += 1;
  }
  properties[key] = schema;
}

function componentContentFieldTitle(name: string): string {
  const title = name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return title || name;
}

function componentContentFieldSchema(field: {
  name: string;
  path: string;
  element: Dict;
}): Dict {
  const element = field.element;
  const elementType = element.type;
  let schema: Dict = {};

  if (elementType === "text") {
    // Provide 40% headroom on maxLength so the model can express complete, deep thoughts;
    // the text auto-fitter dynamically reduces font size down to 40% to fit the box cleanly.
    const expandedMaxLength = typeof element.max_length === "number"
      ? Math.round(element.max_length * 1.4)
      : undefined;

    schema = {
      type: "string",
      minLength: element.min_length,
      maxLength: expandedMaxLength,
    };
  } else if (elementType === "image") {
    const promptKey = element.is_icon === true ? "icon_query" : "image_prompt";
    schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        [promptKey]: {
          type: "string",
          description:
            element.is_icon === true
              ? "Search query for the replacement icon."
              : "Prompt for the replacement image.",
        },
      },
      required: [promptKey],
    };
  } else if (elementType === "text-list") {
    schema = {
      type: "array",
      items: {
        type: "string",
        minLength: element.min_item_length,
        maxLength: element.max_item_length,
      },
      minItems: element.min_items,
      maxItems: element.max_items,
    };
  } else if (elementType === "table") {
    const [headerLimits, bodyLimits] = tableTextLimits(element);
    schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        columns: {
          type: "array",
          items: {
            type: "string",
            minLength: headerLimits[0],
            maxLength: headerLimits[1],
          },
          minItems: element.min_columns,
          maxItems: element.max_columns,
        },
        rows: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "string",
              minLength: bodyLimits[0],
              maxLength: bodyLimits[1],
            },
            minItems: element.min_columns,
            maxItems: element.max_columns,
          },
          minItems: element.min_rows,
          maxItems: element.max_rows,
        },
      },
      required: ["columns", "rows"],
    };
  } else if (elementType === "chart") {
    schema = chartContentSchema(element);
  } else if (elementType === "infographic") {
    schema = infographicContentSchema(element);
  }

  return {
    ...withoutNone(schema),
    title: componentContentFieldTitle(field.name),
    "x-element-type": elementType,
    "x-element-path": field.path,
  };
}

function componentSchemaElementName(element: Dict): string | null {
  if (typeof element.name !== "string") return null;
  const stripped = element.name.trim();
  return stripped || null;
}

function canExpandRepeatedChildren(element: Dict, childCount: number): boolean {
  const maxChildren = element.max_children;
  return typeof maxChildren === "number" && maxChildren > childCount;
}

function componentNormalizedNodeNamesAreUnique(
  nodes: SchemaNode[],
  strategy: string,
): boolean {
  if (!nodes.length) return false;
  const token = componentNormalizationTokenForNodes(nodes, strategy);
  const names = nodes.map(([name]) => componentStripRepeatedSuffix(name, token));
  return names.length === new Set(names).size;
}

function componentRepeatedRootNamesMatch(nodeSets: SchemaNode[][]): boolean {
  if (!nodeSets.length || nodeSets.some((nodeSet) => nodeSet.length !== 1)) {
    return false;
  }
  const names = nodeSets.map((nodeSet) => nodeSet[0][0]);
  if (new Set(names).size === 1) return true;
  const normalized = names.map((name) =>
    componentStripRepeatedSuffix(name, componentNumericNameToken(name)),
  );
  return new Set(normalized).size === 1;
}

function componentFlattenedContentNodes(nodes: SchemaNode[]): SchemaNode[] {
  const flattened: SchemaNode[] = [];
  const visit = (name: string, schema: Dict) => {
    if (typeof schema["x-element-type"] === "string") {
      flattened.push([name, schema]);
      return;
    }
    const properties = isRecord(schema.properties) ? schema.properties : null;
    if (!properties) return;
    for (const [childName, childSchema] of Object.entries(properties)) {
      if (isRecord(childSchema)) visit(childName, childSchema);
    }
  };
  for (const [name, schema] of nodes) visit(name, schema);
  return flattened;
}

function componentNormalizationTokenForNodes(
  nodes: SchemaNode[],
  strategy: string,
): string | null {
  if (strategy === "none") return null;
  const tokenGetter =
    strategy === "numeric" ? componentNumericNameToken : componentPrefixNameToken;
  const tokens = nodes
    .map(([name]) => tokenGetter(name))
    .filter((token): token is string => token !== null);
  if (!tokens.length) return null;
  const first = tokens[0];
  return tokens.every((token) => token === first) ? first : null;
}

function componentNumericNameToken(value: string): string | null {
  const match = value.match(COMPONENT_REPEATED_NAME_TOKEN);
  return match ? match[0] : null;
}

function componentPrefixNameToken(value: string): string | null {
  const separator = value.indexOf("_");
  if (separator <= 0) return null;
  const token = value.slice(0, separator);
  return token ? `${token}_` : null;
}

function componentStripRepeatedSuffix(
  value: string,
  suffix: string | null,
): string {
  if (suffix && value.includes(suffix)) {
    return value.replace(suffix, "");
  }
  return value;
}

function componentComparableRepeatedSchema(value: any, key = ""): any {
  if (Array.isArray(value)) {
    const items = value.map((item) => componentComparableRepeatedSchema(item));
    if (["enum", "required"].includes(key) && items.every((item) => typeof item === "string")) {
      return [...items].sort();
    }
    return items;
  }
  if (!isRecord(value)) return value;
  const comparable: Dict = {};
  for (const nestedKey of Object.keys(value).sort()) {
    if (nestedKey === "x-element-path") continue;
    comparable[nestedKey] = componentComparableRepeatedSchema(
      value[nestedKey],
      nestedKey,
    );
  }
  return comparable;
}

function componentMergeRepeatedSchemas(schemas: Dict[]): Dict | null {
  if (!schemas.length) return null;
  const first = componentComparableRepeatedSchema(schemas[0]);
  const comparable = (schema: Dict) =>
    JSON.stringify(componentComparableRepeatedSchema(schema));
  const firstText = JSON.stringify(first);
  if (schemas.some((schema) => comparable(schema) !== firstText)) return null;
  return withoutNone(clone(schemas[0]));
}

function componentSchemaWithoutRepeatedNameSuffix(
  schema: Dict,
  suffix: string | null,
): Dict {
  const normalized = componentNormalizeSchemaValue(schema, suffix);
  return isRecord(normalized) ? normalized : schema;
}

function componentNormalizeSchemaValue(value: any, suffix: string | null): any {
  if (Array.isArray(value)) {
    return value.map((item) => componentNormalizeSchemaValue(item, suffix));
  }
  if (!isRecord(value)) return value;

  const normalized: Dict = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key === "x-element-path") continue;

    if (key === "properties" && isRecord(nested)) {
      const properties: Dict = {};
      for (const [propertyName, propertySchema] of Object.entries(nested)) {
        const normalizedName = componentStripRepeatedSuffix(propertyName, suffix!);
        const normalizedSchema = componentNormalizeSchemaValue(
          propertySchema,
          suffix,
        );
        if (isRecord(normalizedSchema) && "title" in normalizedSchema) {
          normalizedSchema.title = componentContentFieldTitle(normalizedName);
        }
        properties[normalizedName] = normalizedSchema;
      }
      normalized[key] = properties;
      continue;
    }

    if (key === "required" && Array.isArray(nested)) {
      normalized[key] = nested
        .filter((item): item is string => typeof item === "string")
        .map((item) => componentStripRepeatedSuffix(item, suffix!));
      continue;
    }

    normalized[key] = componentNormalizeSchemaValue(nested, suffix);
  }
  return normalized;
}

function componentObjectSchemaFromNodes(nodes: SchemaNode[]): Dict {
  const properties: Dict = {};
  for (const [name, schema] of nodes) {
    addProperty(properties, name, schema);
  }
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

function componentRepeatedItemLimits(
  element: Dict,
  itemCount: number,
): [any, any] {
  if (element.type !== "group") {
    return [element.min_children, element.max_children];
  }
  return [Math.floor(itemCount / 2), itemCount];
}

function componentNormalizedRepeatedItemSchema(
  nodes: SchemaNode[],
  strategy: string,
): Dict {
  const token = componentNormalizationTokenForNodes(nodes, strategy);
  const itemSchema =
    nodes.length === 1 && nodes[0][1].type === "object"
      ? nodes[0][1]
      : componentObjectSchemaFromNodes(nodes);
  const normalized = componentSchemaWithoutRepeatedNameSuffix(itemSchema, token);
  if (
    token &&
    nodes.length === 1 &&
    isRecord(normalized) &&
    typeof normalized.title === "string"
  ) {
    normalized.title = componentContentFieldTitle(
      componentStripRepeatedSuffix(nodes[0][0], token),
    );
  }
  return normalized;
}

function componentRepeatedChildrenSchemaResult(
  element: Dict,
  childNodeSets: SchemaNode[][],
): [Dict, string] | null {
  const populated = childNodeSets.filter((nodeSet) => nodeSet.length > 0);
  if (populated.length !== childNodeSets.length) return null;
  if (populated.length < 2 && !canExpandRepeatedChildren(element, populated.length)) {
    return null;
  }

  const build = (nodeSets: SchemaNode[][]): [Dict, string] | null => {
    for (const strategy of ["numeric", "none", "prefix"]) {
      const normalizedItemSchemas = nodeSets.map((nodeSet) =>
        componentNormalizedRepeatedItemSchema(nodeSet, strategy),
      );
      const mergedItemSchema = componentMergeRepeatedSchemas(normalizedItemSchemas);
      if (mergedItemSchema !== null) {
        const [minItems, maxItems] = componentRepeatedItemLimits(
          element,
          nodeSets.length,
        );
        return [
          {
            type: "array",
            minItems,
            maxItems,
            items: mergedItemSchema,
          },
          strategy,
        ];
      }
    }
    return null;
  };

  const directResult = build(populated);
  if (directResult) return directResult;

  if (componentRepeatedRootNamesMatch(populated)) {
    const flattenedNodeSets = populated.map(componentFlattenedContentNodes);
    for (const strategy of ["numeric", "none", "prefix"]) {
      if (
        !flattenedNodeSets.every((nodeSet) =>
          componentNormalizedNodeNamesAreUnique(nodeSet, strategy),
        )
      ) {
        continue;
      }
      const normalizedItemSchemas = flattenedNodeSets.map((nodeSet) =>
        componentNormalizedRepeatedItemSchema(nodeSet, strategy),
      );
      const mergedItemSchema = componentMergeRepeatedSchemas(normalizedItemSchemas);
      if (mergedItemSchema !== null) {
        const [minItems, maxItems] = componentRepeatedItemLimits(
          element,
          populated.length,
        );
        return [
          {
            type: "array",
            minItems,
            maxItems,
            items: mergedItemSchema,
          },
          strategy,
        ];
      }
    }
  }

  return null;
}

function componentArraySchemaForRepeatedChildren(
  element: Dict,
  childNodeSets: SchemaNode[][],
): Dict | null {
  const result = componentRepeatedChildrenSchemaResult(element, childNodeSets);
  return result ? result[0] : null;
}

function componentRepeatedTopLevelGroupNode(
  elements: any[],
  path: string,
): SchemaNode | null {
  const groups = elements.filter(isRecord);
  if (
    groups.length !== elements.length ||
    !groups.length ||
    groups.some((group) => group.type !== "group")
  ) {
    return null;
  }

  const nodeSets = groups.map((group, index) =>
    componentSchemaNodesForElement(group, { path: `${path}.${index}` }),
  );
  const result = componentRepeatedChildrenSchemaResult(
    { type: "group", children: groups },
    nodeSets,
  );
  if (!result || !nodeSets[0].length) return null;

  const [schema, strategy] = result;
  const firstName = nodeSets[0][0][0];
  const token = componentNormalizationTokenForNodes(nodeSets[0], strategy);
  return [componentStripRepeatedSuffix(firstName, token), schema];
}

function componentSchemaNodesForElement(
  element: Dict,
  options: { path: string },
): SchemaNode[] {
  const elementType = element.type;
  const name = componentSchemaElementName(element);

  if (
    elementType &&
    CONTENT_TYPES.has(elementType) &&
    isEditableElement(element) &&
    name !== null
  ) {
    return [
      [
        name,
        componentContentFieldSchema({
          name,
          path: options.path,
          element,
        }),
      ],
    ];
  }

  if (elementType === "container") {
    const child = element.child;
    const childNodes = isRecord(child)
      ? componentSchemaNodesForElement(child, { path: `${options.path}.child` })
      : [];
    if (name === null || !childNodes.length) return childNodes;
    return [[name, componentObjectSchemaFromNodes(childNodes)]];
  }

  if (["flex", "grid", "group"].includes(elementType)) {
    const children = Array.isArray(element.children) ? element.children : null;
    if (!children) return [];

    const childNodeSets = children.map((child: any, index: number) =>
      isRecord(child)
        ? componentSchemaNodesForElement(child, {
            path: `${options.path}.children.${index}`,
          })
        : [],
    );
    const childNodes = childNodeSets.flat();
    if (name === null || !childNodes.length) return childNodes;

    const arraySchema = componentArraySchemaForRepeatedChildren(
      element,
      childNodeSets,
    );
    if (arraySchema) return [[name, arraySchema]];

    return [[name, componentObjectSchemaFromNodes(childNodes)]];
  }

  return [];
}

function componentSchemaNodesForElements(
  elements: any[],
  path = "elements",
): SchemaNode[] {
  const repeated = componentRepeatedTopLevelGroupNode(elements, path);
  if (repeated) return [repeated];

  const nodes: SchemaNode[] = [];
  elements.forEach((element, index) => {
    if (isRecord(element)) {
      nodes.push(
        ...componentSchemaNodesForElement(element, {
          path: `${path}.${index}`,
        }),
      );
    }
  });
  return nodes;
}

export function getRepeatedTopLevelGroupSchemaName(
  elements: any[],
): string | null {
  const node = componentRepeatedTopLevelGroupNode(elements, "elements");
  return node ? node[0] : null;
}

export function getComponentSchema(component: Dict): Dict | null {
  const elements = component.elements;
  if (!Array.isArray(elements)) {
    throw new Error("component must contain an elements array");
  }
  const properties: Dict = {};
  for (const [name, schema] of componentSchemaNodesForElements(elements)) {
    addProperty(properties, name, schema);
  }
  if (!Object.keys(properties).length) return null;

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    title: component.id ?? "component_content",
    description: component.description ?? null,
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

// ---------------------------------------------------------------------------
// Template schema
// ---------------------------------------------------------------------------

function stripComponentSchemaMetadata(value: any): any {
  if (Array.isArray(value)) return value.map(stripComponentSchemaMetadata);
  if (!isRecord(value)) return value;

  const stripped: Dict = {};
  for (const [key, nested] of Object.entries(value)) {
    if (COMPONENT_SCHEMA_METADATA_KEYS.has(key)) continue;

    if (key === "properties" && isRecord(nested)) {
      stripped[key] = Object.fromEntries(
        Object.entries(nested).map(([propertyName, propertySchema]) => [
          propertyName,
          stripComponentSchemaMetadata(propertySchema),
        ]),
      );
      continue;
    }

    stripped[key] = stripComponentSchemaMetadata(nested);
  }
  return stripped;
}

function templateComponentKey(
  componentId: string,
  occurrenceIndex: number,
  occurrenceCount: number,
  properties: Dict,
): string {
  const key =
    occurrenceCount > 1 ? `${componentId}_${occurrenceIndex}` : componentId;
  let uniqueKey = key;
  let suffix = 1;
  while (uniqueKey in properties) {
    uniqueKey = `${key}_${suffix}`;
    suffix += 1;
  }
  return uniqueKey;
}

function resolveComponentElements(
  component: Dict,
  templateData: Dict,
): Dict | null {
  if (Array.isArray(component.elements)) return component;
  const merged = Array.isArray(templateData.merged_components)
    ? templateData.merged_components
    : [];
  const match = merged.find((entry: any) => isRecord(entry) && entry.id === component.id);
  if (!match) return null;
  const variantId = typeof component.variant === "string" ? component.variant : null;
  const variants = Array.isArray(match.variants) ? match.variants : [];
  const variant =
    (variantId ? variants.find((entry: any) => entry?.id === variantId) : null) ??
    variants[0] ??
    match;
  const elements = Array.isArray(variant?.elements) ? variant.elements : null;
  return elements ? { ...component, elements } : null;
}

function templateLayoutSchema(
  layout: Dict,
  slideIndex: number,
  templateData: Dict,
): { slide: number; layout_id: any; schema: Dict | null } {
  const properties: Dict = {};
  const required: string[] = [];

  const rawComponents = Array.isArray(layout.components) ? layout.components : [];
  const components = rawComponents
    .filter(isRecord)
    .map((component) => resolveComponentElements(component, templateData))
    .filter((component): component is Dict => Boolean(component));

  const entries: { id: string; schema: Dict }[] = [];
  for (const component of components) {
    const schema = getComponentSchema(component);
    if (!schema) continue;
    entries.push({ id: String(component.id), schema });
  }

  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }

  const indexes = new Map<string, number>();
  for (const entry of entries) {
    const occurrenceIndex = indexes.get(entry.id) ?? 0;
    indexes.set(entry.id, occurrenceIndex + 1);

    const key = templateComponentKey(
      entry.id,
      occurrenceIndex,
      counts.get(entry.id) ?? 1,
      properties,
    );
    properties[key] = stripComponentSchemaMetadata(clone(entry.schema));
    required.push(key);
  }

  const schema = Object.keys(properties).length
    ? {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        title: layout.id ?? `slide_${slideIndex}`,
        description: layout.description ?? null,
        additionalProperties: false,
        properties,
        required,
      }
    : null;

  return { slide: slideIndex, layout_id: layout.id ?? null, schema };
}

export interface TemplateLayoutSchemaEntry {
  slide: number;
  layout_id: string | null;
  schema: JsonObject | null;
}

export function getTemplateSchema(template: Dict): {
  source_file: string;
  layout_count: number;
  layouts: TemplateLayoutSchemaEntry[];
} {
  const layouts = Array.isArray(template.layouts) ? template.layouts : null;
  if (!layouts) {
    throw new Error("template JSON must contain a layouts array");
  }
  const generated = layouts
    .map((layout: any, index: number) =>
      isRecord(layout) ? templateLayoutSchema(layout, index + 1, template) : null,
    )
    .filter((entry: any): entry is TemplateLayoutSchemaEntry => Boolean(entry));

  return {
    source_file: "template.json",
    layout_count: generated.length,
    layouts: generated,
  };
}

export function isRepeatedSuffixName(name: string): boolean {
  return REPEATED_NAME_SUFFIX.test(name);
}
