"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import ChartEditor from "@/components/ChartEditor";

interface Band {
  id: string;
  name: string;
  invite_code: string;
}

interface Setlist {
  id: string;
  name: string;
  band_id: string;
  position: number;
}

interface Chart {
  id: string;
  title: string;
  content: string;
  notes: string;
  drawing_data: string;
  staff_data: string;
  setlist_id: string;
  position: number;
  key_signature: string;
  tempo: number | null;
  time_signature: string;
}

export default function BandPage() {
  const params = useParams();
  const bandId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [band, setBand] = useState<Band | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [activeSetlist, setActiveSetlist] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<string | null>(null);
  const [showNewSetlist, setShowNewSetlist] = useState(false);
  const [showNewChart, setShowNewChart] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState("");
  const [newChartTitle, setNewChartTitle] = useState("");
  const [showBandInfo, setShowBandInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // closed by default on mobile

  const loadCharts = useCallback(async (setlistId: string) => {
    const { data } = await supabase
      .from("charts")
      .select("*")
      .eq("setlist_id", setlistId)
      .order("position");
    setCharts(data || []);
  }, [supabase]);

  const loadSetlists = useCallback(async () => {
    const { data } = await supabase
      .from("setlists")
      .select("*")
      .eq("band_id", bandId)
      .order("position");
    setSetlists(data || []);

    if (data && data.length > 0 && !activeSetlist) {
      setActiveSetlist(data[0].id);
      loadCharts(data[0].id);
    }
  }, [supabase, bandId, activeSetlist, loadCharts]);

  useEffect(() => {
    async function init() {
      const { data: bandData } = await supabase
        .from("bands")
        .select("*")
        .eq("id", bandId)
        .single();

      if (!bandData) {
        router.push("/dashboard");
        return;
      }

      setBand(bandData);
      await loadSetlists();
      setLoading(false);
      // Open sidebar by default on desktop
      if (window.innerWidth >= 768) setSidebarOpen(true);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandId]);

  async function handleCreateSetlist(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await supabase
      .from("setlists")
      .insert({
        name: newSetlistName,
        band_id: bandId,
        position: setlists.length,
      })
      .select()
      .single();

    if (data) {
      setSetlists([...setlists, data]);
      setActiveSetlist(data.id);
      setCharts([]);
      setActiveChart(null);
    }
    setNewSetlistName("");
    setShowNewSetlist(false);
  }

  async function handleCreateChart(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSetlist) return;

    const { data } = await supabase
      .from("charts")
      .insert({
        title: newChartTitle,
        content: "",
        notes: "",
        drawing_data: "",
        staff_data: "",
        setlist_id: activeSetlist,
        position: charts.length,
        key_signature: "C",
        tempo: 120,
        time_signature: "4/4",
      })
      .select()
      .single();

    if (data) {
      setCharts([...charts, data]);
      setActiveChart(data.id);
    }
    setNewChartTitle("");
    setShowNewChart(false);
  }

  async function handleDeleteSetlist(id: string) {
    await supabase.from("charts").delete().eq("setlist_id", id);
    await supabase.from("setlists").delete().eq("id", id);
    setSetlists(setlists.filter((s) => s.id !== id));
    if (activeSetlist === id) {
      setActiveSetlist(null);
      setCharts([]);
      setActiveChart(null);
    }
  }

  async function handleDeleteChart(id: string) {
    await supabase.from("charts").delete().eq("id", id);
    setCharts(charts.filter((c) => c.id !== id));
    if (activeChart === id) {
      setActiveChart(null);
    }
  }

  async function handleUpdateChart(updated: Chart) {
    await supabase
      .from("charts")
      .update({
        title: updated.title,
        content: updated.content,
        notes: updated.notes,
        drawing_data: updated.drawing_data,
        staff_data: updated.staff_data,
        key_signature: updated.key_signature,
        tempo: updated.tempo,
        time_signature: updated.time_signature,
      })
      .eq("id", updated.id);

    setCharts(charts.map((c) => (c.id === updated.id ? updated : c)));
  }

  function selectSetlist(id: string) {
    setActiveSetlist(id);
    setActiveChart(null);
    loadCharts(id);
  }

  // On mobile, close sidebar when selecting a chart
  function handleSelectChart(id: string) {
    setActiveChart(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  const activeChartData = charts.find((c) => c.id === activeChart);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm tracking-wide">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors duration-300 shrink-0"
            aria-label="Toggle sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button onClick={() => router.push("/dashboard")} className="text-xs text-muted-foreground hover:text-foreground tracking-wide transition-colors duration-300 py-1 hidden sm:inline">
            ← Back
          </button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <span className="text-sm font-medium tracking-wide truncate">{band?.name}</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setShowBandInfo(!showBandInfo)}
            className="text-xs text-muted-foreground hover:text-foreground tracking-wide transition-colors duration-300 py-1 px-1.5"
          >
            Invite
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Band info dropdown */}
      {showBandInfo && (
        <div className="px-4 sm:px-5 py-3 bg-card/50 border-b border-border text-xs text-muted-foreground">
          Share this code to invite members: <span className="font-mono font-medium text-accent tracking-widest select-all">{band?.invite_code}</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="fixed md:relative inset-y-0 left-0 z-40 md:z-auto w-64 sm:w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 overflow-hidden shadow-xl md:shadow-none pt-[calc(2.75rem+1px)] md:pt-0">
            {/* Setlists */}
            <div className="border-b border-sidebar-border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Setlists</span>
                <button
                  onClick={() => setShowNewSetlist(!showNewSetlist)}
                  className="p-1.5 sm:p-0.5 text-muted-foreground hover:text-foreground transition-colors duration-300"
                  aria-label="New setlist"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {showNewSetlist && (
                <form onSubmit={handleCreateSetlist} className="px-3 pb-3 flex gap-2">
                  <input
                    type="text"
                    value={newSetlistName}
                    onChange={(e) => setNewSetlistName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
                    autoFocus
                    required
                  />
                  <button type="submit" className="px-2.5 py-1.5 text-xs bg-foreground text-background rounded-md hover:bg-foreground/85 transition-colors duration-300">
                    Add
                  </button>
                </form>
              )}

              <div className="max-h-52 sm:max-h-44 overflow-y-auto">
                {setlists.map((setlist) => (
                  <div
                    key={setlist.id}
                    className={`flex items-center justify-between px-4 py-3 sm:py-2 cursor-pointer text-xs transition-all duration-200 group ${
                      activeSetlist === setlist.id
                        ? "bg-foreground/5 text-foreground border-l-2 border-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                    }`}
                    onClick={() => selectSetlist(setlist.id)}
                  >
                    <span className="truncate tracking-wide">{setlist.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSetlist(setlist.id); }}
                      className="p-1.5 sm:p-1 text-muted-foreground/40 hover:text-destructive active:text-destructive transition-colors duration-200"
                      aria-label="Delete setlist"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Charts</span>
                {activeSetlist && (
                  <button
                    onClick={() => setShowNewChart(!showNewChart)}
                    className="p-1.5 sm:p-0.5 text-muted-foreground hover:text-foreground transition-colors duration-300"
                    aria-label="New chart"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                )}
              </div>

              {showNewChart && (
                <form onSubmit={handleCreateChart} className="px-3 pb-3 flex gap-2">
                  <input
                    type="text"
                    value={newChartTitle}
                    onChange={(e) => setNewChartTitle(e.target.value)}
                    placeholder="Title"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-none focus:border-foreground/40 transition-colors duration-300"
                    autoFocus
                    required
                  />
                  <button type="submit" className="px-2.5 py-1.5 text-xs bg-foreground text-background rounded-md hover:bg-foreground/85 transition-colors duration-300">
                    Add
                  </button>
                </form>
              )}

              {!activeSetlist ? (
                <div className="px-4 py-6 text-xs text-muted-foreground/60 text-center">
                  Select a setlist
                </div>
              ) : charts.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground/60 text-center">
                  No charts yet
                </div>
              ) : (
                charts.map((chart) => (
                  <div
                    key={chart.id}
                    className={`flex items-center justify-between px-4 py-3 sm:py-2 cursor-pointer text-xs transition-all duration-200 group ${
                      activeChart === chart.id
                        ? "bg-foreground/5 text-foreground border-l-2 border-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                    }`}
                    onClick={() => handleSelectChart(chart.id)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                      <span className="truncate tracking-wide">{chart.title}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteChart(chart.id); }}
                      className="p-1.5 sm:p-1 text-muted-foreground/40 hover:text-destructive active:text-destructive transition-colors duration-200"
                      aria-label="Delete chart"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {activeChartData ? (
            <ChartEditor chart={activeChartData} onUpdate={handleUpdateChart} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-muted-foreground/20">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
                <p className="text-sm text-muted-foreground/60">Select or create a chart</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
