"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  BookOpen,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sideItems = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/urunler", label: "Ürünler", icon: ShoppingBag },
  { href: "/acik-hesaplar", label: "Hesaplar", icon: BookOpen },
  { href: "/emanet", label: "Emanet", icon: PackageCheck },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/giris") return null;
  const isSatisActive = pathname.startsWith("/satis");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">

        {/* Left two items */}
        {sideItems.slice(0, 2).map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* FAB — Satış */}
        <div className="flex flex-col items-center">
          <Link
            href="/satis"
            className={cn(
              "-mt-7 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
              isSatisActive
                ? "bg-primary shadow-primary/50"
                : "bg-primary shadow-primary/30"
            )}
          >
            <ShoppingCart className="h-6 w-6 text-white" />
          </Link>
          <span
            className={cn(
              "mt-0.5 text-xs font-semibold",
              isSatisActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            Satış
          </span>
        </div>

        {/* Right two items */}
        {sideItems.slice(2).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
