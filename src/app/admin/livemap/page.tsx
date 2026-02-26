"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2, MapPin, Car, Bike, Zap, Truck, RefreshCw,
    Play, Pause, Clock, User, ChevronLeft, ChevronRight,
} from "lucide-react";

interface SlotData {
    _id: string;
    slotNumber: string;
    vehicleType: string;
    status: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    rotation: number;
    isOccupied: boolean;
    isBlocked: boolean;
    booking: {
        startTime: string;
        endTime: string;
        checkedIn: string | null;
        user: { name: string; employeeCode: string } | null;
        vehicle: { vehicleNumber: string; vehicleType: string } | null;
    } | null;
}

interface MapData {
    ground: { _id: string; name: string; address: string };
    slots: SlotData[];
    stats: { total: number; occupied: number; available: number; blocked: number };
    checkTime: string;
}

interface ParkingGround {
    _id: string;
    name: string;
    address: string;
}

export default function LiveMapPage() {
    const { token } = useAuthStore();
    const [grounds, setGrounds] = useState<ParkingGround[]>([]);
    const [selectedGround, setSelectedGround] = useState("");
    const [mapData, setMapData] = useState<MapData | null>(null);
    const [loading, setLoading] = useState(false);
    const [hoveredSlot, setHoveredSlot] = useState<SlotData | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [checkTime, setCheckTime] = useState(() => {
        const now = new Date();
        return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
    const animFrameRef = useRef<number>(0);
    const pulseRef = useRef(0);

    // Fetch parking grounds
    useEffect(() => {
        fetch("/api/parking", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                const arr = Array.isArray(data) ? data : [];
                setGrounds(arr);
                if (arr.length > 0 && !selectedGround) setSelectedGround(arr[0]._id);
            });
    }, [token]);

    // Fetch live map data
    const fetchMap = useCallback(() => {
        if (!selectedGround) return;
        setLoading(true);
        const params = new URLSearchParams({ groundId: selectedGround, time: new Date(checkTime).toISOString() });
        fetch(`/api/admin/livemap?${params}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => { if (data.slots) setMapData(data); })
            .finally(() => setLoading(false));
    }, [selectedGround, checkTime, token]);

    useEffect(() => { fetchMap(); }, [fetchMap]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const iv = setInterval(() => {
            setCheckTime(new Date().toISOString().slice(0, 16));
        }, 10000);
        return () => clearInterval(iv);
    }, [autoRefresh]);

    // Responsive canvas
    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver((entries) => {
            for (const e of entries) {
                const w = Math.floor(e.contentRect.width);
                setCanvasSize({ w, h: Math.max(400, Math.floor(w * 0.6)) });
            }
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    // Canvas rendering with animations
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !mapData) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasSize.w * dpr;
        canvas.height = canvasSize.h * dpr;
        ctx.scale(dpr, dpr);

        // Compute bounds
        const slots = mapData.slots;
        if (slots.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of slots) {
            const x1 = s.position.x;
            const y1 = s.position.y;
            const x2 = x1 + s.size.width;
            const y2 = y1 + s.size.height;
            minX = Math.min(minX, x1);
            minY = Math.min(minY, y1);
            maxX = Math.max(maxX, x2);
            maxY = Math.max(maxY, y2);
        }

        const pad = 40;
        const gridW = maxX - minX || 1;
        const gridH = maxY - minY || 1;
        const scaleX = (canvasSize.w - pad * 2) / gridW;
        const scaleY = (canvasSize.h - pad * 2) / gridH;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvasSize.w - gridW * scale) / 2 - minX * scale;
        const offsetY = (canvasSize.h - gridH * scale) / 2 - minY * scale;

        const draw = () => {
            pulseRef.current += 0.03;
            const pulse = Math.sin(pulseRef.current) * 0.15 + 0.85;

            ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

            // Background
            ctx.fillStyle = "#0a0a0f";
            ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

            // Grid dots
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            for (let x = 0; x < canvasSize.w; x += 20) {
                for (let y = 0; y < canvasSize.h; y += 20) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw slots
            for (const s of slots) {
                const sx = s.position.x * scale + offsetX;
                const sy = s.position.y * scale + offsetY;
                const sw = s.size.width * scale;
                const sh = s.size.height * scale;

                ctx.save();
                if (s.rotation) {
                    ctx.translate(sx + sw / 2, sy + sh / 2);
                    ctx.rotate((s.rotation * Math.PI) / 180);
                    ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
                }

                // Slot fill
                if (s.isBlocked) {
                    ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
                    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
                } else if (s.isOccupied) {
                    ctx.fillStyle = `rgba(251, 146, 60, ${0.2 * pulse})`;
                    ctx.strokeStyle = `rgba(251, 146, 60, ${0.6 * pulse})`;
                } else {
                    ctx.fillStyle = "rgba(52, 211, 153, 0.15)";
                    ctx.strokeStyle = "rgba(52, 211, 153, 0.4)";
                }

                const r = 4;
                ctx.beginPath();
                ctx.roundRect(sx, sy, sw, sh, r);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Glow for occupied
                if (s.isOccupied) {
                    ctx.shadowColor = "rgba(251, 146, 60, 0.3)";
                    ctx.shadowBlur = 8 * pulse;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = "transparent";
                }

                // Slot number
                const fontSize = Math.max(8, Math.min(12, sw * 0.3));
                ctx.font = `bold ${fontSize}px system-ui`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = s.isBlocked ? "rgba(239,68,68,0.7)" :
                    s.isOccupied ? "rgba(251,146,60,0.9)" : "rgba(52,211,153,0.8)";
                ctx.fillText(s.slotNumber, sx + sw / 2, sy + sh / 2);

                // Vehicle type icon label
                const typeLabel = s.vehicleType === "ev" ? "⚡" : s.vehicleType === "bike" ? "🏍" : s.vehicleType === "pickup" ? "🛻" : "🚗";
                ctx.font = `${Math.max(8, fontSize * 0.7)}px system-ui`;
                ctx.fillStyle = "rgba(255,255,255,0.3)";
                ctx.fillText(typeLabel, sx + sw / 2, sy + sh - fontSize * 0.5);

                ctx.restore();
            }

            // Hovered slot tooltip
            if (hoveredSlot) {
                const sx = hoveredSlot.position.x * scale + offsetX;
                const sy = hoveredSlot.position.y * scale + offsetY;
                const sw = hoveredSlot.size.width * scale;

                const tooltipW = 160;
                const tooltipH = hoveredSlot.booking ? 70 : 40;
                let tx = sx + sw / 2 - tooltipW / 2;
                let ty = sy - tooltipH - 10;
                if (ty < 5) ty = sy + hoveredSlot.size.height * scale + 10;
                if (tx < 5) tx = 5;
                if (tx + tooltipW > canvasSize.w - 5) tx = canvasSize.w - tooltipW - 5;

                ctx.fillStyle = "rgba(20, 20, 30, 0.95)";
                ctx.beginPath();
                ctx.roundRect(tx, ty, tooltipW, tooltipH, 8);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.1)";
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.font = "bold 11px system-ui";
                ctx.fillStyle = "#fff";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`Slot ${hoveredSlot.slotNumber}`, tx + 10, ty + 8);

                const statusLabel = hoveredSlot.isBlocked ? "🚫 Blocked" :
                    hoveredSlot.isOccupied ? "🟠 Occupied" : "🟢 Available";
                ctx.font = "10px system-ui";
                ctx.fillStyle = "rgba(255,255,255,0.7)";
                ctx.fillText(statusLabel, tx + 10, ty + 24);

                if (hoveredSlot.booking) {
                    ctx.fillText(
                        `👤 ${hoveredSlot.booking.user?.name || "—"}`,
                        tx + 10, ty + 40
                    );
                    ctx.fillText(
                        `🚗 ${hoveredSlot.booking.vehicle?.vehicleNumber || "—"}`,
                        tx + 10, ty + 54
                    );
                }
            }

            animFrameRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [mapData, canvasSize, hoveredSlot]);

    // Mouse move for hover detection
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!mapData || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const slots = mapData.slots;
        if (slots.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of slots) {
            minX = Math.min(minX, s.position.x);
            minY = Math.min(minY, s.position.y);
            maxX = Math.max(maxX, s.position.x + s.size.width);
            maxY = Math.max(maxY, s.position.y + s.size.height);
        }

        const pad = 40;
        const gridW = maxX - minX || 1;
        const gridH = maxY - minY || 1;
        const scaleX = (canvasSize.w - pad * 2) / gridW;
        const scaleY = (canvasSize.h - pad * 2) / gridH;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvasSize.w - gridW * scale) / 2 - minX * scale;
        const offsetY = (canvasSize.h - gridH * scale) / 2 - minY * scale;

        let found: SlotData | null = null;
        for (const s of slots) {
            const sx = s.position.x * scale + offsetX;
            const sy = s.position.y * scale + offsetY;
            const sw = s.size.width * scale;
            const sh = s.size.height * scale;
            if (mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh) {
                found = s;
                break;
            }
        }
        setHoveredSlot(found);
    }, [mapData, canvasSize]);

    // Time controls
    const adjustTime = (minutes: number) => {
        const d = new Date(checkTime);
        d.setMinutes(d.getMinutes() + minutes);
        setCheckTime(d.toISOString().slice(0, 16));
        setAutoRefresh(false);
    };

    const setNow = () => {
        setCheckTime(new Date().toISOString().slice(0, 16));
        setAutoRefresh(true);
    };

    const typeIcons: Record<string, typeof Car> = { car: Car, bike: Bike, ev: Zap, pickup: Truck };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-primary" /> Live Parking Map
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Real-time occupancy visualization</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        size="sm"
                        variant={autoRefresh ? "default" : "outline"}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? <><Pause className="h-3 w-3 mr-1" /> Live</> : <><Play className="h-3 w-3 mr-1" /> Paused</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={fetchMap}>
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Ground selector */}
            <div className="flex gap-2 flex-wrap">
                {grounds.map((g) => (
                    <Button
                        key={g._id}
                        size="sm"
                        variant={selectedGround === g._id ? "default" : "outline"}
                        onClick={() => setSelectedGround(g._id)}
                    >
                        <MapPin className="h-3.5 w-3.5 mr-1" /> {g.name}
                    </Button>
                ))}
            </div>

            {/* Time controls */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs whitespace-nowrap">Viewing time:</Label>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjustTime(-60)}>
                                <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjustTime(-15)}>
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                                type="datetime-local"
                                value={checkTime}
                                onChange={(e) => { setCheckTime(e.target.value); setAutoRefresh(false); }}
                                className="h-8 text-xs w-[200px]"
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjustTime(15)}>
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => adjustTime(60)}>
                                <ChevronRight className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5 -ml-2" />
                            </Button>
                        </div>
                        <Button size="sm" variant="outline" onClick={setNow} className="text-xs">
                            Now
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats bar */}
            {mapData && (
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { label: "Total", value: mapData.stats.total, color: "text-foreground" },
                        { label: "Available", value: mapData.stats.available, color: "text-emerald-500" },
                        { label: "Occupied", value: mapData.stats.occupied, color: "text-amber-500" },
                        { label: "Blocked", value: mapData.stats.blocked, color: "text-red-500" },
                    ].map((s, i) => (
                        <Card key={i} className="bg-card/50 border-border/50">
                            <CardContent className="p-3 text-center">
                                <div className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-[10px] text-muted-foreground">{s.label}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Canvas */}
            <div ref={containerRef} className="w-full">
                {loading && !mapData ? (
                    <div className="flex items-center justify-center h-[400px] bg-card/50 rounded-xl border border-border/50">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : !mapData || mapData.slots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] bg-card/50 rounded-xl border border-border/50">
                        <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
                        <h3 className="font-semibold mb-1">No Slots Configured</h3>
                        <p className="text-sm text-muted-foreground">
                            {selectedGround ? "This parking ground has no slots. Add slots in the editor." : "Select a parking ground to view."}
                        </p>
                    </div>
                ) : (
                    <div className="relative rounded-xl overflow-hidden border border-border/50">
                        <canvas
                            ref={canvasRef}
                            style={{ width: canvasSize.w, height: canvasSize.h, cursor: hoveredSlot ? "pointer" : "default" }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={() => setHoveredSlot(null)}
                        />
                        {/* Legend overlay */}
                        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md rounded-lg px-3 py-2 flex gap-3 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50 border border-emerald-500" /> Available</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/50 border border-amber-500 animate-pulse" /> Occupied</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/50 border border-red-500" /> Blocked</span>
                        </div>
                        {loading && (
                            <div className="absolute top-3 right-3">
                                <Badge variant="outline" className="bg-black/60 text-[10px]">
                                    <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> Updating...
                                </Badge>
                            </div>
                        )}
                        {autoRefresh && (
                            <div className="absolute top-3 left-3">
                                <Badge variant="outline" className="bg-black/60 text-emerald-400 border-emerald-500/30 text-[10px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" /> LIVE
                                </Badge>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Occupied slots details */}
            {mapData && mapData.slots.filter((s) => s.isOccupied).length > 0 && (
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2">Currently Occupied ({mapData.slots.filter((s) => s.isOccupied).length})</h2>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {mapData.slots.filter((s) => s.isOccupied && s.booking).map((s) => {
                            const Icon = typeIcons[s.booking!.vehicle?.vehicleType || "car"] || Car;
                            return (
                                <Card key={s._id} className="bg-card/50 border-border/50">
                                    <CardContent className="p-3 flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                            <Icon className="h-4 w-4 text-amber-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm">Slot {s.slotNumber}</span>
                                                {s.booking!.checkedIn && (
                                                    <Badge variant="success" className="text-[9px]">Checked In</Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <User className="h-3 w-3" /> {s.booking!.user?.name || "—"}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {s.booking!.vehicle?.vehicleNumber || "—"} •{" "}
                                                {new Date(s.booking!.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(s.booking!.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
