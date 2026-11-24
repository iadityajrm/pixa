"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";

import {
  DashboardApi,
  type PresentationResponse,
} from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import { LegacyPresentationsTable } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/LegacyPresentationsTable";
import { PresentationGenerationApi } from "@/app/(presentation-generator)/services/api/presentation-generation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Sparkles } from "lucide-react";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { notify } from "@/components/ui/sonner";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from "@/utils/providerConstants";
import { BlankPresentationDialog } from "./BlankPresentationDialog";
import { BuyCreditsModal } from "@/components/dialogs/BuyCreditsModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import UploadPage from "@/app/(presentation-generator)/upload/components/UploadPage";
import GradientASCII from "@/components/ui/GradientASCII";
import styles from "./dashboardMotion.module.css";

const APP_UPDATE_URL = "https://presenton.ai/download";

const actionCardBase =
  "absolute aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] border border-white/50 bg-cover bg-center bg-no-repeat shadow-[0_8px_18px_rgba(16,24,40,0.18)]";

const dashboardHeaderPill =
  "inline-flex shrink-0 items-center justify-center rounded-full text-[#191919] transition-colors hover:bg-[#F8F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6] focus-visible:ring-offset-2";

const dashboardHeaderAsset = (name: string) => `/dashboard-header/${name}`;
const dashboardBodyAsset = (name: string) => `/dashboard-body/${name}`;

const DashboardHeaderDivider = () => (
  <span className="relative h-5 w-px shrink-0" aria-hidden="true">
    <Image
      src={dashboardHeaderAsset("divider.svg")}
      alt=""
      width={20}
      height={1}
      className="absolute left-1/2 top-1/2 h-px w-5 max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90"
    />
  </span>
);

const FloatingActionCards = () => (
  <div className={`${styles.floatingCards} pointer-events-none absolute right-[14px] top-[-35px] z-0 hidden h-[64px] w-[158px] sm:block`}>
    <div
      className={`${actionCardBase} left-0 top-0 border-none`}
      style={{
        backgroundImage: "url('/create_presentation_card_3.png')",
      }}
    />
    <div
      className={`${actionCardBase} left-[39px] top-1 z-10 border-none`}
      style={{
        backgroundImage: "url('/create_presentation_card_2.png')",
      }}
    />
    <div
      className={`${actionCardBase} left-[76px] top-0 border-none`}
      style={{
        backgroundImage: "url('/create_presentation_card_1.png')",
      }}
    />
  </div>
);

type DashboardActionCardProps = {
  href?: string;
  title: string;
  media: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
  mediaClassName?: string;
};

const DashboardActionCard = ({
  href,
  title,
  media,
  ariaLabel,
  onClick,
  disabled = false,
  isLoading = false,
  children,
  mediaClassName = "w-[96px]",
}: DashboardActionCardProps) => {
  const className =
    `${styles.actionCard} motion-press group/action relative isolate flex h-[90px] w-full min-w-0 overflow-visible rounded-[10.8px] border border-[#EDEEEF] bg-white text-[#191919] outline-none hover:border-[#D7D8DE] hover:shadow-[0_10px_28px_rgba(16,24,40,0.08)] focus-visible:ring-2 focus-visible:ring-[#3478F6] focus-visible:ring-offset-4 disabled:cursor-wait disabled:opacity-70 disabled:hover:border-[#EDEEEF] disabled:hover:shadow-none`;
  const content = (
    <>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-[10.8px] bg-white"
      />
      <div
        className={`relative z-20 h-full ${mediaClassName} shrink-0 overflow-hidden rounded-l-[10.8px] bg-[#F8F8FB]`}
      >
        {media}
      </div>
      <span className="relative z-20 flex min-w-0 flex-1 items-center justify-center px-3 text-center font-syne text-sm font-medium leading-normal text-[#191919] sm:px-4">
        {title}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-label={ariaLabel}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={isLoading}
      className={className}
    >
      {content}
    </button>
  );
};

const BlankPresentationIllustration = ({
  isLoading,
}: {
  isLoading: boolean;
}) => (
  <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#D1E9FF]">
    <div className="relative h-[90px] w-[90px] shrink-0">
      <div className="absolute left-[22.312px] top-[20.46px] h-[52.514px] w-[48.892px] -rotate-[5.81deg] bg-[rgba(0,0,0,0.14)]" />
      <div className="absolute left-[21.452px] top-[19.94px] h-[52.514px] w-[48.892px] -rotate-[5.81deg] bg-[#ECEEEE]" />
      <div className="absolute left-[23.57px] top-[21.78px] h-[50.53px] w-[47.045px] bg-[rgba(0,0,0,0.14)]" />
      <div className="absolute left-[22.79px] top-[21.2px] h-[50.53px] w-[47.045px] bg-[#FEFEFF]" />
      <Image
        src="/dashboard/blank-presentation-clip.svg"
        alt=""
        aria-hidden="true"
        width={9}
        height={15}
        className="absolute left-[25.05px] top-[15.66px] h-[14.283px] w-[8.282px]"
      />
      <div className="absolute left-[25.31px] top-[21.2px] h-[0.387px] w-[0.968px] bg-[#FEFEFF]" />
    </div>

    {isLoading && (
      <div className="absolute inset-0 flex items-center justify-center bg-[#D1E9FF]/75">
        <Loader2 className="h-5 w-5 animate-spin text-[#6847F4]" />
      </div>
    )}
  </div>
);

const GridViewIcon = () => (
  <Image
    src={dashboardBodyAsset("grid.svg")}
    alt=""
    width={16}
    height={16}
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  />
);

const ListViewIcon = () => (
  <Image
    src={dashboardBodyAsset("list.svg")}
    alt=""
    width={16}
    height={16}
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  />
);

const sortPresentationsNewestFirst = (presentations: PresentationResponse[]) =>
  [...presentations].sort((a, b) => {
    
    const createdAtA = Date.parse(a.created_at);
    const createdAtB = Date.parse(b.created_at);

    return (
      (Number.isNaN(createdAtB) ? 0 : createdAtB) -
      (Number.isNaN(createdAtA) ? 0 : createdAtA)
    );
  });

function formatGitHubStars(stars: number) {
  if (stars >= 1_000_000) {
    return `${(stars / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (stars >= 1_000) {
    return `${(stars / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return stars.toLocaleString();
}

function DashboardHeader({ onOpenBuyCredits }: { onOpenBuyCredits?: () => void }) {
  const pathname = usePathname();
  const credits = useSelector((state: RootState) => state.userConfig.credits ?? 0);
  const llmConfig = useSelector(
    (state: RootState) => state.userConfig.llm_config,
  );
  const [isElectronApp, setIsElectronApp] = useState(false);

  const textProvider = LLM_PROVIDERS[llmConfig.LLM || "openai"];
  const imageProvider = llmConfig.DISABLE_IMAGE_GENERATION
    ? undefined
    : IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER || ""];
  const configuredProviders = [textProvider, imageProvider].filter(
    (provider): provider is NonNullable<typeof provider> =>
      Boolean(provider?.icon),
  );

  useEffect(() => {
    setIsElectronApp(Boolean(window.electron));

    let isMounted = true;

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 ml-2 md:ml-7 mr-2 md:mr-[9px] flex h-[70px] md:h-[105px] items-center justify-between border-b border-[#EDEEEF] dark:border-neutral-800 bg-white dark:bg-[#121216] px-2 md:px-1 transition-colors">
      <div className="flex w-auto shrink-0 items-center gap-3">
        {/* Mobile App Brand Logo */}
        <Link href="/dashboard" className="md:hidden flex items-center">
          <img
            src="/LightLogo.png"
            alt="Pixa"
            className="h-7 w-7 object-contain dark:hidden"
          />
          <img
            src="/DarkLogo.png"
            alt="Pixa"
            className="h-7 w-7 object-contain hidden dark:block"
          />
        </Link>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Quick Razorpay Buy Credits CTA Button */}
        <button
          type="button"
          onClick={onOpenBuyCredits}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#3478F6] to-[#3478F6] hover:opacity-95 shadow-xs transition-all cursor-pointer font-syne"
          title="Buy Credits via Razorpay"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Recharge</span>
          <span className="font-outfit font-extrabold px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[11px]">
            {credits}
          </span>
        </button>

        <div className="flex h-[42.24px] items-center gap-2 rounded-full">
          <ThemeToggle />

          {isElectronApp && (
            <Link
              href={APP_UPDATE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Update app"
              title="Update app"
              className="relative flex h-[42.24px] w-[42.24px] shrink-0 items-center justify-center rounded-full border-[1.32px] border-[#D9D6FE] dark:border-neutral-700 bg-[#FAFAFF] dark:bg-neutral-800 transition-colors hover:bg-[#F3F0FF] dark:hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6] focus-visible:ring-offset-2"
              onClick={() =>
                trackEvent(MixpanelEvent.Navigation, {
                  from: pathname,
                  to: APP_UPDATE_URL,
                  source: "dashboard_header_update_app",
                  app_version: window.env?.APP_VERSION,
                })
              }
            >
              <Image
                src={dashboardHeaderAsset("update-arrow.svg")}
                alt=""
                aria-hidden="true"
                width={16}
                height={16}
                className="h-4 w-4 -rotate-90"
              />
              <Image
                src={dashboardHeaderAsset("update-badge.svg")}
                alt=""
                aria-hidden="true"
                width={14}
                height={14}
                className="absolute left-[26.44px] top-[-2.32px] h-[13.2px] w-[13.2px]"
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

const DashboardPage: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [presentations, setPresentations] = useState<PresentationResponse[]>(
    [],
  );
  const [legacyPresentations, setLegacyPresentations] = useState<
    PresentationResponse[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBlankPresentation, setIsCreatingBlankPresentation] =
    useState(false);
  const [isBlankPresentationDialogOpen, setIsBlankPresentationDialogOpen] =
    useState(false);
  const [isBuyCreditsDialogOpen, setIsBuyCreditsDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckViewMode, setDeckViewMode] = useState<"grid" | "list">("grid");
  const blankPresentationRequestInFlight = useRef(false);

  const sortedPresentations = useMemo(
    () => sortPresentationsNewestFirst(presentations),
    [presentations],
  );

  const sortedLegacyPresentations = useMemo(
    () => sortPresentationsNewestFirst(legacyPresentations),
    [legacyPresentations],
  );

  const fetchPresentations = useCallback(async () => {
    let fetchedCount = 0;
    let hasError = false;
    try {
      setIsLoading(true);
      setError(null);
      const [supported, legacy] = await Promise.all([
        DashboardApi.getPresentations("v2-standard"),
        DashboardApi.getPresentations("v1-standard", { includeSlides: false }),
      ]);
      fetchedCount = supported.length + legacy.length;
      setPresentations(supported);
      setLegacyPresentations(legacy);
    } catch {
      hasError = true;
      setError(null);
      setPresentations([]);
      setLegacyPresentations([]);
    } finally {
      trackEvent(MixpanelEvent.Dashboard_Page_Viewed, {
        pathname,
        presentation_count: fetchedCount,
        load_failed: hasError,
      });
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    void fetchPresentations();
  }, [fetchPresentations]);

  const createBlankPresentation = useCallback(async (templateId?: string) => {
    if (blankPresentationRequestInFlight.current) return;

    blankPresentationRequestInFlight.current = true;
    setIsCreatingBlankPresentation(true);
    trackEvent(MixpanelEvent.Dashboard_New_Presentation_Clicked, {
      pathname,
      source: "dashboard_blank_presentation_card",
      template_id: templateId,
      creation_type: templateId ? "with_template" : "without_template",
    });

    try {
      const presentation =
        await PresentationGenerationApi.createBlankPresentation(templateId);
      trackEvent(MixpanelEvent.Dashboard_Blank_Presentation_Created, {
        pathname,
        presentation_id: presentation.id,
        slide_count: presentation.n_slides,
        template_id: templateId,
      });
      router.push(
        `/presentation?id=${encodeURIComponent(presentation.id)}&type=standard`,
      );
    } catch (creationError) {
      const message =
        creationError instanceof Error
          ? creationError.message
          : "Something went wrong while creating the presentation.";
      trackEvent(MixpanelEvent.Dashboard_Blank_Presentation_Create_Failed, {
        pathname,
        error_message: sanitizeAnalyticsError(creationError),
      });
      notify.error("Could not create blank presentation", message);
    } finally {
      blankPresentationRequestInFlight.current = false;
      setIsCreatingBlankPresentation(false);
    }
  }, [pathname, router]);

  const removePresentation = (presentationId: string) => {
    setPresentations((prev) => prev.filter((p) => p.id !== presentationId));
    setLegacyPresentations((prev) =>
      prev.filter((p) => p.id !== presentationId),
    );
  };

  const removeLegacyPresentations = (presentationIds: string[]) => {
    const deletedIds = new Set(presentationIds);
    setLegacyPresentations((prev) =>
      prev.filter((presentation) => !deletedIds.has(presentation.id)),
    );
  };

  return (
    <div className="relative min-h-screen w-full pb-10 animate-page-stagger">
      {isBlankPresentationDialogOpen && (
        <BlankPresentationDialog
          open
          isCreating={isCreatingBlankPresentation}
          onOpenChange={setIsBlankPresentationDialogOpen}
          onContinueWithoutTemplate={() => void createBlankPresentation()}
          onContinueWithTemplate={(template) =>
            void createBlankPresentation(template.id)
          }
        />
      )}
      <BuyCreditsModal
        open={isBuyCreditsDialogOpen}
        onOpenChange={setIsBuyCreditsDialogOpen}
      />

      {/* Unified Hero & Presentation Input Form from Upload */}
      <section className="relative w-full pt-4 pb-8 transition-all duration-300 overflow-hidden">
        {/* Background Gradient Animation */}
        <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden opacity-30 dark:opacity-40">
          <GradientASCII
            colors={['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8']}
            shape="horizon"
            characters=" =+xX0S8#@"
            cellSize={18}
            density={0.8}
          />
        </div>

        <div className="relative z-10">
          {/* Reference Process Pill */}
          <div className="motion-enter mx-auto mb-4 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e2e5e9] bg-[#e5f1f8] dark:border-neutral-800 dark:bg-neutral-800/80 px-3.5 py-1 text-xs font-semibold text-[#2c5270] dark:text-[#a5b4fc] shadow-2xs">
              <span>Create</span>
              <span className="opacity-40">•</span>
              <span>Edit</span>
              <span className="opacity-40">•</span>
              <span>Present</span>
              <span className="opacity-40">•</span>
              <span>Download</span>
            </div>
          </div>

          <div className="motion-enter mb-6 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <h1 className="font-syne text-[32px] sm:text-[42px] lg:text-[48px] font-bold leading-tight tracking-[-0.58px] text-[#101323] dark:text-white">
              AI presentations, made simple.
            </h1>
            <p className="max-w-[620px] font-syne text-sm leading-[1.5] tracking-[0.1px] text-[#101323CC] dark:text-neutral-300 sm:text-base">
              Create your presentation. Make your edits. Present it online.
              Download it when you’re ready.
            </p>
          </div>

          <UploadPage
            communityEnabled={false}
            presentationGenerationMode="standard"
          />
        </div>
      </section>

      {/* Existing Decks Section */}
      <section className="motion-fade motion-delay-1 relative z-10 mt-6 pl-3 pr-3 sm:pl-6 sm:pr-[9px]">
        <div className="mb-[14px] flex items-center justify-between gap-4">
          <h2 className="font-syne text-[16px] font-medium leading-[normal] text-[#191919]">
            Decks
          </h2>
          <div className="flex items-center gap-[17px]">
            <div className="flex items-center rounded-[4px] border border-[#EDEEEF] p-1">
              <button
                type="button"
                onClick={() => setDeckViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={deckViewMode === "grid"}
                className={`flex items-center rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6] ${deckViewMode === "grid" ? "bg-[#F6F6F9]" : "hover:bg-[#FAFAFC]"}`}
              >
                <GridViewIcon />
              </button>
              <button
                type="button"
                onClick={() => setDeckViewMode("list")}
                aria-label="List view"
                aria-pressed={deckViewMode === "list"}
                className={`flex items-center rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6] ${deckViewMode === "list" ? "bg-[#F6F6F9]" : "hover:bg-[#FAFAFC]"}`}
              >
                <ListViewIcon />
              </button>
            </div>
          </div>
        </div>
        <PresentationGrid
          presentations={sortedPresentations}
          viewMode={deckViewMode}
          isLoading={isLoading}
          error={error}
          onPresentationDeleted={removePresentation}
          onPresentationDuplicated={(presentation) =>
            setPresentations((prev) => [presentation, ...prev])
          }
        />
      </section>
    </div>
  );
};

export default DashboardPage;
