"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard, ParkingSquare, Users, BarChart3,
    LogOut, Sun, Moon, Car, ChevronRight, Loader2, ScanLine,
} from "lucide-react";

const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/parking", label: "Parking Grounds", icon: ParkingSquare },
    { href: "/admin/scanner", label: "QR Scanner", icon: ScanLine },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, user, logout } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const router = useRouter();
    const pathname = usePathname();
    const [hydrated, setHydrated] = useState(false);

    // Wait for Zustand to hydrate from localStorage before checking auth
    useEffect(() => {
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated && (!isAuthenticated || user?.role !== "ADMIN")) {
            router.push("/admin-login");
        }
    }, [hydrated, isAuthenticated, user, router]);

    // Show loading while Zustand is hydrating from localStorage
    if (!hydrated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || user?.role !== "ADMIN") return null;

    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border/50 bg-card/30 backdrop-blur-xl flex flex-col">
                <div className="p-6 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-1 flex items-center justify-center">
                            <Car className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                            <div className="font-bold text-sm">SmartPark</div>
                            <div className="text-xs text-muted-foreground">Admin Panel</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link key={item.href} href={item.href}>
                                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    }`}>
                                    <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                                    {item.label}
                                    {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border/50 space-y-2">
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleTheme}>
                        {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                        {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={async () => { await logout(); router.push("/"); }}>
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
