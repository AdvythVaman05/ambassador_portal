import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader, Prose } from "@/components/site/PageHeader";
import { Container, DemoTag } from "@/components/site/primitives";
import { formatDate, getArticle, getContributor } from "@/data/site";

export const Route = createFileRoute("/insights/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.article.title} — Rothenhall Insights`
          : "Article not found",
      },
      { name: "description", content: loaderData?.article.excerpt ?? "" },
      { property: "og:title", content: loaderData?.article.title ?? "Rothenhall Insights" },
      { property: "og:description", content: loaderData?.article.excerpt ?? "" },
      { property: "og:type", content: "article" },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const author = getContributor(article.author);
  return (
    <>
      <PageHeader eyebrow={article.category} title={article.title} lead={article.excerpt}>
        <p className="mt-6 flex flex-wrap items-center gap-3 text-sm text-ink-60">
          {author && (
            <Link
              to="/scouts/$slug"
              params={{ slug: author.slug }}
              className="text-ink underline-offset-4 hover:underline"
            >
              {author.name}
            </Link>
          )}
          · {formatDate(article.date)} · {article.readingMinutes} min read <DemoTag />
        </p>
      </PageHeader>
      <Container className="py-16">
        <Prose>
          {article.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </Prose>
      </Container>
    </>
  );
}
