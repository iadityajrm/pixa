import Razorpay from "razorpay";
import crypto from "crypto";

/**
 * Razorpay client helper.
 * Reads RAZORPAY_KEY_ID (or NEXT_PUBLIC_RAZORPAY_KEY_ID) and RAZORPAY_KEY_SECRET from process.env.
 * Supports production mode (live keys starting with rzp_live_).
 */
export function getRazorpayKeyId(): string {
  const keyId =
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    "";
  return keyId.trim();
}

export function getRazorpayKeySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  return secret.trim();
}

export function isRazorpayConfigured(): boolean {
  return Boolean(getRazorpayKeyId() && getRazorpayKeySecret());
}

export function getRazorpayClient(): Razorpay {
  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpayKeySecret();

  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay API credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables."
    );
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
}

/**
 * Verify Razorpay payment signature according to official specification:
 * HMAC SHA256 of `${order_id}|${payment_id}` with key_secret
 */
export function verifyRazorpaySignature(params: {
  order_id: string;
  payment_id: string;
  signature: string;
}): boolean {
  const { order_id, payment_id, signature } = params;
  const keySecret = getRazorpayKeySecret();
  if (!keySecret) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured");
  }

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${order_id}|${payment_id}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(generatedSignature),
    Buffer.from(signature)
  );
}
