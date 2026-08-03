import type { Metadata } from "next";

import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "January 1, 2026";

export default function PrivacyPolicyPage() {
  return (
    <article>
      <SectionHeading
        headingId="privacy-heading"
        label="Legal"
        headline="Privacy Policy"
        description={`Last updated ${LAST_UPDATED}`}
        className="text-left"
      />

      <p className="text-muted-foreground mt-8 text-sm leading-relaxed text-pretty italic">
        This is placeholder content for development purposes and does not
        constitute a binding privacy policy. Replace it with a policy reviewed
        by qualified legal counsel before accepting real users.
      </p>

      <div className="mt-10 flex flex-col gap-10">
        <section aria-labelledby="privacy-introduction">
          <h2
            id="privacy-introduction"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            1. Introduction
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            This policy describes how Nexona (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;) collects, uses, and protects information when you
            use our résumé analysis service (the &ldquo;Service&rdquo;).
          </p>
        </section>

        <section aria-labelledby="privacy-collect">
          <h2
            id="privacy-collect"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            2. Information We Collect
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            We collect the account information you provide at sign-up (such as
            your name and email address), the résumé files you upload and the
            text extracted from them, and the results generated from analyzing
            that text. We also collect basic technical information, such as log
            data, needed to operate the Service securely.
          </p>
        </section>

        <section aria-labelledby="privacy-use">
          <h2
            id="privacy-use"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            3. How We Use Your Information
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            We use your information to provide and improve the Service, generate
            the résumé analyses and related tools you request, maintain the
            security of your account, and communicate with you about the
            Service. We do not sell your personal information.
          </p>
        </section>

        <section aria-labelledby="privacy-ai">
          <h2
            id="privacy-ai"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            4. AI Processing
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Generating an analysis, optimized résumé, compatibility audit, cover
            letter, career insights, or interview preparation requires sending
            the relevant text from your résumé to a third-party AI service
            provider for processing. That provider processes the content solely
            to return a result to the Service and does not use it to train its
            models on our behalf. We do not send your uploaded file itself to
            any third party — only the text extracted from it.
          </p>
        </section>

        <section aria-labelledby="privacy-storage">
          <h2
            id="privacy-storage"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            5. Data Storage and Security
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Account data and generated results are stored with our database
            provider and protected by access controls that restrict each account
            to its own data. We do not store the original uploaded file; we
            retain the extracted text and generated results so that you can
            return to them later. No method of storage or transmission is
            completely secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section aria-labelledby="privacy-retention">
          <h2
            id="privacy-retention"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            6. Data Retention
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            We retain your account data and generated results for as long as
            your account remains active. If you delete your account, this data
            is deleted from our systems, subject to any backups that are purged
            on a routine schedule.
          </p>
        </section>

        <section aria-labelledby="privacy-rights">
          <h2
            id="privacy-rights"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            7. Your Rights and Choices
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            You can access, update, or delete your account information at any
            time from your account settings. Depending on where you live, you
            may have additional rights over your personal information, such as
            the right to request a copy of your data or to object to certain
            processing. Contact us to exercise these rights.
          </p>
        </section>

        <section aria-labelledby="privacy-cookies">
          <h2
            id="privacy-cookies"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            8. Cookies
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            We use cookies necessary to keep you signed in and to remember
            interface preferences, such as whether the dashboard sidebar is
            collapsed. We do not use cookies for advertising.
          </p>
        </section>

        <section aria-labelledby="privacy-children">
          <h2
            id="privacy-children"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            9. Children&rsquo;s Privacy
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            The Service is not directed to children under 16, and we do not
            knowingly collect personal information from them.
          </p>
        </section>

        <section aria-labelledby="privacy-changes">
          <h2
            id="privacy-changes"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            10. Changes to This Policy
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            We may update this policy from time to time. If we make material
            changes, we will notify you by posting the updated policy with a new
            &ldquo;Last updated&rdquo; date.
          </p>
        </section>

        <section aria-labelledby="privacy-contact">
          <h2
            id="privacy-contact"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            11. Contact
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Questions about this policy or your data can be sent to{" "}
            <a
              href="mailto:privacy@nexona.app"
              className="text-foreground underline underline-offset-3 hover:no-underline"
            >
              privacy@nexona.app
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
