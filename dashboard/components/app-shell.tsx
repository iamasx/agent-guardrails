import Link from "next/link";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/signin", label: "Sign In" },
  { href: "/agents", label: "Agents" },
  { href: "/agents/new", label: "New Policy" },
  { href: "/activity", label: "Activity" },
  { href: "/incidents", label: "Incidents" },
];

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1 className="title">{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
      </header>
      <nav className="nav" aria-label="Dashboard">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </nav>
      <section className="card">{children}</section>
    </main>
  );
}
