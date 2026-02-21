"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Save, MousePointer, Square, Circle, Trash2, RotateCcw,
    ZoomIn, ZoomOut, Move, Grid3X3, Image as ImageIcon,
    Car, Bike, Zap, Settings, Type, Crosshair, ChevronLeft, ChevronRight, Upload, ImageOff, Loader2, Undo2, Minus, Eraser, Copy, CheckCircle2
} from "lucide-react";

interface SlotData {
    _id?: string;
    slotNumber: string;
    vehicleType: "car" | "bike" | "pickup" | "ev";
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
    realDimensions: { length: number; width: number }; // cm
    clearance: number; // cm
    rotation: number;
    row: string;
    status: "available" | "booked" | "blocked";
    isEV: boolean;
    isAccessible: boolean;
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
    layoutImage: string;
    layoutDrawing: DrawingShape[];
}

const VEHICLE_COLORS: Record<string, string> = {
    car: "#3b82f6",
    bike: "#10b981",
    pickup: "#f59e0b",
    ev: "#8b5cf6",
};

const STATUS_COLORS: Record<string, string> = {
    available: "#22c55e",
    booked: "#ef4444",
    blocked: "#6b7280",
};

// Default real dimensions in cm
const DEFAULT_REAL_DIMS: Record<string, { length: number; width: number }> = {
    car: { length: 450, width: 200 },
    bike: { length: 200, width: 80 },
    pickup: { length: 550, width: 220 },
    ev: { length: 450, width: 200 },
};

const PIXELS_PER_CM = 0.2; // 1 pixel = 5 cm. So 450cm length = 90px

type EditorTool = "select" | "car" | "bike" | "pickup" | "ev" | "line" | "rect" | "arc" | "eraser";

interface UndoState {
    slots: SlotData[];
    shapes: DrawingShape[];
}

export default function LayoutEditorPage() {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [ground, setGround] = useState<ParkingGround | null>(null);
    const [slots, setSlots] = useState<SlotData[]>([]);
    const [shapes, setShapes] = useState<DrawingShape[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

    // Draft image state
    const [bgImageSrc, setBgImageSrc] = useState<string | null>(null);
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

    const [currentTool, setCurrentTool] = useState<EditorTool>("select");
    const [drawingColor, setDrawingColor] = useState("#ffffff");
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [slotCounter, setSlotCounter] = useState(1);
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [undoStack, setUndoStack] = useState<UndoState[]>([]);

    // Viewport state for zoom/pan
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Drag / Draw state
    const [isInteracting, setIsInteracting] = useState(false);
    const [interactionStart, setInteractionStart] = useState({ x: 0, y: 0 });
    const [currentDraftShape, setCurrentDraftShape] = useState<DrawingShape | null>(null);

    const CANVAS_W = 1600;
    const CANVAS_H = 1200;
    const GRID_SIZE = 10;

    const snap = (val: number) => snapToGrid ? Math.round(val / GRID_SIZE) * GRID_SIZE : val;

    const pushUndo = () => {
        setUndoStack((prev) => [...prev.slice(-20), {
            slots: JSON.parse(JSON.stringify(slots)),
            shapes: JSON.parse(JSON.stringify(shapes))
        }]);
    };
    const undo = () => {
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setSlots(prev.slots);
        setShapes(prev.shapes);
        setUndoStack((s) => s.slice(0, -1));
        setSelectedSlot(null);
    };

    const screenToCanvas = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        return {
            x: (clientX - rect.left) * scaleX / zoom - panOffset.x / zoom,
            y: (clientY - rect.top) * scaleY / zoom - panOffset.y / zoom,
        };
    };

    const hitTestSlot = (cx: number, cy: number): number => {
        for (let i = slots.length - 1; i >= 0; i--) {
            const s = slots[i];
            const w = s.dimensions.width;
            const h = s.dimensions.height;
            // Rough hit test ignoring rotation for simplicity, or just rect check
            if (
                cx >= s.position.x && cx <= s.position.x + w &&
                cy >= s.position.y && cy <= s.position.y + h
            ) return i;
        }
        return -1;
    };

    const hitTestShape = (cx: number, cy: number): number => {
        // Eraser hit testing
        const threshold = 10;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const s = shapes[i];
            if (s.type === 'line' || s.type === 'rect') {
                const [x1, y1, x2, y2] = s.points;
                const minX = Math.min(x1, x2) - threshold;
                const maxX = Math.max(x1, x2) + threshold;
                const minY = Math.min(y1, y2) - threshold;
                const maxY = Math.max(y1, y2) + threshold;
                if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) return i;
            } else if (s.type === 'arc') {
                const [x, y, r] = s.points;
                const d = Math.hypot(cx - x, cy - y);
                if (Math.abs(d - r) <= threshold * 2 || d <= r) return i;
            }
        }
        return -1;
    };

    // Load data
    useEffect(() => {
        if (!id) return;
        fetch(`/api/parking/${id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                setGround(data);
                if (data.layoutDrawing) setShapes(data.layoutDrawing);
                if (data.layoutImage) {
                    setBgImageSrc(data.layoutImage);
                }
            });
        fetch(`/api/slots?parkingGroundId=${id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data) && data.length > 0) {
                    setSlots(data);
                    setSlotCounter(data.length + 1);
                }
            });
    }, [id, token]);

    // Load background image
    useEffect(() => {
        if (!bgImageSrc) {
            setBgImage(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setBgImage(img);
        img.src = bgImageSrc;
    }, [bgImageSrc]);

    // Draw canvas
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.save();
        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        // Background Draft
        if (bgImage) {
            ctx.globalAlpha = 0.5; // Dim the draft image
            // determine aspect ratio
            const scale = Math.min(CANVAS_W / bgImage.width, CANVAS_H / bgImage.height);
            ctx.drawImage(bgImage, 0, 0, bgImage.width * scale, bgImage.height * scale);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }

        // Grid lines
        if (snapToGrid) {
            ctx.strokeStyle = "#ffffff08";
            ctx.lineWidth = 0.5;
            for (let x = 0; x < CANVAS_W; x += GRID_SIZE) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
            }
            for (let y = 0; y < CANVAS_H; y += GRID_SIZE) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
            }
        }

        // Draw generic shapes
        const shapesToDraw = currentDraftShape ? [...shapes, currentDraftShape] : shapes;
        shapesToDraw.forEach(shape => {
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = shape.lineWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            if (shape.type === 'line') {
                ctx.moveTo(shape.points[0], shape.points[1]);
                ctx.lineTo(shape.points[2], shape.points[3]);
                ctx.stroke();
            } else if (shape.type === 'rect') {
                ctx.strokeRect(shape.points[0], shape.points[1], shape.points[2] - shape.points[0], shape.points[3] - shape.points[1]);
            } else if (shape.type === 'arc') {
                ctx.arc(shape.points[0], shape.points[1], shape.points[2], shape.points[3], shape.points[4]);
                ctx.stroke();
            }
        });

        // Draw slots
        slots.forEach((slot, i) => {
            const isSelected = selectedSlot === i;
            const color = VEHICLE_COLORS[slot.vehicleType];
            const statusColor = STATUS_COLORS[slot.status];
            const x = slot.position.x;
            const y = slot.position.y;
            const w = slot.dimensions.width;
            const h = slot.dimensions.height;
            const clr = slot.clearance * PIXELS_PER_CM;

            ctx.save();
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((slot.rotation * Math.PI) / 180);

            // Clearance outline
            if (isSelected && clr > 0) {
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = "#ffffff30";
                ctx.lineWidth = 1;
                ctx.strokeRect(-w / 2 - clr, -h / 2 - clr, w + clr * 2, h + clr * 2);
                ctx.setLineDash([]);
            }

            // Shadow
            if (isSelected) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
            }

            // Slot background
            ctx.fillStyle = isSelected ? `${color}50` : `${color}20`;
            ctx.strokeStyle = isSelected ? color : `${statusColor}80`;
            ctx.lineWidth = isSelected ? 2.5 : 1.5;

            // Box
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, 4);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Status dot
            ctx.fillStyle = statusColor;
            ctx.beginPath();
            ctx.arc(w / 2 - 8, -h / 2 + 8, 4, 0, Math.PI * 2);
            ctx.fill();

            // EV / Handicap
            if (slot.isEV) {
                ctx.fillStyle = "#facc15";
                ctx.font = "bold 12px sans-serif";
                ctx.textAlign = "left";
                ctx.fillText("⚡", -w / 2 + 6, -h / 2 + 14);
            }
            if (slot.isAccessible) {
                ctx.fillStyle = "#0ea5e9";
                ctx.font = "bold 12px sans-serif";
                ctx.textAlign = "left"; // Draw Wheelchair icon placeholder
                ctx.fillText("♿", -w / 2 + 6, h / 2 - 6);
            }

            // Labels
            ctx.fillStyle = "#fff";
            ctx.font = "bold 12px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(slot.slotNumber, 0, -5);
            ctx.font = "10px Inter, sans-serif";
            ctx.fillStyle = "#ffffff99";
            ctx.fillText(slot.vehicleType.toUpperCase(), 0, 12);
            ctx.font = "8px Inter, sans-serif";
            ctx.fillStyle = "#ffffff60";
            ctx.fillText(`${slot.realDimensions.length}x${slot.realDimensions.width} cm`, 0, h / 2 - 10);

            ctx.restore();
        });

        ctx.restore();

    }, [slots, shapes, currentDraftShape, selectedSlot, bgImage, zoom, panOffset, snapToGrid]);

    useEffect(() => { drawCanvas(); }, [drawCanvas]);

    // Input handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
            return;
        }

        if (currentTool === "eraser") {
            const idx = hitTestShape(x, y);
            if (idx >= 0) {
                pushUndo();
                setShapes(s => s.filter((_, i) => i !== idx));
            }
            return;
        }

        if (["line", "rect", "arc"].includes(currentTool)) {
            pushUndo();
            setIsInteracting(true);
            setInteractionStart({ x: snap(x), y: snap(y) });
            return;
        }

        if (currentTool === "select") {
            const idx = hitTestSlot(x, y);
            if (idx >= 0) {
                pushUndo();
                setSelectedSlot(idx);
                setIsInteracting(true);
                setInteractionStart({ x: x - slots[idx].position.x, y: y - slots[idx].position.y });
            } else {
                setSelectedSlot(null);
            }
        } else {
            // Placing a vehicle slot
            pushUndo();
            const realDims = DEFAULT_REAL_DIMS[currentTool as string];
            // Swap length/width if we assume vehicles are parked vertically by default
            const pxWidth = Math.round(realDims.width * PIXELS_PER_CM);
            const pxHeight = Math.round(realDims.length * PIXELS_PER_CM);

            const newSlot: SlotData = {
                slotNumber: `${currentTool.charAt(0).toUpperCase()}${slotCounter}`,
                vehicleType: currentTool as any,
                position: { x: snap(x - pxWidth / 2), y: snap(y - pxHeight / 2) },
                dimensions: { width: pxWidth, height: pxHeight },
                realDimensions: { length: realDims.length, width: realDims.width },
                clearance: 30, // Default 30cm clearance
                rotation: 0,
                row: "A",
                status: "available",
                isEV: currentTool === "ev",
                isAccessible: false,
            };
            setSlots((prev) => [...prev, newSlot]);
            setSelectedSlot(slots.length);
            setSlotCounter((c) => c + 1);
            setCurrentTool("select");
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
            setPanOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y,
            });
            return;
        }

        const { x, y } = screenToCanvas(e.clientX, e.clientY);

        if (isInteracting && ["line", "rect", "arc"].includes(currentTool)) {
            const endX = snap(x);
            const endY = snap(y);
            const shape: DrawingShape = {
                id: Date.now().toString(),
                type: currentTool as "line" | "rect" | "arc",
                color: drawingColor,
                lineWidth: 3,
                points: []
            };

            if (currentTool === 'line' || currentTool === 'rect') {
                shape.points = [interactionStart.x, interactionStart.y, endX, endY];
            } else if (currentTool === 'arc') {
                const radius = Math.hypot(endX - interactionStart.x, endY - interactionStart.y);
                shape.points = [interactionStart.x, interactionStart.y, radius, 0, Math.PI * 2];
            }
            setCurrentDraftShape(shape);
            return;
        }

        if (isInteracting && currentTool === "select" && selectedSlot !== null) {
            const updated = [...slots];
            updated[selectedSlot] = {
                ...updated[selectedSlot],
                position: {
                    x: snap(x - interactionStart.x),
                    y: snap(y - interactionStart.y),
                },
            };
            setSlots(updated);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        if (isInteracting && ["line", "rect", "arc"].includes(currentTool) && currentDraftShape) {
            setShapes(prev => [...prev, currentDraftShape]);
        }
        setIsInteracting(false);
        setCurrentDraftShape(null);
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.min(3, Math.max(0.3, z + delta)));
    };

    // Zoom controls
    const zoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
    const zoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2));
    const resetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };

    // File upload (Local only, for reference)
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Read locally and set as background
        const url = URL.createObjectURL(file);
        setBgImageSrc(url);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Update slots
            const existing = await fetch(`/api/slots?parkingGroundId=${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json());
            if (Array.isArray(existing)) {
                for (const s of existing) {
                    await fetch(`/api/slots/${s._id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                    });
                }
            }
            await fetch("/api/slots", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ parkingGroundId: id, slots }),
            });

            // Update parking ground with ONLY drawings (no layout image is saved)
            await fetch(`/api/parking/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    totalCapacity: slots.length,
                    layoutDrawing: shapes,
                    // layoutImage is no longer being saved, it's strictly a local reference
                }),
            });
            alert("Layout saved successfully!");
        } catch (err) { console.error(err); }
        setSaving(false);
    };

    const duplicateSlot = () => {
        if (selectedSlot === null) return;
        pushUndo();
        // Create a copy slightly offset so it doesn't overlap perfectly
        const original = slots[selectedSlot];

        // Increment the slot counter for the new name
        // E.g., if original is "C1", new might be "C2" or just use the counter
        const prefix = original.vehicleType.charAt(0).toUpperCase();
        const newNumber = `${prefix}${slotCounter}`;

        const clonedSlot: SlotData = {
            ...original,
            _id: undefined, // ensure it gets a new ID from DB later
            slotNumber: newNumber,
            position: {
                x: snap(original.position.x + GRID_SIZE * 2),
                y: snap(original.position.y + GRID_SIZE * 2),
            },
        };

        setSlots([...slots, clonedSlot]);
        setSelectedSlot(slots.length); // Select the new duplicate
        setSlotCounter(c => c + 1);
    };

    const deleteSlot = () => {
        if (selectedSlot === null) return;
        pushUndo();
        setSlots(slots.filter((_, i) => i !== selectedSlot));
        setSelectedSlot(null);
    };

    const updateSelected = (updates: Partial<SlotData>) => {
        if (selectedSlot === null) return;
        const updated = [...slots];

        // Complex update: if realDimensions change, update screen dimensions
        if (updates.realDimensions) {
            updates.dimensions = {
                width: Math.round(updates.realDimensions.width * PIXELS_PER_CM),
                height: Math.round(updates.realDimensions.length * PIXELS_PER_CM),
            };
        }

        updated[selectedSlot] = { ...updated[selectedSlot], ...updates };
        setSlots(updated);
    };

    const drawTools = [
        { key: "select", label: "Select", icon: MousePointer },
        { key: "line", label: "Wall Line", icon: Minus },
        { key: "rect", label: "Area", icon: Square },
        { key: "arc", label: "Curve", icon: Circle },
        { key: "eraser", label: "Eraser", icon: Eraser },
    ];

    const objectTools = [
        { key: "car", label: "Car", icon: Car },
        { key: "bike", label: "Bike", icon: Bike },
        { key: "pickup", label: "Pickup", icon: Car },
        { key: "ev", label: "EV", icon: Zap },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Layout Architecture Editor</h1>
                    <p className="text-muted-foreground mt-1">{ground?.name || "Loading..."}</p>
                </div>
                <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" />

                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload draft PNG as reference">
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload Draft
                    </Button>

                    {bgImageSrc && (
                        <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setBgImageSrc(null)}>
                            <ImageOff className="mr-2 h-4 w-4" /> Clear Draft
                        </Button>
                    )}

                    <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-chart-1 hover:opacity-90">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save System
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                {/* Canvas area */}
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-border/50 bg-muted/30">
                        <div className="flex items-center gap-1 flex-wrap mb-2">
                            <span className="text-xs font-semibold mr-2 opacity-70 uppercase tracking-wider">Draw Tools:</span>
                            {drawTools.map((t) => (
                                <Button
                                    key={t.key}
                                    variant={currentTool === t.key ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setCurrentTool(t.key as EditorTool)}
                                    className={`h-8 px-2.5 ${currentTool === t.key ? "shadow-md" : ""}`}
                                >
                                    <t.icon className="mr-1.5 h-3.5 w-3.5" />
                                    <span className="text-xs">{t.label}</span>
                                </Button>
                            ))}
                            {(currentTool === 'line' || currentTool === 'rect' || currentTool === 'arc') && (
                                <div className="flex gap-1 ml-2 pl-2 border-l border-border/50">
                                    {['#ffffff', '#64748b', '#ef4444', '#eab308'].map(c => (
                                        <button key={c} onClick={() => setDrawingColor(c)} className={`w-6 h-6 rounded-full border-2 ${drawingColor === c ? 'border-primary' : 'border-transparent'}`} style={{ background: c }} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs font-semibold mr-2 opacity-70 uppercase tracking-wider">Vehicles:</span>
                            {objectTools.map((t) => (
                                <Button
                                    key={t.key}
                                    variant={currentTool === t.key ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setCurrentTool(t.key as EditorTool)}
                                    className={`h-8 px-2.5 ${currentTool === t.key ? "bg-chart-2 hover:bg-chart-2/80 text-white" : ""}`}
                                >
                                    <t.icon className="mr-1.5 h-3.5 w-3.5" />
                                    <span className="text-xs">{t.label}</span>
                                </Button>
                            ))}

                            <div className="w-px h-6 bg-border/50 mx-2" />

                            <Button variant="ghost" size="sm" onClick={zoomOut} className="h-8 w-8 p-0"><ZoomOut className="h-3.5 w-3.5" /></Button>
                            <span className="text-xs text-muted-foreground min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                            <Button variant="ghost" size="sm" onClick={zoomIn} className="h-8 w-8 p-0"><ZoomIn className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="sm" onClick={resetView} className="h-8 w-8 p-0" title="Reset View"><Move className="h-3.5 w-3.5" /></Button>

                            <div className="w-px h-6 bg-border/50 mx-1" />
                            <Button variant={snapToGrid ? "default" : "ghost"} size="sm" onClick={() => setSnapToGrid(!snapToGrid)} className="h-8 px-2.5">
                                <Grid3X3 className="mr-1 h-3.5 w-3.5" /> <span className="text-xs">Snap</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={undo} disabled={undoStack.length === 0} className="h-8 px-2.5">
                                <Undo2 className="mr-1 h-3.5 w-3.5" /> <span className="text-xs">Undo</span>
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden bg-slate-950 relative" style={{ minHeight: "600px", cursor: currentTool === "select" ? (isInteracting ? "grabbing" : "default") : currentTool === "eraser" ? "not-allowed" : "crosshair" }}>
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onWheel={handleWheel}
                            onContextMenu={(e) => e.preventDefault()}
                        />
                    </div>
                </Card>

                {/* Properties Panel */}
                <div className="flex flex-col gap-4 overflow-y-auto">
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="pb-3 border-b border-border/50">
                            <CardTitle className="text-sm">Slot Configuration</CardTitle>
                            <CardDescription className="text-xs">Manage real-world dimensions</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {selectedSlot !== null && slots[selectedSlot] ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs opacity-70">Slot ID</Label>
                                            <Input value={slots[selectedSlot].slotNumber} onChange={(e) => updateSelected({ slotNumber: e.target.value })} className="h-8 text-sm font-mono" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs opacity-70">Vehicle Type</Label>
                                            <select
                                                value={slots[selectedSlot].vehicleType}
                                                onChange={(e) => updateSelected({ vehicleType: e.target.value as SlotData["vehicleType"] })}
                                                className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                                            >
                                                <option value="car">Car</option>
                                                <option value="bike">Bike</option>
                                                <option value="pickup">Pickup</option>
                                                <option value="ev">EV</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Move className="w-4 h-4 text-chart-2" />
                                            <span className="text-xs font-semibold">Real-world Area (cm)</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Length (cm)</Label>
                                                <Input type="number"
                                                    value={slots[selectedSlot].realDimensions.length}
                                                    onChange={(e) => updateSelected({ realDimensions: { ...slots[selectedSlot].realDimensions, length: parseInt(e.target.value) || 200 } })}
                                                    className="h-8 text-sm" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Width (cm)</Label>
                                                <Input type="number"
                                                    value={slots[selectedSlot].realDimensions.width}
                                                    onChange={(e) => updateSelected({ realDimensions: { ...slots[selectedSlot].realDimensions, width: parseInt(e.target.value) || 100 } })}
                                                    className="h-8 text-sm" />
                                            </div>
                                        </div>
                                        <div className="space-y-1 pt-1 border-t border-border/50">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Clearance Gap (cm)</Label>
                                                <span className="text-xs font-mono">{slots[selectedSlot].clearance} cm</span>
                                            </div>
                                            <Input type="number"
                                                value={slots[selectedSlot].clearance}
                                                onChange={(e) => updateSelected({ clearance: parseInt(e.target.value) || 0 })}
                                                className="h-8 text-sm" placeholder="Extra space required" />
                                            <p className="text-[10px] text-muted-foreground leading-tight">Must be clear for doors/maneuvring.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs opacity-70">Status</Label>
                                            <select value={slots[selectedSlot].status} onChange={(e) => updateSelected({ status: e.target.value as SlotData["status"] })} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                                                <option value="available">Available</option>
                                                <option value="booked">Booked</option>
                                                <option value="blocked">Blocked</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs opacity-70">Rotation (°)</Label>
                                            <Input type="number" value={slots[selectedSlot].rotation} onChange={(e) => updateSelected({ rotation: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 bg-background border border-border/50 p-2 rounded-md">
                                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                            <input type="checkbox" checked={slots[selectedSlot].isEV} onChange={(e) => updateSelected({ isEV: e.target.checked })} className="rounded accent-yellow-500" />
                                            ⚡ EV Spot
                                        </label>
                                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                            <input type="checkbox" checked={slots[selectedSlot].isAccessible} onChange={(e) => updateSelected({ isAccessible: e.target.checked })} className="rounded accent-sky-500" />
                                            ♿ Accessible
                                        </label>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button variant="outline" className="flex-1" onClick={duplicateSlot}>
                                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                                        </Button>
                                        <Button variant="destructive" size="icon" onClick={deleteSlot}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                                    <MousePointer className="w-8 h-8 opacity-20 mb-2" />
                                    <p className="text-sm font-medium">No Element Selected</p>
                                    <p className="text-xs mt-1">Use Select tool and click a parking slot to configure rules and dimensions.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
                            <p className="font-semibold text-foreground flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Instructions</p>
                            <ul className="list-disc pl-4 space-y-1 opacity-80">
                                <li>Upload a PNG draft of the parking floorplan.</li>
                                <li>Use <b>Wall Line</b> and <b>Area</b> tools to draw walls permanently.</li>
                                <li>Place vehicle slots on parking spaces.</li>
                                <li>Adjust <b>Real-world dimensions</b> and <b>Clearance</b> to enable Smart Size Validation for users.</li>
                                <li>Click <b>Remove Draft</b> before saving to discard the PNG map and only keep your structural drawings.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
