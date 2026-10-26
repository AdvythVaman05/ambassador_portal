import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Container } from "@/components/site/primitives";
import { ArticleCard } from "@/components/site/cards";
import { articles } from "@/data/site";

export const Route = createFileRoute("/insights/")({
  head: () => ({
    meta: [
      { title: "Insights — Rothenhall Knowledge Hub" },
      {
        name: "description",
        content:
          "Articles by Campus Scouts on AI visibility, AEO/GEO, go-to-market and research methods.",
      },
      { property: "og:title", content: "Rothenhall Knowledge Hub" },
      { property: "og:description", content: "Useful ideas, without the noise." },
    ],
  }),
  component: Insights,
});

function Insights() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const categories = ["All", ...Array.from(new Set(articles.map((article) => article.category)))];
  const visible = useMemo(
    () =>
      articles
        .filter((article) => category === "All" || article.category === category)
        .filter((article) =>
          `${article.title} ${article.excerpt}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "title" ? a.title.localeCompare(b.title) : b.date.localeCompare(a.date),
        ),
    [category, query, sort],
  );
  return (
    <>
      <PageHeader
        eyebrow="Knowledge Hub"
        title="Useful ideas, without the noise."
        lead="Articles written by Campus Scouts. Pieces shown are demonstration content."
      />
      <Container className="py-10 sm:py-16">
        <div className="mb-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            aria-label="Search articles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 rounded-md border border-input bg-paper px-3 text-ink focus-visible:outline-2 focus-visible:outline-cognac"
            placeholder="Search articles"
          />
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-11 rounded-md border border-input bg-paper px-3 text-ink"
          >
            <>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </>
          </select>
          <select
            aria-label="Sort articles"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="min-h-11 rounded-md border border-input bg-paper px-3 text-ink"
          >
            <option value="newest">Newest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
        {visible.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line-strong p-8 text-ink-60">
            No articles match that search. Try a different term or category.
          </p>
        )}
      </Container>
    </>
  );
}
