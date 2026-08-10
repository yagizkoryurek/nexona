import type { Metadata } from "next";

import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to report a bug or send feedback while Nexona is in public Beta.",
};

/**
 * No contact form: there is no backend to receive one, and a form that silently
 * discards a submission is worse than no form. Every channel below is one that
 * genuinely exists — the public repository's issue tracker, and the two
 * addresses the legal pages already publish.
 */
const REPO_ISSUES_URL = "https://github.com/yagizkoryurek/nexona/issues";

const linkClassName =
  "text-foreground underline underline-offset-3 hover:no-underline";

export default function ContactPage() {
  return (
    <article>
      <SectionHeading
        headingId="contact-heading"
        label="Company"
        headline="Contact"
        description="Nexona is in public Beta. Bug reports are genuinely useful."
        className="text-left"
      />

      <p className="text-muted-foreground mt-8 text-sm leading-relaxed text-pretty italic">
        Nexona is maintained alongside other work, so replies are not guaranteed
        and response times vary. Reports are read, even when they are not
        answered individually.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <section aria-labelledby="contact-bugs">
          <h2
            id="contact-bugs"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            Bugs and feedback
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Open an issue at{" "}
            <a
              href={REPO_ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClassName}
            >
              github.com/yagizkoryurek/nexona/issues
            </a>
            . This is the best channel during the Beta — it is public, it is
            tracked, and other people hitting the same problem can find it.
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            What helps most: which tool you were using, what you expected, what
            happened instead, and the browser you were in. If a résumé upload
            failed, the file type and rough size matter — but please do not
            attach the résumé itself or paste personal details into a public
            issue.
          </p>
        </section>

        <section aria-labelledby="contact-privacy">
          <h2
            id="contact-privacy"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            Privacy and data requests
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            For questions about your data, or to exercise the rights described
            in the{" "}
            <a href="/privacy" className={linkClassName}>
              Privacy Policy
            </a>
            , write to{" "}
            <a href="mailto:privacy@nexona.app" className={linkClassName}>
              privacy@nexona.app
            </a>
            . Please use email rather than a public issue for anything involving
            your personal information.
          </p>
        </section>

        <section aria-labelledby="contact-legal">
          <h2
            id="contact-legal"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            Legal
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            For matters relating to the{" "}
            <a href="/terms" className={linkClassName}>
              Terms of Service
            </a>
            , write to{" "}
            <a href="mailto:legal@nexona.app" className={linkClassName}>
              legal@nexona.app
            </a>
            . Note that the legal pages are currently placeholder documents
            pending review, which the pages themselves state.
          </p>
        </section>

        <section aria-labelledby="contact-billing">
          <h2
            id="contact-billing"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            Billing
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            There is nothing to bill. Nexona is free during the Beta, there is
            no payment step anywhere in the product, and no subscription exists
            to cancel. If you believe you have been charged for Nexona, it was
            not us — please get in touch.
          </p>
        </section>
      </div>
    </article>
  );
}
