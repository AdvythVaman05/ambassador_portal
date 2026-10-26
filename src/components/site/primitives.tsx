import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Container({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)} {...p} />;
}

const btnBase =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium";
export const btnVariants = {
  primary: "bg-ink text-canvas hover:bg-cognac-deep",
  accent: "bg-cognac text-paper hover:bg-cognac-deep",
  outline: "border border-line-strong text-ink hover:border-ink hover:bg-paper",
  ghost: "text-ink underline-offset-4 hover:underline px-0",
  onNight: "bg-canvas text-ink hover:bg-cognac-soft hover:text-paper",
  outlineNight: "border border-line-night text-on-night hover:border-on-night",
} as const;
export type BtnVariant = keyof typeof btnVariants;

export function ButtonLink({
  to,
  params,
  variant = "primary",
  arrow,
  className,
  children,
}: {
  to: string;
  params?: Record<string, string>;
  variant?: BtnVariant;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className={cn(btnBase, btnVariants[variant], "group", className)}
    >
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      )}
    </Link>
  );
}

export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1 underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
      <ArrowUpRight
        aria-hidden
        className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function Button({
  variant = "primary",
  className,
  ...p
}: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return (
    <button
      className={cn(
        btnBase,
        btnVariants[variant],
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...p}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
  tone = "light",
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  id?: string;
  tone?: "light" | "night";
  className?: string;
}) {
  const night = tone === "night";
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className={cn("eyebrow", night ? "text-brass-soft" : "text-cognac")}>{eyebrow}</p>
      <h2
        id={id}
        className={cn(
          "display mt-4 text-[2rem] sm:text-[2.6rem] lg:text-[3rem]",
          night && "text-on-night",
        )}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            "mt-5 text-lg leading-relaxed",
            night ? "text-on-night-muted" : "text-ink-60",
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

export function DemoTag({
  className,
  label = "Demo content",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border border-dashed border-brass px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-brass-deep",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Field({
  label,
  id,
  hint,
  error,
  children,
}: {
  label: string;
  id: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-60">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-md border border-input bg-paper px-3 text-[15px] text-ink placeholder:text-ink-45 transition-colors hover:border-ink-45 focus-visible:border-cognac focus-visible:outline-2 focus-visible:outline-offset-0 aria-[invalid=true]:border-destructive";
