import Link from "next/link";
import GenerateHeader from "@/app/(presentation-generator)/upload/components/GenerateHeader";

const marketingLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteHeader() {
  return (
    <>
      <GenerateHeader homeHref="/upload" signInHref="/login" />

      <div className="border-b border-[#e5e7eb] bg-white dark:border-neutral-800 dark:bg-neutral-950 md:hidden">
        <nav aria-label="Primary" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {marketingLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-[#4C4C4C] hover:bg-[#F2F4F7] dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
