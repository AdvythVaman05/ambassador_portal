import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Article,
  type Contributor,
  type Project,
  formatDate,
  getContributor,
} from "@/data/site";
import { DemoTag } from "./primitives";

const cardLink =
  "group relative flex h-full flex-col rounded-lg border border-line bg-paper p-6 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_12px_30px_-18px_rgb(20_18_13/0.35)] active:translate-y-0";

export function Initials({ name, className }: { name: string; className?: string }) {
  const i = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas-2 font-display text-sm text-cognac-deep ring-1 ring-line",
        className,
      )}
    >
      {i}
    </span>
  );
}

export function ArticleCard({
  article,
  variant = "default",
}: {
  article: Article;
  variant?: "default" | "row";
}) {
  const author = getContributor(article.author);
  if (variant === "row") {
    return (
      <Link
        to="/insights/$slug"
        params={{ slug: article.slug }}
        className="group grid gap-2 border-t border-line py-5 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline sm:gap-6"
      >
        <span className="eyebrow text-cognac">{article.category}</span>
        <span>
          <span className="font-display text-lg text-ink group-hover:text-cognac-deep">
            {article.title}
          </span>
          <span className="mt-1 block text-sm text-ink-60">
            {author?.name} · {formatDate(article.date)}
          </span>
        </span>
        <span className="text-sm text-ink-45">{article.readingMinutes} min</span>
      </Link>
    );
  }
  return (
    <Link to="/insights/$slug" params={{ slug: article.slug }} className={cardLink}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-cognac">{article.category}</span>
        <DemoTag />
      </div>
      <h3 className="mt-4 text-xl leading-snug group-hover:text-cognac-deep">{article.title}</h3>
      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-60">{article.excerpt}</p>
      <p className="mt-6 border-t border-line pt-4 text-sm text-ink-60">
        <span className="text-ink">{author?.name}</span> · {formatDate(article.date)} ·{" "}
        {article.readingMinutes} min read
      </p>
    </Link>
  );
}

export function ProjectCard({ project, index }: { project: Project; index?: number }) {
  const names = project.contributors
    .map((s) => getContributor(s)?.name)
    .filter(Boolean)
    .join(", ");
  return (
    <Link to="/projects/$slug" params={{ slug: project.slug }} className={cardLink}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-ink-60">
          {index !== undefined && (
            <span className="mr-2 text-cognac">{String(index + 1).padStart(2, "0")}</span>
          )}
          {project.category}
        </span>
        <DemoTag label="Illustrative" />
      </div>
      <h3 className="mt-5 text-[1.35rem] leading-snug group-hover:text-cognac-deep">
        {project.title}
      </h3>
      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-60">{project.summary}</p>
      <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Skills">
        {project.skills.map((s) => (
          <li key={s} className="rounded-sm bg-canvas-2 px-2 py-1 text-xs text-ink-80">
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="text-ink-60">
          By {names} <span className="text-ink-45">(demo)</span>
        </span>
        <ArrowRight
          aria-hidden
          className="size-4 text-ink-45 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-cognac"
        />
      </div>
    </Link>
  );
}

export function ContributorCard({ person }: { person: Contributor }) {
  return (
    <Link to="/scouts/$slug" params={{ slug: person.slug }} className={cardLink}>
      <div className="flex items-start gap-3">
        <Initials name={person.name} />
        <div className="min-w-0">
          <h3 className="text-lg leading-tight group-hover:text-cognac-deep">{person.name}</h3>
          <p className="mt-0.5 text-sm text-ink-60">
            {person.role} · {person.discipline}
          </p>
        </div>
      </div>
      <p className="mt-4 flex-1 text-[15px] leading-relaxed text-ink-60">{person.bio}</p>
      <div className="mt-5">
        <DemoTag label="Fictional profile" />
      </div>
    </Link>
  );
}
