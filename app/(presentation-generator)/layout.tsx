import React from "react";
import { headers } from "next/headers";
import { requireAppSession } from "@/utils/serverAuth";
import { ConfigurationInitializer } from "../ConfigurationInitializer";
import TailwindBrowserRuntime from "@/components/runtime/TailwindBrowserRuntime";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname =
    headerList.get("x-invoke-path") ||
    headerList.get("x-url") ||
    headerList.get("x-forwarded-uri") ||
    "";

  // / and /upload act as the landing / upload hybrid entry point for any user
  const isUploadPath = pathname === "/" || pathname.includes("/upload");
  if (!isUploadPath) {
    await requireAppSession();
  }

  return (
    <div>
      <ConfigurationInitializer>{children}</ConfigurationInitializer>
      <TailwindBrowserRuntime />
    </div>
  );
}
