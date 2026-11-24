import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest, getUserFromSessionCookie } from "@/lib/v3/auth";
import { getCreditPlanById } from "@/lib/v3/services/creditService";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  isRazorpayConfigured,
} from "@/lib/v3/services/razorpayService";
import { query } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || !auth.user_id) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planId = body.plan_id;

    if (!planId) {
      return NextResponse.json(
        { detail: "plan_id is required" },
        { status: 400 }
      );
    }

    await ensureSchema();
    const plan = await getCreditPlanById(planId);
    if (!plan) {
      return NextResponse.json(
        { detail: "Invalid credit plan selected" },
        { status: 400 }
      );
    }

    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        {
          detail:
            "Razorpay payment gateway is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
          configured: false,
        },
        { status: 503 }
      );
    }

    const razorpay = getRazorpayClient();
    const receipt = `rcpt_${Date.now()}_${auth.user_id.slice(0, 6)}`;
    // Razorpay takes amount in currency subunit (e.g. paise for INR: 1 INR = 100 paise)
    const amountInSubunits = Math.round(plan.price_inr * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInSubunits,
      currency: "INR",
      receipt,
      notes: {
        user_id: auth.user_id,
        username: auth.username || "",
        plan_id: plan.id,
        credits: String(plan.credits),
      },
    });

    // Save order in payment_orders table
    await query(
      `INSERT INTO payment_orders (id, user_id, plan_id, amount_inr, currency, status, razorpay_order_id, receipt, metadata)
       VALUES ($1, $2, $3, $4, $5, 'created', $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        razorpayOrder.id,
        auth.user_id,
        plan.id,
        plan.price_inr,
        "INR",
        razorpayOrder.id,
        receipt,
        JSON.stringify({
          plan_name: plan.name,
          credits: plan.credits,
          notes: razorpayOrder.notes,
        }),
      ]
    );

    return NextResponse.json({
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      amount_inr: plan.price_inr,
      currency: razorpayOrder.currency,
      key_id: getRazorpayKeyId(),
      plan: {
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
        price_inr: plan.price_inr,
        description: plan.description,
      },
      user: {
        user_id: auth.user_id,
        username: auth.username,
      },
    });
  } catch (err: any) {
    console.error("[Razorpay Create Order Error]:", err);
    return NextResponse.json(
      { detail: err.message || "Failed to create payment order" },
      { status: 500 }
    );
  }
}
