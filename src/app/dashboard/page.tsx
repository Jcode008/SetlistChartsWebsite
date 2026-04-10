"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { nanoid } from "nanoid";

interface Band {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
}

export default function DashboardPage() {
  const [bands, setBands] = useState<Band[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [bandName, setBandName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadUserAndBands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUserAndBands() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    setUserName(user.user_metadata?.display_name || user.email || "");

    // Get bands the user is a member of
    const { data: memberships } = await supabase
      .from("band_members")
      .select("band_id")
      .eq("user_id", user.id);

    if (memberships && memberships.length > 0) {
      const bandIds = memberships.map((m) => m.band_id);
      const { data: bandsData } = await supabase
        .from("bands")
        .select("*")
        .in("id", bandIds);
      setBands(bandsData || []);
    }

    setLoading(false);
  }

  async function handleCreateBand(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const inviteCode = nanoid(8).toUpperCase();

    const { data: band, error: bandError } = await supabase
      .from("bands")
      .insert({ name: bandName, invite_code: inviteCode, created_by: user.id })
      .select()
      .single();

    if (bandError) {
      setError(bandError.message);
      return;
    }

    // Add creator as a member
    await supabase.from("band_members").insert({
      band_id: band.id,
      user_id: user.id,
      role: "admin",
    });

    setBandName("");
    setShowCreate(false);
    loadUserAndBands();
  }

  async function handleJoinBand(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: band } = await supabase
      .from("bands")
      .select("*")
      .eq("invite_code", joinCode.toUpperCase())
      .single();

    if (!band) {
      setError("No band found with that code.");
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("band_members")
      .select("id")
      .eq("band_id", band.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      setError("You're already in this band!");
      return;
    }

    await supabase.from("band_members").insert({
      band_id: band.id,
      user_id: user.id,
      role: "member",
    });

    setJoinCode("");
    setShowJoin(false);
    loadUserAndBands();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm tracking-wide">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <span className="text-sm font-medium tracking-widest uppercase text-foreground/70">BandApp</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{userName}</span>
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl font-light tracking-tight">Your Bands</h2>
            <p className="text-sm text-muted-foreground mt-1">Select a band or create a new one.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
              className="px-4 py-2 text-sm tracking-wide bg-foreground text-background rounded-md hover:bg-foreground/85 transition-colors duration-300"
            >
              Create
            </button>
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
              className="px-4 py-2 text-sm tracking-wide border border-border rounded-md hover:border-foreground/30 transition-colors duration-300"
            >
              Join
            </button>
          </div>
        </div>

        {error && (
          <div className="text-destructive text-sm py-2 px-3 bg-destructive/8 rounded-md mb-6">
            {error}
          </div>
        )}

        {/* Create Band Form */}
        {showCreate && (
          <div className="border border-border rounded-md p-6 mb-8 bg-card">
            <h3 className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-4">New Band</h3>
            <form onSubmit={handleCreateBand} className="space-y-4">
              <div>
                <label className="block text-xs tracking-wide text-muted-foreground mb-2 uppercase">Band Name</label>
                <input
                  type="text"
                  value={bandName}
                  onChange={(e) => setBandName(e.target.value)}
                  placeholder="e.g. The Velvet Sessions"
                  className="w-full px-4 py-2.5 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-5 py-2 text-sm bg-foreground text-background rounded-md hover:bg-foreground/85 transition-colors duration-300">
                  Create
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join Band Form */}
        {showJoin && (
          <div className="border border-border rounded-md p-6 mb-8 bg-card">
            <h3 className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-4">Join a Band</h3>
            <form onSubmit={handleJoinBand} className="space-y-4">
              <div>
                <label className="block text-xs tracking-wide text-muted-foreground mb-2 uppercase">Invite Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="8-character code"
                  className="w-full px-4 py-2.5 rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300 uppercase font-mono tracking-widest"
                  maxLength={8}
                  required
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-5 py-2 text-sm bg-foreground text-background rounded-md hover:bg-foreground/85 transition-colors duration-300">
                  Join
                </button>
                <button type="button" onClick={() => setShowJoin(false)} className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Band List */}
        {bands.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground text-sm mb-1">No bands yet</p>
            <p className="text-xs text-muted-foreground/60">Create a band or join one with an invite code.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bands.map((band) => (
              <button
                key={band.id}
                onClick={() => router.push(`/band/${band.id}`)}
                className="w-full flex items-center justify-between px-6 py-5 bg-card border border-border rounded-md hover:border-foreground/20 transition-all duration-300 group text-left"
              >
                <div>
                  <h3 className="font-medium group-hover:text-accent transition-colors duration-300">
                    {band.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-mono tracking-wider">
                    {band.invite_code}
                  </p>
                </div>
                <span className="text-muted-foreground/40 group-hover:text-foreground/60 transition-colors duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
