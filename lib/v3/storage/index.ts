import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface StorageUploadResult {
  url: string;
  key: string;
  size: number;
}

/**
 * Storage service for Pixa V3
 * Uses persistent cloud storage when configured, or localized filesystem storage.
 */
export class StorageService {
  private static localBaseDir(): string {
    const appData = process.env.APP_DATA_DIRECTORY?.trim();
    if (appData) return appData;
    return path.join(process.cwd(), "..", "..", "app_data");
  }

  /**
   * Put an object / file into storage
   */
  static async put(
    folder: "images" | "uploads" | "exports" | "fonts",
    filename: string,
    data: Buffer | Uint8Array,
    contentType?: string
  ): Promise<StorageUploadResult> {
    const ext = path.extname(filename) || ".png";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${uniqueName}`;

    // If Vercel Blob token is available:
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(key, Buffer.from(data), {
          access: "public",
          contentType: contentType || "application/octet-stream",
        });
        return {
          url: blob.url,
          key: blob.pathname,
          size: data.byteLength,
        };
      } catch (err) {
        console.warn("[Pixa V3 Storage] Vercel Blob put failed, falling back to local:", err);
      }
    }

    // Local filesystem fallback
    const targetDir = path.join(this.localBaseDir(), folder);
    await fs.mkdir(targetDir, { recursive: true });
    const localFilePath = path.join(targetDir, uniqueName);
    await fs.writeFile(localFilePath, Buffer.from(data));

    return {
      url: `/app_data/${folder}/${uniqueName}`,
      key,
      size: data.byteLength,
    };
  }

  /**
   * Get an object / file stream or buffer from storage
   */
  static async get(relativeKey: string): Promise<Buffer | null> {
    try {
      const normalized = relativeKey.replace(/^\/+/, "").replace(/^app_data\//, "");
      const fullPath = path.join(this.localBaseDir(), normalized);
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  /**
   * Delete an object from storage
   */
  static async delete(relativeKey: string): Promise<boolean> {
    try {
      const normalized = relativeKey.replace(/^\/+/, "").replace(/^app_data\//, "");
      const fullPath = path.join(this.localBaseDir(), normalized);
      await fs.unlink(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
