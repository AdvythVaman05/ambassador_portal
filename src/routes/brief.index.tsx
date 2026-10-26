import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Container, DemoTag } from "@/components/site/primitives";
import { briefIssues, formatDate } from "@/data/site";

export const Route = createFileRoute("/brief/")({
  head: () => ({
    meta: [
      { title: "The Rothenhall Brief — Weekly, by Campus Scouts" },
      {
        name: "description",
        content:
          "A weekly publication researched and written by Rothenhall Campus Scouts, reviewed by Rothenhall before release.",
      },
      { property: "og:title", content: "The Rothenhall Brief" },
      { property: "og:description", content: "Research. Write. Publish." },
    ],
  }),
  component: BriefIndex,
});

function BriefIndex() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage("Enter a valid email address.");
      return;
    }
    setMessage("Prototype signup complete — your email was not added to a live mailing list.");
  }
  return (
    <>
      <PageHeader
        eyebrow="The Rothenhall Brief"
        title="Research. Write. Publish."
        lead="Written and produced weekly by Campus Scouts. Rothenhall supplies official company information and reviews each issue before release."
      />
      <Container className="py-16">
        <ol className="border-b border-line">
          {briefIssues.map((i) => (
            <li key={i.slug}>
              <Link
                to="/brief/$slug"
                params={{ slug: i.slug }}
                className="group grid gap-2 border-t border-line py-6 sm:grid-cols-[8rem_1fr_auto] sm:items-baseline sm:gap-6"
              >
                <span className="eyebrow text-cognac">
                  Issue {String(i.number).padStart(3, "0")}
                </span>
                <span>
                  <span className="font-display text-xl group-hover:text-cognac-deep">
                    {i.title}
                  </span>
                  <span className="mt-1 block text-sm text-ink-60">{i.summary}</span>
                </span>
                <span className="flex items-center gap-2 text-sm text-ink-45">
                  {formatDate(i.date)} <DemoTag label="Demo" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
        <section
          aria-labelledby="signup-title"
          className="mt-12 max-w-2xl rounded-lg border border-line bg-paper p-6 sm:p-8"
        >
          <p className="eyebrow text-cognac">Stay in the loop</p>
          <h2 id="signup-title" className="mt-3 text-2xl">
            Newsletter signup
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-60">
            Prototype only: no mailing service is connected, and submitting does not add you to a
            live list.
          </p>
          <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={signup}>
            <label className="sr-only" htmlFor="brief-email">
              Email address
            </label>
            <input
              id="brief-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-11 flex-1 rounded-md border border-input bg-canvas px-3"
              placeholder="you@example.com"
            />
            <button className="min-h-11 rounded-md bg-ink px-5 text-sm font-medium text-canvas hover:bg-cognac-deep">
              Check signup
            </button>
          </form>
          <p role="status" className="mt-3 text-sm text-cognac-deep">
            {message}
          </p>
        </section>
      </Container>
    </>
  );
}
