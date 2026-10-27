import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Button, Container, Field, inputClass } from "@/components/site/primitives";
import { currentSessionServer } from "./-auth.actions";
import { reviewSubmissionServer, reviewerDashboard } from "./-dashboard.actions";

export const Route = createFileRoute("/review")({ component: Review });
function Review() {
  const current = useServerFn(currentSessionServer),
    load = useServerFn(reviewerDashboard),
    grade = useServerFn(reviewSubmissionServer);
  const [allowed, setAllowed] = useState<boolean>();
  const [items, setItems] =
    useState<Awaited<ReturnType<typeof reviewerDashboard>>["submissions"]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    current()
      .then(async (user) => {
        const ok = !!user?.roles.some((role) => role === "admin" || role === "reviewer");
        setAllowed(ok);
        if (ok) setItems((await load()).submissions);
      })
      .catch(() => setAllowed(false));
  }, [current, load]);
  async function submit(event: React.FormEvent<HTMLFormElement>, submissionId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setError(undefined);
      await grade({
        data: {
          submissionId,
          decision: String(data.get("decision")) as "accepted" | "rejected" | "revision_requested",
          feedback: String(data.get("feedback")),
          signalDelta: Number(data.get("signal") || 0),
        },
      });
      setItems((await load()).submissions);
    } catch {
      setError("The review was not saved.");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Review"
        title="Submission review queue"
        lead="Reviewers can grade submitted work and leave actionable feedback."
      />
      <Container className="py-16">
        {allowed === undefined ? (
          <p>Checking your secure session…</p>
        ) : !allowed ? (
          <p>
            Reviewer access is required.{" "}
            <Link to="/login" className="text-cognac underline">
              Sign in
            </Link>
            .
          </p>
        ) : !items ? (
          <p>Loading submissions…</p>
        ) : items.length ? (
          <div className="grid gap-5">
            {items.map((item) => (
              <article key={item.id} className="rounded-md border border-border bg-paper p-5">
                <h2 className="font-medium">Submission {item.id}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink-80">{item.body}</p>
                <form onSubmit={(event) => submit(event, item.id)} className="mt-4 grid gap-3">
                  <Field label="Decision" id={`${item.id}-decision`}>
                    <select name="decision" className={inputClass}>
                      <option value="accepted">Accept</option>
                      <option value="revision_requested">Request changes</option>
                      <option value="rejected">Reject</option>
                    </select>
                  </Field>
                  <Field label="Feedback" id={`${item.id}-feedback`}>
                    <textarea name="feedback" required className={`${inputClass} py-2`} rows={3} />
                  </Field>
                  <Field label="Signal adjustment" id={`${item.id}-signal`} hint="Optional">
                    <input name="signal" type="number" defaultValue="0" className={inputClass} />
                  </Field>
                  <Button type="submit" className="justify-self-start">
                    Save review
                  </Button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p>No submissions are waiting for review.</p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </Container>
    </>
  );
}
