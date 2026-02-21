"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Save, Upload, Trash2, Car, Bike, Zap, RotateCcw, Loader2,
} from "lucide-react";

interface SlotData {
    _id?: string;
    slotNumber: string;
    vehicleType: "car" | "bike" | "pickup" | "ev";
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
    rotation: number;
    row: string;
    status: "available" | "booked" | "blocked";
    isEV: boolean;
    isAccessible: boolean;
}

interface ParkingGround {
    _id: string;
    name: string;
    layoutImage: string;
}

const VEHICLE_COLORS: Record<string, string> = {
    car: "#3b82f6",
    bike: "#10b981",
    pickup: "#f59e0b",
    ev: "#8b5cf6",
};

const VEHICLE_ICONS: Record<string, typeof Car> = {
    car: Car,
    bike: Bike,
    pickup: Car,
    ev: Zap,
};

const STATUS_COLORS: Record<string, string> = {
    available: "#22c55e",
    booked: "#ef4444",
    blocked: "#6b7280",
};

export default function LayoutEditorPage() {
    const { id } = useParams<{ id: string }>();
    const { token } = useAuthStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [ground, setGround] = useState<ParkingGround | null>(null);
    const [slots, setSlots] = useState<SlotData[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [currentTool, setCurrentTool] = useState<"car" | "bike" | "pickup" | "ev">("car");
    const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [slotCounter, setSlotCounter] = useState(1);

    // Fetch parking ground and slots
    useEffect(() => {
        if (!id) return;
        fetch(`/api/parking/${id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                setGround(data);
                if (data.slots) {
                    setSlots(data.slots);
                    setSlotCounter(data.slots.length + 1);
                }
                if (data.layoutImage) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => setBgImage(img);
                    img.src = data.layoutImage;
                }
            });
    }, [id, token]);

    // Draw canvas
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = "#1a1a2e";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Grid
            ctx.strokeStyle = "#ffffff10";
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 30) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 30) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }
        }

        // Draw slots
        slots.forEach((slot, i) => {
            ctx.save();
            ctx.translate(slot.position.x + slot.dimensions.width / 2, slot.position.y + slot.dimensions.height / 2);
            ctx.rotate((slot.rotation * Math.PI) / 180);

            const isSelected = selectedSlot === i;
            const color = VEHICLE_COLORS[slot.vehicleType];
            const statusColor = STATUS_COLORS[slot.status];

            // Slot background
            ctx.fillStyle = isSelected ? `${color}40` : `${color}25`;
            ctx.strokeStyle = isSelected ? color : statusColor;
            ctx.lineWidth = isSelected ? 2 : 1.5;

            const w = slot.dimensions.width;
            const h = slot.dimensions.height;
            const r = 4;
            ctx.beginPath();
            ctx.moveTo(-w / 2 + r, -h / 2);
            ctx.lineTo(w / 2 - r, -h / 2);
            ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
            ctx.lineTo(w / 2, h / 2 - r);
            ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
            ctx.lineTo(-w / 2 + r, h / 2);
            ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
            ctx.lineTo(-w / 2, -h / 2 + r);
            ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Status indicator dot
            ctx.fillStyle = statusColor;
            ctx.beginPath();
            ctx.arc(w / 2 - 6, -h / 2 + 6, 3, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = "#fff";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(slot.slotNumber, 0, -2);
            ctx.font = "8px sans-serif";
            ctx.fillStyle = "#ffffff99";
            ctx.fillText(slot.vehicleType.toUpperCase(), 0, 8);

            ctx.restore();
        });
    }, [slots, selectedSlot, bgImage]);

    useEffect(() => { drawCanvas(); }, [drawCanvas]);

    // Handle canvas click - add or select slot
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragging) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on existing slot
        const clickedIdx = slots.findIndex(
            (s) =>
                x >= s.position.x && x <= s.position.x + s.dimensions.width &&
                y >= s.position.y && y <= s.position.y + s.dimensions.height
        );

        if (clickedIdx >= 0) {
            setSelectedSlot(clickedIdx);
            return;
        }

        // Add new slot
        const dims = currentTool === "bike" ? { width: 30, height: 50 } : { width: 60, height: 30 };
        const newSlot: SlotData = {
            slotNumber: `${currentTool.charAt(0).toUpperCase()}${slotCounter}`,
            vehicleType: currentTool,
            position: { x: x - dims.width / 2, y: y - dims.height / 2 },
            dimensions: dims,
            rotation: 0,
            row: "A",
            status: "available",
            isEV: currentTool === "ev",
            isAccessible: false,
        };
        setSlots([...slots, newSlot]);
        setSelectedSlot(slots.length);
        setSlotCounter(slotCounter + 1);
    };

    // Handle drag
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const idx = slots.findIndex(
            (s) =>
                x >= s.position.x && x <= s.position.x + s.dimensions.width &&
                y >= s.position.y && y <= s.position.y + s.dimensions.height
        );

        if (idx >= 0) {
            setDragging(true);
            setSelectedSlot(idx);
            setDragOffset({ x: x - slots[idx].position.x, y: y - slots[idx].position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dragging || selectedSlot === null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - dragOffset.x;
        const y = e.clientY - rect.top - dragOffset.y;

        const updated = [...slots];
        updated[selectedSlot] = { ...updated[selectedSlot], position: { x, y } };
        setSlots(updated);
    };

    const handleMouseUp = () => { setDragging(false); };

    // Upload layout image
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("layout", file);
        try {
            const res = await fetch(`/api/parking/${id}/upload`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (data.layoutImage) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => setBgImage(img);
                img.src = data.layoutImage;
            }
        } catch (e) { console.error(e); }
        setUploading(false);
    };

    // Save slots
    const handleSave = async () => {
        setSaving(true);
        try {
            // Delete existing slots
            const existing = await fetch(`/api/slots?parkingGroundId=${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json());
            for (const s of existing) {
                await fetch(`/api/slots/${s._id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
            // Create new
            await fetch("/api/slots", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ parkingGroundId: id, slots }),
            });
            // Update capacity
            await fetch(`/api/parking/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ totalCapacity: slots.length }),
            });
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const deleteSlot = () => {
        if (selectedSlot === null) return;
        setSlots(slots.filter((_, i) => i !== selectedSlot));
        setSelectedSlot(null);
    };

    const updateSelected = (updates: Partial<SlotData>) => {
        if (selectedSlot === null) return;
        const updated = [...slots];
        updated[selectedSlot] = { ...updated[selectedSlot], ...updates };
        setSlots(updated);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Layout Editor</h1>
                    <p className="text-muted-foreground mt-1">{ground?.name || "Loading..."}</p>
                </div>
                <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload Layout
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-chart-1 hover:opacity-90">
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save ({slots.length} slots)
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_300px] gap-4">
                {/* Canvas */}
                <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden">
                    <CardContent className="p-0">
                        {/* Tool bar */}
                        <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-muted/30">
                            {(["car", "bike", "pickup", "ev"] as const).map((t) => {
                                const Icon = VEHICLE_ICONS[t];
                                return (
                                    <Button
                                        key={t}
                                        variant={currentTool === t ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setCurrentTool(t)}
                                        className={currentTool === t ? "shadow-md" : ""}
                                    >
                                        <Icon className="mr-1.5 h-3.5 w-3.5" />
                                        <span className="capitalize">{t}</span>
                                    </Button>
                                );
                            })}
                            <div className="flex-1" />
                            <Badge variant="outline">{slots.length} slots</Badge>
                        </div>
                        <canvas
                            ref={canvasRef}
                            width={800}
                            height={500}
                            className="w-full cursor-crosshair"
                            onClick={handleCanvasClick}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />
                    </CardContent>
                </Card>

                {/* Properties Panel */}
                <div className="space-y-4">
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Slot Properties</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedSlot !== null && slots[selectedSlot] ? (
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Slot Number</Label>
                                        <Input
                                            value={slots[selectedSlot].slotNumber}
                                            onChange={(e) => updateSelected({ slotNumber: e.target.value })}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Vehicle Type</Label>
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
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Row</Label>
                                        <Input
                                            value={slots[selectedSlot].row}
                                            onChange={(e) => updateSelected({ row: e.target.value })}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Width</Label>
                                            <Input
                                                type="number" value={slots[selectedSlot].dimensions.width}
                                                onChange={(e) => updateSelected({ dimensions: { ...slots[selectedSlot].dimensions, width: parseInt(e.target.value) } })}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Height</Label>
                                            <Input
                                                type="number" value={slots[selectedSlot].dimensions.height}
                                                onChange={(e) => updateSelected({ dimensions: { ...slots[selectedSlot].dimensions, height: parseInt(e.target.value) } })}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Rotation (°)</Label>
                                        <Input
                                            type="number" value={slots[selectedSlot].rotation}
                                            onChange={(e) => updateSelected({ rotation: parseInt(e.target.value) })}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Status</Label>
                                        <select
                                            value={slots[selectedSlot].status}
                                            onChange={(e) => updateSelected({ status: e.target.value as SlotData["status"] })}
                                            className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                                        >
                                            <option value="available">Available</option>
                                            <option value="booked">Booked</option>
                                            <option value="blocked">Blocked</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedSlot(null)}>
                                            <RotateCcw className="mr-1.5 h-3 w-3" /> Deselect
                                        </Button>
                                        <Button variant="destructive" size="sm" className="flex-1" onClick={deleteSlot}>
                                            <Trash2 className="mr-1.5 h-3 w-3" /> Delete
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">Click on the canvas to add a slot, or click an existing slot to edit it.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Legend */}
                    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Legend</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {Object.entries(VEHICLE_COLORS).map(([type, color]) => (
                                <div key={type} className="flex items-center gap-2 text-xs">
                                    <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                                    <span className="capitalize">{type}</span>
                                </div>
                            ))}
                            <div className="border-t border-border/50 pt-2 mt-2 space-y-1.5">
                                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                                    <div key={status} className="flex items-center gap-2 text-xs">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="capitalize">{status}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
