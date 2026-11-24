"use client";

import React, { useState, useEffect } from "react";
import { Check, Sparkles, Zap, ArrowRight, ShieldCheck, Download, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/sonner";
import { getApiUrl } from "@/utils/api";
import { useDispatch } from "react-redux";
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

export default function PlansPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [plans, setPlans] = useState<PlanItem[]>([
    {
      id: "plan_50",
      name: "Starter Pack",
      credits: 50,
      price_inr: 19,
      description: "Ideal for assignments and coursework projects.",
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
    fetch(getApiUrl("/api/v1/credits/plans"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPlans(data);
        }
      })
      .catch(() => {});
  }, []);

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

      // If Razorpay gateway is configured on server, initiate Razorpay Checkout
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

              setTimeout(() => {
                router.push("/subscription");
              }, 1200);
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

      // If Razorpay keys are not yet configured in ENV, notify user with actionable advice
      if (orderRes.status === 503 || !orderData.key_id) {
        throw new Error(
          orderData.detail ||
            "Razorpay API credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured in your environment."
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
    <div className="min-h-full py-10 px-4 sm:px-8 max-w-6xl mx-auto font-syne animate-page-stagger">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3478F6]/10 text-[#3478F6] px-3.5 py-1 text-xs font-semibold tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5" /> Presentation Credit Plans
        </span>
        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-[#101323] dark:text-white">
          Simple, Transparent Credit Packs
        </h1>
        <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
          Each 10-slide presentation uses approximately 10 credits (1 credit/slide).
          Purchasing any plan unlocks unlimited exports & downloads for all your decks.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isPro = plan.credits >= 100;
          const isBuying = purchasingPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-3xl p-8 transition-all ${
                isPro
                  ? "border-2 border-[#3478F6] bg-white dark:bg-[#16161d] shadow-xl shadow-[#3478F6]/10"
                  : "border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d] shadow-sm hover:shadow-md"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3.5 right-8">
                  <span className="rounded-full bg-gradient-to-r from-[#3478F6] to-[#3478F6] px-3 py-1 text-xs font-bold text-white shadow-xs">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[#101323] dark:text-white">
                    {plan.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EFF5FF] dark:bg-[#162444] text-[#3478F6]">
                    <Zap className="w-3 h-3" /> <span className="font-outfit font-bold">{plan.credits}</span> Credits
                  </span>
                </div>

                <p className="mt-3 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 min-h-[40px]">
                  {plan.description}
                </p>

                <div className="mt-6 flex items-baseline gap-2 pb-6 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-4xl font-extrabold text-[#101323] dark:text-white font-outfit tracking-tight">
                    ₹{plan.price_inr}
                  </span>
                  <span className="text-xs font-medium text-neutral-500">
                    one-time payment
                  </span>
                </div>

                {/* Features */}
                <ul className="mt-6 space-y-3.5 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                  <li className="flex items-center gap-2.5">
                    <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 p-1 text-emerald-600">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      Generate up to <strong className="font-outfit font-bold">{plan.presentations_included}</strong> presentations (10 slides each)
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 p-1 text-emerald-600">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      <strong>Unlock PowerPoint (PPTX) & PDF</strong> downloads
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 p-1 text-emerald-600">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <span>Flexible credit deduction (~1 credit per slide)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 p-1 text-emerald-600">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span>Powered by Razorpay (UPI, Cards, NetBanking, Wallets)</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <button
                  type="button"
                  disabled={!!purchasingPlanId}
                  onClick={() => handlePurchase(plan)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition-all shadow-sm ${
                    isPro
                      ? "bg-[#3478F6] hover:bg-[#2563EB] text-white disabled:opacity-50"
                      : "bg-[#101323] hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 disabled:opacity-50"
                  }`}
                >
                  {isBuying ? (
                    "Opening Razorpay..."
                  ) : (
                    <>
                      <span>Pay with Razorpay — <span className="font-outfit font-bold">₹{plan.price_inr}</span></span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Callout */}
      <div className="mt-12 rounded-2xl bg-[#F6F6F9] dark:bg-[#1a1a20] border border-neutral-200 dark:border-neutral-800 p-6 max-w-4xl mx-auto text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
        <h4 className="font-bold text-neutral-900 dark:text-white mb-1.5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#3478F6]" /> How the Presentation Credit System Works
        </h4>
        <p className="leading-relaxed">
          1. <strong>First Free Deck:</strong> Every registered user can create their first presentation up to 10 slides for free.
        </p>
        <p className="mt-1 leading-relaxed">
          2. <strong>Exporting & Downloads:</strong> Exporting requires purchasing any credit pack. Once purchased, you can download all your existing and future presentations.
        </p>
        <p className="mt-1 leading-relaxed">
          3. <strong>Instant Credit Activation:</strong> Upon successful Razorpay payment, your account is credited immediately and verified against the backend database.
        </p>
      </div>
    </div>
  );
}
