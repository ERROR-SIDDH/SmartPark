"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    CalendarRange, MapPin, Clock, Loader2, X, RefreshCw, Car,
} from "lucide-react";

interface Booking {
    _id: string;
    startTime: string;
    endTime: string;
    status: string;
    createdAt: string;
    parkingGroundId: { _id: string; name: string; address: string } | null;
    slotId: { slotNumber: string; vehicleType: string } | null;
    vehicleId: { vehicleNumber: string; vehicleType: string } | null;
}

export default function BookingsPage() {
    const { token } = useAuthStore();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [acting, setActing] = useState("");

    const fetchBookings = () => {
        const params = filter ? `?status=${filter}` : "";
        fetch(`/api/bookings${params}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then(setBookings)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchBookings(); }, [token, filter]);

    const cancelBooking = async (id: string) => {
        if (!confirm("Cancel this booking?")) return;
        setActing(id);
        await fetch(`/api/bookings/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: "cancel" }),
        });
        fetchBookings();
        setActing("");
    };

    const statusVariants: Record<string, "success" | "destructive" | "secondary"> = {
        active: "success",
        cancelled: "destructive",
        completed: "secondary",
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">My Bookings</h1>
                <p className="text-sm text-muted-foreground mt-1">View and manage your parking bookings</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {[
                    { value: "", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "completed", label: "Completed" },
                    { value: "cancelled", label: "Cancelled" },
                ].map((f) => (
                    <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)}>
                        {f.label}
                    </Button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : bookings.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-16 text-center">
                        <CalendarRange className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">No Bookings Found</h3>
                        <p className="text-sm text-muted-foreground">
                            {filter ? `No ${filter} bookings` : "You haven't made any bookings yet"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {bookings.map((b) => (
                        <Card key={b._id} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/10 transition-all">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex gap-4 flex-1">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${b.status === "active" ? "bg-emerald-500/10" : b.status === "cancelled" ? "bg-red-500/10" : "bg-muted"
                                            }`}>
                                            <MapPin className={`h-5 w-5 ${b.status === "active" ? "text-emerald-500" : b.status === "cancelled" ? "text-red-400" : "text-muted-foreground"
                                                }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold">{b.parkingGroundId?.name || "Parking Ground"}</h3>
                                                <Badge variant={statusVariants[b.status] || "secondary"} className="capitalize">{b.status}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                                                <MapPin className="h-3 w-3" /> {b.parkingGroundId?.address || "—"}
                                            </p>
                                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Car className="h-3 w-3" />
                                                    Slot: <strong>{b.slotId?.slotNumber || "—"}</strong>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(b.startTime).toLocaleDateString()} • {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(b.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                            {b.vehicleId && (
                                                <Badge variant="outline" className="text-[10px] mt-2">{b.vehicleId.vehicleNumber}</Badge>
                                            )}
                                        </div>
                                    </div>

                                    {b.status === "active" && (
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => cancelBooking(b._id)} disabled={acting === b._id}>
                                            {acting === b._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
