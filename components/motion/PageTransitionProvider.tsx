"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";

interface PageTransitionContextValue {
  navigate: (href: string) => void;
  isNavigating: boolean;
}

const PageTransitionContext = createContext<PageTransitionContextValue>({
  navigate: () => {},
  isNavigating: false,
});

export const usePageTransition = () => useContext(PageTransitionContext);

export function PageTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const pendingHrefRef = useRef<string | null>(null);

  // When pathname changes, mark navigation as complete
  useEffect(() => {
    setIsNavigating(false);
    pendingHrefRef.current = null;
  }, [pathname]);

  const navigate = useCallback(
    (href: string) => {
      if (href === pathname || pendingHrefRef.current === href) return;

      pendingHrefRef.current = href;
      setIsNavigating(true);

      // Let Next.js start fetching immediately; the CSS entrance animation
      // covers the transition without an artificial pre-navigation delay.
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router]
  );

  return (
    <PageTransitionContext.Provider value={{ navigate, isNavigating }}>
      <div className="w-full flex-1 flex flex-col">
        {children}
      </div>
    </PageTransitionContext.Provider>
  );
}
