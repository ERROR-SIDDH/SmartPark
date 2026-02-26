"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Search, Loader2, Car, Bike, Zap, Truck, User, Palette,
} from "lucide-react";

interface VehicleEntry {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    color: string;
    vehicleModel: string;
    isDefault: boolean;
    createdAt: string;
    dimensions: { length: number; width: number };
    userId: { name: string; email: string; employeeCode: string; department: string } | null;
}

const typeIcons: Record<string, typeof Car> = { car: Car, bike: Bike, ev: Zap, pickup: Truck };
const typeColors: Record<string, string> = {
    car: "text-blue-500 bg-blue-500/10",
    bike: "text-amber-500 bg-amber-500/10",
    ev: "text-emerald-500 bg-emerald-500/10",
    pickup: "text-purple-500 bg-purple-500/10",
};

export default function AdminVehiclesPage() {
    const { token } = useAuthStore();
    const [vehicles, setVehicles] = useState<VehicleEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("");
    const [search, setSearch] = useState("");

    const fetchVehicles = (p = page, s = search) => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(p), limit: "20" });
        if (typeFilter) params.set("type", typeFilter);
        if (s) params.set("search", s);

        fetch(`/api/admin/vehicles?${params}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
                setTotal(data.total || 0);
                setCounts(data.counts || {});
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchVehicles(); }, [token, typeFilter]);

    const handleSearch = () => { setPage(1); fetchVehicles(1, search); };

    const totalVehicles = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vehicle Registry</h1>
                    <p className="text-sm text-muted-foreground mt-1">{totalVehicles} vehicles registered</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {Object.entries(counts).map(([k, v]) => {
                        const Icon = typeIcons[k] || Car;
                        return (
                            <Badge key={k} variant="outline" className="capitalize text-xs">
                                <Icon className="h-3 w-3 mr-1" /> {k}: {v}
                            </Badge>
                        );
                    })}
                </div>
            </div>

            {/* Type Filter */}
            <div className="flex flex-wrap gap-2">
                {[
                    { v: "", l: "All", icon: Car },
                    { v: "car", l: "Cars", icon: Car },
                    { v: "bike", l: "Bikes", icon: Bike },
                    { v: "ev", l: "EVs", icon: Zap },
                    { v: "pickup", l: "Pickups", icon: Truck },
                ].map((f) => (
                    <Button key={f.v} size="sm" variant={typeFilter === f.v ? "default" : "outline"} onClick={() => { setTypeFilter(f.v); setPage(1); }}>
                        <f.icon className="h-3.5 w-3.5 mr-1" /> {f.l}
                    </Button>
                ))}
            </div>

            {/* Search */}
            <div className="flex gap-2">
                <Input
                    placeholder="Search by plate number, model, color..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1 sm:max-w-md"
                />
                <Button variant="outline" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
            </div>

            {/* Vehicles List */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : vehicles.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-16 text-center">
                        <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">No Vehicles Found</h3>
                        <p className="text-sm text-muted-foreground mt-1">No registered vehicles match your criteria</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {vehicles.map((v) => {
                        const Icon = typeIcons[v.vehicleType] || Car;
                        const colorClass = typeColors[v.vehicleType] || "text-muted-foreground bg-muted";
                        return (
                            <Card key={v._id} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/10 transition-all">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-sm">{v.vehicleNumber}</h3>
                                                <Badge variant="outline" className="capitalize text-[10px]">{v.vehicleType}</Badge>
                                                {v.isDefault && <Badge variant="success" className="text-[10px]">Default</Badge>}
                                            </div>
                                            {v.vehicleModel && (
                                                <p className="text-xs text-muted-foreground">{v.vehicleModel}</p>
                                            )}
                                            {v.color && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Palette className="h-3 w-3" /> {v.color}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                                <User className="h-3 w-3" />
                                                <span className="truncate">
                                                    {v.userId?.name || "Unknown"} ({v.userId?.employeeCode || "—"})
                                                </span>
                                            </div>
                                            {v.userId?.department && (
                                                <p className="text-[10px] text-muted-foreground ml-4">{v.userId.department}</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {total > 20 && (
                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchVehicles(p); }}>Prev</Button>
                    <span className="text-sm text-muted-foreground flex items-center">Page {page} of {Math.ceil(total / 20)}</span>
                    <Button variant="outline" size="sm" disabled={vehicles.length < 20} onClick={() => { const p = page + 1; setPage(p); fetchVehicles(p); }}>Next</Button>
                </div>
            )}
        </div>
    );
}
