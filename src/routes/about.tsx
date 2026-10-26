import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Prose } from "@/components/site/PageHeader";
import { ButtonLink, Container } from "@/components/site/primitives";
import { progression } from "@/data/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "The Program — Rothenhall Campus Scouts" },
      {
        name: "description",
        content:
          "What Campus Scouts work on, what is expected, and how contributions are reviewed and published.",
      },
      { property: "og:title", content: "The Campus Scouts Program" },
      {
        property: "og:description",
        content: "A flexible, part-time student initiative of Rothenhall Partners.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHeader
        eyebrow="The program"
        title="A student initiative built around real, visible work."
        lead="Campus Scouts is a flexible, part-time initiative of Rothenhall Partners for students who want to research, write, create and execute."
      />
      <Container className="py-16 sm:py-20">
        <Prose>
          <h2>Relationship to Rothenhall Partners</h2>
          <p>
            Rothenhall Partners is a fractional operating partner for AI-era growth. Campus Scouts
            helps more people understand that work, while giving students practical experience.
            Scouts do not automatically work with clients or access confidential company
            information.
          </p>
          <h2>What Scouts work on</h2>
          <p>
            Scouts may contribute through research, writing, technical work, data analysis, content
            creation, design, strategy and campus initiatives. The four contribution areas are
            Research, Create, Connect and Execute; no Scout is promised a particular activity or
            project.
          </p>
          <h2>Participation expectations</h2>
          <p>
            Participation is flexible and part-time. There is no published weekly-hour or
            programme-duration commitment. Contributors are expected to work thoughtfully, represent
            sources accurately and communicate about work in progress.
          </p>
          <h2>Editorial review and publishing</h2>
          <p>
            Scouts write and produce The Rothenhall Brief. Rothenhall supplies or approves official
            company information, and reviews final issues for factual accuracy, confidentiality,
            brand alignment and attribution before release. Contributions are reviewed before
            publication; authors receive accurate credit and no profile or work is published without
            appropriate consent.
          </p>
          <h2>Progression</h2>
          <ul className="list-disc pl-5">
            {progression.map((p) => (
              <li key={p.role}>
                <strong>{p.role}:</strong> {p.summary}
              </li>
            ))}
          </ul>
          <h2>Recognition policy</h2>
          <p>
            The role is unpaid. Recognition means attribution and visibility of your work. There is
            no guaranteed merchandise, reward, internship, employment or recommendation.
          </p>
          <h2>Application process</h2>
          <p>
            Use the application form to share what you would like to build, research, create or
            organise. The current form is a prototype: it does not transmit or retain information
            until a submission service is configured.
          </p>
        </Prose>
        <ButtonLink to="/apply" className="mt-6" arrow>
          Apply to Join
        </ButtonLink>
      </Container>
    </>
  );
}
