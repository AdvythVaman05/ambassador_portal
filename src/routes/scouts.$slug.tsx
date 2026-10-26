import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { Container, DemoTag } from "@/components/site/primitives";
import { ArticleCard, ProjectCard } from "@/components/site/cards";
import { articles, getContributor, projects } from "@/data/site";

export const Route = createFileRoute("/scouts/$slug")({
  loader: ({ params }) => {
    const person = getContributor(params.slug);
    if (!person) throw notFound();
    return { person };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.person.name} — Campus Scouts` : "Profile not found" },
      { name: "description", content: loaderData?.person.bio ?? "" },
      { property: "og:title", content: loaderData?.person.name ?? "Campus Scout" },
      { property: "og:description", content: loaderData?.person.bio ?? "" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { person } = Route.useLoaderData();
  const work = projects.filter((p) => p.contributors.includes(person.slug));
  const writing = articles.filter((a) => a.author === person.slug);
  return (
    <>
      <PageHeader
        eyebrow={`${person.role} · ${person.campus}`}
        title={person.name}
        lead={person.bio}
      >
        <div className="mt-6">
          <DemoTag label="Fictional demonstration profile" />
        </div>
      </PageHeader>
      <Container className="space-y-12 py-16">
        {work.length > 0 && (
          <div>
            <h2 className="text-2xl">Projects</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {work.map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>
          </div>
        )}
        {writing.length > 0 && (
          <div>
            <h2 className="text-2xl">Writing</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {writing.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
