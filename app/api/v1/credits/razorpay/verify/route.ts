import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { purchaseCredits, getCreditPlanById } from "@/lib/v3/services/creditService";
import {
  verifyRazorpaySignature,
  isRazorpayConfigured,
} from "@/lib/v3/services/razorpayService";
import { query, queryOne } from "@/lib/v3/db";
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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          detail:
            "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
        },
        { status: 400 }
      );
    }

    await ensureSchema();

    // Verify signature
    try {
      const isValid = verifyRazorpaySignature({
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isValid) {
        return NextResponse.json(
          { detail: "Payment signature verification failed. Invalid transaction." },
          { status: 400 }
        );
      }
    } catch (sigErr: any) {
      console.error("[Razorpay Signature Error]:", sigErr);
      return NextResponse.json(
        { detail: sigErr.message || "Signature verification failed" },
        { status: 400 }
      );
    }

    // Look up the order in our DB
    const existingOrder = await queryOne<{
      id: string;
      user_id: string;
      plan_id: string;
      amount_inr: number;
      status: string;
    }>("SELECT * FROM payment_orders WHERE razorpay_order_id = $1", [
      razorpay_order_id,
    ]);

    const resolvedPlanId = existingOrder?.plan_id || plan_id;
    if (!resolvedPlanId) {
      return NextResponse.json(
        { detail: "Could not identify plan for this order" },
        { status: 400 }
      );
    }

    // Update payment_orders status
    await query(
      `UPDATE payment_orders 
       SET status = 'paid',
           razorpay_payment_id = $1,
           razorpay_signature = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE razorpay_order_id = $3`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    // Credit the user's account with idempotency (payment_reference = razorpay_payment_id)
    const result = await purchaseCredits(
      auth.user_id,
      resolvedPlanId,
      razorpay_payment_id
    );

    const plan = "plan" in result ? result.plan : await getCreditPlanById(resolvedPlanId);

    return NextResponse.json({
      success: true,
      message: "Payment verified and credits added successfully",
      credits: result.credits,
      has_purchased_credits: result.has_purchased_credits,
      plan,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    });
  } catch (err: any) {
    console.error("[Razorpay Verify Error]:", err);
    return NextResponse.json(
      { detail: err.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
