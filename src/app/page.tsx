"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Shield, ArrowRight, Zap, MapPin, BarChart3 } from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && isAuthenticated && user) {
      router.push(user.role === "ADMIN" ? "/admin/dashboard" : "/user/home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuthenticated, user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-chart-1/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-chart-2/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-6 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-1 flex items-center justify-center">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">SmartPark</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => router.push("/login")}>
              Employee Login
            </Button>
            <Button onClick={() => router.push("/admin-login")} className="bg-gradient-to-r from-primary to-chart-1 border-0 hover:opacity-90">
              <Shield className="mr-2 h-4 w-4" /> Admin
            </Button>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-8 pt-20 pb-16 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-6 backdrop-blur-sm">
            <Zap className="h-3.5 w-3.5 text-chart-1" />
            Intelligent Parking Management
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Park <span className="bg-gradient-to-r from-primary to-chart-1 bg-clip-text text-transparent">Smarter</span>,
            <br />Not Harder
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Enterprise-grade parking management with real-time availability, interactive slot maps, smart discovery, and powerful analytics.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => router.push("/login")} className="bg-gradient-to-r from-primary to-chart-1 border-0 hover:opacity-90 text-base px-8">
              Book a Spot <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push("/admin-login")} className="text-base px-8">
              Admin Portal
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="px-8 pb-20 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MapPin, title: "Smart Discovery", desc: "Find the nearest parking with real-time availability and EV charging support." },
              { icon: Car, title: "Interactive Booking", desc: "Visual slot picker with conflict detection and instant confirmation." },
              { icon: BarChart3, title: "Live Analytics", desc: "Occupancy heatmaps, booking trends, and revenue insights in real-time." },
            ].map((f, i) => (
              <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group">
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-chart-1/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{f.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
