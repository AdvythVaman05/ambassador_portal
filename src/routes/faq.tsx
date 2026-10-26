import { createFileRoute } from "@tanstack/react-router";
import * as Accordion from "@radix-ui/react-accordion";
import { PageHeader } from "@/components/site/PageHeader";
import { Container } from "@/components/site/primitives";
import { faqs } from "@/data/site";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Rothenhall Campus Scouts" },
      {
        name: "description",
        content: "Answers about eligibility, time commitment, pay, publishing and progression.",
      },
      { property: "og:title", content: "Campus Scouts FAQ" },
      { property: "og:description", content: "Straight answers about the program." },
    ],
  }),
  component: () => (
    <>
      <PageHeader eyebrow="FAQ" title="Straight answers." />
      <Container className="py-16">
        <Accordion.Root type="single" collapsible className="max-w-3xl border-b border-line">
          {faqs.map((f, index) => (
            <Accordion.Item key={f.q} value={`faq-${index}`} className="border-t border-line">
              <Accordion.Header>
                <Accordion.Trigger className="flex w-full items-center justify-between gap-4 py-6 text-left font-display text-xl hover:text-cognac-deep">
                  {f.q}
                  <span aria-hidden className="text-cognac">
                    +
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className="pb-6 leading-relaxed text-ink-60">{f.a}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Container>
    </>
  ),
});
