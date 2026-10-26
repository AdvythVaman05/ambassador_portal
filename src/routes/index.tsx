import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import * as Accordion from "@radix-ui/react-accordion";
import {
  articles,
  briefIssues,
  contributors,
  faqs,
  formatDate,
  getContributor,
  progression,
  projects,
  ROTHENHALL_URL,
} from "@/data/site";
import {
  ButtonLink,
  Container,
  DemoTag,
  ExternalLink,
  SectionHeading,
} from "@/components/site/primitives";
import { ArticleCard, Initials, ProjectCard } from "@/components/site/cards";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rothenhall Campus Scouts — Research. Create. Connect. Execute." },
      {
        name: "description",
        content:
          "A student initiative of Rothenhall Partners. Explore AI visibility, investigate how businesses grow, and publish work people can see.",
      },
      { property: "og:title", content: "Rothenhall Campus Scouts" },
      {
        property: "og:description",
        content:
          "Learn the systems behind modern growth. Build work that demonstrates your skills. Make your contribution visible.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <Hero />
      <Intro />
      <Activities />
      <Journey />
      <FeaturedProjects />
      <KnowledgeHub />
      <Spotlight />
      <Brief />
      <Progression />
      <FaqPreview />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
      <Container className="grid gap-14 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:py-28">
        <div>
          <p className="eyebrow text-cognac">Rothenhall Partners / Campus Scouts</p>
          <h1
            id="hero-title"
            className="display mt-6 text-[2.7rem] sm:text-[3.8rem] lg:text-[4.4rem]"
          >
            Don't just follow what changes.{" "}
            <span className="text-cognac">Help build what comes next.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-60 sm:text-xl">
            Explore AI visibility, investigate how businesses grow, and turn your ideas into work
            that people can actually see.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink to="/about" arrow>
              Explore the Program
            </ButtonLink>
            <ButtonLink to="/apply" variant="outline">
              Apply to Join
            </ButtonLink>
          </div>
          <p className="mt-8 text-sm text-ink-45">
            Flexible, part-time and unpaid. Open to students from any discipline.
          </p>
        </div>
        <HeroVisual />
      </Container>
    </section>
  );
}

/** Editorial visual: a question becomes evidence, an insight, then a published byline. */
function HeroVisual() {
  const steps = [
    { k: "Question", v: "How do AI assistants describe this category?" },
    { k: "Evidence", v: "40 prompts · 4 assistants · coded answers" },
    { k: "Insight", v: "Consistent public information tends to be described more accurately." },
  ];
  return (
    <figure
      aria-label="Illustration: from a research question to a published piece"
      className="relative mx-auto w-full max-w-md lg:max-w-none"
    >
      <div className="rounded-lg border border-line bg-paper p-6 shadow-[0_30px_60px_-40px_rgb(20_18_13/0.45)] sm:p-8">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-ink-45">Research note · Draft</span>
          <DemoTag label="Illustrative" />
        </div>
        <ol className="mt-6 space-y-0">
          {steps.map((s, i) => (
            <li key={s.k} className="relative grid grid-cols-[2rem_1fr] gap-3 pb-6 last:pb-0">
              {i < steps.length - 1 && (
                <span aria-hidden className="absolute left-[0.95rem] top-8 bottom-1 w-px bg-line" />
              )}
              <span className="flex size-8 items-center justify-center rounded-full border border-line-strong font-display text-xs text-cognac">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="eyebrow text-cognac">{s.k}</p>
                <p className="mt-1.5 font-display text-[1.05rem] leading-snug text-ink">{s.v}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="relative -mt-4 ml-6 rounded-lg border border-line bg-night p-5 text-on-night sm:ml-14">
        <p className="eyebrow text-brass-soft">Published in The Rothenhall Brief</p>
        <p className="mt-2 font-display text-lg leading-snug">
          The shortlist now starts in a chat window
        </p>
        <p className="mt-2 text-sm text-on-night-muted">By Maya Okafor, Campus Scout (demo)</p>
      </div>
    </figure>
  );
}

const pillars = [
  {
    t: "AI Visibility",
    d: "How a business is discovered, described and recommended across AI-powered search and answer experiences, through Answer Engine and Generative Engine Optimization.",
  },
  {
    t: "Go-to-Market Strategy",
    d: "Positioning, market entry, customer acquisition and the commercial execution that turns a clear story into growth.",
  },
  {
    t: "Growth Operations",
    d: "The research, processes, systems and measurement that keep growth repeatable rather than accidental.",
  },
];

function Intro() {
  return (
    <section aria-labelledby="intro-title" className="border-b border-line">
      <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div>
          <SectionHeading
            id="intro-title"
            eyebrow="Introducing Rothenhall Partners"
            title="Growth is a system. We work on the system."
          />
          <p className="mt-6 text-lg leading-relaxed text-ink-60">
            Rothenhall Partners is a fractional operating partner for AI-era growth. Its aim for
            clients is simple:{" "}
            <em className="not-italic text-ink">be the company the AI recommends.</em> Its products
            include Cailyx, an AI visibility engine, and Motion, a social studio.
          </p>
          <ExternalLink href={ROTHENHALL_URL} className="mt-6 text-sm font-medium text-cognac-deep">
            Visit rothenhall.com
          </ExternalLink>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {pillars.map((p, i) => (
            <article key={p.t} className="grid gap-3 py-7 sm:grid-cols-[3rem_1fr]">
              <span className="font-display text-sm text-cognac">0{i + 1}</span>
              <div>
                <h3 className="text-2xl">{p.t}</h3>
                <p className="mt-2 leading-relaxed text-ink-60">{p.d}</p>
                <ExternalLink href={ROTHENHALL_URL} className="mt-3 text-sm text-ink-80">
                  Learn more at Rothenhall
                </ExternalLink>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

const activities = [
  {
    k: "Research",
    d: "Investigate questions, analyse evidence and develop insights.",
    ex: "A sourced brief on how buyers in one industry shortlist vendors.",
  },
  {
    k: "Create",
    d: "Write articles, create explainers and produce genuinely useful content.",
    ex: "A plain-language explainer on AEO for the Knowledge Hub.",
  },
  {
    k: "Connect",
    d: "Build relationships with relevant campus communities and collaborators.",
    ex: "A joint research session with a campus entrepreneurship society.",
  },
  {
    k: "Execute",
    d: "Turn ideas into organised projects, experiments and initiatives.",
    ex: "A documented two-week landing-page experiment.",
  },
];

function Activities() {
  return (
    <section aria-labelledby="act-title" className="bg-canvas-2/60 border-b border-line">
      <Container className="py-20 sm:py-28">
        <SectionHeading
          id="act-title"
          eyebrow="What Scouts do"
          title="Four ways to turn curiosity into contribution."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
          {activities.map((a, i) => (
            <article key={a.k} className={`bg-paper p-7 sm:p-9 ${i === 0 ? "md:row-span-1" : ""}`}>
              <h3 className="display text-[2.2rem] tracking-[0.04em] text-ink sm:text-[2.6rem]">
                {a.k.toUpperCase()}
              </h3>
              <p className="mt-3 max-w-sm text-lg leading-relaxed text-ink-80">{a.d}</p>
              <p className="mt-6 border-l-2 border-cognac pl-4 text-sm text-ink-60">
                <span className="eyebrow mb-1 block text-cognac">Example deliverable</span>
                {a.ex}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

const journey = [
  {
    k: "Explore",
    d: "Understand Rothenhall, choose an area of interest and learn the program expectations.",
  },
  { k: "Contribute", d: "Produce research, content, technical work or community initiatives." },
  { k: "Publish", d: "Submit contributions for review and publish approved work." },
  {
    k: "Demonstrate",
    d: "Build a visible record of completed projects, articles and achievements.",
  },
];

function Journey() {
  return (
    <section aria-labelledby="journey-title" className="border-b border-line">
      <Container className="py-20 sm:py-28">
        <SectionHeading
          id="journey-title"
          eyebrow="How it works"
          title="From first question to visible work."
        />
        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {journey.map((j, i) => (
            <li key={j.k} className="border-t-2 border-ink pt-5">
              <span className="font-display text-sm text-cognac">0{i + 1}</span>
              <h3 className="mt-2 text-xl tracking-[0.06em]">{j.k.toUpperCase()}</h3>
              <p className="mt-3 leading-relaxed text-ink-60">{j.d}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function FeaturedProjects() {
  return (
    <section aria-labelledby="proj-title" className="border-b border-line">
      <Container className="py-20 sm:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            id="proj-title"
            eyebrow="Featured projects"
            title="Ideas are useful. Evidence is better."
            lead="Example projects showing the format and standard of Scout work. All findings are illustrative, not real research results."
          />
          <ButtonLink to="/projects" variant="ghost" arrow>
            All student work
          </ButtonLink>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <ProjectCard key={p.slug} project={p} index={i} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function KnowledgeHub() {
  const [lead, ...rest] = articles as [(typeof articles)[number], ...typeof articles];
  return (
    <section aria-labelledby="hub-title" className="border-b border-line bg-paper">
      <Container className="py-20 sm:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            id="hub-title"
            eyebrow="Knowledge Hub"
            title="Useful ideas, without the noise."
          />
          <ButtonLink to="/insights" variant="outline" arrow>
            Explore all insights
          </ButtonLink>
        </div>
        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
          <ArticleCard article={lead} />
          <div className="border-b border-line">
            {rest.map((a) => (
              <ArticleCard key={a.slug} article={a} variant="row" />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Spotlight() {
  const person = contributors[0]!;
  const project = projects[0]!;
  return (
    <section aria-labelledby="spot-title" className="border-b border-line">
      <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <SectionHeading
            id="spot-title"
            eyebrow="Scout spotlight"
            title="Good work deserves to be seen."
          />
          <p className="mt-6 leading-relaxed text-ink-60">
            Selected contributions may be featured in Rothenhall's publishing channels, subject to
            editorial review and the contributor's consent.
          </p>
          <ButtonLink to="/projects" className="mt-8" arrow>
            Explore Student Work
          </ButtonLink>
        </div>
        <article className="rounded-lg border border-line bg-paper p-7 sm:p-9">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Initials name={person.name} className="size-14 text-lg" />
              <div>
                <h3 className="text-2xl">{person.name}</h3>
                <p className="text-sm text-ink-60">
                  {person.role} · {person.discipline}
                </p>
              </div>
            </div>
            <DemoTag label="Fictional profile" />
          </div>
          <dl className="mt-8 grid gap-5 text-[15px]">
            <div>
              <dt className="eyebrow text-ink-45">Area of interest</dt>
              <dd className="mt-1 text-ink-80">{person.interests.join(", ")}</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink-45">Contribution</dt>
              <dd className="mt-1 text-ink-80">{person.contribution}</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink-45">Featured project</dt>
              <dd className="mt-1">
                <Link
                  to="/projects/$slug"
                  params={{ slug: project.slug }}
                  className="font-display text-lg text-ink underline decoration-line-strong underline-offset-4 hover:decoration-cognac"
                >
                  {project.title}
                </Link>
              </dd>
            </div>
          </dl>
          <Link
            to="/scouts/$slug"
            params={{ slug: person.slug }}
            className="group mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-cognac-deep"
          >
            View profile{" "}
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </article>
      </Container>
    </section>
  );
}

function Brief() {
  const issue = briefIssues[0]!;
  return (
    <section aria-labelledby="brief-title" className="bg-night text-on-night">
      <Container className="py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <SectionHeading
              tone="night"
              id="brief-title"
              eyebrow="The Rothenhall Brief · Weekly"
              title="Research. Write. Publish."
              lead="A weekly publication produced by Rothenhall Campus Scouts, exploring AI visibility, business growth, industry developments, Rothenhall, and the work happening across the community."
            />
            <ul className="mt-8 space-y-3 text-[15px] text-on-night-muted">
              <li className="border-l border-brass pl-4">
                <span className="text-on-night">Written by Scouts.</span> Every piece draws on their
                own research, projects and understanding of Rothenhall.
              </li>
              <li className="border-l border-brass pl-4">
                <span className="text-on-night">Grounded in official information.</span> Rothenhall
                supplies or approves company facts.
              </li>
              <li className="border-l border-brass pl-4">
                <span className="text-on-night">Reviewed before release.</span> Rothenhall reviews
                each final issue. Authors are always credited.
              </li>
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink to="/brief/$slug" params={{ slug: issue.slug }} variant="onNight" arrow>
                Read the latest issue
              </ButtonLink>
              <ButtonLink to="/brief" variant="outlineNight">
                Browse the archive
              </ButtonLink>
            </div>
          </div>
          <article className="rounded-lg border border-line-night bg-night-2 p-7 sm:p-9">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow text-brass-soft">
                Issue {String(issue.number).padStart(3, "0")} · {formatDate(issue.date)}
              </p>
              <span className="rounded-sm border border-dashed border-brass px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-brass-soft">
                Demo issue
              </span>
            </div>
            <h3 className="display mt-4 text-[1.9rem] text-on-night">{issue.title}</h3>
            <p className="mt-3 leading-relaxed text-on-night-muted">{issue.summary}</p>
            <ol className="mt-7 divide-y divide-line-night border-y border-line-night">
              {issue.headlines.map((h) => (
                <li
                  key={h.title}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <span className="font-display text-lg text-on-night">{h.title}</span>
                  <span className="shrink-0 text-sm text-on-night-muted">
                    {getContributor(h.author)?.name}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
                {issue.topics.map((t) => (
                  <li
                    key={t}
                    className="rounded-sm border border-line-night px-2 py-1 text-xs text-on-night-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-on-night-muted">
                {issue.editors.length} contributing Scouts
              </p>
            </div>
          </article>
        </div>
      </Container>
    </section>
  );
}

function Progression() {
  return (
    <section aria-labelledby="prog-title" className="border-b border-line">
      <Container className="py-20 sm:py-28">
        <SectionHeading
          id="prog-title"
          eyebrow="Progression"
          title="Progress through contribution."
          lead="Roles reflect increasing responsibility, recognised through the quality, consistency, collaboration and leadership shown in your work. There are no fixed thresholds or guaranteed benefits."
        />
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {progression.map((p, i) => (
            <li key={p.role} className="rounded-lg border border-line bg-paper p-6">
              <div className="flex items-center gap-1" aria-hidden>
                {progression.map((_, j) => (
                  <span
                    key={j}
                    className={`h-1 flex-1 rounded-full ${j <= i ? "bg-cognac" : "bg-line"}`}
                  />
                ))}
              </div>
              <h3 className="mt-5 text-2xl">{p.role}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-60">{p.summary}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function FaqPreview() {
  return (
    <section aria-labelledby="faq-title" className="border-b border-line bg-paper">
      <Container className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div>
          <SectionHeading
            id="faq-title"
            eyebrow="FAQ"
            title="Straight answers."
            lead="What the program is, and what it is not."
          />
          <ButtonLink to="/faq" variant="outline" className="mt-8" arrow>
            All questions
          </ButtonLink>
        </div>
        <Accordion.Root type="single" collapsible className="border-t border-line">
          {faqs.map((f, i) => (
            <Accordion.Item key={f.q} value={`f${i}`} className="border-b border-line">
              <Accordion.Header>
                <Accordion.Trigger className="group flex min-h-14 w-full items-center justify-between gap-6 py-4 text-left font-display text-lg text-ink hover:text-cognac-deep">
                  {f.q}
                  <span aria-hidden className="relative size-3.5 shrink-0">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-current" />
                    <span className="absolute inset-y-0 left-1/2 w-px bg-current transition-transform duration-200 group-data-[state=open]:scale-y-0" />
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className="max-w-xl pb-5 leading-relaxed text-ink-60">{f.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title">
      <Container className="py-24 text-center sm:py-32">
        <p className="eyebrow text-cognac">Research · Create · Connect · Execute</p>
        <h2 id="cta-title" className="display mx-auto mt-5 max-w-3xl text-[2.6rem] sm:text-[4rem]">
          What would you build?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-60">
          We're interested in people who bring ideas, curiosity, and the willingness to execute.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/apply" variant="accent" arrow>
            Apply to Join
          </ButtonLink>
          <ButtonLink to="/projects" variant="outline">
            Explore the Work
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
