import { BUNDLED_TEMPLATES } from "./bundledTemplates";
import { query, queryOne } from "../db";
import { ensureSchema } from "../db/schema";

export interface TemplateV2Summary {
  id: string;
  name: string;
  description: string | null;
  layout_count: number;
  thumbnail: string | null;
  preview_url: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  layouts?: any;
  merged_components?: any;
  theme?: any;
  fonts?: any;
}

let bundledTemplatesCache: Map<string, any> | null = null;

export async function loadBundledTemplates(): Promise<Map<string, any>> {
  if (bundledTemplatesCache) return bundledTemplatesCache;

  const map = new Map<string, any>();
  for (const t of BUNDLED_TEMPLATES) {
    const templateId = t.id || t.name?.toLowerCase();
    map.set(templateId, t);
    if (t.name) {
      map.set(t.name.toLowerCase(), t);
    }
  }

  bundledTemplatesCache = map;
  return map;
}

export async function listAllTemplates(): Promise<TemplateV2Summary[]> {
  await ensureSchema();
  const bundled = await loadBundledTemplates();
  const dbTemplates = (await query("SELECT * FROM template_v2 ORDER BY is_default DESC, name ASC")).rows;

  const results: TemplateV2Summary[] = [];
  const seenIds = new Set<string>();

  // DB templates
  for (const t of dbTemplates) {
    seenIds.add(t.id);
    const layoutCount = t.layouts?.layouts?.length || Object.keys(t.layouts || {}).length || 0;
    results.push({
      id: t.id,
      name: t.name,
      description: t.description,
      layout_count: layoutCount,
      thumbnail: t.assets?.thumbnail || null,
      preview_url: `/template-preview?templateV2Id=${encodeURIComponent(t.id)}`,
      is_default: Boolean(t.is_default),
      created_at: t.created_at || new Date().toISOString(),
      updated_at: t.updated_at || new Date().toISOString(),
      layouts: t.layouts,
      merged_components: t.merged_components,
      theme: t.theme,
      fonts: t.assets?.fonts || {},
    });
  }

  // Include bundled templates that might not be in DB yet
  for (const [id, t] of bundled.entries()) {
    const realId = t.id || id;
    if (seenIds.has(realId)) continue;
    seenIds.add(realId);
    const layoutCount = t.layouts?.length || Object.keys(t.layouts || {}).length || 0;
    const thumbnailPath = `/templates/${encodeURIComponent(realId)}/static/thumbnail.png`;
    results.push({
      id: realId,
      name: t.name || realId,
      description: t.description || null,
      layout_count: layoutCount,
      thumbnail: thumbnailPath,
      preview_url: `/template-preview?templateV2Id=${encodeURIComponent(realId)}`,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      layouts: t.layouts,
      merged_components: t.merged_components,
      theme: t.theme,
      fonts: t.fonts || {},
    });
  }

  return results;
}

export async function getTemplateById(templateId: string): Promise<any | null> {
  await ensureSchema();
  const dbTemplate = await queryOne("SELECT * FROM template_v2 WHERE id = $1", [templateId]);
  if (dbTemplate) {
    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      description: dbTemplate.description,
      layout_count: dbTemplate.layouts?.layouts?.length || 0,
      thumbnail: dbTemplate.assets?.thumbnail || null,
      preview_url: `/template-preview?templateV2Id=${encodeURIComponent(dbTemplate.id)}`,
      is_default: dbTemplate.is_default,
      created_at: dbTemplate.created_at,
      updated_at: dbTemplate.updated_at,
      layouts: dbTemplate.layouts,
      merged_components: dbTemplate.merged_components,
      theme: dbTemplate.theme,
      fonts: dbTemplate.assets?.fonts || {},
    };
  }

  const bundled = await loadBundledTemplates();
  const t = bundled.get(templateId);
  if (t) {
    return {
      id: t.id || templateId,
      name: t.name || templateId,
      description: t.description || null,
      layout_count: t.layouts?.length || 0,
      thumbnail: t.thumbnail || null,
      preview_url: `/template-preview?templateV2Id=${encodeURIComponent(t.id || templateId)}`,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      layouts: t.layouts,
      merged_components: t.merged_components,
      theme: t.theme,
      fonts: t.fonts || {},
    };
  }

  return null;
}
