import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { Container, DemoTag } from "@/components/site/primitives";
import { getContributor, getProject } from "@/data/site";

export const Route = createFileRoute("/projects/$slug")({
  loader: ({ params }) => {
    const project = getProject(params.slug);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.project.title} — Student Work` : "Project not found" },
      { name: "description", content: loaderData?.project.summary ?? "" },
      { property: "og:title", content: loaderData?.project.title ?? "Student Work" },
      { property: "og:description", content: loaderData?.project.summary ?? "" },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { project: p } = Route.useLoaderData();
  const sections = [
    ["Problem", p.problem],
    ["Methodology", p.methodology],
    ["Evidence", p.evidence],
    ["Findings", p.findings],
    ["Limitations", p.limitations],
    ["Contribution", p.contribution],
  ] as const;
  return (
    <>
      <PageHeader eyebrow={p.category} title={p.title} lead={p.summary}>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-ink-60">
          {p.contributors.map((s) => {
            const c = getContributor(s);
            return (
              c && (
                <Link
                  key={s}
                  to="/scouts/$slug"
                  params={{ slug: s }}
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {c.name}
                </Link>
              )
            );
          })}
          <DemoTag label="Illustrative demonstration" />
        </div>
      </PageHeader>
      <Container className="py-16">
        <dl className="grid max-w-3xl gap-8">
          {sections.map(([k, v]) => (
            <div key={k} className="grid gap-2 border-t border-line pt-5 sm:grid-cols-[10rem_1fr]">
              <dt className="eyebrow text-cognac">{k}</dt>
              <dd className="leading-relaxed text-ink-80">{v}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </>
  );
}
