"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/utils/api";
import { notify } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FullscreenLoader } from "@/components/ui/fullscreen-loader";
import { markStartupSplashConsumed } from "@/components/ui/presenton-splash-loader";

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "login" | "signup";
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export default function AuthModal({
  isOpen,
  onOpenChange,
  initialMode = "login",
  onSuccess,
  title,
  subtitle,
}: AuthModalProps) {
  const [isLoginMode, setIsLoginMode] = useState(initialMode === "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      notify.error("Validation error", "Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    const endpoint = isLoginMode ? "/api/v1/auth/login" : "/api/v1/auth/signup";

    try {
      const response = await fetch(getApiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: email.trim(),
          password: password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          data?.detail || (isLoginMode ? "Invalid email or password" : "Registration failed");
        notify.error(isLoginMode ? "Login failed" : "Sign up failed", detail);
        setIsSubmitting(false);
        return;
      }

      notify.success(isLoginMode ? "Logged in successfully" : "Account created successfully");
      onOpenChange(false);

      if (onSuccess) {
        setIsSubmitting(false);
        onSuccess();
        return;
      }

      // Keep the loader visible while the next view renders. A client-side
      // navigation avoids a full page reload (and the startup splash).
      markStartupSplashConsumed();
      const destination =
        data?.role === "admin" || email.trim().toLowerCase() === "admin@framewrk.site"
          ? "/adminconsole"
          : "/dashboard";
      router.replace(destination);
    } catch (err: any) {
      notify.error("Network error", "Unable to connect to server");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="motion-pop-modal max-w-[420px] rounded-2xl border border-[#E1E1E5] bg-white p-7 text-[#101323] shadow-xl dark:border-neutral-800 dark:bg-[#18181b] dark:text-neutral-100">
        <DialogTitle className="sr-only">
          {isLoginMode ? "Sign In" : "Create Account"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isLoginMode ? "Sign in to your account" : "Create a new account"}
        </DialogDescription>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#3478F6]/10 p-2">
            <Image
              src="/mainlogo.png"
              alt="Logo"
              width={32}
              height={32}
              style={{ width: "auto", height: "auto" }}
              className="h-8 w-8 object-contain"
            />
          </div>
          <h2 className="text-xl font-bold font-syne text-[#101323] dark:text-white">
            {title || (isLoginMode ? "Welcome back" : "Create your account")}
          </h2>
          <p className="mt-1 text-xs text-[#667085] dark:text-neutral-400">
            {subtitle ||
              (isLoginMode
                ? "Sign in to generate and save your presentation"
                : "Create an account to continue your presentation")}
          </p>
        </div>

        <div className="mb-5 flex rounded-lg bg-[#F2F4F7] p-1 text-xs font-semibold dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setIsLoginMode(true)}
            className={`flex-1 rounded-md py-1.5 transition-all ${
              isLoginMode
                ? "bg-white text-[#101323] shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-[#667085] hover:text-[#101323] dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setIsLoginMode(false)}
            className={`flex-1 rounded-md py-1.5 transition-all ${
              !isLoginMode
                ? "bg-white text-[#101323] shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-[#667085] hover:text-[#101323] dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#344054] dark:text-neutral-300">
              Email Address
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2 text-sm text-[#101323] outline-none transition placeholder:text-[#98A2B3] focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#344054] dark:text-neutral-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2 text-sm text-[#101323] outline-none transition placeholder:text-[#98A2B3] focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#3478F6] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {isLoginMode ? "Sign In & Continue" : "Sign Up & Continue"}
          </button>
        </form>
      </DialogContent>
      </Dialog>

      {isSubmitting && (
        <FullscreenLoader
          message={
            isLoginMode ? "Signing you in…" : "Creating your account…"
          }
        />
      )}
    </>
  );
}
