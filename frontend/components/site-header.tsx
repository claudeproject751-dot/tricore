"use client";

import { Github, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiStatus } from "@/components/api-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/analyze", label: "Analyze" },
  { href: "/batch", label: "Batch" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 ease-product",
        scrolled
          ? "border-b border-border bg-canvas/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="container flex h-14 items-center gap-4 sm:h-16">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
          <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
            EmotionSense
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-ink" : "text-muted hover:text-body",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ApiStatus />
          <Button variant="ghost" size="icon" asChild className="hidden text-muted hover:text-ink sm:inline-flex">
            <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer" aria-label="API documentation">
              <Github className="size-4" />
            </a>
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-border bg-canvas/95 backdrop-blur-xl md:hidden"
        >
          <ul className="container flex flex-col py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm transition-colors",
                    pathname === item.href ? "bg-elevated text-ink" : "text-body hover:bg-elevated",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-7 place-items-center overflow-hidden rounded-lg border border-border bg-elevated"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none">
        <circle cx="12" cy="12" r="9" stroke="hsl(var(--ink))" strokeWidth="1.4" opacity="0.85" />
        <path
          d="M8.2 14.2c1.1 1.3 2.4 2 3.8 2s2.7-.7 3.8-2"
          stroke="hsl(var(--joy))"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="9" cy="9.8" r="1.15" fill="hsl(var(--love))" />
        <circle cx="15" cy="9.8" r="1.15" fill="hsl(var(--surprise))" />
      </svg>
    </span>
  );
}
