import { Link } from "@tanstack/react-router";
import { ROTHENHALL_URL } from "@/data/site";
import { Container, ExternalLink } from "./primitives";

const cols = [
  {
    title: "Program",
    links: [
      { l: "About the program", to: "/about" },
      { l: "Apply to Join", to: "/apply" },
      { l: "FAQ", to: "/faq" },
    ],
  },
  {
    title: "Work",
    links: [
      { l: "Insights", to: "/insights" },
      { l: "Student Work", to: "/projects" },
      { l: "Scouts", to: "/scouts" },
    ],
  },
  {
    title: "Publication",
    links: [
      { l: "The Rothenhall Brief", to: "/brief" },
      { l: "Archive", to: "/brief" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-night text-on-night-muted">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <a
            href={ROTHENHALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-sm bg-paper px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
          >
            <img
              src="/rothenhall-partners-logo.png"
              alt="Rothenhall Partners"
              className="h-auto w-[190px]"
            />
          </a>
          <p className="mt-2 text-sm text-brass-soft">Campus Scouts</p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed">
            A student research, publishing and community initiative of Rothenhall Partners, a
            fractional operating partner for AI-era growth.
          </p>
          <ExternalLink href={ROTHENHALL_URL} className="mt-5 text-sm text-on-night">
            rothenhall.com
          </ExternalLink>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="eyebrow text-brass-soft" style={{ fontFamily: "var(--font-sans)" }}>
              {c.title}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((x) => (
                <li key={x.l}>
                  <Link to={x.to} className="hover:text-on-night">
                    {x.l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container className="flex flex-col gap-2 border-t border-line-night py-6 text-xs sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} Rothenhall Partners. Campus Scouts is an unpaid, student-led
          initiative.
        </p>
        <p>Profiles, projects and issues shown are demonstration content.</p>
      </Container>
    </footer>
  );
}
