import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Button, Container, Field, inputClass } from "@/components/site/primitives";
import { loginServer } from "./-auth.actions";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const login = useServerFn(loginServer);
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);
    const values = new FormData(event.currentTarget);
    try {
      const response = await login({
        data: {
          email: String(values.get("email") ?? ""),
          password: String(values.get("password") ?? ""),
        },
      });
      await navigate({ to: response.roles.includes("admin") ? "/console" : "/workspace" });
    } catch {
      setError("We could not sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Member access"
        title="Sign in to Campus Scouts"
        lead="Use the account credentials supplied with your invitation."
      />
      <Container className="py-16">
        <form
          noValidate
          onSubmit={submit}
          className="grid max-w-md gap-5"
          aria-describedby={error ? "login-error" : undefined}
        >
          <Field label="Email" id="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Password" id="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </Field>
          <Button type="submit" disabled={loading} className="justify-self-start">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          {error && (
            <p id="login-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </Container>
    </>
  );
}
