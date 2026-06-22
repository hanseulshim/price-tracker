"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Store, Folder, Receipt, BarChart2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Compare", icon: BarChart2 },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/items", label: "Items", icon: Tag },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/categories", label: "Categories", icon: Folder },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-emerald-900 dark:bg-emerald-950 sticky top-0 z-50 shadow-md">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-4 h-14">
          <Link href="/" className="flex items-center gap-2 font-bold text-white shrink-0">
            <ShoppingCart className="h-5 w-5 text-emerald-300" />
            <span className="hidden sm:inline tracking-tight">PriceTracker</span>
          </Link>
          <nav className="flex items-center gap-0.5 flex-1">
            {navItems.map((item) => {
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
          </nav>
        </div>
      </div>
    </header>
  );
}
