"use client";

import React, { useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Slide } from "../../types/slide";
import { shouldRenderTemplateV2HtmlPreview, TemplateV2HtmlSlidePreview } from "../../components/TemplateV2HtmlSlidePreview";
import SmartHtmlSlide from "../../components/SmartHtmlSlide";
import { V1ContentRender } from "../../components/V1ContentRender";
import { cn } from "@/lib/utils";

interface MobileSlideGalleryBarProps {
  slides: Slide[];
  selectedSlide: number;
  onSelectSlide: (index: number) => void;
  className?: string;
}

const THUMBNAIL_WIDTH = 85;
const SCALE = THUMBNAIL_WIDTH / 1280;

export function MobileSlideGalleryBar({
  slides,
  selectedSlide,
  onSelectSlide,
  className,
}: MobileSlideGalleryBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeThumbnailRef = useRef<HTMLButtonElement>(null);

  const { presentationData } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  // Scroll active slide thumbnail into view when slide changes
  useEffect(() => {
    if (activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [selectedSlide]);

  if (!slides || slides.length === 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-40 w-full border-t border-[#EDEEEF] bg-white/95 backdrop-blur-md dark:border-neutral-800 dark:bg-[#121216]/95 py-2.5 px-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden",
        className
      )}
      style={{
        paddingBottom: "max(0.625rem, env(safe-area-inset-bottom, 0.625rem))",
      }}
      aria-label="Slide thumbnail navigation"
    >
      <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-semibold text-[#667085] dark:text-neutral-400">
        <span>Slide {selectedSlide + 1} of {slides.length}</span>
        <span className="text-[10px] font-normal text-[#98A2B3]">Swipe or tap to navigate</span>
      </div>

      <div
        ref={containerRef}
        data-slide-thumbnail-scroll-container="true"
        className="flex gap-2.5 overflow-x-auto overflow-y-hidden scroll-smooth pb-1 pt-0.5 no-scrollbar touch-pan-x"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {slides.map((slide, index) => {
          const isSelected = index === selectedSlide;
          const useTemplateV2Html = shouldRenderTemplateV2HtmlPreview(
            slide,
            presentationData?.version
          );

          return (
            <button
              key={slide.id || index}
              ref={isSelected ? activeThumbnailRef : null}
              type="button"
              onClick={() => onSelectSlide(index)}
              aria-label={`Jump to slide ${index + 1}`}
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "group relative flex-shrink-0 flex flex-col items-center gap-1 rounded-lg border-2 p-1 transition-all duration-150 focus:outline-none",
                isSelected
                  ? "border-[#3478F6] bg-[#3478F6]/5 shadow-sm scale-105"
                  : "border-transparent bg-neutral-100 hover:border-neutral-300 dark:bg-neutral-800 dark:hover:border-neutral-700"
              )}
            >
              <div className="relative h-[48px] w-[85px] overflow-hidden rounded bg-white shadow-2xs pointer-events-none">
                {typeof slide.html_content === "string" && slide.html_content.trim() ? (
                  <div
                    className="absolute left-0 top-0 pointer-events-none"
                    style={{
                      width: 1280,
                      height: 720,
                      transformOrigin: "top left",
                      transform: `scale(${SCALE})`,
                    }}
                  >
                    <SmartHtmlSlide
                      fixedSize
                      fonts={presentationData?.fonts}
                      html={slide.html_content}
                      title={`Slide ${index + 1} thumbnail`}
                    />
                  </div>
                ) : useTemplateV2Html ? (
                  <div
                    className="pointer-events-none absolute left-0 top-0"
                    style={{
                      width: 1280,
                      height: 720,
                      transformOrigin: "top left",
                      transform: `scale(${SCALE})`,
                    }}
                  >
                    <TemplateV2HtmlSlidePreview
                      slide={slide}
                      fonts={presentationData?.fonts}
                      fixedSize
                      className="pointer-events-none"
                    />
                  </div>
                ) : (
                  <div
                    className="pointer-events-none absolute left-0 top-0 overflow-hidden"
                    style={{
                      width: 1280,
                      height: 720,
                      transformOrigin: "top left",
                      transform: `scale(${SCALE})`,
                    }}
                  >
                    <V1ContentRender
                      slide={slide}
                      isEditMode={false}
                      fonts={presentationData?.fonts}
                      presentationLayout={presentationData?.layout}
                    />
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  isSelected
                    ? "font-bold text-[#3478F6]"
                    : "text-[#667085] dark:text-neutral-400"
                )}
              >
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export default MobileSlideGalleryBar;
