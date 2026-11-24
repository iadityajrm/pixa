"use client";

import React, { useEffect } from "react";
import { LayoutDashboard, Star, Brain, UsersRound, CreditCard, Sparkles, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/Auth/LogoutButton";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import { setCreditStatus } from "@/store/slices/userConfig";
import { getApiUrl } from "@/utils/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PixaLogoIcon } from "@/components/PixaLogo";

export const defaultNavItems = [
    { key: "dashboard" as const, label: "Presentations", icon: LayoutDashboard },
    { key: "templates" as const, label: "Standard", icon: Star },
    { key: "designs" as const, label: "Smart", icon: Brain },
];

type DashboardSidebarProps = {
    showTemplates?: boolean;
};

const DashboardSidebar = ({
    showTemplates = true,
}: DashboardSidebarProps) => {
    const pathname = usePathname();
    const dispatch = useDispatch();
    const isAdmin = useSelector((state: RootState) => state.userConfig.role === "admin");
    const credits = useSelector((state: RootState) => state.userConfig.credits ?? 0);
    const freeUsed = useSelector((state: RootState) => state.userConfig.free_presentation_used);

    // Refresh credits on mount & route changes to ensure fresh balance
    useEffect(() => {
        let isMounted = true;
        const fetchCreditStatus = async () => {
            try {
                const res = await fetch(getApiUrl("/api/v1/credits/status"), {
                    credentials: "include",
                    cache: "no-store",
                });
                if (res.ok && isMounted) {
                    const data = await res.json();
                    dispatch(
                        setCreditStatus({
                            credits: data.credits,
                            free_presentation_used: data.free_presentation_used,
                            has_purchased_credits: data.has_purchased_credits,
                        })
                    );
                }
            } catch {
                // Silently keep current balance on error
            }
        };
        fetchCreditStatus();
        return () => {
            isMounted = false;
        };
    }, [pathname, dispatch]);

    const isDashboardActive = pathname === "/dashboard" || pathname === "/";
    const isTemplatesActive = pathname === "/templates";
    const isPlansActive = pathname === "/plans";
    const isSubscriptionActive = pathname === "/subscription";
    const isAdminActive = pathname === "/adminconsole";
    const isSettingsActive = pathname === "/settings";

    return (
        <>
            {/* Desktop / Tablet Sidebar: Floating light-toned panel adhering to Pixa brand reference */}
            <aside
                className="sticky top-0 hidden md:flex h-screen w-[220px] shrink-0 flex-col justify-between p-3.5 z-40"
                aria-label="Dashboard sidebar"
            >
                <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-[#FFFFFF] dark:bg-[#111318] border border-[#E5E7EB] dark:border-[#22252D] shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4">
                    <div className="flex flex-col w-full">
                        {/* Brand Logo & Wordmark Header */}
                        <div className="flex items-center justify-between mb-6">
                            <Link
                                href="/dashboard"
                                className="flex items-center px-1 py-1 rounded-lg transition-opacity hover:opacity-85"
                                title="Pixa Home"
                            >
                                <img
                                    src="/LightTextLogo.png"
                                    alt="Pixa"
                                    className="h-7 w-auto object-contain dark:hidden"
                                />
                                <img
                                    src="/DarkTextLogo.png"
                                    alt="Pixa"
                                    className="h-7 w-auto object-contain hidden dark:block"
                                />
                            </Link>
                            <ThemeToggle />
                        </div>

                        {/* Navigation Items */}
                        <nav className="flex flex-col space-y-1 w-full" aria-label="Dashboard sections">
                            {/* Dashboard / Home */}
                            <Link
                                prefetch={false}
                                href="/dashboard"
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                                    isDashboardActive
                                        ? "bg-[#EFF5FF] text-[#3478F6] dark:bg-[#162444] dark:text-[#3478F6] font-semibold"
                                        : "text-[#4B5563] dark:text-[#B8BBC5] hover:bg-[#F7F8FC] dark:hover:bg-[#181A20] hover:text-[#111318] dark:hover:text-white"
                                }`}
                                aria-label="Presentations"
                            >
                                <LayoutDashboard className={`h-4 w-4 shrink-0 ${isDashboardActive ? "text-[#3478F6]" : "text-[#6B7280] dark:text-[#8E929E]"}`} />
                                <span>Presentations</span>
                            </Link>

                            {/* Templates */}
                            {showTemplates && (
                                <Link
                                    prefetch={false}
                                    href="/templates"
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                                        isTemplatesActive
                                            ? "bg-[#EFF5FF] text-[#3478F6] dark:bg-[#162444] dark:text-[#3478F6] font-semibold"
                                            : "text-[#4B5563] dark:text-[#B8BBC5] hover:bg-[#F7F8FC] dark:hover:bg-[#181A20] hover:text-[#111318] dark:hover:text-white"
                                    }`}
                                    aria-label="Templates"
                                >
                                    <Star className={`h-4 w-4 shrink-0 ${isTemplatesActive ? "text-[#3478F6]" : "text-[#6B7280] dark:text-[#8E929E]"}`} />
                                    <span>Templates</span>
                                </Link>
                            )}

                            {/* Credit Plans */}
                            <Link
                                prefetch={false}
                                href="/plans"
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                                    isPlansActive
                                        ? "bg-[#EFF5FF] text-[#3478F6] dark:bg-[#162444] dark:text-[#3478F6] font-semibold"
                                        : "text-[#4B5563] dark:text-[#B8BBC5] hover:bg-[#F7F8FC] dark:hover:bg-[#181A20] hover:text-[#111318] dark:hover:text-white"
                                }`}
                                aria-label="Plans"
                            >
                                <Sparkles className={`h-4 w-4 shrink-0 ${isPlansActive ? "text-[#3478F6]" : "text-[#6B7280] dark:text-[#8E929E]"}`} />
                                <span>Plans</span>
                            </Link>

                            {/* Billing / Subscription */}
                            <Link
                                prefetch={false}
                                href="/subscription"
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                                    isSubscriptionActive
                                        ? "bg-[#EFF5FF] text-[#3478F6] dark:bg-[#162444] dark:text-[#3478F6] font-semibold"
                                        : "text-[#4B5563] dark:text-[#B8BBC5] hover:bg-[#F7F8FC] dark:hover:bg-[#181A20] hover:text-[#111318] dark:hover:text-white"
                                }`}
                                aria-label="Billing"
                            >
                                <CreditCard className={`h-4 w-4 shrink-0 ${isSubscriptionActive ? "text-[#3478F6]" : "text-[#6B7280] dark:text-[#8E929E]"}`} />
                                <span>Billing</span>
                            </Link>

                            {/* Admin Console (administrators only) */}
                            {isAdmin && (
                                <Link
                                    prefetch={false}
                                    href="/adminconsole"
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                                        isAdminActive
                                            ? "bg-[#EFF5FF] text-[#3478F6] dark:bg-[#162444] dark:text-[#3478F6] font-semibold"
                                            : "text-[#4B5563] dark:text-[#B8BBC5] hover:bg-[#F7F8FC] dark:hover:bg-[#181A20] hover:text-[#111318] dark:hover:text-white"
                                    }`}
                                    aria-label="Admin Console"
                                >
                                    <UsersRound className={`h-4 w-4 shrink-0 ${isAdminActive ? "text-[#3478F6]" : "text-[#6B7280] dark:text-[#8E929E]"}`} />
                                    <span>Console</span>
                                </Link>
                            )}
                        </nav>
                    </div>

                    {/* Bottom Section: Clean Balance Display & Session */}
                    <div className="flex flex-col gap-3 pt-3 border-t border-[#F0F2F8] dark:border-[#22252D]">
                        {/* Credits Card */}
                        <Link
                            href="/subscription"
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F8FC] dark:bg-[#181A20] hover:bg-[#EFF5FF] dark:hover:bg-[#162444] transition-colors border border-[#E5E7EB]/70 dark:border-[#2B2F38]"
                            title="View Credits Balance"
                        >
                            <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#3478F6]/10 text-[#3478F6] text-sm font-semibold select-none">
                                    ✧
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-semibold text-[#111318] dark:text-white">Credits</span>
                                    {!freeUsed && (
                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">1 Free left</span>
                                    )}
                                </div>
                            </div>
                            <span className="text-xs font-bold text-[#3478F6] font-mono">
                                {credits}
                            </span>
                        </Link>

                        {/* Logout button */}
                        <div className="px-1 py-0.5">
                            <LogoutButton
                                label="Log Out"
                                className="flex items-center gap-2.5 text-[#6B7280] dark:text-[#B8BBC5] hover:text-[#111318] dark:hover:text-white transition-colors text-xs font-medium w-full px-2 py-1.5 rounded-lg hover:bg-[#F7F8FC] dark:hover:bg-[#181A20]"
                            />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Navigation Bar: Floating minimalist dock */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around border-t border-[#E5E7EB] dark:border-[#22252D] bg-[#FFFFFF]/95 dark:bg-[#111318]/95 backdrop-blur-md px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0.5rem))] shadow-lg"
                aria-label="Mobile navigation"
            >
                <Link
                    href="/dashboard"
                    className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors ${
                        isDashboardActive
                            ? "text-[#3478F6]"
                            : "text-[#6B7280] dark:text-[#8E929E]"
                    }`}
                >
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="text-[10px] font-medium mt-0.5">Home</span>
                </Link>

                {showTemplates && (
                    <Link
                        href="/templates"
                        className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors ${
                            isTemplatesActive
                                ? "text-[#3478F6]"
                                : "text-[#6B7280] dark:text-[#8E929E]"
                        }`}
                    >
                        <Star className="h-5 w-5" />
                        <span className="text-[10px] font-medium mt-0.5">Templates</span>
                    </Link>
                )}

                <Link
                    href="/plans"
                    className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors ${
                        isPlansActive
                            ? "text-[#3478F6]"
                            : "text-[#6B7280] dark:text-[#8E929E]"
                    }`}
                >
                    <Sparkles className="h-5 w-5" />
                    <span className="text-[10px] font-medium mt-0.5">Plans</span>
                </Link>

                <Link
                    href="/subscription"
                    className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors ${
                        isSubscriptionActive
                            ? "text-[#3478F6]"
                            : "text-[#6B7280] dark:text-[#8E929E]"
                    }`}
                >
                    <CreditCard className="h-5 w-5" />
                    <span className="text-[10px] font-medium mt-0.5">{credits} Creds</span>
                </Link>

                {isAdmin && (
                    <Link
                        href="/adminconsole"
                        className={`flex flex-col items-center justify-center p-1 rounded-lg transition-colors ${
                            isAdminActive
                                ? "text-[#3478F6]"
                                : "text-[#6B7280] dark:text-[#8E929E]"
                        }`}
                    >
                        <UsersRound className="h-5 w-5" />
                        <span className="text-[10px] font-medium mt-0.5">Admin</span>
                    </Link>
                )}
            </nav>
        </>
    );
};

export default DashboardSidebar;
