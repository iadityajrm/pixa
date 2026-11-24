import { NextResponse } from "next/server";
import { getCreditPlans } from "@/lib/v3/services/creditService";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await getCreditPlans();
  return NextResponse.json(plans);
}
