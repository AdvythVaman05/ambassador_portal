import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Container } from "@/components/site/primitives";
import { currentSessionServer } from "./-auth.actions";
import { scoutDashboard } from "./-dashboard.actions";

export const Route = createFileRoute("/workspace")({ component: Workspace });
function Workspace() {
  const current = useServerFn(currentSessionServer);
  const loadDashboard = useServerFn(scoutDashboard);
  const [signedIn, setSignedIn] = useState<boolean>();
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof scoutDashboard>>>();
  useEffect(() => {
    current()
      .then(async (user) => {
        const allowed = user?.roles.includes("scout") ?? false;
        setSignedIn(allowed);
        if (allowed) setDashboard(await loadDashboard());
      })
      .catch(() => setSignedIn(false));
  }, [current, loadDashboard]);
  return (
    <>
      <PageHeader
        eyebrow="Scout workspace"
        title="Your Campus Scouts workspace"
        lead="Assignments, submissions, feedback, progress and announcements are available to signed-in Scouts."
      />
      <Container className="py-16">
        {signedIn === undefined ? (
          <p>Checking your secure session…</p>
        ) : signedIn ? (
          !dashboard ? (
            <p>Loading your workspace…</p>
          ) : (
            <div className="grid gap-6">
              <section className="rounded-md border border-border bg-paper p-6">
                <h2 className="font-medium">Signal total: {dashboard.signalTotal}</h2>
                <h3 className="mt-5 font-medium">Assigned tasks</h3>
                {dashboard.tasks.length ? (
                  <ul className="mt-3 grid gap-2 text-sm text-ink-80">
                    {dashboard.tasks.map((task) => (
                      <li key={task.id}>
                        {task.title}
                        {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-80">No tasks are assigned to you.</p>
                )}
              </section>
              <section className="rounded-md border border-border bg-paper p-6">
                <h2 className="font-medium">Announcements</h2>
                {dashboard.announcements.length ? (
                  <ul className="mt-3 grid gap-2 text-sm text-ink-80">
                    {dashboard.announcements.map((item) => (
                      <li key={item.id}>{item.title}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink-80">No announcements have been published.</p>
                )}
              </section>
            </div>
          )
        ) : (
          <p className="text-ink-80">
            Please{" "}
            <Link to="/login" className="text-cognac underline">
              sign in
            </Link>{" "}
            to access this workspace.
          </p>
        )}
      </Container>
    </>
  );
}
