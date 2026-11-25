import AuthGate from "@/components/Auth/AuthGate";
import { getServerAuthStatus } from "@/utils/serverAuth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function LoginPage() {
  const status = await getServerAuthStatus();
  if (status.authenticated) {
    redirect(status.role === "admin" ? "/adminconsole" : "/dashboard");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F6F9]" />}>
      <AuthGate />
    </Suspense>
  );
}
