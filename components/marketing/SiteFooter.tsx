import Image from "next/image";
import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Create a presentation" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/templates", label: "Templates" },
      { href: "/plans", label: "Plans & credits" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms and Conditions" },
      { href: "/terms#refunds", label: "Refund Policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e5e7eb] bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center" aria-label="Pixa home">
              <Image
                src="/LightTextLogo.png"
                alt="Pixa"
                width={110}
                height={36}
                className="h-8 w-auto object-contain dark:hidden"
              />
              <Image
                src="/DarkTextLogo.png"
                alt="Pixa"
                width={110}
                height={36}
                className="h-8 w-auto object-contain hidden dark:block"
              />
            </Link>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-[#7b8494] dark:text-neutral-400">
              AI presentation generator by Framewrk. Turn a prompt or a document into a
              polished, downloadable deck.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#111418] dark:text-white">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-[#5c6470] transition hover:text-[#3478F6] dark:text-neutral-400 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[#e5e7eb] pt-6 text-xs text-[#7b8494] dark:border-neutral-800 dark:text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Pixa, by Framewrk. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
