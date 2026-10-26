import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { navItems, ROTHENHALL_URL } from "@/data/site";
import { ButtonLink, Container } from "./primitives";

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <a
        href={ROTHENHALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cognac"
        aria-label="Rothenhall Partners (opens in a new tab)"
      >
        <img
          src="/rothenhall-partners-logo.png"
          alt="Rothenhall Partners"
          className="h-auto w-[146px] sm:w-[164px]"
        />
      </a>
      <span aria-hidden className="h-6 w-px bg-line-strong" />
      <Link
        to="/"
        className="whitespace-nowrap text-[0.72rem] font-medium text-cognac hover:text-cognac-deep sm:text-[0.8rem]"
      >
        Campus Scouts
      </Link>
    </span>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/75">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-6">
        <Wordmark />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navItems.map((n) => (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className="rounded-md px-3 py-2 text-sm text-ink-80 transition-colors hover:text-ink data-[status=active]:text-ink data-[status=active]:underline data-[status=active]:decoration-cognac data-[status=active]:underline-offset-8"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink to="/apply" className="hidden sm:inline-flex min-h-10">
            Apply to Join
          </ButtonLink>
          <button
            ref={btnRef}
            type="button"
            className="press inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-canvas-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>
      <div
        id="mobile-nav"
        className={cn(
          "fixed inset-x-0 top-16 bottom-0 bg-canvas transition-[opacity,transform] duration-200 ease-out md:hidden",
          open
            ? "opacity-100 translate-y-0"
            : "pointer-events-none -translate-y-2 opacity-0 invisible",
        )}
      >
        <nav aria-label="Mobile">
          <Container className="flex flex-col py-6">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="border-b border-line py-4 font-display text-2xl text-ink data-[status=active]:text-cognac"
              >
                {n.label}
              </Link>
            ))}
            <ButtonLink to="/apply" className="mt-8" arrow>
              Apply to Join
            </ButtonLink>
            <a
              href={ROTHENHALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 text-sm text-ink-60 underline-offset-4 hover:underline"
            >
              Visit Rothenhall Partners ↗
            </a>
          </Container>
        </nav>
      </div>
    </header>
  );
}
