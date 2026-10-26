import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Button, Container, Field, inputClass } from "@/components/site/primitives";

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply to Join — Rothenhall Campus Scouts" },
      {
        name: "description",
        content: "Apply to join Rothenhall Campus Scouts, a flexible, unpaid student initiative.",
      },
      { property: "og:title", content: "Apply to Campus Scouts" },
      { property: "og:description", content: "What would you build?" },
    ],
  }),
  component: Apply,
});

function Apply() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    if (!String(d.get("name")).trim()) next["name"] = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(String(d.get("email"))))
      next["email"] = "Please enter a valid email.";
    if (!String(d.get("institution")).trim())
      next["institution"] = "Please enter your college or university.";
    if (!String(d.get("course")).trim())
      next["course"] = "Please enter your course and year of study.";
    if (String(d.get("idea")).trim().length < 20)
      next["idea"] = "Tell us a little more (at least 20 characters).";
    if (!d.get("unpaid")) next["unpaid"] = "Please acknowledge that the program is unpaid.";
    if (!d.get("consent"))
      next["consent"] =
        "Please confirm that you understand this prototype does not send or store your information.";
    setErrors(next);
    if (Object.keys(next).length) {
      setState("error");
      return;
    }
    setState("loading");
    window.setTimeout(() => setState("success"), 450);
  }

  return (
    <>
      <PageHeader
        eyebrow="Apply"
        title="What would you build?"
        lead="Campus Scouts is unpaid and does not guarantee publication, internships or employment."
      />
      <Container className="py-16">
        <div
          role="note"
          className="mb-8 max-w-xl rounded-md border border-dashed border-brass bg-paper p-4 text-sm text-ink-80"
        >
          Preview only: this form checks your answers but does not send them anywhere yet.
        </div>
        <form noValidate onSubmit={onSubmit} className="grid max-w-xl gap-6">
          <Field label="Full name" id="name" error={errors["name"]}>
            <input
              id="name"
              name="name"
              autoComplete="name"
              className={inputClass}
              aria-invalid={!!errors["name"]}
              aria-describedby={errors["name"] ? "name-error" : undefined}
            />
          </Field>
          <Field label="Email" id="email" error={errors["email"]}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className={inputClass}
              aria-invalid={!!errors["email"]}
              aria-describedby={errors["email"] ? "email-error" : undefined}
            />
          </Field>
          <Field label="College or university" id="institution" error={errors["institution"]}>
            <input
              id="institution"
              name="institution"
              autoComplete="organization"
              className={inputClass}
              aria-invalid={!!errors["institution"]}
            />
          </Field>
          <Field label="Course and year of study" id="course" error={errors["course"]}>
            <input
              id="course"
              name="course"
              className={inputClass}
              aria-invalid={!!errors["course"]}
              placeholder="e.g. BSc Economics, year 2"
            />
          </Field>
          <Field label="Interests" id="interests" hint="Optional">
            <input
              id="interests"
              name="interests"
              className={inputClass}
              placeholder="e.g. research, design, AI"
            />
          </Field>
          <Field label="Skills" id="skills" hint="Optional">
            <input
              id="skills"
              name="skills"
              className={inputClass}
              placeholder="e.g. writing, data analysis, coding"
            />
          </Field>
          <Field label="Portfolio or LinkedIn URL" id="portfolio" hint="Optional">
            <input
              id="portfolio"
              name="portfolio"
              type="url"
              className={inputClass}
              placeholder="https://"
            />
          </Field>
          <Field
            label="What would you research, write or build?"
            id="idea"
            hint="A few sentences is plenty."
            error={errors["idea"]}
          >
            <textarea
              id="idea"
              name="idea"
              rows={5}
              className={`${inputClass} py-2.5`}
              aria-invalid={!!errors["idea"]}
              aria-describedby={errors["idea"] ? "idea-error" : "idea-hint"}
            />
          </Field>
          <Field
            label="Relevant previous work"
            id="previous"
            hint="Optional — links or a short description are welcome."
          >
            <textarea id="previous" name="previous" rows={3} className={`${inputClass} py-2.5`} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink">Preferred contribution areas</legend>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {["Research", "Create", "Connect", "Execute"].map((area) => (
                <label key={area} className="flex items-center gap-2">
                  <input type="checkbox" name="areas" value={area} /> {area}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex gap-3 text-sm leading-relaxed text-ink-80">
            <input name="unpaid" type="checkbox" className="mt-1 size-4 accent-cognac" />I
            understand that Campus Scouts is an unpaid program.
          </label>
          {errors["unpaid"] && (
            <p role="alert" className="-mt-4 text-xs text-destructive">
              {errors["unpaid"]}
            </p>
          )}
          <label className="flex gap-3 text-sm leading-relaxed text-ink-80">
            <input name="consent" type="checkbox" className="mt-1 size-4 accent-cognac" />I
            understand that this prototype does not transmit or retain my application information.
          </label>
          {errors["consent"] && (
            <p role="alert" className="-mt-4 text-xs text-destructive">
              {errors["consent"]}
            </p>
          )}
          <Button type="submit" disabled={state === "loading"} className="justify-self-start">
            {state === "loading" ? "Checking application…" : "Check application"}
          </Button>
          {state === "success" && (
            <p role="status" className="text-sm text-cognac-deep">
              Your application is complete as a prototype. Nothing was transmitted or stored.
            </p>
          )}
          {state === "error" && (
            <p role="status" className="text-sm text-destructive">
              Please correct the highlighted fields before continuing.
            </p>
          )}
        </form>
      </Container>
    </>
  );
}
