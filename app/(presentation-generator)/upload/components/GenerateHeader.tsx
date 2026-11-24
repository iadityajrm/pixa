"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Wrapper from "@/components/Wrapper";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getApiUrl } from "@/utils/api";
import LogoutButton from "@/components/Auth/LogoutButton";

interface GenerateHeaderProps {
  onSignInClick?: () => void;
  signInHref?: string;
  homeHref?: string;
  authenticated?: boolean;
  username?: string | null;
}

export default function GenerateHeader({
  onSignInClick,
  signInHref,
  homeHref = "/dashboard",
  authenticated: propAuthenticated,
  username: propUsername,
}: GenerateHeaderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(propAuthenticated)
  );
  const [user, setUser] = useState<string | null>(propUsername || null);

  useEffect(() => {
    if (propAuthenticated !== undefined) {
      setIsAuthenticated(propAuthenticated);
      if (propUsername) setUser(propUsername);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch(getApiUrl("/api/v1/auth/status"), {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(Boolean(data.authenticated));
          setUser(data.username || null);
        }
      } catch {
        // Ignore
      }
    };
    checkAuth();
  }, [propAuthenticated, propUsername]);

  return (
    <header className="sticky top-0 z-40 h-[66px] bg-white/95 backdrop-blur-md dark:bg-[#111318]/95 border-b border-[#E5E7EB] dark:border-[#22252D] transition-colors">
      <Wrapper className="relative flex h-full items-center justify-between gap-3 px-4 sm:px-10 lg:px-20">
        <Link
          href={homeHref}
          aria-label="Pixa home"
          className="flex items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-[#3478F6]"
        >
          <Image
            src="/LightTextLogo.png"
            alt="Pixa"
            width={100}
            height={32}
            className="h-8 w-auto object-contain dark:hidden"
          />
          <Image
            src="/DarkTextLogo.png"
            alt="Pixa"
            width={100}
            height={32}
            className="h-8 w-auto object-contain hidden dark:block"
          />
        </Link>

        <nav
          aria-label="Primary"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
        >
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/about", label: "About Us" },
            { href: "/contact", label: "Contact Us" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[#4C4C4C] transition hover:bg-[#F2F4F7] hover:text-[#101323] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6] dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <LogoutButton className="h-8 rounded-xl px-2.5 text-xs" />
            </div>
          ) : signInHref && !onSignInClick ? (
            <Link
              href={signInHref}
              className="inline-flex items-center justify-center rounded-xl bg-[#3478F6] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]"
            >
              Sign In
            </Link>
          ) : (
            <button
              type="button"
              onClick={onSignInClick}
              className="inline-flex items-center justify-center rounded-xl bg-[#3478F6] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]"
            >
              Sign In
            </button>
          )}
        </div>
      </Wrapper>
    </header>
  );
}
