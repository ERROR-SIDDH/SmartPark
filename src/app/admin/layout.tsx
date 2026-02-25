"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard, ParkingSquare, Users, BarChart3,
    LogOut, Sun, Moon, Car, ChevronRight, Loader2, ScanLine, Menu, X,
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
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => { setHydrated(true); }, []);

    useEffect(() => {
        if (hydrated && (!isAuthenticated || user?.role !== "ADMIN")) {
            router.push("/admin-login");
        }
    }, [hydrated, isAuthenticated, user, router]);

    // Close sidebar on route change (mobile)
    useEffect(() => { setSidebarOpen(false); }, [pathname]);

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

    const SidebarContent = () => (
        <>
            <div className="p-6 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-1 flex items-center justify-center">
                        <Car className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                        <div className="font-bold text-sm">SmartPark</div>
                        <div className="text-xs text-muted-foreground">Admin Panel</div>
                    </div>
                    {/* Close button — mobile only */}
                    <Button variant="ghost" size="icon" className="ml-auto md:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
                        <X className="h-4 w-4" />
                    </Button>
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
        </>
    );

    return (
        <div className="flex min-h-screen bg-background">
            {/* Desktop sidebar — hidden on mobile */}
            <aside className="hidden md:flex w-64 border-r border-border/50 bg-card/30 backdrop-blur-xl flex-col fixed inset-y-0 left-0 z-30">
                <SidebarContent />
            </aside>

            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Mobile slide-out sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border/50 flex flex-col transition-transform duration-300 ease-in-out md:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}>
                <SidebarContent />
            </aside>

            {/* Main content */}
            <main className="flex-1 md:ml-64 overflow-y-auto">
                {/* Mobile top bar */}
                <div className="sticky top-0 z-20 md:hidden border-b border-border/50 bg-card/80 backdrop-blur-xl">
                    <div className="flex items-center justify-between px-4 h-14">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSidebarOpen(true)}>
                            <Menu className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-chart-1 flex items-center justify-center">
                                <Car className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <span className="font-bold text-sm">SmartPark</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
                            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                <div className="p-4 sm:p-6 lg:p-8">{children}</div>
            </main>
        </div>
    );
}
