/**
 * fieldResolver — Pydantic JSON Schema 프로퍼티를 프론트 Field 컴포넌트로 매핑.
 *
 * 매핑 우선순위:
 * 1) 이름/format 힌트 (icon, color, markdown/body/message)
 * 2) enum → select
 * 3) type → text / number / boolean
 * 4) array of primitive → array editor, 그 외 → json editor
 */

export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "null";

export interface JsonSchemaProperty {
  type?: JsonSchemaType | JsonSchemaType[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: Array<string | number>;
  format?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  items?: JsonSchemaProperty | { $ref?: string; type?: JsonSchemaType };
  anyOf?: JsonSchemaProperty[];
  allOf?: JsonSchemaProperty[];
  $ref?: string;
}

export type FieldKind =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "color"
  | "icon"
  | "markdown"
  | "array-primitive"
  | "json";

export interface ResolvedField {
  kind: FieldKind;
  /** enum 또는 array 의 itemType 결정용 */
  itemType?: "string" | "number";
  options?: Array<{ value: string | number; label: string }>;
  nullable: boolean;
  min?: number;
  max?: number;
  step?: number;
}

const MARKDOWN_NAMES = new Set([
  "markdown",
  "body",
  "message",
  "text",
  "description",
]);
/** text 는 TitleBlock 의 짧은 문구 필드라 일반 text 로 남긴다. MARKDOWN 후보에서 제거. */
MARKDOWN_NAMES.delete("text");

function unwrapNullable(prop: JsonSchemaProperty): {
  inner: JsonSchemaProperty;
  nullable: boolean;
} {
  if (prop.anyOf && prop.anyOf.length > 0) {
    const withoutNull = prop.anyOf.filter(
      (p) => p.type !== "null" && !(Array.isArray(p.type) && p.type.includes("null")),
    );
    const hasNull = prop.anyOf.some(
      (p) => p.type === "null" || (Array.isArray(p.type) && p.type.includes("null")),
    );
    if (withoutNull.length === 1) {
      return { inner: { ...prop, ...withoutNull[0], anyOf: undefined }, nullable: hasNull };
    }
  }
  if (Array.isArray(prop.type)) {
    const hasNull = prop.type.includes("null");
    const others = prop.type.filter((t) => t !== "null");
    if (others.length === 1) {
      return { inner: { ...prop, type: others[0] }, nullable: hasNull };
    }
  }
  return { inner: prop, nullable: false };
}

function isPrimitiveType(t: JsonSchemaType | undefined): t is "string" | "number" | "integer" {
  return t === "string" || t === "number" || t === "integer";
}

export function resolveField(name: string, rawProp: JsonSchemaProperty): ResolvedField {
  const { inner, nullable } = unwrapNullable(rawProp);
  const lowerName = name.toLowerCase();

  if (lowerName === "icon") {
    return { kind: "icon", nullable };
  }
  if (lowerName === "color" || inner.format === "color") {
    return { kind: "color", nullable };
  }
  if (MARKDOWN_NAMES.has(lowerName) || inner.format === "markdown") {
    return { kind: "markdown", nullable };
  }

  if (inner.enum && inner.enum.length > 0) {
    const options = inner.enum.map((v) => ({
      value: v,
      label: String(v),
    }));
    return { kind: "select", options, nullable };
  }

  const type = Array.isArray(inner.type) ? inner.type[0] : inner.type;

  if (type === "boolean") {
    return { kind: "boolean", nullable };
  }
  if (type === "number" || type === "integer") {
    return {
      kind: "number",
      nullable,
      min: inner.minimum ?? inner.exclusiveMinimum,
      max: inner.maximum ?? inner.exclusiveMaximum,
      step: type === "integer" ? 1 : inner.multipleOf,
    };
  }
  if (type === "string") {
    return { kind: "text", nullable };
  }
  if (type === "array") {
    const items = inner.items as JsonSchemaProperty | undefined;
    if (items && !("$ref" in items) && isPrimitiveType(items.type as JsonSchemaType)) {
      const itemType: "string" | "number" =
        items.type === "number" || items.type === "integer" ? "number" : "string";
      return { kind: "array-primitive", itemType, nullable };
    }
    return { kind: "json", nullable };
  }
  return { kind: "json", nullable };
}

/** 라벨: title > 스네이크→Title-case 변환 */
export function propertyLabel(name: string, prop: JsonSchemaProperty): string {
  if (prop.title) return prop.title;
  return name
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
