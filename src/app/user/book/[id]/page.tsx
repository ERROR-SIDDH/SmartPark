"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MapPin, Calendar, Clock, Loader2, CheckCircle, ArrowLeft, Car } from "lucide-react";

interface SlotData {
    _id: string;
    slotNumber: string;
    vehicleType: string;
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
    rotation: number;
    status: string;
    isEV: boolean;
}

interface ParkingGround {
    _id: string;
    name: string;
    address: string;
    layoutImage: string;
    slots: SlotData[];
}

interface Vehicle {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    isDefault: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    available: "#22c55e",
    booked: "#ef4444",
    blocked: "#6b7280",
};

const TYPE_COLORS: Record<string, string> = {
    car: "#3b82f6",
    bike: "#10b981",
    pickup: "#f59e0b",
    ev: "#8b5cf6",
};

export default function BookSlotPage() {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ground, setGround] = useState<ParkingGround | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("18:00");
    const [showConfirm, setShowConfirm] = useState(false);
    const [booking, setBooking] = useState(false);
    const [booked, setBooked] = useState(false);
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`/api/parking/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
            fetch("/api/vehicles", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        ]).then(([g, v]) => {
            setGround(g);
            setVehicles(v);
            const def = v.find((ve: Vehicle) => ve.isDefault);
            if (def) setSelectedVehicle(def._id);
            else if (v.length > 0) setSelectedVehicle(v[0]._id);
            if (g.layoutImage) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => setBgImage(img);
                img.src = g.layoutImage;
            }
            setLoading(false);
        });
    }, [id, token]);

    // Draw
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !ground) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = "#1a1a2e";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = "#ffffff10";
            for (let x = 0; x < canvas.width; x += 30) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 30) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }
        }

        ground.slots?.forEach((slot) => {
            ctx.save();
            ctx.translate(slot.position.x + slot.dimensions.width / 2, slot.position.y + slot.dimensions.height / 2);
            ctx.rotate((slot.rotation * Math.PI) / 180);

            const isSelected = selectedSlot?._id === slot._id;
            const isAvailable = slot.status === "available";
            const color = TYPE_COLORS[slot.vehicleType] || "#3b82f6";
            const statusColor = STATUS_COLORS[slot.status];

            ctx.fillStyle = isSelected ? `${color}60` : isAvailable ? `${color}25` : `${statusColor}20`;
            ctx.strokeStyle = isSelected ? "#ffffff" : statusColor;
            ctx.lineWidth = isSelected ? 2.5 : 1.5;

            const w = slot.dimensions.width;
            const h = slot.dimensions.height;
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.strokeRect(-w / 2, -h / 2, w, h);

            // Status dot
            ctx.fillStyle = statusColor;
            ctx.beginPath();
            ctx.arc(w / 2 - 5, -h / 2 + 5, 3, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = "#fff";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(slot.slotNumber, 0, 0);

            // Pointer cursor hint for available
            if (isAvailable && isSelected) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
                ctx.setLineDash([]);
            }

            ctx.restore();
        });
    }, [ground, selectedSlot, bgImage]);

    useEffect(() => { drawCanvas(); }, [drawCanvas]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!ground?.slots) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clicked = ground.slots.find(
            (s) =>
                x >= s.position.x && x <= s.position.x + s.dimensions.width &&
                y >= s.position.y && y <= s.position.y + s.dimensions.height &&
                s.status === "available"
        );

        setSelectedSlot(clicked || null);
    };

    const handleBook = async () => {
        if (!selectedSlot || !selectedVehicle) return;
        setBooking(true);
        try {
            const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
            const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    vehicleId: selectedVehicle,
                    parkingGroundId: id,
                    slotId: selectedSlot._id,
                    startTime: startDateTime,
                    endTime: endDateTime,
                }),
            });

            if (res.ok) {
                setBooked(true);
                setShowConfirm(false);
            } else {
                const data = await res.json();
                alert(data.error || "Booking failed");
            }
        } catch (e) { console.error(e); }
        setBooking(false);
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (booked) {
        return (
            <div className="flex items-center justify-center py-20">
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 max-w-md w-full">
                    <CardContent className="py-12 text-center">
                        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                            <CheckCircle className="h-8 w-8 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
                        <p className="text-muted-foreground mb-1">Slot: <strong>{selectedSlot?.slotNumber}</strong></p>
                        <p className="text-muted-foreground mb-6">{date} • {startTime} – {endTime}</p>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" onClick={() => router.push("/user/bookings")}>My Bookings</Button>
                            <Button onClick={() => router.push("/user/home")} className="bg-gradient-to-r from-chart-2 to-primary">Go Home</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{ground?.name}</h1>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {ground?.address}
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                {/* Slot Map */}
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            Select a Slot
                            <div className="flex gap-2 ml-auto">
                                <span className="flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Available</span>
                                <span className="flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-red-500" /> Booked</span>
                                <span className="flex items-center gap-1 text-xs"><span className="w-2 h-2 rounded-full bg-gray-500" /> Blocked</span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <canvas
                            ref={canvasRef}
                            width={800}
                            height={500}
                            className="w-full cursor-pointer"
                            onClick={handleCanvasClick}
                        />
                    </CardContent>
                </Card>

                {/* Booking Details */}
                <div className="space-y-4">
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Booking Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedSlot ? (
                                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Car className="h-4 w-4 text-primary" />
                                        <span className="font-bold">{selectedSlot.slotNumber}</span>
                                        <Badge variant="outline" className="text-[10px] capitalize">{selectedSlot.vehicleType}</Badge>
                                    </div>
                                    {selectedSlot.isEV && <Badge variant="warning" className="text-[10px]">EV Charging</Badge>}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Click an available slot on the map</p>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-xs">Vehicle</Label>
                                <select
                                    value={selectedVehicle}
                                    onChange={(e) => setSelectedVehicle(e.target.value)}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    {vehicles.map((v) => (
                                        <option key={v._id} value={v._id}>
                                            {v.vehicleNumber} ({v.vehicleType})
                                        </option>
                                    ))}
                                </select>
                                {vehicles.length === 0 && (
                                    <Button variant="link" className="text-xs p-0 h-auto" onClick={() => router.push("/user/vehicles")}>
                                        Add a vehicle first →
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Date</Label>
                                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Start</Label>
                                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> End</Label>
                                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                                </div>
                            </div>

                            <Button
                                className="w-full bg-gradient-to-r from-chart-2 to-primary hover:opacity-90"
                                disabled={!selectedSlot || !selectedVehicle}
                                onClick={() => setShowConfirm(true)}
                            >
                                <Calendar className="mr-2 h-4 w-4" /> Book Slot
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Confirm Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="bg-card backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Confirm Booking</DialogTitle>
                        <DialogDescription>Review your booking details</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium">{ground?.name}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Slot</span><span className="font-medium">{selectedSlot?.slotNumber}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Vehicle</span><span className="font-medium">{vehicles.find(v => v._id === selectedVehicle)?.vehicleNumber}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{date}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{startTime} — {endTime}</span></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
                        <Button onClick={handleBook} disabled={booking} className="bg-gradient-to-r from-chart-2 to-primary">
                            {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Confirm Booking
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
