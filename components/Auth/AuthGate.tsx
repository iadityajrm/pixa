"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { getApiUrl } from "@/utils/api";
import { notify } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRouter, useSearchParams } from "next/navigation";
import { FullscreenLoader } from "@/components/ui/fullscreen-loader";
import { markStartupSplashConsumed } from "@/components/ui/presenton-splash-loader";

export default function AuthGate() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const defaultMode = searchParams.get("mode");
  const router = useRouter();

  const [isLoginMode, setIsLoginMode] = useState(defaultMode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // The sign-in page is a cold-start entry point. Mark the branding splash
    // as seen so the post-login view opens immediately.
    markStartupSplashConsumed();
  }, []);

  useEffect(() => {
    if (defaultMode === "signup") {
      setIsLoginMode(false);
    } else if (defaultMode === "login") {
      setIsLoginMode(true);
    }
  }, [defaultMode]);

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
        const detail = data?.detail || (isLoginMode ? "Invalid email or password" : "Registration failed");
        notify.error(isLoginMode ? "Login failed" : "Sign up failed", detail);
        setIsSubmitting(false);
        return;
      }

      notify.success(isLoginMode ? "Logged in successfully" : "Account created successfully");

      // If returnTo is specified, navigate there so pending presentation generation resumes
      if (returnTo) {
        router.replace(returnTo);
        return;
      }

      // Check role or admin email
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
    <main className="relative flex min-h-screen w-full items-center justify-center bg-[#F6F6F9] p-4 font-syne dark:bg-[#101323]">
      {isSubmitting && (
        <FullscreenLoader
          message={isLoginMode ? "Signing you in…" : "Creating your account…"}
        />
      )}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-[420px] rounded-2xl border border-[#E1E1E5] bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[#3478F6]/10 p-2">
            <Image
              src="/mainlogo.png"
              alt="Logo"
              width={40}
              height={40}
              style={{ width: "auto", height: "auto" }}
              className="h-10 w-10 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-[#101323] dark:text-white">
            {isLoginMode ? "Welcome back" : "Create an account"}
          </h1>
          <p className="mt-1 text-sm text-[#667085] dark:text-neutral-400">
            {returnTo
              ? (isLoginMode
                  ? "Log in to continue generating your presentation"
                  : "Sign up to continue generating your presentation")
              : (isLoginMode
                  ? "Enter your email and password to log in"
                  : "Sign up to start creating presentations")}
          </p>
        </div>

        <div className="mb-6 flex rounded-lg bg-[#F2F4F7] p-1 text-xs font-semibold dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setIsLoginMode(true)}
            className={`flex-1 rounded-md py-2 transition-all ${
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
            className={`flex-1 rounded-md py-2 transition-all ${
              !isLoginMode
                ? "bg-white text-[#101323] shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-[#667085] hover:text-[#101323] dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#101323] outline-none transition placeholder:text-[#98A2B3] focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
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
              className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#101323] outline-none transition placeholder:text-[#98A2B3] focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#3478F6] py-2.5 text-sm font-semibold text-white transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {isSubmitting
              ? "Please wait..."
              : isLoginMode
              ? (returnTo ? "Log In & Generate" : "Log In")
              : (returnTo ? "Sign Up & Generate" : "Create Account")}
          </button>
        </form>
      </section>
    </main>
  );
}
