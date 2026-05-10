"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios from "axios";

import { Button, Card, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: bootLoading, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Bounce to /leads.
  useEffect(() => {
    if (!bootLoading && user) router.replace("/leads");
  }, [user, bootLoading, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace("/leads");
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        setError("Wrong username or password.");
      } else if (axios.isAxiosError(e) && !e.response) {
        setError("Can't reach the server. Is the backend running?");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/brand/lextalkworld_logo.png"
            alt="LexTalk World"
            width={211}
            height={64}
            priority
          />
          <h1 className="text-2xl text-ink-900 mt-4">Mantranex</h1>
          <p className="text-sm text-slate-600">Sign in to continue.</p>
        </div>

        <Card padding="default">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              name="username"
              label="Username"
              autoComplete="username"
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p className="text-sm text-rose-600 font-medium" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              loading={submitting}
              className="w-full"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="text-xs text-slate-500 text-center mt-6">
          Accounts are created by the admin. Forgot your password? Ask your admin to reset it.
        </p>
      </div>
    </main>
  );
}
