"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Car, Bike, Zap, Loader2, Trash2, Star, Pencil } from "lucide-react";

interface Vehicle {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    color: string;
    model: string;
    isDefault: boolean;
}

const TYPE_ICONS: Record<string, typeof Car> = { car: Car, bike: Bike, ev: Zap, pickup: Car };

export default function VehiclesPage() {
    const { token } = useAuthStore();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ vehicleNumber: "", vehicleType: "car", color: "", model: "", isDefault: false });
    const [saving, setSaving] = useState(false);

    const fetchVehicles = () => {
        fetch("/api/vehicles", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then(setVehicles)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchVehicles(); }, [token]);

    const handleAdd = async () => {
        setSaving(true);
        await fetch("/api/vehicles", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
        });
        setShowAdd(false);
        setForm({ vehicleNumber: "", vehicleType: "car", color: "", model: "", isDefault: false });
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
                    <p className="text-muted-foreground text-sm mt-1">Manage your registered vehicles</p>
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
                        <p className="text-sm text-muted-foreground mb-4">Add your vehicle to start booking</p>
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
                                                <div className="text-xs text-muted-foreground capitalize">{v.vehicleType}</div>
                                            </div>
                                        </div>
                                        {v.isDefault && (
                                            <Badge variant="success" className="text-[10px]">
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
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(v._id)}>
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
                <DialogContent className="bg-card backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Add Vehicle</DialogTitle>
                        <DialogDescription>Register a new vehicle to your account</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Vehicle Number</Label>
                            <Input value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} placeholder="KA01AB1234" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Vehicle Type</Label>
                            <select
                                value={form.vehicleType}
                                onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                <option value="car">Car</option>
                                <option value="bike">Bike</option>
                                <option value="ev">EV</option>
                                <option value="pickup">Pickup</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Model</Label>
                                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Honda City" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Color</Label>
                                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="White" />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded" />
                            Set as default vehicle
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Add Vehicle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
