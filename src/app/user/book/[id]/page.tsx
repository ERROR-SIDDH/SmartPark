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
import { MapPin, Calendar, Clock, Loader2, CheckCircle, ArrowLeft, Car, AlertCircle, Ruler } from "lucide-react";

interface SlotData {
    _id: string;
    slotNumber: string;
    vehicleType: string;
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
    realDimensions?: { length: number; width: number };
    clearance?: number;
    rotation: number;
    status: string;
    isEV: boolean;
}

interface DrawingShape {
    id: string;
    type: "line" | "rect" | "arc";
    points: number[];
    color: string;
    lineWidth: number;
}

interface ParkingGround {
    _id: string;
    name: string;
    address: string;
    layoutImage: string;
    layoutDrawing?: DrawingShape[];
    slots: SlotData[];
}

interface Vehicle {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    dimensions?: { length: number; width: number };
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
    const [loading, setLoading] = useState(true);
    const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());
    const [sizeError, setSizeError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedSlot || !selectedVehicle) {
            setSizeError(null);
            return;
        }
        const v = vehicles.find((vec) => vec._id === selectedVehicle);
        if (v?.dimensions && selectedSlot.realDimensions) {
            const clr = selectedSlot.clearance || 0;
            const reqL = v.dimensions.length + clr;
            const reqW = v.dimensions.width + clr;
            const slotL = selectedSlot.realDimensions.length;
            const slotW = selectedSlot.realDimensions.width;

            const fitsNormally = reqL <= slotL && reqW <= slotW;
            const fitsRotated = reqL <= slotW && reqW <= slotL;

            if (!fitsNormally && !fitsRotated) {
                setSizeError(`Vehicle + clearance (${reqL}x${reqW}cm) doesn't fit in slot (${slotL}x${slotW}cm)`);
            } else {
                setSizeError(null);
            }
        } else {
            setSizeError(null);
        }
    }, [selectedSlot, selectedVehicle, vehicles]);

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
            setLoading(false);
        });
    }, [id, token]);

    // Fetch bookings for the selected date/time to compute which slots are occupied
    useEffect(() => {
        if (!id || !date || !startTime || !endTime) return;
        const start = new Date(`${date}T${startTime}:00`).toISOString();
        const end = new Date(`${date}T${endTime}:00`).toISOString();
        fetch(`/api/bookings/check?parkingGroundId=${id}&startTime=${start}&endTime=${end}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setBookedSlotIds(new Set(data.map((b: { slotId: string }) => b.slotId)));
                }
            })
            .catch(() => { });
    }, [id, token, date, startTime, endTime]);

    // Dynamic canvas sizing via ResizeObserver
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    const dpr = window.devicePixelRatio || 1;
                    setCanvasSize({ w: Math.round(width * dpr), h: Math.round(height * dpr) });
                }
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Compute bounding box of all content
    const getContentBounds = useCallback(() => {
        if (!ground) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasElements = false;

        if (ground.slots?.length) {
            ground.slots.forEach(s => {
                hasElements = true;
                minX = Math.min(minX, s.position.x);
                minY = Math.min(minY, s.position.y);
                maxX = Math.max(maxX, s.position.x + s.dimensions.width);
                maxY = Math.max(maxY, s.position.y + s.dimensions.height);
            });
        }

        if (ground.layoutDrawing?.length) {
            ground.layoutDrawing.forEach(s => {
                hasElements = true;
                const pts = s.points;
                if (s.type === 'line' || s.type === 'rect') {
                    if (pts.length >= 4) {
                        const [x1, y1, x2, y2] = pts;
                        minX = Math.min(minX, x1, x2);
                        minY = Math.min(minY, y1, y2);
                        maxX = Math.max(maxX, x1, x2);
                        maxY = Math.max(maxY, y1, y2);
                    }
                } else if (s.type === 'arc') {
                    if (pts.length >= 3) {
                        const [cx, cy, r] = pts;
                        minX = Math.min(minX, cx - r);
                        minY = Math.min(minY, cy - r);
                        maxX = Math.max(maxX, cx + r);
                        maxY = Math.max(maxY, cy + r);
                    }
                }
            });
        }

        if (!hasElements) return null;
        return { minX, minY, maxX, maxY };
    }, [ground]);

    // Compute the transform to fit all content in the canvas
    const getViewportTransform = useCallback(() => {
        const bounds = getContentBounds();
        if (!bounds) return { scale: 1, offsetX: 0, offsetY: 0 };

        const { minX, minY, maxX, maxY } = bounds;
        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const padding = 40;
        const availW = canvasSize.w - padding * 2;
        const availH = canvasSize.h - padding * 2;

        const scale = Math.min(availW / (contentW || 1), availH / (contentH || 1));

        const centerX = minX + contentW / 2;
        const centerY = minY + contentH / 2;

        const offsetX = canvasSize.w / 2 - centerX * scale;
        const offsetY = canvasSize.h / 2 - centerY * scale;

        return { scale, offsetX, offsetY };
    }, [getContentBounds, canvasSize]);

    // Draw
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !ground) return;
        canvas.width = canvasSize.w;
        canvas.height = canvasSize.h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

        // Background
        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
        ctx.strokeStyle = "#ffffff10";
        const gridStep = 30;
        for (let x = 0; x < canvasSize.w; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasSize.h); ctx.stroke();
        }
        for (let y = 0; y < canvasSize.h; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasSize.w, y); ctx.stroke();
        }

        const { scale, offsetX, offsetY } = getViewportTransform();

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);

        // Draw architectural shapes
        if (ground.layoutDrawing) {
            ground.layoutDrawing.forEach(shape => {
                ctx.save();
                ctx.strokeStyle = shape.color;
                ctx.lineWidth = (shape.lineWidth || 2) / scale;
                const pts = shape.points;
                if (shape.type === "line" && pts.length >= 4) {
                    ctx.beginPath();
                    ctx.moveTo(pts[0], pts[1]);
                    ctx.lineTo(pts[2], pts[3]);
                    ctx.stroke();
                } else if (shape.type === "rect" && pts.length >= 4) {
                    const [x1, y1, x2, y2] = pts;
                    const rx = Math.min(x1, x2);
                    const ry = Math.min(y1, y2);
                    const rw = Math.abs(x2 - x1);
                    const rh = Math.abs(y2 - y1);
                    ctx.strokeRect(rx, ry, rw, rh);
                    ctx.fillStyle = shape.color + "20";
                    ctx.fillRect(rx, ry, rw, rh);
                } else if (shape.type === "arc" && pts.length >= 3) {
                    ctx.beginPath();
                    ctx.arc(pts[0], pts[1], pts[2], 0, Math.PI, false);
                    ctx.stroke();
                }
                ctx.restore();
            });
        }

        // Draw slots
        ground.slots?.forEach((slot) => {
            ctx.save();
            ctx.translate(slot.position.x + slot.dimensions.width / 2, slot.position.y + slot.dimensions.height / 2);
            ctx.rotate((slot.rotation * Math.PI) / 180);

            const isSelected = selectedSlot?._id === slot._id;
            const isBookedNow = bookedSlotIds.has(slot._id);
            const isBlocked = slot.status === "blocked";
            const isAvailable = !isBookedNow && !isBlocked;
            const effectiveStatus = isBlocked ? "blocked" : isBookedNow ? "booked" : "available";
            const color = TYPE_COLORS[slot.vehicleType] || "#3b82f6";
            const statusColor = STATUS_COLORS[effectiveStatus];

            ctx.fillStyle = isSelected ? `${color}60` : isAvailable ? `${color}25` : `${statusColor}20`;
            ctx.strokeStyle = isSelected ? "#ffffff" : statusColor;
            ctx.lineWidth = (isSelected ? 2.5 : 1.5) / scale;

            const w = slot.dimensions.width;
            const h = slot.dimensions.height;
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.strokeRect(-w / 2, -h / 2, w, h);

            // Status dot
            ctx.fillStyle = statusColor;
            ctx.beginPath();
            ctx.arc(w / 2 - 6, -h / 2 + 6, 4 / scale, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = "#fff";
            const fontSize = Math.max(10, 12 / scale);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(slot.slotNumber, 0, -6);

            // Vehicle type label
            ctx.fillStyle = "#ffffff80";
            ctx.font = `${Math.max(8, 9 / scale)}px sans-serif`;
            ctx.fillText(slot.vehicleType.toUpperCase(), 0, 8);

            // Selection highlight
            if (isAvailable && isSelected) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5 / scale;
                ctx.setLineDash([4 / scale, 4 / scale]);
                ctx.strokeRect(-w / 2 - 4 / scale, -h / 2 - 4 / scale, w + 8 / scale, h + 8 / scale);
                ctx.setLineDash([]);
            }

            ctx.restore();
        });

        ctx.restore();
    }, [ground, selectedSlot, canvasSize, bookedSlotIds, getViewportTransform]);

    useEffect(() => { drawCanvas(); }, [drawCanvas]);

    // Convert click pixel coordinate to world coordinate
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!ground?.slots) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();

        // Convert from CSS pixels to canvas pixels
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;
        const canvasX = cssX * (canvas.width / rect.width);
        const canvasY = cssY * (canvas.height / rect.height);

        // Invert the viewport transform to get world coordinates
        const { scale, offsetX, offsetY } = getViewportTransform();
        const worldX = (canvasX - offsetX) / scale;
        const worldY = (canvasY - offsetY) / scale;

        // Hit-test each available slot with rotation-aware bounds
        const clicked = ground.slots.find((s) => {
            if (s.status === "blocked" || bookedSlotIds.has(s._id)) return false;
            const w = s.dimensions.width;
            const h = s.dimensions.height;
            const cx = s.position.x + w / 2;
            const cy = s.position.y + h / 2;
            const dx = worldX - cx;
            const dy = worldY - cy;
            const angle = -(s.rotation * Math.PI) / 180;
            const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
            const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
            return rx >= -w / 2 && rx <= w / 2 && ry >= -h / 2 && ry <= h / 2;
        });

        setSelectedSlot(clicked || null);
    };

    const handleBook = async () => {
        if (!selectedSlot || !selectedVehicle || sizeError) return;
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
                        <div ref={containerRef} className="w-full" style={{ height: "480px" }}>
                            <canvas
                                ref={canvasRef}
                                className="w-full h-full cursor-pointer block"
                                style={{ imageRendering: "auto" }}
                                onClick={handleCanvasClick}
                            />
                        </div>
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

                            {sizeError && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span className="text-xs font-medium leading-relaxed">{sizeError}</span>
                                </div>
                            )}

                            <Button
                                className="w-full bg-gradient-to-r from-chart-2 to-primary hover:opacity-90 disabled:opacity-50"
                                disabled={!selectedSlot || !selectedVehicle || !!sizeError}
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
