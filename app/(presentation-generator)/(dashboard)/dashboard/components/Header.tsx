"use client";

import Wrapper from "@/components/Wrapper";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { ArrowLeft } from "lucide-react";

const PATHS_WITH_HEADER_BACK = [
  "/upload",
  "/outline",
  "/documents-preview",
  "/template-preview",
] as const;

function pathMatches(pathname: string | null, base: string) {
  return pathname === base || pathname?.startsWith(`${base}/`) === true;
}

const Header = () => {
  const pathname = usePathname();
  const showHeaderBack = PATHS_WITH_HEADER_BACK.some((p) => pathMatches(pathname, p));

  const backToUpload =
    pathMatches(pathname, "/outline") || pathMatches(pathname, "/documents-preview");
  const backToTemplates = pathMatches(pathname, "/template-preview");

  const backHref = backToUpload ? "/upload" : backToTemplates ? "/templates" : "/dashboard";
  const backLabel = backToUpload
    ? "BACK"
    : backToTemplates
      ? "BACK"
      : "BACK";

  return (
    <div className="w-full sticky top-0 z-50 py-7 bg-gradient-to-b from-background to-transparent">
      <Wrapper className="px-5 sm:px-10 lg:px-20">
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" onClick={() => trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/dashboard" })}>
              <img
                src="/LightLogo.png"
                alt="Pixa"
                className="h-9 w-9 object-contain dark:hidden"
              />
              <img
                src="/DarkLogo.png"
                alt="Pixa"
                className="h-9 w-9 object-contain hidden dark:block"
              />
            </Link>
          </div>
          <div className="flex items-center">
            {showHeaderBack ? (
              <Link
                href={backHref}
                className="text-[#4B5563] dark:text-[#B8BBC5] hover:text-[#3478F6] text-xs font-semibold flex items-center gap-2 transition-colors"
                onClick={() =>
                  trackEvent(MixpanelEvent.Navigation, { from: pathname, to: backHref })
                }
              >
                <ArrowLeft className="w-4 h-4 shrink-0 text-current" aria-hidden />
                <span>{backLabel}</span>
              </Link>
            ) : null}
          </div>
        </div>
      </Wrapper>
    </div>
  );
};

export default Header;
