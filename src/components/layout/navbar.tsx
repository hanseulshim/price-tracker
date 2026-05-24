"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, LayoutDashboard, Store, Tag, Folder, Receipt, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/items", label: "Items", icon: Tag },
  { href: "/categories", label: "Categories", icon: Folder },
  { href: "/receipts", label: "Receipts", icon: Receipt },
  { href: "/compare", label: "Compare", icon: BarChart2 },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-4 h-14">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary shrink-0">
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">Price Tracker</span>
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
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title={item.label}
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
