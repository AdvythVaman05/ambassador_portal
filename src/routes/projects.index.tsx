import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Container } from "@/components/site/primitives";
import { ProjectCard } from "@/components/site/cards";
import { projects } from "@/data/site";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "Student Work — Rothenhall Campus Scouts" },
      {
        name: "description",
        content: "Research briefs, audits and experiments produced by Campus Scouts.",
      },
      { property: "og:title", content: "Campus Scouts Student Work" },
      { property: "og:description", content: "Ideas are useful. Evidence is better." },
    ],
  }),
  component: Projects,
});
function Projects() {
  const [query, setQuery] = useState("");
  const visible = projects.filter((project) =>
    `${project.title} ${project.category} ${project.skills.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="Student work"
        title="Ideas are useful. Evidence is better."
        lead="These example projects are illustrative demonstration content. They show format and method, not real findings."
      />
      <Container className="py-10 sm:py-16">
        <input
          aria-label="Search projects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mb-8 min-h-11 w-full max-w-md rounded-md border border-input bg-paper px-3"
          placeholder="Search projects, categories or skills"
        />
        {visible.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((p, i) => (
              <ProjectCard key={p.slug} project={p} index={i} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line-strong p-8 text-ink-60">
            No projects match that search.
          </p>
        )}
      </Container>
    </>
  );
}
