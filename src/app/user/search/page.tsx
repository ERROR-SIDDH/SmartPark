"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Search, MapPin, Navigation, Loader2,
    Car, Bike, Zap, ArrowRight,
} from "lucide-react";

interface ParkingResult {
    _id: string;
    name: string;
    address: string;
    slotsAvailable: number;
    totalSlots: number;
    evSlots: number;
    distance?: number;
    allowedVehicleTypes: string[];
}

export default function SearchPage() {
    const { token } = useAuthStore();
    const router = useRouter();
    const [vehicleType, setVehicleType] = useState("");
    const [searchText, setSearchText] = useState("");
    const [results, setResults] = useState<ParkingResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);

    const searchByText = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchText) params.set("search", searchText);
        if (vehicleType) params.set("vehicleType", vehicleType);
        const res = await fetch(`/api/parking?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setLoading(false);
    };

    const findNearby = () => {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                setLoading(true);
                const params = new URLSearchParams({
                    lat: pos.coords.latitude.toString(),
                    lng: pos.coords.longitude.toString(),
                    maxDistance: "10000",
                });
                if (vehicleType) params.set("vehicleType", vehicleType);
                const res = await fetch(`/api/parking/nearby?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setResults(Array.isArray(data) ? data : []);
                setLoading(false);
                setLocating(false);
            },
            () => setLocating(false)
        );
    };

    const types = [
        { value: "", label: "All", icon: Search },
        { value: "car", label: "Car", icon: Car },
        { value: "bike", label: "Bike", icon: Bike },
        { value: "ev", label: "EV", icon: Zap },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Find Parking</h1>
                <p className="text-sm text-muted-foreground mt-1">Search for available parking spots</p>
            </div>

            {/* Vehicle Type */}
            <div className="flex gap-2 flex-wrap">
                {types.map((t) => (
                    <Button
                        key={t.value}
                        variant={vehicleType === t.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVehicleType(t.value)}
                        className={vehicleType === t.value ? "shadow-md" : ""}
                    >
                        <t.icon className="mr-1.5 h-3.5 w-3.5" /> {t.label}
                    </Button>
                ))}
            </div>

            {/* Search */}
            <div className="flex flex-col sm:flex-row gap-2">
                <Input
                    placeholder="Search by parking name..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchByText()}
                    className="flex-1"
                />
                <div className="flex gap-2">
                    <Button variant="outline" onClick={searchByText} disabled={loading} className="flex-1 sm:flex-initial">
                        <Search className="h-4 w-4 mr-2 sm:mr-0" /><span className="sm:hidden">Search</span>
                    </Button>
                    <Button onClick={findNearby} disabled={locating} className="flex-1 sm:flex-initial bg-gradient-to-r from-chart-2 to-primary hover:opacity-90">
                        {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                        Nearby
                    </Button>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : results.length > 0 ? (
                <div className="space-y-3">
                    {results.map((r) => (
                        <Card key={r._id} className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/20 transition-all cursor-pointer group" onClick={() => router.push(`/user/book/${r._id}`)}>
                            <CardContent className="p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-base sm:text-lg group-hover:text-primary transition-colors truncate">{r.name}</h3>
                                        <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground mt-0.5">
                                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">{r.address}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                                            <Badge variant="success">{r.slotsAvailable} available</Badge>
                                            <Badge variant="secondary">{r.totalSlots} total</Badge>
                                            {r.evSlots > 0 && <Badge variant="warning">{r.evSlots} EV</Badge>}
                                            {r.distance !== undefined && (
                                                <Badge variant="outline">{r.distance} km away</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="group-hover:bg-primary/10 group-hover:text-primary">
                                        <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-12 text-center">
                        <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="font-semibold mb-1">Search for Parking</h3>
                        <p className="text-sm text-muted-foreground">Search by name or use your location to find nearby spots</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
