"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import {
    CalendarRange, MapPin, Clock, Loader2, X, Car, QrCode, CheckCircle, LogIn, LogOut as LogOutIcon,
    Navigation,
} from "lucide-react";

/** Prefer coordinates for accurate pin; fall back to address. GeoJSON coordinates are [longitude, latitude]. */
function getDirectionsUrl(ground: { address?: string; location?: { coordinates: [number, number] } } | null | undefined): string | null {
    if (!ground) return null;
    const coords = ground.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
        const lat = coords[1];
        const lng = coords[0];
        return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    if (ground.address?.trim()) {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ground.address.trim())}`;
    }
    return null;
}

interface Booking {
    _id: string;
    startTime: string;
    endTime: string;
    status: string;
    qrToken?: string;
    checkedIn?: string | null;
    checkedOut?: string | null;
    createdAt: string;
    parkingGroundId: { _id: string; name: string; address: string; location?: { coordinates: [number, number] } } | null;
    slotId: { slotNumber: string; vehicleType: string } | null;
    vehicleId: { vehicleNumber: string; vehicleType: string } | null;
}

export default function BookingsPage() {
    const { token } = useAuthStore();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("");
    const [acting, setActing] = useState("");
    const [qrModal, setQrModal] = useState<Booking | null>(null);

    const fetchBookings = () => {
        const params = filter ? `?status=${filter}` : "";
        fetch(`/api/bookings${params}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => setBookings(Array.isArray(data) ? data : []))
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
                <h1 className="text-xl sm:text-2xl font-bold">My Bookings</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">View and manage your parking bookings</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
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
                            <CardContent className="p-4 sm:p-5">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                    <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
                                        <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${b.status === "active" ? "bg-emerald-500/10" : b.status === "cancelled" ? "bg-red-500/10" : "bg-muted"
                                            }`}>
                                            <MapPin className={`h-4 w-4 sm:h-5 sm:w-5 ${b.status === "active" ? "text-emerald-500" : b.status === "cancelled" ? "text-red-400" : "text-muted-foreground"
                                                }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h3 className="font-semibold text-sm sm:text-base truncate">{b.parkingGroundId?.name || "Parking Ground"}</h3>
                                                <Badge variant={statusVariants[b.status] || "secondary"} className="capitalize text-[10px]">{b.status}</Badge>
                                                {b.checkedIn && !b.checkedOut && (
                                                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px] hidden sm:flex">
                                                        <LogIn className="h-2.5 w-2.5 mr-1" /> Checked In
                                                    </Badge>
                                                )}
                                                {b.checkedOut && (
                                                    <Badge variant="outline" className="text-muted-foreground text-[10px] hidden sm:flex">
                                                        <LogOutIcon className="h-2.5 w-2.5 mr-1" /> Checked Out
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2 truncate">
                                                <MapPin className="h-3 w-3 flex-shrink-0" /> {b.parkingGroundId?.address || "—"}
                                            </p>
                                            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-muted-foreground">
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

                                    <div className="flex sm:flex-col gap-1.5 self-end sm:self-start">
                                        {getDirectionsUrl(b.parkingGroundId ?? undefined) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-primary/30 text-primary hover:bg-primary/10"
                                                asChild
                                            >
                                                <a href={getDirectionsUrl(b.parkingGroundId ?? undefined)!} target="_blank" rel="noopener noreferrer">
                                                    <Navigation className="h-4 w-4 mr-1" /> Get directions
                                                </a>
                                            </Button>
                                        )}
                                        {/* QR Code Button — only for active bookings that haven't checked out */}
                                        {b.status === "active" && b.qrToken && !b.checkedOut && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-primary/30 text-primary hover:bg-primary/10"
                                                onClick={() => setQrModal(b)}
                                            >
                                                <QrCode className="h-4 w-4 mr-1" /> Show QR
                                            </Button>
                                        )}
                                        {b.status === "active" && (
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => cancelBooking(b._id)} disabled={acting === b._id}>
                                                {acting === b._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* QR Code Modal */}
            {qrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setQrModal(null)}>
                    <div className="bg-card border border-border/50 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center mb-6">
                            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                <QrCode className="h-7 w-7 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold">Parking QR Pass</h2>
                            <p className="text-sm text-muted-foreground mt-1">Show this to the parking attendant</p>
                        </div>

                        {/* QR Code */}
                        <div className="bg-white rounded-xl p-4 sm:p-6 mb-6 flex justify-center">
                            <QRCodeSVG
                                value={qrModal.qrToken || ""}
                                size={180}
                                level="H"
                                includeMargin={false}
                                className="w-full max-w-[220px] h-auto"
                            />
                        </div>

                        {/* Booking Details */}
                        <div className="space-y-2 text-sm mb-6">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Location</span>
                                <span className="font-medium">{qrModal.parkingGroundId?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Slot</span>
                                <span className="font-medium">{qrModal.slotId?.slotNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Vehicle</span>
                                <span className="font-medium">{qrModal.vehicleId?.vehicleNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Date</span>
                                <span className="font-medium">{new Date(qrModal.startTime).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Time</span>
                                <span className="font-medium">
                                    {new Date(qrModal.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(qrModal.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                            {qrModal.checkedIn && (
                                <div className="flex justify-between text-emerald-500">
                                    <span>Checked In</span>
                                    <span className="font-medium flex items-center gap-1">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        {new Date(qrModal.checkedIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            )}
                        </div>

                        <Button className="w-full" variant="outline" onClick={() => setQrModal(null)}>
                            Close
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
