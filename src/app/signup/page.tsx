"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute top-5 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-10">
          <p className="text-sm font-medium tracking-widest uppercase text-foreground/70 mb-1">BandApp</p>
          <h1 className="text-2xl font-light tracking-tight">Create your account</h1>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          {error && (
            <div className="text-destructive text-sm py-2 px-3 bg-destructive/8 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs tracking-wide text-muted-foreground mb-2 uppercase">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wide text-muted-foreground mb-2 uppercase">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs tracking-wide text-muted-foreground mb-2 uppercase">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-foreground text-background rounded-md text-sm tracking-wide hover:bg-foreground/85 transition-colors duration-300 disabled:opacity-40"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground hover:text-accent transition-colors duration-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
