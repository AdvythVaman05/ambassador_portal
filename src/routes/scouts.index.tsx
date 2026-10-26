import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Container } from "@/components/site/primitives";
import { ContributorCard } from "@/components/site/cards";
import { contributors } from "@/data/site";

export const Route = createFileRoute("/scouts/")({
  head: () => ({
    meta: [
      { title: "Scouts — Rothenhall Campus Scouts" },
      {
        name: "description",
        content: "The contributors behind Campus Scouts research and The Rothenhall Brief.",
      },
      { property: "og:title", content: "Campus Scouts Contributors" },
      { property: "og:description", content: "Meet the people behind the work." },
    ],
  }),
  component: Scouts,
});
function Scouts() {
  const [query, setQuery] = useState("");
  const visible = contributors.filter((person) =>
    `${person.name} ${person.role} ${person.discipline} ${person.interests.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="Contributors"
        title="The people behind the work."
        lead="All profiles shown are fictional demonstration profiles."
      />
      <Container className="py-10 sm:py-16">
        <input
          aria-label="Search contributors"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mb-8 min-h-11 w-full max-w-md rounded-md border border-input bg-paper px-3"
          placeholder="Search people, roles or interests"
        />
        {visible.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((c) => (
              <ContributorCard key={c.slug} person={c} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line-strong p-8 text-ink-60">
            No contributors match that search.
          </p>
        )}
      </Container>
    </>
  );
}
