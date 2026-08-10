import type { Metadata } from "next";

import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "About",
  description:
    "What Nexona is, who it is for, and where it currently stands as a public Beta.",
};

/** The canonical repository. Kept here so the two links below cannot drift. */
const REPO_URL = "https://github.com/yagizkoryurek/nexona";

const linkClassName =
  "text-foreground underline underline-offset-3 hover:no-underline";

export default function AboutPage() {
  return (
    <article>
      <SectionHeading
        headingId="about-heading"
        label="Company"
        headline="About Nexona"
        description="An honest read on your résumé, and the tools to act on it."
        className="text-left"
      />

      <div className="mt-10 flex flex-col gap-10">
        <section aria-labelledby="about-what">
          <h2
            id="about-what"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            What Nexona does
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Most résumé advice is generic. Nexona reads your actual résumé the
            way a recruiter and an automated applicant tracking system would,
            then turns that read into specific work: a scored analysis, a
            rewrite that preserves every fact, a detailed ATS audit, a cover
            letter for a particular job, an assessment of where your career
            currently stands, and the interview your résumé invites.
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Every tool builds on one stored analysis rather than re-deriving it,
            so the advice stays consistent instead of contradicting itself
            between screens.
          </p>
        </section>

        <section aria-labelledby="about-who">
          <h2
            id="about-who"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            Who it is for
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Students and recent graduates writing a first serious résumé,
            working professionals who have stopped hearing back, and career
            changers whose experience does not map neatly onto the roles they
            want. If you are applying and not getting interviews, the problem is
            usually specific and findable — that is what Nexona is for.
          </p>
        </section>

        <section aria-labelledby="about-beta">
          <h2
            id="about-beta"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            We are in public Beta
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            All six tools work and are free to use while the Beta lasts. There
            is no payment step, no card required, and no subscription to cancel.
            Paid plans will come later; we have not set a price or decided what
            they will include.
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Beta also means the honest caveats. Some things are unfinished, and
            they are listed openly rather than hidden: there is no history view
            of past results yet, generated documents cannot be exported, legacy{" "}
            <code>.doc</code> files are not supported, and the legal pages are
            placeholders awaiting review. Things may change or briefly break. We
            would rather hear about it than not.
          </p>
        </section>

        <section aria-labelledby="about-how">
          <h2
            id="about-how"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            How it works, briefly
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Nexona is a Next.js application using Supabase for accounts and
            storage and Google Gemini for analysis. The file you upload is never
            stored — only the text extracted from it, which is sent to the AI
            provider for processing. Your data is scoped to your account at the
            database level, so no other user can read it. The{" "}
            <a href="/privacy" className={linkClassName}>
              Privacy Policy
            </a>{" "}
            covers this in full.
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            Two rules run through every tool. Derived tools <em>explain</em> the
            stored analysis rather than generating a second, competing score.
            And every claim has to trace back to your résumé — the tools are
            instructed never to invent an employer, title, credential, or
            achievement that is not already there.
          </p>
        </section>

        <section aria-labelledby="about-links">
          <h2
            id="about-links"
            className="text-foreground text-xl font-semibold tracking-tight"
          >
            Source and contact
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed text-pretty">
            The repository is public at{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClassName}
            >
              github.com/yagizkoryurek/nexona
            </a>
            , where the architecture and the full list of known limitations are
            documented. To report a problem or send feedback, see the{" "}
            <a href="/contact" className={linkClassName}>
              Contact
            </a>{" "}
            page.
          </p>
        </section>
      </div>
    </article>
  );
}
