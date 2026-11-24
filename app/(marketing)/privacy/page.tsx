import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Pixa, by Framewrk",
  description: "How Pixa collects, uses, and protects your data.",
};

const sections = [
  {
    title: "What we collect",
    body: [
      "Account details you provide when you sign up, such as your name, email address, and hashed password.",
      "Content you submit to generate presentations: prompts, uploaded documents, and generated slides.",
      "Usage data needed to operate the product, such as sign-in events, generation counts, credit balances, and error logs.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To generate, store, and export the presentations you create, including presenting them in the browser.",
      "To manage your account, credits, and access, and to keep the service secure.",
      "To diagnose failures and improve reliability. We do not sell your personal data.",
    ],
  },
  {
    title: "AI providers",
    body: [
      "Text and image generation is performed by the AI provider configured for your account or instance. Your prompts and document content are sent to that provider to produce the requested output.",
      "Provider terms and data-retention practices apply to that processing. Administrators can change providers from the admin dashboard.",
    ],
  },
  {
    title: "Storage and retention",
    body: [
      "Presentations, uploads, and account records are stored in our managed database so you can reopen and export them.",
      "Deleted presentations and uploads are removed from active storage. Residual backups may be retained for a limited period for disaster recovery.",
    ],
  },
  {
    title: "Cookies",
    body: [
      "We use a secure session cookie to keep you signed in. It is required for the app to function.",
      "Analytics, where enabled, is used in aggregate to understand product usage.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can update account details, delete presentations, and request deletion of your account and associated content by contacting support.",
      "If you believe your data has been handled incorrectly, contact us and we will investigate.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#3478F6]">Legal</p>
      <h1 className="mt-3 font-syne text-3xl font-bold text-[#111418] dark:text-white sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-xs text-[#7b8494] dark:text-neutral-400">
        Last updated: November 2026
      </p>

      <div className="mt-8 space-y-8">
        {sections.map((section, index) => (
          <section key={section.title}>
            <h2 className="font-syne text-lg font-semibold text-[#111418] dark:text-white">
              {index + 1}. {section.title}
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400">
              {section.body.map((paragraph) => (
                <li key={paragraph}>{paragraph}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs leading-relaxed text-[#7b8494] dark:text-neutral-400">
        Questions about this policy can be sent through the{" "}
        <a className="font-medium text-[#3478F6]" href="/contact">
          Contact Us
        </a>{" "}
        page.
      </p>
    </div>
  );
}
