"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, Sparkles, Zap, ArrowRight, ShieldCheck, Download, Layers } from "lucide-react";
import { notify } from "@/components/ui/sonner";
import { getApiUrl } from "@/utils/api";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { setCreditStatus } from "@/store/slices/userConfig";
import { loadRazorpayScript } from "@/utils/razorpay";

interface PlanItem {
  id: string;
  name: string;
  credits: number;
  price_inr: number;
  description: string;
  presentations_included: number;
}

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const dispatch = useDispatch();
  const currentCredits = useSelector((state: RootState) => state.userConfig.credits ?? 0);
  const [plans, setPlans] = useState<PlanItem[]>([
    {
      id: "plan_50",
      name: "Starter Pack",
      credits: 50,
      price_inr: 19,
      description: "Ideal for coursework and short presentations.",
      presentations_included: 5,
    },
    {
      id: "plan_100",
      name: "Pro Pack",
      credits: 100,
      price_inr: 49,
      description: "Best value for frequent creators, pitches, and reports.",
      presentations_included: 10,
    },
  ]);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch(getApiUrl("/api/v1/credits/plans"))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setPlans(data);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const handlePurchase = async (plan: PlanItem) => {
    setPurchasingPlanId(plan.id);
    const toastId = notify.loading(
      "Preparing checkout...",
      `Setting up secure payment for ${plan.name} (₹${plan.price_inr})`
    );

    try {
      // Step 1: Create Razorpay Order on server
      const orderRes = await fetch(getApiUrl("/api/v1/credits/razorpay/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan_id: plan.id }),
      });

      const orderData = await orderRes.json().catch(() => ({}));

      if (orderRes.ok && orderData.order_id && orderData.key_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error("Could not load Razorpay payment gateway. Please check your internet connection.");
        }

        notify.loading("Opening payment gateway...", "Complete payment in the Razorpay window", { id: toastId });

        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || "INR",
          name: "Pixa",
          description: `${plan.name} — ${plan.credits} Presentation Credits`,
          image: "/mainlogo.png",
          order_id: orderData.order_id,
          prefill: {
            name: orderData.user?.username || "",
            email: orderData.user?.username?.includes("@") ? orderData.user?.username : undefined,
          },
          theme: {
            color: "#3478F6",
          },
          handler: async function (response: any) {
            const verifyToast = notify.loading(
              "Verifying payment...",
              "Securing your credits and activating plan..."
            );
            try {
              const verifyRes = await fetch(getApiUrl("/api/v1/credits/razorpay/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_id: plan.id,
                }),
              });

              if (!verifyRes.ok) {
                const verifyErr = await verifyRes.json().catch(() => ({}));
                throw new Error(verifyErr.detail || "Payment verification failed");
              }

              const verifyData = await verifyRes.json();
              dispatch(
                setCreditStatus({
                  credits: verifyData.credits,
                  has_purchased_credits: true,
                })
              );

              notify.success(
                "Payment Successful!",
                `Added ${plan.credits} credits to your account. Your new balance is ${verifyData.credits} credits!`,
                { id: verifyToast }
              );

              onOpenChange(false);
            } catch (vErr: any) {
              notify.error(
                "Verification Failed",
                vErr.message || "Failed to confirm payment with server",
                { id: verifyToast }
              );
            } finally {
              setPurchasingPlanId(null);
            }
          },
          modal: {
            ondismiss: function () {
              setPurchasingPlanId(null);
              notify.dismiss(toastId);
            },
          },
        };

        const razorpayInstance = new (window as any).Razorpay(options);
        razorpayInstance.on("payment.failed", function (failResponse: any) {
          notify.error(
            "Payment Failed",
            failResponse.error?.description || "Payment could not be completed"
          );
          setPurchasingPlanId(null);
        });
        razorpayInstance.open();
        return;
      }

      if (orderRes.status === 503 || !orderData.key_id) {
        throw new Error(
          orderData.detail ||
            "Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured in your environment."
        );
      }

      throw new Error(orderData.detail || "Unable to initiate payment order");
    } catch (err: any) {
      notify.error(
        "Purchase failed",
        err.message || "Could not complete purchase. Please try again.",
        { id: toastId }
      );
      setPurchasingPlanId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-6 sm:p-8 font-syne">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="flex justify-center mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3478F6]/10 text-[#3478F6] px-3.5 py-1 text-xs font-semibold uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5" /> Presentation Credits
            </span>
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-extrabold text-[#101323] dark:text-white">
            Recharge Credits
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Current balance: <span className="font-bold text-[#3478F6]">{currentCredits} credits</span>.
            Purchasing any plan unlocks unlimited PowerPoint (PPTX) & PDF downloads.
          </DialogDescription>
        </DialogHeader>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {plans.map((plan) => {
            const isPro = plan.credits >= 100;
            const isBuying = purchasingPlanId === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all ${
                  isPro
                    ? "border-2 border-[#3478F6] bg-white dark:bg-[#16161d] shadow-lg shadow-[#3478F6]/10"
                    : "border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d]"
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 right-6">
                    <span className="rounded-full bg-gradient-to-r from-[#3478F6] to-[#3478F6] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                      POPULAR
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[#101323] dark:text-white">
                      {plan.name}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF5FF] dark:bg-[#162444] text-[#3478F6]">
                      <Zap className="w-3 h-3" /> <span className="font-bold">{plan.credits}</span> Credits
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 min-h-[32px]">
                    {plan.description}
                  </p>

                  <div className="mt-4 flex items-baseline gap-1.5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-3xl font-extrabold text-[#101323] dark:text-white font-outfit">
                      ₹{plan.price_inr}
                    </span>
                    <span className="text-[11px] font-medium text-neutral-500">
                      one-time
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{plan.presentations_included} decks (10 slides each)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Unlock PPTX & PDF exports</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Instant Razorpay checkout (UPI/Card)</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-2">
                  <button
                    type="button"
                    disabled={!!purchasingPlanId}
                    onClick={() => handlePurchase(plan)}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                      isPro
                        ? "bg-[#3478F6] hover:bg-[#2563EB] text-white disabled:opacity-50"
                        : "bg-[#101323] hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 disabled:opacity-50"
                    }`}
                  >
                    {isBuying ? (
                      "Opening Razorpay..."
                    ) : (
                      <>
                        <span>Get {plan.credits} Credits — ₹{plan.price_inr}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
