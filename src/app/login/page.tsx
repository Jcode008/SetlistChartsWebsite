"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 sm:px-6 py-8">
      <div className="absolute top-4 right-4 sm:top-5 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 sm:mb-10">
          <p className="text-sm font-medium tracking-widest uppercase text-foreground/70 mb-1">BandApp</p>
          <h1 className="text-xl sm:text-2xl font-light tracking-tight">Welcome back</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="text-destructive text-sm py-2 px-3 bg-destructive/8 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs tracking-wide text-muted-foreground mb-2 uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wide text-muted-foreground mb-2 uppercase">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-foreground text-background rounded-md text-sm tracking-wide hover:bg-foreground/85 transition-colors duration-300 disabled:opacity-40"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-foreground hover:text-accent transition-colors duration-300">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
