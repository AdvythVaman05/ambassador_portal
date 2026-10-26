import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { Container, DemoTag } from "@/components/site/primitives";
import { briefIssues, formatDate, getContributor, getIssue, projects } from "@/data/site";

export const Route = createFileRoute("/brief/$slug")({
  loader: ({ params }) => {
    const issue = getIssue(params.slug);
    if (!issue) throw notFound();
    return { issue };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Issue ${loaderData.issue.number}: ${loaderData.issue.title} — The Rothenhall Brief`
          : "Issue not found",
      },
      { name: "description", content: loaderData?.issue.summary ?? "" },
      { property: "og:title", content: loaderData?.issue.title ?? "The Rothenhall Brief" },
      { property: "og:description", content: loaderData?.issue.summary ?? "" },
    ],
  }),
  component: Issue,
});

function Issue() {
  const { issue } = Route.useLoaderData();
  const index = briefIssues.findIndex((item) => item.slug === issue.slug);
  const previous = briefIssues[index + 1];
  const next = briefIssues[index - 1];
  return (
    <>
      <PageHeader
        eyebrow={`The Rothenhall Brief · Issue ${String(issue.number).padStart(3, "0")} · ${formatDate(issue.date)}`}
        title={issue.title}
        lead={issue.summary}
      >
        <div className="mt-6">
          <DemoTag label="Demonstration issue" />
        </div>
      </PageHeader>
      <Container className="grid gap-12 py-16 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <ol className="border-b border-line">
            {issue.headlines.map((h) => (
              <li key={h.title} className="border-t border-line py-5">
                <p className="font-display text-xl">{h.title}</p>
                <p className="mt-1 text-sm text-ink-60">
                  By {getContributor(h.author)?.name}, Campus Scout
                </p>
              </li>
            ))}
          </ol>
          <section className="mt-10 rounded-lg border border-dashed border-brass bg-paper p-6">
            <h2 className="text-xl">Editorial note</h2>
            <p className="mt-3 leading-relaxed text-ink-60">
              This is a demonstration issue, not a published newsletter. In a live workflow Scouts
              produce the writing and Rothenhall reviews final material for factual accuracy,
              confidentiality, brand alignment and appropriate attribution before release.
            </p>
            <p className="mt-3 text-sm text-ink-45">
              Sources would be linked with approved articles. No external research claims are
              represented here.
            </p>
          </section>
          <section className="mt-10">
            <h2 className="text-xl">Related work</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {projects.slice(0, 2).map((project) => (
                <Link
                  key={project.slug}
                  to="/projects/$slug"
                  params={{ slug: project.slug }}
                  className="rounded-md border border-line px-3 py-2 text-sm hover:border-cognac"
                >
                  {project.title}
                </Link>
              ))}
            </div>
          </section>
          <nav
            aria-label="Issue navigation"
            className="mt-10 flex justify-between gap-4 border-t border-line pt-5 text-sm"
          >
            {previous ? (
              <Link
                to="/brief/$slug"
                params={{ slug: previous.slug }}
                className="text-cognac-deep hover:underline"
              >
                ← Issue {String(previous.number).padStart(3, "0")}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                to="/brief/$slug"
                params={{ slug: next.slug }}
                className="text-cognac-deep hover:underline"
              >
                Issue {String(next.number).padStart(3, "0")} →
              </Link>
            )}
          </nav>
        </div>
        <aside className="rounded-lg border border-line bg-paper p-6 text-sm">
          <h2 className="eyebrow text-cognac" style={{ fontFamily: "var(--font-sans)" }}>
            Written by
          </h2>
          <ul className="mt-3 space-y-1.5">
            {issue.editors.map((s) => (
              <li key={s}>
                <Link
                  to="/scouts/$slug"
                  params={{ slug: s }}
                  className="underline-offset-4 hover:underline"
                >
                  {getContributor(s)?.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-ink-60">Reviewed by Rothenhall Partners before release.</p>
        </aside>
      </Container>
    </>
  );
}
