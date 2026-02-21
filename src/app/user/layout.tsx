"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { Button } from "@/components/ui/button";
import {
    Home, Search, CalendarRange, Car, User,
    LogOut, Sun, Moon, ParkingSquare,
} from "lucide-react";

const navItems = [
    { href: "/user/home", label: "Home", icon: Home },
    { href: "/user/search", label: "Find Parking", icon: Search },
    { href: "/user/bookings", label: "My Bookings", icon: CalendarRange },
    { href: "/user/vehicles", label: "Vehicles", icon: Car },
    { href: "/user/profile", label: "Profile", icon: User },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, user, logout } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isAuthenticated || user?.role !== "USER") {
            router.push("/login");
        }
    }, [isAuthenticated, user, router]);

    if (!isAuthenticated || user?.role !== "USER") return null;

    return (
        <div className="min-h-screen bg-background">
            {/* Top navbar */}
            <nav className="sticky top-0 z-40 border-b border-border/50 bg-card/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-chart-2 to-primary flex items-center justify-center">
                                <ParkingSquare className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-bold text-lg hidden sm:block">SmartPark</span>
                        </div>

                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                                return (
                                    <Link key={item.href} href={item.href}>
                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                                ? "bg-primary/10 text-primary"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            }`}>
                                            <item.icon className="h-4 w-4" />
                                            {item.label}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground hidden sm:block">
                                {user.name} <span className="text-xs opacity-60">({user.employeeCode})</span>
                            </span>
                            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
                                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { logout(); router.push("/"); }}>
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile bottom nav */}
            <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border/50 bg-card/90 backdrop-blur-xl">
                <div className="flex items-center justify-around py-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href}>
                                <div className={`flex flex-col items-center gap-0.5 px-3 py-1 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                                    <item.icon className="h-5 w-5" />
                                    <span className="text-[10px]">{item.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
                {children}
            </main>
        </div>
    );
}
