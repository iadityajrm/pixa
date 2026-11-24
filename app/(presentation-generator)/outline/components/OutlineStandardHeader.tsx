"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface OutlineStandardHeaderProps {
  title: string;
  onBack: () => void;
}

const OutlineStandardHeader = ({
  title,
  onBack,
}: OutlineStandardHeaderProps) => (
  <header className="sticky top-0 z-[60] h-[58px] sm:h-[68px] w-full border-b border-[#E5E7EB] bg-white dark:bg-[#111318] dark:border-[#22252D]">
    <div className="flex h-full items-center justify-between px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]/30 flex items-center"
        >
          <Image
            src="/LightLogo.png"
            alt="Pixa"
            width={32}
            height={32}
            className="h-8 w-8 object-contain dark:hidden"
          />
          <Image
            src="/DarkLogo.png"
            alt="Pixa"
            width={32}
            height={32}
            className="h-8 w-8 object-contain hidden dark:block"
          />
        </Link>
        <h1 className="truncate text-sm sm:text-base font-semibold tracking-tight text-[#111318] dark:text-[#F7F8FC]">
          {title}
        </h1>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="flex shrink-0 items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.96px] text-[#4B5563] dark:text-[#B8BBC5] transition-colors hover:text-[#3478F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]/30"
      >
        <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
        Back
      </button>
    </div>
  </header>
);

export default OutlineStandardHeader;
