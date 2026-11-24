/**
 * UploadPage Component
 * 
 * This component handles the presentation generation upload process, allowing users to:
 * - Configure presentation settings (slides, language)
 * - Input prompts
 * - Upload supporting documents
 * 
 * @component
 */

"use client";
import { isGPTImage25Provider } from "@/utils/providerConstants";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { clearOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { PromptInput } from "./PromptInput";
import { LanguageType, PresentationConfig, ToneType, VerbosityType } from "../type";
import SupportingDoc from "./SupportingDoc";
import { notify } from "@/components/ui/sonner";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import { setPptGenUploadState } from "@/store/slices/presentationGenUpload";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { ConfigurationSelects } from "./ConfigurationSelects";
import { RootState } from "@/store/store";
import { ImagesApi } from "../../services/api/images";
import GenerateUserGuide from "./GenerateUserGuide";
import { LLMConfig } from "@/types/llm_config";
import {
  clampSlideCountValue,
  parseLimitedSlideCount,
} from "@/utils/presentationLimits";
import {
  type GenerationMode,
  type PresentationGenerationMode,
} from "@/utils/presentationGenerationMode";
import { type CommunityPresentation } from "../../services/api/community";
import { getApiUrl } from "@/utils/api";
import Image from "next/image";
import styles from "../../(dashboard)/dashboard/components/dashboardMotion.module.css";

const actionCardBase =
  "absolute aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] border border-white/50 bg-cover bg-center bg-no-repeat shadow-[0_8px_18px_rgba(16,24,40,0.18)]";

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

const CONTENT_DEPTH_OPTIONS = [
  { value: VerbosityType.Concise, label: "Short", hint: "Headlines only" },
  { value: VerbosityType.Standard, label: "Medium", hint: "Balanced detail" },
  { value: VerbosityType.Text_Heavy, label: "Elaborate", hint: "Full, detailed slides" },
] as const;

const STOCK_IMAGE_PROVIDERS = new Set(["pexels", "pixabay"]);
const FILE_TYPE_WORD = new Set([".doc", ".docx", ".docm", ".odt", ".rtf"]);
const FILE_TYPE_PRESENTATION = new Set([".ppt", ".pptx", ".pptm", ".odp"]);
const FILE_TYPE_SPREADSHEET = new Set([".xls", ".xlsx", ".xlsm", ".ods", ".csv", ".tsv"]);
const FILE_TYPE_IMAGE = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"]);
const FILE_MIME_IMAGE = new Set(["image/jpeg", "image/png", "image/gif", "image/bmp", "image/tiff", "image/webp"]);
const FILE_TYPE_PDF = new Set([".pdf"]);
const FILE_TYPE_TEXT = new Set([".txt"]);
// Types for loading state
interface LoadingState {
  isLoading: boolean;
  message: string;
  duration?: number;
  showProgress?: boolean;
  extra_info?: string;
}

const getFileExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf(".");
  if (index < 0) return "";
  return fileName.slice(index).toLowerCase();
};

const getFileCategory = (file: File): string => {
  const extension = getFileExtension(file.name || "");
  if (FILE_TYPE_WORD.has(extension)) return "word";
  if (FILE_TYPE_PRESENTATION.has(extension)) return "presentation";
  if (FILE_TYPE_SPREADSHEET.has(extension)) return "spreadsheet";
  if (FILE_TYPE_IMAGE.has(extension) || FILE_MIME_IMAGE.has((file.type || "").toLowerCase())) return "image";
  if (FILE_TYPE_PDF.has(extension) || file.type === "application/pdf") return "pdf";
  if (FILE_TYPE_TEXT.has(extension) || file.type === "text/plain") return "text";
  return "other";
};

const getSelectedTextModel = (config?: LLMConfig): string => {
  if (!config) return "";
  switch (config.LLM) {
    case "openai":
      return config.OPENAI_MODEL || "";
    case "deepseek":
      return config.DEEPSEEK_MODEL || "";
    case "google":
      return config.GOOGLE_MODEL || "";
    case "vertex":
      return config.VERTEX_MODEL || "";
    case "azure":
      return config.AZURE_OPENAI_MODEL || "";
    case "bedrock":
      return config.BEDROCK_MODEL || "";
    case "openrouter":
      return config.OPENROUTER_MODEL || "";
    case "fireworks":
      return config.FIREWORKS_MODEL || "";
    case "together":
      return config.TOGETHER_MODEL || "";
    case "cerebras":
      return config.CEREBRAS_MODEL || "";
    case "litellm":
      return config.LITELLM_MODEL || "";
    case "lmstudio":
      return config.LMSTUDIO_MODEL || "";
    case "anthropic":
      return config.ANTHROPIC_MODEL || "";
    case "ollama":
      return config.OLLAMA_MODEL || "";
    case "custom":
      return config.CUSTOM_MODEL || "";
    case "codex":
      return config.CODEX_MODEL || "";
    default:
      return "";
  }
};

const getSelectedImageQuality = (config?: LLMConfig): string => {
  if (!config) return "";
  if (config.IMAGE_PROVIDER === "gpt-image-2") return config.GPT_IMAGE_2_QUALITY || "";
  if (isGPTImage25Provider(config.IMAGE_PROVIDER)) return config.GPT_IMAGE_2_5_QUALITY || "medium";
  return "";
};

const getDocumentPaths = (files: unknown): string[] => {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .flat()
    .map((file) =>
      file && typeof file === "object" && "file_path" in file
        ? (file as { file_path?: unknown }).file_path
        : null
    )
    .filter((filePath): filePath is string => typeof filePath === "string");
};

type UploadPageProps = {
  communityEnabled: boolean;
  presentationGenerationMode: PresentationGenerationMode;
  onRequireAuth?: () => void;
  initialTopic?: string;
  initialSlides?: number;
};

const UploadPage = ({
  communityEnabled,
  presentationGenerationMode,
  onRequireAuth,
  initialTopic,
  initialSlides,
}: UploadPageProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const llmConfig = useSelector((state: RootState) => state.userConfig.llm_config);

  const [files, setFiles] = useState<File[]>([]);
  const [communityReference, setCommunityReference] =
    useState<CommunityPresentation | null>(null);
  const [generationMode] = useState<GenerationMode>("standard");
  const [config, setConfig] = useState<PresentationConfig>({
    slides: null,
    language: LanguageType.Auto,
    prompt: "",
    tone: ToneType.Default,
    verbosity: VerbosityType.Standard,
    instructions: "",
    includeTableOfContents: false,
    includeTitleSlide: true,
    webSearch: false,
  });

  useEffect(() => {
    if (initialTopic) {
      setConfig((current) => ({
        ...current,
        prompt: initialTopic,
        ...(initialSlides ? { slides: String(initialSlides) } : {}),
      }));
    }
  }, [initialTopic, initialSlides]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPrompt = params.get("prompt")?.trim();
    if (requestedPrompt) {
      setConfig((current) => ({ ...current, prompt: requestedPrompt }));
    }
  }, []);

  useEffect(() => {
    if (llmConfig?.WEB_GROUNDING !== undefined) {
      setConfig((current) => ({
        ...current,
        webSearch: !!llmConfig.WEB_GROUNDING,
      }));
    }
  }, [llmConfig?.WEB_GROUNDING]);

  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: "",
    duration: 4,
    showProgress: false,
    extra_info: "",
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  const getUploadSnapshotProps = () => {
    const trimmedPrompt = config.prompt.trim();
    const trimmedInstructions = (config.instructions || "").trim();
    const attachmentCategories = Array.from(new Set(files.map(getFileCategory))).sort();
    const imageGenerationEnabled = !llmConfig?.DISABLE_IMAGE_GENERATION;
    const parsedSlides = parseLimitedSlideCount(config.slides);

    return {
      pathname,
      generation_path: files.length > 0 ? "documents" : "prompt_only",
      slides_selected: parsedSlides,
      slides_mode: config.slides ? "selected" : "auto",
      language: config.language || "",
      tone: config.tone,
      verbosity: config.verbosity,
      include_table_of_contents: !!config.includeTableOfContents,
      include_title_slide: !!config.includeTitleSlide,
      web_search: !!config.webSearch,
      generation_mode: generationMode,
      community_reference_id: communityReference?.id ?? null,
      has_prompt: Boolean(trimmedPrompt),
      prompt_char_count: trimmedPrompt.length,
      prompt_word_count: trimmedPrompt ? trimmedPrompt.split(/\s+/).filter(Boolean).length : 0,
      has_instructions: Boolean(trimmedInstructions),
      instructions_char_count: trimmedInstructions.length,
      has_attachments: files.length > 0,
      attachments_count: files.length,
      attachment_categories: attachmentCategories.join(","),
      text_provider: llmConfig?.LLM || "",
      text_model: getSelectedTextModel(llmConfig),
      image_generation_enabled: imageGenerationEnabled,
      image_provider: imageGenerationEnabled ? (llmConfig?.IMAGE_PROVIDER || "") : "disabled",
      image_quality: imageGenerationEnabled ? getSelectedImageQuality(llmConfig) : "",
    };
  };

  const trackUploadValidationFailure = (reason: string) => {
    trackEvent(MixpanelEvent.Upload_Configuration_Invalid, {
      ...getUploadSnapshotProps(),
      reason,
    });
  };

  const handleConfigChange = (key: keyof PresentationConfig, value: unknown) => {
    const nextValue =
      key === "slides" && typeof value === "string"
        ? clampSlideCountValue(value)
        : value;
    setConfig((prev) => ({ ...prev, [key]: nextValue } as PresentationConfig));
  };

  const getGenerationDestination = (presentationId: string) => {
    if (generationMode === "smart") {
      return `/presentation?id=${presentationId}&stream=true&type=smart`;
    }

    const params = new URLSearchParams({ id: presentationId });
    return `/outline?${params.toString()}`;
  };

  const handleCommunityReferenceChange = (
    presentation: CommunityPresentation | null,
    source: "community_picker" | "prompt_reference"
  ) => {
    const previousReferenceId = communityReference?.id ?? null;
    setCommunityReference(presentation);
    if (presentation) {
      trackEvent(MixpanelEvent.Smart_Mode_Reference_Selected, {
        pathname,
        reference_id: presentation.id,
        previous_reference_id: previousReferenceId,
        source,
      });
      return;
    }
    if (previousReferenceId !== null) {
      trackEvent(MixpanelEvent.Smart_Mode_Reference_Removed, {
        pathname,
        reference_id: previousReferenceId,
        source,
      });
    }
  };

  const ensureStockImageProviderReady = async (): Promise<boolean> => {
    if (llmConfig?.DISABLE_IMAGE_GENERATION) {
      return true;
    }

    const selectedProvider = (llmConfig?.IMAGE_PROVIDER || "").toLowerCase();
    if (!STOCK_IMAGE_PROVIDERS.has(selectedProvider)) {
      return true;
    }

    try {
      const providerApiKey =
        selectedProvider === "pexels"
          ? llmConfig?.PEXELS_API_KEY
          : llmConfig?.PIXABAY_API_KEY;
      await ImagesApi.searchStockImages("business", 1, {
        provider: selectedProvider,
        apiKey: providerApiKey,
        strictApiKey: true,
      });
      return true;
    } catch (error: any) {
      notify.error(
        "Image provider unavailable",
        error?.message ||
        `Unable to reach ${selectedProvider} right now. Please check your API key/settings and try again.`
      );
      return false;
    }
  };

  // Restore pending presentation draft when returning after login/signup
  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem("pending_presentation_draft");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.config) {
          setConfig((prev) => ({ ...prev, ...parsed.config }));
        }
        // Auto trigger generation if user just returned from login
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("autostart") === "true") {
          sessionStorage.removeItem("pending_presentation_draft");
          window.history.replaceState({}, "", "/upload");
          setTimeout(() => {
            handleGeneratePresentation();
          }, 400);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Validates the current configuration and files
   * @returns boolean indicating if the configuration is valid
   */
  const validateConfiguration = (): boolean => {
    if (!config.language) {
      trackUploadValidationFailure("language_missing");
      notify.warning("Language required", "Please select a language.");
      return false;
    }

    if (files.length > 0 && config.language === LanguageType.Auto) {
      trackUploadValidationFailure("language_auto_with_documents");
      notify.warning("Language required", "Please choose a language before processing uploaded documents.");
      return false;
    }

    if (
      !config.prompt.trim() &&
      files.length === 0 &&
      !(communityEnabled && generationMode === "smart" && communityReference)
    ) {
      trackUploadValidationFailure("prompt_or_document_missing");
      notify.warning(
        "Input required",
        communityEnabled
          ? "Provide a prompt, upload a document, or select a community reference."
          : "Provide a prompt or upload a document."
      );
      return false;
    }
    return true;
  };

  /**
   * Handles the presentation generation process
   */
  const handleGeneratePresentation = async () => {
    if (!validateConfiguration()) return;

    // Check if user is authenticated before proceeding
    setIsCheckingAuth(true);
    try {
      const authRes = await fetch(getApiUrl("/api/v1/auth/status"), {
        credentials: "include",
        cache: "no-store",
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (!authData.authenticated) {
          // Store entered draft details in sessionStorage
          sessionStorage.setItem(
            "pending_presentation_draft",
            JSON.stringify({
              config,
              generationMode,
            })
          );
          if (onRequireAuth) {
            onRequireAuth();
          } else {
            router.push("/login?returnTo=/upload?autostart=true&mode=signup");
          }
          return;
        }
      }
    } catch {
      // If auth check fails, proceed and let API handle it
    } finally {
      setIsCheckingAuth(false);
    }

    const snapshot = getUploadSnapshotProps();
    trackEvent(MixpanelEvent.Upload_Generation_Started, snapshot);
    if (generationMode === "smart") {
      trackEvent(MixpanelEvent.Smart_Mode_Generation_Started, {
        ...snapshot,
        source: "upload",
      });
    }

    try {
      const isStockProviderReady =
        generationMode === "smart" || (await ensureStockImageProviderReady());
      if (!isStockProviderReady) {
        trackUploadValidationFailure("stock_image_provider_unreachable");
        return;
      }

      const hasUploadedAssets = files.length > 0;

      if (hasUploadedAssets) {
        await handleDocumentProcessing();
      } else {
        await handleDirectPresentationGeneration();
      }
    } catch (error) {
      handleGenerationError(error);
    }
  };

  /**
   * Handles document processing
   */
  const handleDocumentProcessing = async () => {
    setLoadingState({
      isLoading: true,
      message: "Processing documents...",
      showProgress: true,
      duration: 90,
      extra_info: files.length > 0 ? "It might take a few minutes for large documents." : "",
    });

    let documents = [];

    if (files.length > 0) {
      const uploadResponse = await PresentationGenerationApi.uploadDoc(files);
      documents = uploadResponse;
    }

    const selectedLanguage = config?.language ?? "";

    const promises: Promise<any>[] = [];

    if (documents.length > 0) {
      promises.push(
        PresentationGenerationApi.decomposeDocuments(
          documents,
          selectedLanguage
        )
      );
    }
    const responses = await Promise.all(promises);
    const documentPaths = getDocumentPaths(responses);

    setLoadingState({
      isLoading: true,
      message:
        generationMode === "smart"
          ? "Starting Smart presentation..."
          : "Generating presentation outline...",
      showProgress: true,
      duration: 40,
      extra_info: "",
    });

    const createResponse = await PresentationGenerationApi.createPresentation({
      content: config?.prompt ?? "",
      version: "v2-standard",
      n_slides: parseLimitedSlideCount(config?.slides),
      file_paths: documentPaths,
      language: selectedLanguage,
      tone: config?.tone,
      verbosity: config?.verbosity,
      instructions: config?.instructions || null,
      include_table_of_contents: !!config?.includeTableOfContents,
      include_title_slide: !!config?.includeTitleSlide,
      web_search: !!config?.webSearch,
      generation_mode: generationMode,
      community_design_ids:
        communityEnabled && generationMode === "smart" && communityReference
          ? [communityReference.id]
          : undefined,
    });

    dispatch(setPptGenUploadState({
      config,
      files: responses,
    }));
    dispatch(clearOutlines());
    dispatch(setPresentationId(createResponse.id));
    trackEvent(MixpanelEvent.Upload_Documents_Processed, {
      ...getUploadSnapshotProps(),
      uploaded_documents_count: documents.length,
      decompose_job_count: responses.length,
      extracted_document_count: documentPaths.length,
      destination:
        generationMode === "smart" ? "/presentation" : "/outline",
    });
    trackEvent(MixpanelEvent.Upload_Outline_Generation_Requested, {
      ...getUploadSnapshotProps(),
      presentation_id: createResponse.id,
      uploaded_documents_count: documents.length,
      extracted_document_count: documentPaths.length,
      destination:
        generationMode === "smart" ? "/presentation" : "/outline",
    });
    const destination = getGenerationDestination(createResponse.id);
    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: destination });
    router.push(destination);
  };

  /**
   * Handles direct presentation generation without documents
   */
  const handleDirectPresentationGeneration = async () => {
    setLoadingState({
      isLoading: true,
      message:
        generationMode === "smart"
          ? "Starting Smart presentation..."
          : "Preparing outline generation...",
      showProgress: true,
      duration: 30,
    });

    const selectedLanguage = config?.language ?? "";

    // Standard mode continues to outline review; Smart mode streams the deck directly.
    const createResponse = await PresentationGenerationApi.createPresentation({
      content: config?.prompt ?? "",

      n_slides: parseLimitedSlideCount(config?.slides),
      file_paths: [],
      language: selectedLanguage,
      tone: config?.tone,
      verbosity: config?.verbosity,
      instructions: config?.instructions || null,
      include_table_of_contents: !!config?.includeTableOfContents,
      include_title_slide: !!config?.includeTitleSlide,
      web_search: !!config?.webSearch,
      generation_mode: generationMode,
      community_design_ids:
        communityEnabled && generationMode === "smart" && communityReference
          ? [communityReference.id]
          : undefined,
    });

    dispatch(setPptGenUploadState({
      config,
      files: [],
    }));
    dispatch(clearOutlines());
    dispatch(setPresentationId(createResponse.id));
    trackEvent(MixpanelEvent.Upload_Outline_Generation_Requested, {
      ...getUploadSnapshotProps(),
      presentation_id: createResponse.id,
      destination:
        generationMode === "smart" ? "/presentation" : "/outline",
    });
    const destination = getGenerationDestination(createResponse.id);
    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: destination });
    router.push(destination);
  };

  /**
   * Handles errors during presentation generation
   */
  const handleGenerationError = (error: any) => {
    console.error("Error in upload page", error);
    if (generationMode === "smart") {
      trackEvent(MixpanelEvent.Smart_Mode_Generation_Failed, {
        ...getUploadSnapshotProps(),
        stage: "presentation_setup",
        error_message: sanitizeAnalyticsError(error, "Generation setup failed"),
      });
    }
    setLoadingState({
      isLoading: false,
      message: "",
      duration: 0,
      showProgress: false,
    });

    const isCreditError =
      error?.status === 402 ||
      (typeof error?.message === "string" &&
        (error.message.includes("Insufficient presentation credits") ||
          error.message.includes("credits")));

    if (isCreditError) {
      notify.error(
        "Insufficient Credits",
        error.message || "Please purchase presentation credits to continue generating."
      );
      router.push("/plans");
      return;
    }

    notify.error(
      "Generation failed",
      error.message || "Something went wrong while starting your presentation."
    );
  };

  return (
    <Wrapper className="w-full pb-10">
      <GenerateUserGuide mode={generationMode} communityEnabled={communityEnabled} />
      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        extra_info={loadingState.extra_info}
      />
      <OverlayLoader
        show={isCheckingAuth && !loadingState.isLoading}
        text="Checking your session..."
      />
      <div className="mx-auto max-w-[742px] space-y-[14px] px-3 sm:px-4">
        <div data-generate-guide="prompt" className="motion-enter motion-delay-1 relative mt-[10px]">
          <FloatingActionCards />
          <div className="relative z-10">
            <PromptInput
              value={config.prompt}
              variant={generationMode}
              references={
                communityEnabled && generationMode === "smart" && communityReference
                  ? [{ id: String(communityReference.id), label: communityReference.title || "Community design" }]
                  : []
              }
              onRemoveReference={() =>
                handleCommunityReferenceChange(null, "prompt_reference")
              }
              onChange={(value) => handleConfigChange("prompt", value)}
              onSubmit={handleGeneratePresentation}
              hasAttachments={files.length > 0}
              footer={
                <SupportingDoc
                  files={files}
                  onFilesChange={setFiles}
                  onSubmit={handleGeneratePresentation}
                  disabled={loadingState.isLoading}
                />
              }
            />
          </div>
        </div>

        <div data-generate-guide="setup" className="motion-enter motion-delay-2 flex min-h-[62px] w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3 sm:gap-5">
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 self-start font-syne text-[13px] leading-[18px] text-[#4C4C4C] dark:text-[#B8BBC5]">
                Content Depth
              </span>
              <div role="group" aria-label="Content depth" className="inline-flex h-9 w-[205px] sm:w-[236px] items-center rounded-xl border border-[#EDEEEF] dark:border-neutral-800 bg-white dark:bg-[#181A20] p-1 font-manrope text-[12px] sm:text-[13px] font-medium text-[#191919] dark:text-neutral-100">
                {CONTENT_DEPTH_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    aria-pressed={config.verbosity === option.value}
                    onClick={() => handleConfigChange("verbosity", option.value)}
                    className={`h-7 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6] ${config.verbosity === option.value ? "bg-[#F6F6F9] dark:bg-neutral-800 text-[#191919] dark:text-white" : "text-[#4C4C4C] dark:text-[#B8BBC5] hover:bg-[#FAFAFC] dark:hover:bg-neutral-800/50"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ConfigurationSelects
            compact
            config={config}
            onConfigChange={handleConfigChange}
          />
        </div>
      </div>

    </Wrapper>
  );
};

export default UploadPage;
