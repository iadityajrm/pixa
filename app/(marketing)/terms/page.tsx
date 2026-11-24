import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | Pixa, by Framewrk",
  description: "Terms of use for the Pixa AI presentation generator.",
};

const sections = [
  {
    id: "service",
    title: "1. The service",
    body: [
      "Pixa is an AI presentation generator operated by Framewrk. It lets you create, edit, present, and export presentations from prompts and documents.",
      "We may update, improve, or discontinue features over time. Core functionality will not be removed without reasonable notice where practicable.",
    ],
  },
  {
    id: "accounts",
    title: "2. Accounts and access",
    body: [
      "You are responsible for the accuracy of your account details and for keeping your password confidential.",
      "Access to generation features is managed by your administrator or by the providers you connect. Suspected unauthorized use should be reported immediately.",
    ],
  },
  {
    id: "content",
    title: "3. Your content",
    body: [
      "You retain ownership of the prompts, documents, and presentations you create. You grant us the limited rights needed to process and store them to provide the service.",
      "You must not upload content you do not have the right to use, or content that is unlawful, harmful, or infringes the rights of others.",
    ],
  },
  {
    id: "ai-output",
    title: "4. AI-generated output",
    body: [
      "Output is generated automatically and may contain mistakes or omissions. Review facts, figures, and citations before relying on a deck.",
      "AI output is not professional advice of any kind.",
    ],
  },
  {
    id: "payments",
    title: "5. Payments and credits",
    body: [
      "Some features require purchased credits. The ₹19 unlock is a one-time payment for downloading a presentation and is not a subscription.",
      "Credits and unlocks are tied to your account and are not transferable.",
    ],
  },
  {
    id: "refunds",
    title: "6. Refund policy",
    body: [
      "If a paid download fails or credits are charged without a usable result, contact support within 7 days of the transaction and we will review the request.",
      "Refunds may be declined where the purchased output was successfully delivered and accessed, or where there is evidence of abuse.",
    ],
  },
  {
    id: "acceptable-use",
    title: "7. Acceptable use",
    body: [
      "Do not use the service to generate spam, malware, harassment, or content that violates applicable law, or to attempt to disrupt the service or bypass access controls.",
      "We may suspend accounts that violate these terms.",
    ],
  },
  {
    id: "liability",
    title: "8. Limitation of liability",
    body: [
      "The service is provided on an as-is basis. To the extent permitted by law, our liability for any claim is limited to the amount you paid for the affected transaction.",
    ],
  },
  {
    id: "contact",
    title: "9. Contact",
    body: [
      "Questions about these terms can be sent through the Contact Us page.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#3478F6]">Legal</p>
      <h1 className="mt-3 font-syne text-3xl font-bold text-[#111418] dark:text-white sm:text-4xl">
        Terms and Conditions
      </h1>
      <p className="mt-3 text-xs text-[#7b8494] dark:text-neutral-400">
        Last updated: November 2026
      </p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="font-syne text-lg font-semibold text-[#111418] dark:text-white">
              {section.title}
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
        By using Pixa you agree to these terms and to our{" "}
        <a className="font-medium text-[#3478F6]" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
