"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { setCreditStatus } from "@/store/slices/userConfig";
import { getApiUrl } from "@/utils/api";

export function useCredits() {
  const dispatch = useDispatch();
  const credits = useSelector((state: RootState) => state.userConfig.credits);
  const freeUsed = useSelector((state: RootState) => state.userConfig.free_presentation_used);
  const hasPurchased = useSelector((state: RootState) => state.userConfig.has_purchased_credits);
  const [loading, setLoading] = useState(false);

  const refreshCredits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/v1/credits/status"), {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        dispatch(
          setCreditStatus({
            credits: data.credits,
            free_presentation_used: data.free_presentation_used,
            has_purchased_credits: data.has_purchased_credits,
          })
        );
      }
    } catch (e) {
      console.error("Failed to refresh credits:", e);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  return {
    credits,
    freeUsed,
    hasPurchased,
    loading,
    refreshCredits,
  };
}
