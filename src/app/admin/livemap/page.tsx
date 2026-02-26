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
    ZoomIn, ZoomOut, Maximize
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

interface IDrawingShape {
    type: 'line' | 'rect' | 'arc' | 'freehand';
    points: number[];
    color: string;
    lineWidth: number;
    fill?: string;
}

interface MapData {
    ground: { _id: string; name: string; address: string; layoutDrawing: IDrawingShape[] };
    slots: SlotData[];
    stats: { total: number; occupied: number; available: number; blocked: number };
    checkTime: string;
}

interface ParkingGround {
    _id: string;
    name: string;
    address: string;
}

const getLocalDatetimeString = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function LiveMapPage() {
    const { token } = useAuthStore();
    const [grounds, setGrounds] = useState<ParkingGround[]>([]);
    const [selectedGround, setSelectedGround] = useState("");
    const [mapData, setMapData] = useState<MapData | null>(null);
    const [loading, setLoading] = useState(false);
    const [hoveredSlot, setHoveredSlot] = useState<SlotData | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [checkTime, setCheckTime] = useState(() => getLocalDatetimeString(new Date()));

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
    const animFrameRef = useRef<number>(0);
    const pulseRef = useRef(0);

    // Zoom and Pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

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
            setCheckTime(getLocalDatetimeString(new Date()));
            fetchMap(); // Also re-fetch the map data to update stats
        }, 10000);
        return () => clearInterval(iv);
    }, [autoRefresh, fetchMap]);

    // Responsive canvas
    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver((entries) => {
            for (const e of entries) {
                setCanvasSize({
                    w: Math.floor(e.contentRect.width),
                    h: Math.floor(e.contentRect.height)
                });
            }
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    // Get true base scale and offset for the grid to fit screen
    const getBaseTransform = useCallback(() => {
        if (!mapData || (mapData.slots.length === 0 && (!mapData.ground.layoutDrawing || mapData.ground.layoutDrawing.length === 0))) return { scale: 1, offsetX: 0, offsetY: 0 };
        const slots = mapData.slots;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of slots) {
            minX = Math.min(minX, s.position.x);
            minY = Math.min(minY, s.position.y);
            maxX = Math.max(maxX, s.position.x + s.size.width);
            maxY = Math.max(maxY, s.position.y + s.size.height);
        }

        // Include drawing bounds if any
        if (mapData.ground.layoutDrawing) {
            for (const shape of mapData.ground.layoutDrawing) {
                if (shape.type === 'rect') {
                    const [x, y, w, h] = shape.points;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x + w);
                    maxY = Math.max(maxY, y + h);
                } else if (shape.type === 'arc') {
                    const [cx, cy, r] = shape.points;
                    minX = Math.min(minX, cx - r);
                    minY = Math.min(minY, cy - r);
                    maxX = Math.max(maxX, cx + r);
                    maxY = Math.max(maxY, cy + r);
                } else { // line or freehand
                    for (let i = 0; i < shape.points.length; i += 2) {
                        minX = Math.min(minX, shape.points[i]);
                        minY = Math.min(minY, shape.points[i + 1]);
                        maxX = Math.max(maxX, shape.points[i]);
                        maxY = Math.max(maxY, shape.points[i + 1]);
                    }
                }
            }
        }

        const pad = 40;
        const gridW = maxX - minX || 1;
        const gridH = maxY - minY || 1;
        const scaleX = (canvasSize.w - pad * 2) / gridW;
        const scaleY = (canvasSize.h - pad * 2) / gridH;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (canvasSize.w - gridW * scale) / 2 - minX * scale;
        const offsetY = (canvasSize.h - gridH * scale) / 2 - minY * scale;
        return { scale, offsetX, offsetY };
    }, [mapData, canvasSize]);

    // Canvas rendering with animations, zoom and pan
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !mapData) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasSize.w * dpr;
        canvas.height = canvasSize.h * dpr;
        ctx.scale(dpr, dpr);

        const slots = mapData.slots;
        // If no slots and no layout drawing, nothing to draw
        if (slots.length === 0 && (!mapData.ground.layoutDrawing || mapData.ground.layoutDrawing.length === 0)) return;

        const { scale: baseScale, offsetX: baseOffsetX, offsetY: baseOffsetY } = getBaseTransform();

        const draw = () => {
            pulseRef.current += 0.03;
            const pulse = Math.sin(pulseRef.current) * 0.15 + 0.85;

            ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

            // Background
            ctx.fillStyle = "#0a0a0f";
            ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

            ctx.save();

            // Apply Pan and Zoom
            // Pivot around center of canvas
            ctx.translate(canvasSize.w / 2 + pan.x, canvasSize.h / 2 + pan.y);
            ctx.scale(zoom, zoom);
            ctx.translate(-canvasSize.w / 2, -canvasSize.h / 2);

            // Grid dots (relative to zoomed area)
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            for (let x = -canvasSize.w; x < canvasSize.w * 2; x += 20) {
                for (let y = -canvasSize.h; y < canvasSize.h * 2; y += 20) {
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw layout graphics
            if (mapData.ground.layoutDrawing) {
                for (const shape of mapData.ground.layoutDrawing) {
                    ctx.beginPath();
                    ctx.strokeStyle = shape.color;
                    ctx.lineWidth = shape.lineWidth * baseScale;
                    if (shape.fill) ctx.fillStyle = shape.fill;

                    if (shape.type === 'line' || shape.type === 'freehand') {
                        const pts = shape.points;
                        if (pts.length >= 2) {
                            ctx.moveTo(pts[0] * baseScale + baseOffsetX, pts[1] * baseScale + baseOffsetY);
                            for (let i = 2; i < pts.length; i += 2) {
                                ctx.lineTo(pts[i] * baseScale + baseOffsetX, pts[i + 1] * baseScale + baseOffsetY);
                            }
                        }
                    } else if (shape.type === 'rect') {
                        const [x, y, w, h] = shape.points;
                        ctx.rect(x * baseScale + baseOffsetX, y * baseScale + baseOffsetY, w * baseScale, h * baseScale);
                    } else if (shape.type === 'arc') {
                        const [cx, cy, r, startAngle, endAngle] = shape.points;
                        ctx.arc(cx * baseScale + baseOffsetX, cy * baseScale + baseOffsetY, r * baseScale, startAngle || 0, endAngle || Math.PI * 2);
                    }

                    if (shape.fill) ctx.fill();
                    ctx.stroke();
                }
            }

            // Draw slots
            for (const s of slots) {
                const sx = s.position.x * baseScale + baseOffsetX;
                const sy = s.position.y * baseScale + baseOffsetY;
                const sw = s.size.width * baseScale;
                const sh = s.size.height * baseScale;

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

            // Hovered slot tooltip inside the scaled context so it tracks the slot
            if (hoveredSlot) {
                const sx = hoveredSlot.position.x * baseScale + baseOffsetX;
                const sy = hoveredSlot.position.y * baseScale + baseOffsetY;
                const sw = hoveredSlot.size.width * baseScale;

                // Intelligently scale tooltip so it doesn't get huge when zoomed
                const invZoom = 1 / zoom;
                const tooltipW = 160 * invZoom;
                const tooltipH = (hoveredSlot.booking ? 70 : 40) * invZoom;

                let tx = sx + sw / 2 - tooltipW / 2;
                let ty = sy - tooltipH - 10 * invZoom;

                ctx.fillStyle = "rgba(20, 20, 30, 0.95)";
                ctx.beginPath();
                ctx.roundRect(tx, ty, tooltipW, tooltipH, 8 * invZoom);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.1)";
                ctx.lineWidth = 1 * invZoom;
                ctx.stroke();

                ctx.font = `bold ${11 * invZoom}px system-ui`;
                ctx.fillStyle = "#fff";
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`Slot ${hoveredSlot.slotNumber}`, tx + 10 * invZoom, ty + 8 * invZoom);

                const statusLabel = hoveredSlot.isBlocked ? "🚫 Blocked" :
                    hoveredSlot.isOccupied ? "🟠 Occupied" : "🟢 Available";
                ctx.font = `${10 * invZoom}px system-ui`;
                ctx.fillStyle = "rgba(255,255,255,0.7)";
                ctx.fillText(statusLabel, tx + 10 * invZoom, ty + 24 * invZoom);

                if (hoveredSlot.booking) {
                    ctx.fillText(
                        `👤 ${hoveredSlot.booking.user?.name || "—"}`,
                        tx + 10 * invZoom, ty + 40 * invZoom
                    );
                    ctx.fillText(
                        `🚗 ${hoveredSlot.booking.vehicle?.vehicleNumber || "—"}`,
                        tx + 10 * invZoom, ty + 54 * invZoom
                    );
                }
            }

            ctx.restore();

            animFrameRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [mapData, canvasSize, hoveredSlot, zoom, pan, getBaseTransform]);

    // Mouse and touch handlers for panning and hovering
    const getTransformedMousePos = useCallback((mx: number, my: number) => {
        // Need to reverse the transform: 
        // 1. untranslate pan
        // 2. unscale zoom
        // 3. shift relative to center
        const cx = canvasSize.w / 2;
        const cy = canvasSize.h / 2;

        const translatedX = mx - cx - pan.x;
        const translatedY = my - cy - pan.y;

        const scaledX = translatedX / zoom;
        const scaledY = translatedY / zoom;

        return { x: scaledX + cx, y: scaledY + cy };
    }, [zoom, pan, canvasSize]);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        if (e.pointerType === "mouse") {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (isDragging) {
            setPan({
                x: e.clientX - dragStartRef.current.x,
                y: e.clientY - dragStartRef.current.y
            });
            setHoveredSlot(null);
            return;
        }

        // Hover detection
        if (!mapData || !canvasRef.current || isDragging) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const { x: tmx, y: tmy } = getTransformedMousePos(mx, my);
        const { scale: baseScale, offsetX: baseOffsetX, offsetY: baseOffsetY } = getBaseTransform();

        let found: SlotData | null = null;
        for (const s of mapData.slots) {
            const sx = s.position.x * baseScale + baseOffsetX;
            const sy = s.position.y * baseScale + baseOffsetY;
            const sw = s.size.width * baseScale;
            const sh = s.size.height * baseScale;
            if (tmx >= sx && tmx <= sx + sw && tmy >= sy && tmy <= sy + sh) {
                found = s;
                break;
            }
        }
        setHoveredSlot(found);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        setIsDragging(false);
        if (e.pointerType === "mouse") {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
    };

    // Wheel listener for zooming
    const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault(); // Need to add wheel listener natively to prevent browser scroll
        const zoomSensitivity = 0.001;
        setZoom((z) => {
            const newZoom = z - e.deltaY * zoomSensitivity;
            return Math.max(0.5, Math.min(newZoom, 5));
        });
    }, []);

    // Add non-passive wheel listener explicitly
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomSensitivity = 0.002;
            setZoom((z) => {
                const newZoom = z - e.deltaY * zoomSensitivity;
                return Math.max(0.2, Math.min(newZoom, 5));
            });
        };
        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", onWheel);
    }, []);

    const resetView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    // Time controls
    const adjustTime = (minutes: number) => {
        const d = new Date(checkTime);
        d.setMinutes(d.getMinutes() + minutes);
        setCheckTime(d.toISOString().slice(0, 16));
        setAutoRefresh(false);
    };

    const setNow = () => {
        setCheckTime(getLocalDatetimeString(new Date()));
        setAutoRefresh(true);
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-3 -m-2 p-2">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h1 className="text-xl font-bold tracking-tight">Live Map</h1>

                    {/* Ground selector */}
                    <div className="flex gap-1 ml-4 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                        {grounds.map((g) => (
                            <Button
                                key={g._id}
                                size="sm"
                                variant={selectedGround === g._id ? "default" : "outline"}
                                onClick={() => { setSelectedGround(g._id); resetView(); }}
                                className="h-7 text-xs px-2 whitespace-nowrap"
                            >
                                {g.name}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Time controls */}
                    <div className="flex items-center bg-card/50 backdrop-blur-sm border border-border/50 rounded-md p-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => adjustTime(-60)}>
                            <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => adjustTime(-15)}>
                            <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Input
                            type="datetime-local"
                            value={checkTime}
                            onChange={(e) => { setCheckTime(e.target.value); setAutoRefresh(false); }}
                            className="h-6 text-xs w-[180px] border-none bg-transparent shadow-none"
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => adjustTime(15)}>
                            <ChevronRight className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => adjustTime(60)}>
                            <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" />
                        </Button>
                    </div>

                    <Button size="sm" variant={autoRefresh ? "default" : "outline"} onClick={autoRefresh ? () => { } : setNow} className="h-8">
                        {autoRefresh ? <><Badge variant="outline" className="h-4 w-4 rounded-full p-0 flex items-center justify-center border-none mr-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /></Badge> Live</> : "Now"}
                    </Button>

                    <Button size="icon" variant="outline" onClick={fetchMap} className="h-8 w-8">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Main Map Area - takes up remaining height */}
            <div className="flex flex-1 gap-3 min-h-0 relative">

                {/* Canvas Container */}
                <div ref={containerRef} className="flex-1 bg-card/20 rounded-xl overflow-hidden border border-border/50 relative">
                    {loading && !mapData ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : !mapData || (mapData.slots.length === 0 && (!mapData.ground.layoutDrawing || mapData.ground.layoutDrawing.length === 0)) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
                            <MapPin className="h-12 w-12 text-muted-foreground mb-3" />
                            <h3 className="font-semibold mb-1">No Map Data Configured</h3>
                            <p className="text-sm text-muted-foreground">Select a parking ground or add layout elements in the editor.</p>
                        </div>
                    ) : null}

                    <canvas
                        ref={canvasRef}
                        style={{ cursor: isDragging ? "grabbing" : hoveredSlot ? "pointer" : "grab", touchAction: "none" }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        // Wheel event added via useEffect for passive: false
                        className="absolute inset-0"
                    />

                    {/* Overlay: Zoom Controls */}
                    <div className="absolute top-4 right-4 flex flex-col gap-1 bg-black/50 backdrop-blur-md p-1 rounded-lg border border-white/10">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setZoom(z => Math.min(z + 0.5, 5))}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setZoom(z => Math.max(z - 0.5, 0.2))}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={resetView}>
                            <Maximize className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Overlay: Legend */}
                    <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md rounded-lg px-3 py-2 flex flex-col gap-2 text-[10px] border border-white/10 pointer-events-none">
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500" /> Available</span>
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-500 shadow-[0_0_8px_rgba(251,146,60,0.5)]" /> Occupied</span>
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-500/30 border border-red-500" /> Blocked</span>
                    </div>

                    {/* Overlay: Stats */}
                    {mapData && (
                        <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                            <Badge variant="outline" className="bg-black/70 backdrop-blur-md text-emerald-400 border-white/10 text-xs py-1">
                                {mapData.stats.available} Available
                            </Badge>
                            <Badge variant="outline" className="bg-black/70 backdrop-blur-md text-amber-400 border-white/10 text-xs py-1">
                                {mapData.stats.occupied} Occupied
                            </Badge>
                            <Badge variant="outline" className="bg-black/70 backdrop-blur-md text-foreground border-white/10 text-xs py-1">
                                {mapData.stats.total} Total
                            </Badge>
                        </div>
                    )}
                </div>

                {/* Right Side Panel: Occupied details (only visible if there's space, hidden on narrow screens) */}
                {mapData && mapData.slots.filter(s => s.isOccupied).length > 0 && (
                    <div className="hidden lg:flex flex-col w-80 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden">
                        <div className="p-3 border-b border-border/50 bg-muted/30">
                            <h2 className="text-sm font-medium">Active Bookings ({mapData.slots.filter(s => s.isOccupied).length})</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
                            {mapData.slots.filter(s => s.isOccupied && s.booking).map((s) => (
                                <Card key={s._id} className="bg-background border-border/50 shadow-sm">
                                    <CardContent className="p-2.5 flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-xs">Slot {s.slotNumber}</span>
                                                {s.booking!.checkedIn && (
                                                    <Badge variant="success" className="text-[8px] px-1 py-0 h-4">In</Badge>
                                                )}
                                            </div>
                                            <div className="text-[11px] flex items-center gap-1 mb-0.5 mt-2 text-foreground">
                                                <User className="h-3 w-3 text-muted-foreground text-[10px]" />
                                                <span className="truncate">{s.booking!.user?.name || "—"}</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex justify-between">
                                                <span>{s.booking!.vehicle?.vehicleNumber}</span>
                                                <span>
                                                    {new Date(s.booking!.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(s.booking!.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

