import { NextResponse } from "next/server";
import { isV3BackendEngine } from "@/proxy";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";
import { bundledExportPackageAvailable } from "@/lib/run-bundled-presentation-export";

export const dynamic = "force-dynamic";

export async function GET() {
  const engine = isV3BackendEngine() ? "v3" : "legacy";
  const export_enabled =
    !process.env.VERCEL && (await bundledExportPackageAvailable());
  return NextResponse.json(
    {
      engine,
      chat_enabled: engine !== "v3",
      image_generation_enabled: engine !== "v3",
      export_enabled,
      max_slides: MAX_NUMBER_OF_SLIDES,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
