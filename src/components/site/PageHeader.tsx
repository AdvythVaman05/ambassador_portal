import type { ReactNode } from "react";
import { Container } from "./primitives";

export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-line" data-reveal>
      <Container className="py-16 sm:py-24">
        <p className="eyebrow text-cognac">{eyebrow}</p>
        <h1 className="display mt-4 max-w-3xl text-[2.4rem] sm:text-[3.4rem]">{title}</h1>
        {lead && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-60">{lead}</p>}
        {children}
      </Container>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-2xl space-y-5 text-[17px] leading-[1.7] text-ink-80 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:text-ink">
      {children}
    </div>
  );
}
