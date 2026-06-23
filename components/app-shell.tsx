"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Code2, FileSearch, GitBranch, History, MessageSquare, ShieldCheck } from "lucide-react";

const navItems = [
  { href: "/", view: "documents", label: "Documents", Icon: FileSearch },
  { href: "/?view=reviews", view: "reviews", label: "Reviews", Icon: MessageSquare },
  { href: "/?view=suggestions", view: "suggestions", label: "Suggestions", Icon: GitBranch },
  { href: "/?view=versions", view: "versions", label: "Versions", Icon: History },
  { href: "/?view=roles", view: "roles", label: "Roles", Icon: ShieldCheck }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") ?? "documents";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Code2 size={19} />
          </span>
          ReviewSync
        </Link>
        <nav className="nav" aria-label="Primary">
          {navItems.map(({ href, view, label, Icon }) => (
            <Link className={`nav-item ${activeView === view ? "active" : ""}`} href={href} key={view}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-card">
          <span className="live-dot" />
          <strong>Live workspace</strong>
          <span>Redis pub/sub and CRDT sync ready</span>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <strong>ReviewSync</strong>
          <div className="topbar-meta">
            <span>Production preview</span>
            <span className="topbar-live"><span className="live-dot" /> Live</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
