export type JsonObject = Record<string, any>;

export interface TemplateLayout {
  id?: string;
  description?: string;
  components?: any[];
  elements?: any[];
  background?: string;
  [key: string]: any;
}

export interface TemplateLayoutEntry {
  id: string;
  name: string | null;
  description: string | null;
  json_schema: JsonObject | null;
}

export interface PresentationLayoutModel {
  name: string;
  ordered: boolean;
  icon_type: string;
  slides: TemplateLayoutEntry[];
}
