import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Button, Container, Field, inputClass } from "@/components/site/primitives";
import { currentSessionServer } from "./-auth.actions";
import {
  acceptApplicationServer,
  adminDashboard,
  createTaskServer,
  createAnnouncementServer,
  publishAnnouncementServer,
  publishTaskServer,
  rejectApplicationServer,
} from "./-dashboard.actions";

export const Route = createFileRoute("/console")({ component: Console });
function Console() {
  const current = useServerFn(currentSessionServer);
  const loadDashboard = useServerFn(adminDashboard);
  const accept = useServerFn(acceptApplicationServer);
  const reject = useServerFn(rejectApplicationServer);
  const createTask = useServerFn(createTaskServer);
  const createAnnouncement = useServerFn(createAnnouncementServer);
  const publishAnnouncement = useServerFn(publishAnnouncementServer);
  const publishTask = useServerFn(publishTaskServer);
  const [authorized, setAuthorized] = useState<boolean>();
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof adminDashboard>>>();
  const [actionError, setActionError] = useState<string>();
  async function decide(applicationId: string, accepted: boolean) {
    try {
      setActionError(undefined);
      if (accepted) await accept({ data: { applicationId } });
      else await reject({ data: { applicationId, notes: "Not selected after review." } });
      setDashboard(await loadDashboard());
    } catch {
      setActionError("The application decision was not saved.");
    }
  }
  async function authorTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createTask({
        data: {
          title: String(form.get("title")),
          brief: String(form.get("brief")),
          rubric: String(form.get("rubric")).split("\n").filter(Boolean),
        },
      });
      event.currentTarget.reset();
      setDashboard(await loadDashboard());
    } catch {
      setActionError("The task was not saved.");
    }
  }
  async function authorAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createAnnouncement({
        data: {
          title: String(form.get("announcementTitle")),
          body: String(form.get("announcementBody")),
        },
      });
      event.currentTarget.reset();
      setDashboard(await loadDashboard());
    } catch {
      setActionError("The announcement was not saved.");
    }
  }
  useEffect(() => {
    current()
      .then(async (user) => {
        const allowed = user?.roles.includes("admin") ?? false;
        setAuthorized(allowed);
        if (allowed) setDashboard(await loadDashboard());
      })
      .catch(() => setAuthorized(false));
  }, [current, loadDashboard]);
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Campus Scouts console"
        lead="Review applications, invitations, cohorts, Scouts and tasks with an administrator account."
      />
      <Container className="py-16">
        {authorized === undefined ? (
          <p>Checking your secure session…</p>
        ) : authorized ? (
          !dashboard ? (
            <p>Loading administrative records…</p>
          ) : (
            <>
              <div className="grid gap-6">
                <section className="rounded-md border border-border bg-paper p-6">
                  <h2 className="font-medium">Applications ({dashboard.applications.length})</h2>
                  {dashboard.applications.length ? (
                    <ul className="mt-3 grid gap-2 text-sm text-ink-80">
                      {dashboard.applications.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-2">
                          <span>
                            {item.fullName} · {item.status}
                          </span>
                          {item.status === "submitted" && (
                            <>
                              <button
                                type="button"
                                onClick={() => decide(item.id, true)}
                                className="text-cognac underline"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => decide(item.id, false)}
                                className="text-cognac underline"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-ink-80">
                      No applications match the current queue.
                    </p>
                  )}
                </section>
                <section className="rounded-md border border-border bg-paper p-6">
                  <h2 className="font-medium">Announcements</h2>
                  <form onSubmit={authorAnnouncement} className="mt-4 grid gap-3">
                    <Field label="Title" id="announcementTitle">
                      <input name="announcementTitle" required className={inputClass} />
                    </Field>
                    <Field label="Message" id="announcementBody">
                      <textarea
                        name="announcementBody"
                        required
                        rows={3}
                        className={`${inputClass} py-2`}
                      />
                    </Field>
                    <Button type="submit" className="justify-self-start">
                      Create announcement
                    </Button>
                  </form>
                  <ul className="mt-4 grid gap-2 text-sm text-ink-80">
                    {dashboard.announcements.map((item) => (
                      <li key={item.id}>
                        {item.title}{" "}
                        <button
                          type="button"
                          className="text-cognac underline"
                          onClick={async () => {
                            try {
                              await publishAnnouncement({
                                data: { id: item.id, published: !item.publishedAt },
                              });
                              setDashboard(await loadDashboard());
                            } catch {
                              setActionError("The publish state was not saved.");
                            }
                          }}
                        >
                          {item.publishedAt ? "Unpublish" : "Publish"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-md border border-border bg-paper p-6">
                  <h2 className="font-medium">Scouts ({dashboard.scouts.length})</h2>
                  {dashboard.scouts.length ? (
                    <ul className="mt-3 grid gap-2 text-sm text-ink-80">
                      {dashboard.scouts.map((item) => (
                        <li key={item.user.id}>
                          {item.user.displayName} · Signal {item.signalTotal}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-ink-80">No Scout profiles yet.</p>
                  )}
                </section>
                <section className="rounded-md border border-border bg-paper p-6">
                  <h2 className="font-medium">Tasks and submissions</h2>
                  <p className="mt-3 text-sm text-ink-80">
                    {dashboard.tasks.length} tasks · {dashboard.submissions.length} submissions
                  </p>
                  <form onSubmit={authorTask} className="mt-4 grid gap-3">
                    <Field label="Task title" id="title">
                      <input name="title" required className={inputClass} />
                    </Field>
                    <Field label="Brief" id="brief">
                      <textarea name="brief" required rows={3} className={`${inputClass} py-2`} />
                    </Field>
                    <Field label="Rubric" id="rubric" hint="One criterion per line">
                      <textarea name="rubric" rows={2} className={`${inputClass} py-2`} />
                    </Field>
                    <Button type="submit" className="justify-self-start">
                      Create task
                    </Button>
                  </form>
                  <ul className="mt-4 grid gap-2 text-sm text-ink-80">
                    {dashboard.tasks.map((task) => (
                      <li key={task.id}>
                        {task.title} · {task.publishedAt ? "published" : "draft"}{" "}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await publishTask({
                                data: { taskId: task.id, published: !task.publishedAt },
                              });
                              setDashboard(await loadDashboard());
                            } catch {
                              setActionError("The publish state was not saved.");
                            }
                          }}
                          className="text-cognac underline"
                        >
                          {task.publishedAt ? "Unpublish" : "Publish"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              {actionError && (
                <p role="alert" className="text-sm text-destructive">
                  {actionError}
                </p>
              )}
            </>
          )
        ) : (
          <p className="text-ink-80">
            Administrator access is required.{" "}
            <Link to="/login" className="text-cognac underline">
              Sign in
            </Link>
            .
          </p>
        )}
      </Container>
    </>
  );
}
