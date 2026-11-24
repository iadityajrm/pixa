"use client";

import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/sonner";
import { LLMConfig } from "@/types/llm_config";
import { getApiErrorMessage, getApiUrl } from "@/utils/api";
import { LLM_PROVIDERS } from "@/utils/providerConstants";
import { Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";

interface TextProviderProps {
  onInputChange: (value: string | boolean | number | string[], field: string) => void;
  llmConfig: LLMConfig;
}

const MANAGED_PROVIDERS = ["groq", "qwen"] as const;
type ManagedProvider = (typeof MANAGED_PROVIDERS)[number];

const FALLBACK_MODELS: Record<ManagedProvider, string[]> = {
  groq: [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
  ],
  qwen: ["qwen-max", "qwen-plus", "qwen-turbo"],
};

const MODEL_FIELD: Record<ManagedProvider, "GROQ_MODEL" | "QWEN_MODEL"> = {
  groq: "GROQ_MODEL",
  qwen: "QWEN_MODEL",
};

function resolveManagedProvider(provider?: string): ManagedProvider {
  return provider === "qwen" ? "qwen" : "groq";
}

const TextProvider = ({ onInputChange, llmConfig }: TextProviderProps) => {
  const configuredProvider = (llmConfig.LLM || "").toLowerCase();
  const isManaged = MANAGED_PROVIDERS.includes(configuredProvider as ManagedProvider);
  const selectedProvider = resolveManagedProvider(configuredProvider);
  const modelField = MODEL_FIELD[selectedProvider];
  const currentModel = String(llmConfig[modelField] || "");

  const [models, setModels] = useState<string[]>(FALLBACK_MODELS[selectedProvider]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    setModels(FALLBACK_MODELS[selectedProvider]);
  }, [selectedProvider]);

  const modelOptions = useMemo(() => {
    const values = new Set(models);
    if (currentModel) values.add(currentModel);
    if (!values.size) values.add(FALLBACK_MODELS[selectedProvider][0]);
    return Array.from(values);
  }, [models, currentModel, selectedProvider]);

  const selectProvider = (provider: ManagedProvider) => {
    onInputChange(provider, "LLM");
    const field = MODEL_FIELD[provider];
    const existing = String(llmConfig[field] || "");
    if (!existing) {
      onInputChange(FALLBACK_MODELS[provider][0], field);
    }
  };

  const refreshModels = async () => {
    if (isLoadingModels) return;
    setIsLoadingModels(true);
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/admin/pool/models?provider=${selectedProvider}`),
        { credentials: "include", cache: "no-store" }
      );
      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          `Could not load ${selectedProvider} models. Add an API key for this provider in the pool first.`
        );
        notify.error("Could not load models", message);
        return;
      }
      const data = (await response.json()) as { models?: string[] };
      const nextModels = (data.models || []).filter(Boolean);
      if (nextModels.length) {
        setModels(nextModels);
        notify.success("Models updated", `${nextModels.length} models available.`);
      } else {
        notify.warning("No models returned", "The provider returned an empty model list.");
      }
    } catch (error) {
      notify.error(
        "Could not load models",
        error instanceof Error ? error.message : "Check the backend connection."
      );
    } finally {
      setIsLoadingModels(false);
    }
  };

  const providerMeta = LLM_PROVIDERS[selectedProvider];

  return (
    <div className="space-y-6 rounded-[12px] bg-[#F9F8F8] p-7">
      {!isManaged && (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-5 py-4 text-[#713F12]">
          <p className="text-sm font-semibold">Select a centrally managed provider</p>
          <p className="mt-1 text-xs leading-5">
            The current provider
            {configuredProvider ? ` "${configuredProvider}"` : ""} is not managed by
            the Admin Console. Choose Groq or Qwen below, then save.
          </p>
        </div>
      )}

      <div className="rounded-[12px] bg-white px-8 py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[320px]">
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[8px] bg-[#4C55541A]">
              <ShieldCheck className="h-6 w-6 text-[#4C5554]" />
            </div>
            <h3 className="py-2.5 text-xl font-normal text-[#191919]">
              Text Generation
            </h3>
            <p className="text-sm text-gray-500">
              One provider and model is used by every account. API keys are
              assigned per account from the central pool.
            </p>
          </div>

          <div className="flex w-full flex-col gap-5 sm:max-w-[560px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Text Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                {MANAGED_PROVIDERS.map((provider) => {
                  const meta = LLM_PROVIDERS[provider];
                  const active = selectedProvider === provider && isManaged;
                  return (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => selectProvider(provider)}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                        active
                          ? "border-[#3478F6] bg-[#F4F3FF]"
                          : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                    >
                      {meta?.icon ? (
                        <Image
                          src={meta.icon}
                          alt=""
                          width={22}
                          height={22}
                          className="h-[22px] w-[22px] object-contain"
                        />
                      ) : null}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {meta?.label || provider}
                        </p>
                        <p className="text-xs text-gray-500">{meta?.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Model
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refreshModels}
                  disabled={isLoadingModels}
                  className="h-7 gap-1.5 px-2 text-xs text-[#3478F6]"
                >
                  {isLoadingModels ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Load from provider
                </Button>
              </div>
              <select
                value={currentModel || ""}
                onChange={(event) => onInputChange(event.target.value, modelField)}
                className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-[#101323] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {!currentModel && <option value="">Select a {providerMeta?.label || selectedProvider} model</option>}
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                Model lists are loaded with a key from the pool. Qwen models on
                Groq include the <code>qwen/...</code> IDs.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[#EDEEEF] bg-[#F9FAFB] px-4 py-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#3478F6]" />
              <p className="text-xs leading-relaxed text-[#475467]">
                API keys are never entered here. Add, rotate, deactivate or
                assign keys in <strong>Administration → API Key Pool</strong>.
                Every account automatically uses the active provider and model
                with its own assigned key.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextProvider;
