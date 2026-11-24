import { query, queryOne, transaction } from "../db";
import { ensureSchema } from "../db/schema";
import { V3User } from "../auth";

export interface CreditPlanItem {
  id: string;
  name: string;
  credits: number;
  price_inr: number;
  description: string;
  presentations_included: number;
  is_active?: boolean;
  sort_order?: number;
}

export const CREDIT_PLANS: Record<string, CreditPlanItem> = {
  plan_50: {
    id: "plan_50",
    name: "Starter Pack",
    credits: 50,
    price_inr: 19,
    description: "Ideal for assignments and coursework projects.",
    presentations_included: 5,
  },
  plan_100: {
    id: "plan_100",
    name: "Pro Pack",
    credits: 100,
    price_inr: 49,
    description: "Best value for frequent creators, pitches, and reports.",
    presentations_included: 10,
  },
};

/**
 * Fetch active credit plans from the database (with fallback to default CREDIT_PLANS)
 */
export async function getCreditPlans(): Promise<CreditPlanItem[]> {
  await ensureSchema();
  try {
    const res = await query<CreditPlanItem>(
      "SELECT id, name, credits, price_inr, description, presentations_included, is_active, sort_order FROM credit_plans WHERE is_active = true ORDER BY sort_order ASC, price_inr ASC"
    );
    if (res.rows.length > 0) {
      return res.rows;
    }
  } catch (e) {
    console.warn("[CreditService] Failed to query credit_plans from DB, using fallback", e);
  }
  return Object.values(CREDIT_PLANS);
}

/**
 * Fetch a specific plan by its ID from DB or fallback
 */
export async function getCreditPlanById(planId: string): Promise<CreditPlanItem | null> {
  await ensureSchema();
  try {
    const plan = await queryOne<CreditPlanItem>(
      "SELECT id, name, credits, price_inr, description, presentations_included, is_active, sort_order FROM credit_plans WHERE id = $1 AND is_active = true",
      [planId]
    );
    if (plan) return plan;
  } catch (e) {
    console.warn("[CreditService] Failed to query credit_plan by id from DB", e);
  }
  return CREDIT_PLANS[planId] || null;
}

export function calculateRequiredCredits(nSlides: number): number {
  if (nSlides <= 0) return 10;
  return Math.max(1, nSlides);
}

export async function getUserCreditStatus(userId: string) {
  await ensureSchema();
  const user = await queryOne<V3User>('SELECT * FROM "user" WHERE id = $1', [userId]);
  if (!user) {
    throw new Error("User not found");
  }

  return {
    user_id: user.id,
    username: user.username,
    credits: user.credits,
    free_presentation_used: user.free_presentation_used,
    has_purchased_credits: user.has_purchased_credits,
    can_download: user.has_purchased_credits || user.is_superuser,
    can_generate_free: !user.free_presentation_used || user.is_superuser,
  };
}

export async function purchaseCredits(
  userId: string,
  planId: string,
  paymentReference?: string | null
) {
  await ensureSchema();
  const plan = await getCreditPlanById(planId);
  if (!plan) {
    throw new Error("Invalid credit plan");
  }

  // Idempotency check
  if (paymentReference) {
    const existing = await queryOne(
      "SELECT * FROM credit_transactions WHERE reference_id = $1",
      [paymentReference]
    );
    if (existing) {
      const user = await queryOne<V3User>('SELECT * FROM "user" WHERE id = $1', [userId]);
      return {
        success: true,
        message: "Transaction already processed",
        credits: user?.credits ?? 0,
        transaction_id: existing.id,
        already_processed: true,
        has_purchased_credits: true,
      };
    }
  }

  return await transaction(async (client) => {
    const userRes = await client.query(
      'SELECT * FROM "user" WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user: V3User = userRes.rows[0];
    if (!user) {
      throw new Error("User not found");
    }

    const newCredits = user.credits + plan.credits;
    await client.query(
      'UPDATE "user" SET credits = $1, has_purchased_credits = true WHERE id = $2',
      [newCredits, userId]
    );

    const txRes = await client.query(
      `INSERT INTO credit_transactions (user_id, type, amount, balance_after, plan_id, price_inr, reference_id, description)
       VALUES ($1, 'purchase', $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId,
        plan.credits,
        newCredits,
        planId,
        plan.price_inr,
        paymentReference || null,
        `Purchased ${plan.name} plan (${plan.credits} credits) for ₹${plan.price_inr}`,
      ]
    );

    return {
      success: true,
      credits: newCredits,
      has_purchased_credits: true,
      transaction_id: txRes.rows[0].id,
      plan,
    };
  });
}

export async function checkAndReserveGenerationCredits(
  userId: string,
  nSlides: number,
  presentationId: string
): Promise<{ isFree: boolean; creditsCharged: number }> {
  await ensureSchema();
  return await transaction(async (client) => {
    const userRes = await client.query(
      'SELECT * FROM "user" WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user: V3User = userRes.rows[0];
    if (!user) {
      throw new Error("User not found");
    }

    if (user.is_superuser) {
      return { isFree: true, creditsCharged: 0 };
    }

    const requiredCredits = calculateRequiredCredits(nSlides);

    // 1. Free first presentation
    if (!user.free_presentation_used) {
      await client.query(
        'UPDATE "user" SET free_presentation_used = true WHERE id = $1',
        [userId]
      );
      await client.query(
        `INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description)
         VALUES ($1, 'free_allowance', 0, $2, $3, 'Used 1 Free Presentation creation')`,
        [userId, user.credits, presentationId]
      );
      return { isFree: true, creditsCharged: 0 };
    }

    // 2. Requires credits
    if (user.credits < requiredCredits) {
      const err: any = new Error(
        `Insufficient presentation credits. You have ${user.credits} credits, but this presentation requires ${requiredCredits} credits. Please purchase credits to continue generating presentations.`
      );
      err.statusCode = 402;
      throw err;
    }

    const newCredits = user.credits - requiredCredits;
    await client.query(
      'UPDATE "user" SET credits = $1 WHERE id = $2',
      [newCredits, userId]
    );
    await client.query(
      `INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description)
       VALUES ($1, 'deduction', $2, $3, $4, $5)`,
      [
        userId,
        -requiredCredits,
        newCredits,
        presentationId,
        `Generated presentation (${nSlides || 10} slides): -${requiredCredits} credits`,
      ]
    );

    return { isFree: false, creditsCharged: requiredCredits };
  });
}

export async function refundGenerationCredits(
  presentationId: string,
  reason = "Presentation generation failed"
): Promise<{ refunded: boolean; credits: number; amount: number }> {
  await ensureSchema();
  return await transaction(async (client) => {
    const deductionRes = await client.query(
      `SELECT id, user_id, amount FROM credit_transactions
       WHERE reference_id = $1 AND type = 'deduction'
       ORDER BY created_at DESC
       LIMIT 1`,
      [presentationId]
    );
    const deduction = deductionRes.rows[0];
    if (!deduction || deduction.amount >= 0) {
      return { refunded: false, credits: 0, amount: 0 };
    }

    const existingRefund = await client.query(
      `SELECT id FROM credit_transactions
       WHERE reference_id = $1 AND type = 'refund'
       LIMIT 1`,
      [presentationId]
    );
    if (existingRefund.rowCount) {
      const userRes = await client.query(
        'SELECT credits FROM "user" WHERE id = $1',
        [deduction.user_id]
      );
      return {
        refunded: false,
        credits: userRes.rows[0]?.credits ?? 0,
        amount: 0,
      };
    }

    const userRes = await client.query(
      'SELECT credits FROM "user" WHERE id = $1 FOR UPDATE',
      [deduction.user_id]
    );
    const currentCredits = userRes.rows[0]?.credits ?? 0;
    const refundAmount = Math.abs(deduction.amount);
    const newCredits = currentCredits + refundAmount;

    await client.query('UPDATE "user" SET credits = $1 WHERE id = $2', [
      newCredits,
      deduction.user_id,
    ]);
    await client.query(
      `INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description)
       VALUES ($1, 'refund', $2, $3, $4, $5)`,
      [
        deduction.user_id,
        refundAmount,
        newCredits,
        presentationId,
        `${reason}: refunded ${refundAmount} credits`.slice(0, 256),
      ]
    );

    return { refunded: true, credits: newCredits, amount: refundAmount };
  });
}

export async function checkExportPermission(
  userId: string | null | undefined,
  _presentationId: string
): Promise<boolean> {
  if (!userId) return true;
  await ensureSchema();
  const user = await queryOne<V3User>('SELECT * FROM "user" WHERE id = $1', [userId]);
  if (!user) {
    throw new Error("User not found");
  }
  if (user.is_superuser) return true;
  if (!user.has_purchased_credits) {
    const err: any = new Error(
      "Exporting and downloading presentations requires purchasing presentation credits. Please purchase a credit plan to unlock downloads."
    );
    err.statusCode = 403;
    throw err;
  }
  return true;
}
