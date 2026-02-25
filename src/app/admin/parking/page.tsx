"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, MapPin, Car, Loader2, Pencil, Trash2, Clock, Settings2 } from "lucide-react";

interface ParkingGround {
    _id: string;
    name: string;
    address: string;
    location: { coordinates: [number, number] };
    totalCapacity: number;
    allowedVehicleTypes: string[];
    entryTimeWindow: number;
    layoutImage: string;
    slotsAvailable: number;
    totalSlots: number;
    evSlots: number;
}

type CreateForm = { name: string; address: string; latitude: string; longitude: string; totalCapacity: string; entryTimeWindow: string };
type EditForm = { name: string; address: string; latitude: string; longitude: string; totalCapacity: string; entryTimeWindow: string };

export default function ParkingGroundsPage() {
    const { token } = useAuthStore();
    const router = useRouter();
    const [grounds, setGrounds] = useState<ParkingGround[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<CreateForm>({ name: "", address: "", latitude: "", longitude: "", totalCapacity: "", entryTimeWindow: "15" });
    const [saving, setSaving] = useState(false);

    // Edit state
    const [editGround, setEditGround] = useState<ParkingGround | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({ name: "", address: "", latitude: "", longitude: "", totalCapacity: "", entryTimeWindow: "15" });
    const [editSaving, setEditSaving] = useState(false);

    const fetchGrounds = () => {
        fetch("/api/parking", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then(setGrounds)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchGrounds(); }, [token]);

    const handleCreate = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/parking", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: form.name,
                    address: form.address,
                    latitude: parseFloat(form.latitude),
                    longitude: parseFloat(form.longitude),
                    totalCapacity: parseInt(form.totalCapacity) || 0,
                    entryTimeWindow: parseInt(form.entryTimeWindow) || 15,
                    allowedVehicleTypes: ["car", "bike", "pickup", "ev"],
                }),
            });
            if (res.ok) {
                setShowCreate(false);
                setForm({ name: "", address: "", latitude: "", longitude: "", totalCapacity: "", entryTimeWindow: "15" });
                fetchGrounds();
            }
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    const openEdit = (g: ParkingGround) => {
        setEditGround(g);
        setEditForm({
            name: g.name,
            address: g.address,
            latitude: String(g.location.coordinates[1]),
            longitude: String(g.location.coordinates[0]),
            totalCapacity: String(g.totalCapacity),
            entryTimeWindow: String(g.entryTimeWindow ?? 15),
        });
    };

    const handleEdit = async () => {
        if (!editGround) return;
        setEditSaving(true);
        try {
            const res = await fetch(`/api/parking/${editGround._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: editForm.name,
                    address: editForm.address,
                    latitude: parseFloat(editForm.latitude),
                    longitude: parseFloat(editForm.longitude),
                    totalCapacity: parseInt(editForm.totalCapacity) || 0,
                    entryTimeWindow: parseInt(editForm.entryTimeWindow) || 15,
                }),
            });
            if (res.ok) {
                setEditGround(null);
                fetchGrounds();
            }
        } catch (e) { console.error(e); }
        setEditSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await fetch(`/api/parking/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchGrounds();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Parking Grounds</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage your parking infrastructure</p>
                </div>
                <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-primary to-chart-1 hover:opacity-90 w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Add Parking Ground
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : grounds.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-16 text-center">
                        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Parking Grounds</h3>
                        <p className="text-muted-foreground mb-4">Create your first parking ground to get started</p>
                        <Button onClick={() => setShowCreate(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Create Parking Ground
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grounds.map((g) => (
                        <Card key={g._id} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all group">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-lg">{g.name}</CardTitle>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)} title="Edit Details">
                                            <Settings2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/admin/parking/${g._id}/editor`)} title="Configure Slots">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(g._id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" /> {g.address}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="success">{g.slotsAvailable} available</Badge>
                                    <Badge variant="secondary">{g.totalSlots} total</Badge>
                                    {g.evSlots > 0 && <Badge variant="warning">{g.evSlots} EV</Badge>}
                                </div>
                                <div className="flex gap-1 flex-wrap">
                                    {g.allowedVehicleTypes.map((t) => (
                                        <Badge key={t} variant="outline" className="text-xs capitalize">{t}</Badge>
                                    ))}
                                </div>
                                {/* Extra details */}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/30">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Entry window: <strong>{g.entryTimeWindow ?? 15} min</strong>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> {g.location.coordinates[1].toFixed(4)}, {g.location.coordinates[0].toFixed(4)}
                                    </span>
                                </div>
                                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/admin/parking/${g._id}/editor`)}>
                                    <Car className="mr-2 h-3.5 w-3.5" /> Configure Slots
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="bg-card backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Create Parking Ground</DialogTitle>
                        <DialogDescription>Add a new parking facility to the system</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Building Parking" />
                        </div>
                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Business Park, City" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Latitude</Label>
                                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="12.9716" />
                            </div>
                            <div className="space-y-2">
                                <Label>Longitude</Label>
                                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="77.5946" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Total Capacity</Label>
                                <Input type="number" value={form.totalCapacity} onChange={(e) => setForm({ ...form, totalCapacity: e.target.value })} placeholder="100" />
                            </div>
                            <div className="space-y-2">
                                <Label>Entry Time Window (min)</Label>
                                <Input type="number" value={form.entryTimeWindow} onChange={(e) => setForm({ ...form, entryTimeWindow: e.target.value })} placeholder="15" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={saving} className="bg-gradient-to-r from-primary to-chart-1">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editGround} onOpenChange={(open) => { if (!open) setEditGround(null); }}>
                <DialogContent className="bg-card backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Edit Parking Ground</DialogTitle>
                        <DialogDescription>Update details for {editGround?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Latitude</Label>
                                <Input type="number" step="any" value={editForm.latitude} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Longitude</Label>
                                <Input type="number" step="any" value={editForm.longitude} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Total Capacity</Label>
                                <Input type="number" value={editForm.totalCapacity} onChange={(e) => setEditForm({ ...editForm, totalCapacity: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Entry Time Window (min)</Label>
                                <Input type="number" value={editForm.entryTimeWindow} onChange={(e) => setEditForm({ ...editForm, entryTimeWindow: e.target.value })} />
                                <p className="text-[10px] text-muted-foreground">How many minutes before booking start time can employees enter</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditGround(null)}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={editSaving} className="bg-gradient-to-r from-primary to-chart-1">
                            {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
