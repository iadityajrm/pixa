import AuthGate from "@/components/Auth/AuthGate";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F6F9]" />}>
      <AuthGate />
    </Suspense>
  );
}
