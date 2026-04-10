import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-8 py-5">
        <span className="text-sm font-medium tracking-widest uppercase text-foreground/70">BandApp</span>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm tracking-wide text-muted-foreground hover:text-foreground transition-colors duration-300"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 text-sm tracking-wide bg-foreground text-background rounded-md hover:bg-foreground/85 transition-colors duration-300"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-8">
        <div className="text-center max-w-xl">
          <div className="inline-block mb-8 text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h2 className="text-4xl font-light leading-tight mb-6 tracking-tight">
            Charts & setlists,<br />
            <span className="font-normal">all in one place.</span>
          </h2>
          <p className="text-base text-muted-foreground mb-10 leading-relaxed max-w-md mx-auto">
            Create or join your band. Organize setlists, write charts, and keep
            everything your group needs&mdash;together.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 text-sm tracking-wide bg-foreground text-background rounded-md hover:bg-foreground/85 transition-colors duration-300"
          >
            Get Started
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required</p>
        </div>
      </main>

      <footer className="px-8 py-6 text-center">
        <p className="text-xs text-muted-foreground/60 tracking-wide">Built for musicians, by musicians.</p>
      </footer>
    </div>
  );
}
