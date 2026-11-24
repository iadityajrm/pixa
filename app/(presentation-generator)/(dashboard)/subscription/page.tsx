"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  CreditCard,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Clock,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import { setCreditStatus } from "@/store/slices/userConfig";
import { getApiUrl } from "@/utils/api";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  plan_id?: string;
  price_inr?: number;
  reference_id?: string;
  description: string;
  created_at: string;
}

interface AccountStatus {
  user_id: string;
  username: string;
  credits: number;
  free_presentation_used: boolean;
  has_purchased_credits: boolean;
  can_download: boolean;
  can_generate_free: boolean;
}

export default function SubscriptionPage() {
  const dispatch = useDispatch();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatusAndHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch(getApiUrl("/api/v1/credits/status"), { credentials: "include", cache: "no-store" }),
        fetch(getApiUrl("/api/v1/credits/history?limit=50"), { credentials: "include", cache: "no-store" }),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data);
        dispatch(
          setCreditStatus({
            credits: data.credits,
            free_presentation_used: data.free_presentation_used,
            has_purchased_credits: data.has_purchased_credits,
          })
        );
      }
      if (historyRes.ok) {
        setHistory(await historyRes.json());
      }
    } catch (e) {
      console.error("Failed to fetch subscription data:", e);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchStatusAndHistory();
  }, [fetchStatusAndHistory]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-full py-10 px-4 sm:px-8 max-w-5xl mx-auto font-syne animate-page-stagger">
      {/* Top Banner / Account Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101323] dark:text-white">
            Subscription & Credits
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Account status, active credits, and purchase transactions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchStatusAndHistory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/plans"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#3478F6] hover:bg-[#2563EB] transition shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Buy Credits</span>
          </Link>
        </div>
      </div>

      {/* Cards Row */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Credits Balance */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
              <span>Available Credits</span>
              <Sparkles className="w-4 h-4 text-[#3478F6]" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-[#101323] dark:text-white">
                {status ? status.credits : 0}
              </span>
              <span className="text-xs text-neutral-500 font-medium">Credits</span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              ≈ {Math.floor((status?.credits ?? 0) / 10)} full presentations (10 slides each)
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Link
              href="/plans"
              className="text-xs font-bold text-[#3478F6] hover:underline flex items-center gap-1"
            >
              Add more credits <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Free Presentation Status */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
              <span>Free Welcome Allowance</span>
              <Layers className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4">
              {status?.free_presentation_used ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  Used
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 1 Free Presentation Ready
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
              {status?.free_presentation_used
                ? "You have claimed your complimentary first presentation creation."
                : "Every new account can generate their first presentation up to 10 slides for free."}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-400">
            Complimentary sign-up benefit
          </div>
        </div>

        {/* Download & Export Access */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
              <span>Export & Downloads</span>
              <Download className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-4">
              {status?.can_download ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Downloads Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5" /> Credits Required to Export
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
              {status?.can_download
                ? "You can export all existing and newly generated presentations as PPTX or PDF."
                : "Purchase any credit pack to unlock PPTX and PDF exports for your presentations."}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            {!status?.can_download && (
              <Link
                href="/plans"
                className="text-xs font-bold text-[#3478F6] hover:underline flex items-center gap-1"
              >
                Unlock downloads now <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Credit & Transaction History */}
      <div className="mt-12">
        <h2 className="text-lg font-bold text-[#101323] dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-500" /> Transaction & Credit History
        </h2>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d] p-8 text-center text-xs text-neutral-500">
            Loading transaction history...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d] p-8 text-center text-xs text-neutral-500">
            No transactions yet. Purchase credits or generate presentations to see your history.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#16161d] shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 uppercase font-bold">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-right">Change</th>
                  <th className="px-5 py-3.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {history.map((tx) => {
                  const isPositive = tx.amount > 0;
                  const isZero = tx.amount === 0;

                  return (
                    <tr key={tx.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                      <td className="px-5 py-4 whitespace-nowrap text-neutral-500 font-mono text-[11px]">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-[#101323] dark:text-neutral-200">
                          {tx.description}
                        </div>
                        {tx.price_inr && (
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            Amount Paid: ₹{tx.price_inr}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            tx.type === "purchase"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : tx.type === "deduction"
                              ? "bg-[#EFF5FF] text-[#3478F6] dark:bg-[#162444] dark:text-[#60A5FA]"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-bold whitespace-nowrap ${
                          isPositive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isZero
                            ? "text-neutral-500"
                            : "text-[#3478F6] dark:text-[#60A5FA]"
                        }`}
                      >
                        {isPositive ? `+${tx.amount}` : isZero ? "0" : tx.amount}
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-[#101323] dark:text-white whitespace-nowrap">
                        {tx.balance_after}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
