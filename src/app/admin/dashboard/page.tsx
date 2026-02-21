"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ParkingSquare, Users, Calendar, TrendingUp,
    Car, Bike, Zap, Activity,
} from "lucide-react";

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

export default function AdminDashboard() {
    const { token } = useAuthStore();
    const [data, setData] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/analytics", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Activity className="h-8 w-8 animate-pulse text-primary" />
            </div>
        );
    }

    const stats = [
        { label: "Total Parking Grounds", value: data?.totalGrounds || 0, icon: ParkingSquare, color: "text-chart-1" },
        { label: "Total Slots", value: data?.totalSlots || 0, icon: Car, color: "text-chart-2" },
        { label: "Available Slots", value: data?.availableSlots || 0, icon: TrendingUp, color: "text-emerald-500" },
        { label: "Active Bookings", value: data?.activeBookings || 0, icon: Calendar, color: "text-chart-4" },
        { label: "Registered Users", value: data?.totalUsers || 0, icon: Users, color: "text-chart-5" },
        { label: "Booked Slots", value: data?.bookedSlots || 0, icon: Activity, color: "text-red-400" },
    ];

    const vehicleIcons: Record<string, typeof Car> = { car: Car, bike: Bike, ev: Zap, pickup: Car };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-1">Overview of your parking infrastructure</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((s, i) => (
                    <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                            <s.icon className={`h-5 w-5 ${s.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{s.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Occupancy by Ground */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg">Occupancy by Parking Ground</CardTitle>
                </CardHeader>
                <CardContent>
                    {data?.occupancyByGround && data.occupancyByGround.length > 0 ? (
                        <div className="space-y-4">
                            {data.occupancyByGround.map((g, i) => {
                                const pct = g.total > 0 ? Math.round((g.booked / g.total) * 100) : 0;
                                return (
                                    <div key={i} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{g.name}</span>
                                            <span className="text-muted-foreground">{g.booked}/{g.total} slots ({pct}%)</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"
                                                    }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">No parking grounds yet. Create one to see data.</p>
                    )}
                </CardContent>
            </Card>

            {/* Vehicle Distribution + Booking Trend */}
            <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Vehicle Type Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data?.vehicleTypeDist && data.vehicleTypeDist.length > 0 ? (
                            <div className="space-y-3">
                                {data.vehicleTypeDist.map((v, i) => {
                                    const Icon = vehicleIcons[v._id] || Car;
                                    return (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-primary" />
                                                <span className="text-sm capitalize">{v._id}</span>
                                            </div>
                                            <Badge variant="secondary">{v.count} slots</Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">No slots configured yet.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Bookings (7 days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data?.bookingsByDay && data.bookingsByDay.length > 0 ? (
                            <div className="space-y-2">
                                {data.bookingsByDay.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">{b._id}</span>
                                        <Badge variant="outline">{b.count} bookings</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">No bookings yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
