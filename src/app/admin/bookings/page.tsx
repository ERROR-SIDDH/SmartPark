"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Search, Loader2, Calendar, MapPin, Car, Clock, User,
    CheckCircle, XCircle, Timer, QrCode, LogIn, LogOut as LogOutIcon, X,
} from "lucide-react";

interface BookingEntry {
    _id: string;
    status: string;
    startTime: string;
    endTime: string;
    qrToken?: string;
    checkedIn?: string | null;
    checkedOut?: string | null;
    createdAt: string;
    userId: { name: string; email: string; employeeCode: string; department: string } | null;
    vehicleId: { vehicleNumber: string; vehicleType: string; color: string } | null;
    parkingGroundId: { name: string; address: string } | null;
    slotId: { slotNumber: string; vehicleType: string } | null;
}

export default function AdminBookingsPage() {
    const { token } = useAuthStore();
    const [bookings, setBookings] = useState<BookingEntry[]>([]);
    const [grounds, setGrounds] = useState<{ _id: string; name: string }[]>([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [selectedGround, setSelectedGround] = useState("");
    const [search, setSearch] = useState("");
    const [acting, setActing] = useState("");

    useEffect(() => {
        fetch("/api/parking", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => setGrounds(Array.isArray(data) ? data : []));
    }, [token]);

    const fetchBookings = (p = page, s = search, g = selectedGround) => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(p), limit: "20" });
        if (filter) params.set("status", filter);
        if (s) params.set("search", s);
        if (g) params.set("groundId", g);

        fetch(`/api/admin/bookings?${params}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                setBookings(Array.isArray(data.bookings) ? data.bookings : []);
                setTotal(data.total || 0);
                setCounts(data.counts || {});
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchBookings(1); }, [token, filter, selectedGround]);

    const cancelBooking = async (id: string) => {
        if (!confirm("Cancel this booking?")) return;
        setActing(id);
        await fetch(`/api/bookings/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: "cancel" }),
        });
        fetchBookings(page);
        setActing("");
    };

    const handleSearch = () => { setPage(1); fetchBookings(1, search); };

    const statusStyles: Record<string, { variant: "success" | "destructive" | "secondary" | "warning"; icon: typeof CheckCircle }> = {
        active: { variant: "success", icon: Timer },
        completed: { variant: "secondary", icon: CheckCircle },
        cancelled: { variant: "destructive", icon: XCircle },
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bookings</h1>
                    <p className="text-sm text-muted-foreground mt-1">{total} total bookings</p>
                </div>
                {/* Status summary badges */}
                <div className="flex gap-2 flex-wrap">
                    {Object.entries(counts).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="capitalize text-xs">
                            {k}: {v}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Ground filter */}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={selectedGround === "" ? "default" : "outline"} onClick={() => { setSelectedGround(""); setPage(1); }}>
                    <MapPin className="h-3.5 w-3.5 mr-1" /> All Grounds
                </Button>
                {grounds.map((g) => (
                    <Button key={g._id} size="sm" variant={selectedGround === g._id ? "default" : "outline"} onClick={() => { setSelectedGround(g._id); setPage(1); }}>
                        <MapPin className="h-3.5 w-3.5 mr-1" /> {g.name}
                    </Button>
                ))}
            </div>

            {/* Status filters */}
            <div className="flex flex-wrap gap-2">
                {[
                    { v: "", l: "All", icon: Calendar },
                    { v: "active", l: "Active", icon: Timer },
                    { v: "completed", l: "Completed", icon: CheckCircle },
                    { v: "cancelled", l: "Cancelled", icon: XCircle },
                ].map((f) => (
                    <Button key={f.v} size="sm" variant={filter === f.v ? "default" : "outline"} onClick={() => { setFilter(f.v); setPage(1); }}>
                        <f.icon className="h-3.5 w-3.5 mr-1" /> {f.l}
                    </Button>
                ))}
            </div>

            {/* Search */}
            <div className="flex gap-2">
                <Input
                    placeholder="Search by employee name, email, vehicle..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1 sm:max-w-md"
                />
                <Button variant="outline" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
            </div>

            {/* Bookings List */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : bookings.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-16 text-center">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">No Bookings Found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {filter ? `No ${filter} bookings` : "No bookings yet"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {bookings.map((b) => {
                        const ss = statusStyles[b.status] || statusStyles.active;
                        const StatusIcon = ss.icon;
                        return (
                            <Card key={b._id} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/10 transition-all">
                                <CardContent className="p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                                        {/* Status icon */}
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${b.status === "active" ? "bg-emerald-500/10" :
                                            b.status === "cancelled" ? "bg-red-500/10" : "bg-muted"
                                            }`}>
                                            <StatusIcon className={`h-5 w-5 ${b.status === "active" ? "text-emerald-500" :
                                                b.status === "cancelled" ? "text-red-400" : "text-muted-foreground"
                                                }`} />
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <Badge variant={ss.variant} className="capitalize text-[10px]">{b.status}</Badge>
                                                {b.checkedIn && !b.checkedOut && (
                                                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">
                                                        <LogIn className="h-2.5 w-2.5 mr-1" /> In
                                                    </Badge>
                                                )}
                                                {b.checkedOut && (
                                                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                                        <LogOutIcon className="h-2.5 w-2.5 mr-1" /> Out
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* User line */}
                                            <div className="flex items-center gap-2 text-sm mb-1">
                                                <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                <span className="font-medium truncate">
                                                    {b.userId?.name || "Unknown"}{" "}
                                                    <span className="text-muted-foreground font-normal">
                                                        ({b.userId?.employeeCode || "—"})
                                                    </span>
                                                </span>
                                            </div>

                                            {/* Location & Slot */}
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" /> {b.parkingGroundId?.name || "—"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Car className="h-3 w-3" /> Slot {b.slotId?.slotNumber || "—"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Car className="h-3 w-3" /> {b.vehicleId?.vehicleNumber || "—"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(b.startTime).toLocaleDateString()} •{" "}
                                                    {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(b.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1.5 flex-shrink-0 self-end sm:self-start">
                                            {b.qrToken && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    <QrCode className="h-2.5 w-2.5 mr-1" /> QR
                                                </Badge>
                                            )}
                                            {b.status === "active" && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive h-7 px-2"
                                                    onClick={() => cancelBooking(b._id)}
                                                    disabled={acting === b._id}
                                                >
                                                    {acting === b._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                                    <span className="ml-1 text-xs">Cancel</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {total > 20 && (
                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchBookings(p); }}>Prev</Button>
                    <span className="text-sm text-muted-foreground flex items-center">Page {page} of {Math.ceil(total / 20)}</span>
                    <Button variant="outline" size="sm" disabled={bookings.length < 20} onClick={() => { const p = page + 1; setPage(p); fetchBookings(p); }}>Next</Button>
                </div>
            )}
        </div>
    );
}
