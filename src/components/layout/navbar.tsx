"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ShoppingCart, Store, Tag, Folder, Receipt, BarChart2, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/", label: "Compare", icon: BarChart2 },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/items", label: "Items", icon: Tag },
];

const manageNav = [
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/categories", label: "Categories", icon: Folder },
];

export function NavBar() {
  const pathname = usePathname();
  const [manageOpen, setManageOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const manageActive = manageNav.some((item) => pathname === item.href);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setManageOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="bg-emerald-900 dark:bg-emerald-950 sticky top-0 z-50 shadow-md">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-4 h-14">
          <Link href="/" className="flex items-center gap-2 font-bold text-white shrink-0">
            <ShoppingCart className="h-5 w-5 text-emerald-300" />
            <span className="hidden sm:inline tracking-tight">PriceTracker</span>
          </Link>
          <nav className="flex items-center gap-0.5 flex-1">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-white/20 text-white"
                      : "text-emerald-200 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}

            {/* Manage dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setManageOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                  manageActive || manageOpen
                    ? "bg-white/20 text-white"
                    : "text-emerald-200 hover:text-white hover:bg-white/10"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">Manage</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", manageOpen && "rotate-180")} />
              </button>
              {manageOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-900 border rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                  {manageNav.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setManageOpen(false)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                          active
                            ? "text-emerald-700 font-medium bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
