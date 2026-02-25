"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Car, Bike, Zap, Loader2, Trash2, Star, Ruler } from "lucide-react";

interface Vehicle {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    color: string;
    model: string;
    dimensions: { length: number; width: number };
    isDefault: boolean;
}

const TYPE_ICONS: Record<string, typeof Car> = { car: Car, bike: Bike, ev: Zap, pickup: Car };

const DEFAULT_REAL_DIMS: Record<string, { length: number; width: number }> = {
    car: { length: 450, width: 200 },
    bike: { length: 200, width: 80 },
    pickup: { length: 550, width: 220 },
    ev: { length: 450, width: 200 },
};

export default function VehiclesPage() {
    const { token } = useAuthStore();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({
        vehicleNumber: "",
        vehicleType: "car",
        color: "",
        model: "",
        dimensions: { length: 450, width: 200 },
        isDefault: false
    });
    const [saving, setSaving] = useState(false);

    const fetchVehicles = () => {
        fetch("/api/vehicles", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => setVehicles(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchVehicles(); }, [token]);

    const handleTypeChange = (type: string) => {
        const dims = DEFAULT_REAL_DIMS[type] || { length: 450, width: 200 };
        setForm({ ...form, vehicleType: type, dimensions: dims });
    };

    const handleAdd = async () => {
        setSaving(true);
        await fetch("/api/vehicles", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
        });
        setShowAdd(false);
        setForm({ vehicleNumber: "", vehicleType: "car", color: "", model: "", dimensions: { length: 450, width: 200 }, isDefault: false });
        fetchVehicles();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this vehicle?")) return;
        await fetch(`/api/vehicles/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchVehicles();
    };

    const setDefault = async (id: string) => {
        await fetch(`/api/vehicles/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isDefault: true }),
        });
        fetchVehicles();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">My Vehicles</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your registered vehicles and precise dimensions</p>
                </div>
                <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-chart-2 to-primary hover:opacity-90">
                    <Plus className="mr-2 h-4 w-4" /> Add Vehicle
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : vehicles.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-16 text-center">
                        <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">No Vehicles Added</h3>
                        <p className="text-sm text-muted-foreground mb-4">Add your vehicle to start booking parking accurately</p>
                        <Button onClick={() => setShowAdd(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Vehicle
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vehicles.map((v) => {
                        const Icon = TYPE_ICONS[v.vehicleType] || Car;
                        return (
                            <Card key={v._id} className={`bg-card/50 backdrop-blur-sm transition-all ${v.isDefault ? "border-primary/40 shadow-lg shadow-primary/5" : "border-border/50 hover:border-primary/20"}`}>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Icon className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg">{v.vehicleNumber}</div>
                                                <div className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                                                    {v.vehicleType}
                                                    {v.dimensions && (
                                                        <span className="flex items-center ml-2 border-l border-border pl-2 opacity-80" title="Vehicle Dimensions (cm)">
                                                            <Ruler className="h-3 w-3 mr-1" />
                                                            {v.dimensions.length}×{v.dimensions.width} cm
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {v.isDefault && (
                                            <Badge variant="success" className="text-[10px] ml-2">
                                                <Star className="mr-0.5 h-2.5 w-2.5" /> Default
                                            </Badge>
                                        )}
                                    </div>
                                    {(v.model || v.color) && (
                                        <div className="flex gap-2 mb-3">
                                            {v.model && <Badge variant="outline" className="text-xs">{v.model}</Badge>}
                                            {v.color && <Badge variant="outline" className="text-xs">{v.color}</Badge>}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        {!v.isDefault && (
                                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setDefault(v._id)}>
                                                <Star className="mr-1.5 h-3 w-3" /> Set Default
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" className="text-destructive border border-destructive/20 hover:bg-destructive/10" onClick={() => handleDelete(v._id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add Vehicle Dialog */}
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="bg-card backdrop-blur-xl max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Vehicle</DialogTitle>
                        <DialogDescription>Register a new vehicle with its exact size</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Vehicle Number</Label>
                                <Input value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} placeholder="KA01AB1234" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Vehicle Type</Label>
                                <select
                                    value={form.vehicleType}
                                    onChange={(e) => handleTypeChange(e.target.value)}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="car">Car</option>
                                    <option value="bike">Bike</option>
                                    <option value="ev">EV</option>
                                    <option value="pickup">Pickup</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Model (optional)</Label>
                                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Honda City" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Color (optional)</Label>
                                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="White" />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5 text-chart-2" /> Vehicle Dimensions</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Length (cm)</Label>
                                    <Input type="number" value={form.dimensions.length} onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, length: parseInt(e.target.value) || 0 } })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Width (cm)</Label>
                                    <Input type="number" value={form.dimensions.width} onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, width: parseInt(e.target.value) || 0 } })} />
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2">Precise dimensions are required to ensure the vehicle fits into the designated parking slots safely.</p>
                        </div>

                        <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded" />
                            Set as default vehicle
                        </label>
                    </div>
                    <DialogFooter className="mt-4 border-t border-border/50 pt-4">
                        <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={saving} className="bg-primary hover:opacity-90">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Register Vehicle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
