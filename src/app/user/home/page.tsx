"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, CalendarRange, Car, MapPin, ArrowRight, Loader2, Clock } from "lucide-react";

interface Booking {
    _id: string;
    startTime: string;
    endTime: string;
    status: string;
    parkingGroundId: { name: string; address: string };
    slotId: { slotNumber: string; vehicleType: string };
}

export default function UserHome() {
    const { user, token } = useAuthStore();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/bookings?status=active", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => setBookings(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    }, [token]);

    return (
        <div className="space-y-8">
            {/* Welcome */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-chart-2/20 via-primary/10 to-chart-1/20 border border-border/30 p-8">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight relative">
                    Welcome back, <span className="bg-gradient-to-r from-chart-2 to-primary bg-clip-text text-transparent">{user?.name?.split(" ")[0]}</span> 👋
                </h1>
                <p className="text-sm text-muted-foreground mt-2 relative">
                    {bookings.length > 0 ? `You have ${bookings.length} active booking(s)` : "Ready to find a parking spot?"}
                </p>
            </div>

            {/* Quick Actions */}
            <div className="grid sm:grid-cols-3 gap-4">
                {[
                    { icon: Search, title: "Find Parking", desc: "Search nearby spots", href: "/user/search", gradient: "from-chart-2 to-primary" },
                    { icon: CalendarRange, title: "My Bookings", desc: "View & manage", href: "/user/bookings", gradient: "from-chart-1 to-chart-4" },
                    { icon: Car, title: "My Vehicles", desc: "Manage vehicles", href: "/user/vehicles", gradient: "from-primary to-chart-5" },
                ].map((a, i) => (
                    <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all cursor-pointer group" onClick={() => router.push(a.href)}>
                        <CardContent className="p-6">
                            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform`}>
                                <a.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                            </div>
                            <h3 className="font-semibold mb-1">{a.title}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                {a.desc} <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Active Bookings */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Active Bookings</h2>
                {loading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : bookings.length === 0 ? (
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardContent className="py-12 text-center">
                            <CalendarRange className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <h3 className="font-semibold mb-1">No Active Bookings</h3>
                            <p className="text-sm text-muted-foreground mb-4">Find and book a parking spot now</p>
                            <Button onClick={() => router.push("/user/search")} className="bg-gradient-to-r from-chart-2 to-primary hover:opacity-90">
                                <Search className="mr-2 h-4 w-4" /> Find Parking
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {bookings.map((b) => (
                            <Card key={b._id} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate">{b.parkingGroundId?.name || "Parking"}</h3>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                            <Badge variant="success" className="text-[10px] px-1.5 py-0">{b.slotId?.slotNumber}</Badge>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(b.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                        </div>
                                    </div>
                                    <Badge variant="success">Active</Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
