import { NextResponse } from "next/server";
import { readUserConfigFile } from "@/lib/user-config-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const userConfigPath = process.env.USER_CONFIG_PATH;

  let keyFromFile = "";
  if (userConfigPath) {
    try {
      const cfg = readUserConfigFile<{
        OPENAI_API_KEY?: string;
        GROQ_API_KEY?: string;
        CUSTOM_LLM_API_KEY?: string;
      }>(userConfigPath);
      keyFromFile =
        cfg?.GROQ_API_KEY ||
        cfg?.CUSTOM_LLM_API_KEY ||
        cfg?.OPENAI_API_KEY ||
        "";
    } catch {
      keyFromFile = "";
    }
  }
  const keyFromEnv =
    process.env.GROQ_API_KEY ||
    process.env.CUSTOM_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  const hasKey = Boolean((keyFromFile || keyFromEnv).trim());

  return NextResponse.json({ hasKey });
}
