"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, ParkingSquare, Users, Calendar, Car } from "lucide-react";

interface Analytics {
    totalUsers: number;
    activeUsers: number;
    totalGrounds: number;
    totalSlots: number;
    availableSlots: number;
    bookedSlots: number;
    blockedSlots: number;
    totalBookings: number;
    activeBookings: number;
    cancelledBookings: number;
    bookingsByDay: { _id: string; count: number }[];
    vehicleTypeDist: { _id: string; count: number }[];
    occupancyByGround: { name: string; total: number; booked: number }[];
}

export default function AnalyticsPage() {
    const { token } = useAuthStore();
    const [data, setData] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/analytics", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then(setData)
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Activity className="h-8 w-8 animate-pulse text-primary" /></div>;
    }

    const occupancyRate = data && data.totalSlots > 0
        ? Math.round((data.bookedSlots / data.totalSlots) * 100)
        : 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                <p className="text-muted-foreground mt-1">Detailed insights into parking operations</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Occupancy Rate", value: `${occupancyRate}%`, icon: TrendingUp, color: occupancyRate > 80 ? "text-red-400" : "text-emerald-500" },
                    { label: "Total Bookings", value: data?.totalBookings || 0, icon: Calendar, color: "text-chart-1" },
                    { label: "Active Users", value: data?.activeUsers || 0, icon: Users, color: "text-chart-2" },
                    { label: "Parking Grounds", value: data?.totalGrounds || 0, icon: ParkingSquare, color: "text-chart-4" },
                ].map((m, i) => (
                    <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">{m.label}</CardTitle>
                            <m.icon className={`h-4 w-4 ${m.color}`} />
                        </CardHeader>
                        <CardContent><div className="text-2xl font-bold">{m.value}</div></CardContent>
                    </Card>
                ))}
            </div>

            {/* Slot Status Breakdown */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader><CardTitle className="text-lg">Slot Status Breakdown</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-6">
                        {[
                            { label: "Available", value: data?.availableSlots || 0, color: "bg-emerald-500" },
                            { label: "Booked", value: data?.bookedSlots || 0, color: "bg-red-500" },
                            { label: "Blocked", value: data?.blockedSlots || 0, color: "bg-gray-500" },
                        ].map((s, i) => (
                            <div key={i} className="text-center">
                                <div className="text-3xl font-bold mb-1">{s.value}</div>
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data && data.totalSlots > 0 && (
                        <div className="mt-6 h-4 rounded-full overflow-hidden flex bg-muted">
                            <div className="bg-emerald-500 transition-all" style={{ width: `${(data.availableSlots / data.totalSlots) * 100}%` }} />
                            <div className="bg-red-500 transition-all" style={{ width: `${(data.bookedSlots / data.totalSlots) * 100}%` }} />
                            <div className="bg-gray-500 transition-all" style={{ width: `${(data.blockedSlots / data.totalSlots) * 100}%` }} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Booking Trends */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader><CardTitle className="text-lg">Booking Trends (Last 7 Days)</CardTitle></CardHeader>
                <CardContent>
                    {data?.bookingsByDay && data.bookingsByDay.length > 0 ? (
                        <div className="flex items-end gap-2 h-40">
                            {data.bookingsByDay.map((b, i) => {
                                const max = Math.max(...data.bookingsByDay.map((d) => d.count), 1);
                                const height = (b.count / max) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-xs text-muted-foreground">{b.count}</span>
                                        <div
                                            className="w-full bg-gradient-to-t from-primary/60 to-primary rounded-t-md transition-all duration-500"
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                        />
                                        <span className="text-[10px] text-muted-foreground">{b._id.slice(5)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">No booking data yet.</p>
                    )}
                </CardContent>
            </Card>

            {/* Occupancy Heatmap */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader><CardTitle className="text-lg">Occupancy by Location</CardTitle></CardHeader>
                <CardContent>
                    {data?.occupancyByGround && data.occupancyByGround.length > 0 ? (
                        <div className="space-y-3">
                            {data.occupancyByGround.map((g, i) => {
                                const pct = g.total > 0 ? Math.round((g.booked / g.total) * 100) : 0;
                                return (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className="w-32 text-sm font-medium truncate">{g.name}</div>
                                        <div className="flex-1 h-8 rounded-lg bg-muted overflow-hidden relative">
                                            <div
                                                className={`h-full rounded-lg transition-all duration-700 ${pct > 80 ? "bg-gradient-to-r from-red-500 to-red-400"
                                                        : pct > 50 ? "bg-gradient-to-r from-amber-500 to-amber-400"
                                                            : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                                    }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                                {g.booked}/{g.total} ({pct}%)
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">No parking grounds configured.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
