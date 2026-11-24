import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { purchaseCredits } from "@/lib/v3/services/creditService";
import { query, queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

export const dynamic = "force-dynamic";

/**
 * Razorpay Webhook handler to handle asynchronous payment success events.
 * Uses RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET to verify the X-Razorpay-Signature header.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.RAZORPAY_KEY_SECRET ||
      "";

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (
        !crypto.timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(signature)
        )
      ) {
        console.warn("[Razorpay Webhook] Invalid signature");
        return NextResponse.json({ detail: "Invalid signature" }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    if (event === "order.paid" || event === "payment.captured") {
      const payment = payload.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      const notes = payment?.notes || {};

      let userId = notes.user_id;
      let planId = notes.plan_id;

      await ensureSchema();

      if (orderId && (!userId || !planId)) {
        const order = await queryOne<{ user_id: string; plan_id: string }>(
          "SELECT user_id, plan_id FROM payment_orders WHERE razorpay_order_id = $1",
          [orderId]
        );
        if (order) {
          userId = userId || order.user_id;
          planId = planId || order.plan_id;
        }
      }

      if (userId && planId && paymentId) {
        if (orderId) {
          await query(
            `UPDATE payment_orders 
             SET status = 'paid', razorpay_payment_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE razorpay_order_id = $2`,
            [paymentId, orderId]
          );
        }

        await purchaseCredits(userId, planId, paymentId);
        console.info(`[Razorpay Webhook] Processed ${event} for user ${userId}, plan ${planId}`);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("[Razorpay Webhook Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
