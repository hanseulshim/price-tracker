"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/stores", label: "Stores" },
  { href: "/items", label: "Items" },
  { href: "/categories", label: "Categories" },
  { href: "/receipts", label: "Receipts" },
  { href: "/compare", label: "Compare" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center gap-6 h-14">
          <Link href="/" className="flex items-center gap-2 font-semibold text-primary shrink-0">
            <ShoppingCart className="h-5 w-5" />
            <span>Price Tracker</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  pathname === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
