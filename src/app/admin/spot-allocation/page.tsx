"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    QrCode, Search, User, MapPin, Car, Bike, Zap, Truck,
    ArrowRight, ArrowLeft, Loader2, CheckCircle, Clock
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

const VEHICLE_TYPES = [
    { id: 'car', name: 'Car', icon: Car, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'bike', name: 'Bike', icon: Bike, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'ev', name: 'EV', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'pickup', name: 'Pickup', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

export default function SpotAllocationPage() {
    const { token } = useAuthStore();
    const [step, setStep] = useState(1);
    const [grounds, setGrounds] = useState<{ _id: string; name: string }[]>([]);

    // Form state
    const [employeeCode, setEmployeeCode] = useState("");
    const [selectedGround, setSelectedGround] = useState("");
    const [selectedType, setSelectedType] = useState("");
    const [endTime, setEndTime] = useState("");

    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<any>(null);

    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        fetch("/api/parking", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                const arr = Array.isArray(data) ? data : [];
                setGrounds(arr);
                if (arr.length > 0) setSelectedGround(arr[0]._id);
            });

        // Default end time to 4 hours from now
        const d = new Date();
        d.setHours(d.getHours() + 4);
        setEndTime(d.toISOString().slice(0, 16));
    }, [token]);

    const startScanner = () => {
        setScanning(true);
        setTimeout(() => {
            const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
            scanner.render((decodedText) => {
                setEmployeeCode(decodedText);
                scanner.clear();
                setScanning(false);
                setStep(2);
            }, (error) => { });
            scannerRef.current = scanner;
        }, 100);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.clear();
            scannerRef.current = null;
        }
        setScanning(false);
    };

    const handleAllocate = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/spot-allocation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    employeeCode,
                    parkingGroundId: selectedGround,
                    vehicleType: selectedType,
                    endTime: new Date(endTime).toISOString()
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to allocate spot");

            setResult(data.booking);
            setStep(4);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep(1);
        setEmployeeCode("");
        setSelectedType("");
        setResult(null);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Spot Allocation</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manually assign a parking spot to an employee</p>
                </div>
                <Badge variant="outline" className="px-3 py-1">Step {step} of 4</Badge>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }} />
            </div>

            {step === 1 && (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                        <CardTitle>Identify Employee</CardTitle>
                        <CardDescription>Scan identity QR or enter employee code</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {scanning ? (
                            <div className="space-y-4">
                                <div id="reader" className="overflow-hidden rounded-xl border-2 border-primary/20 bg-black/10" />
                                <Button variant="outline" className="w-full" onClick={stopScanner}>Cancel Scanning</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                <Button
                                    className="h-32 flex flex-col gap-3 rounded-2xl border-dashed border-2 bg-primary/5 hover:bg-primary/10 hover:border-primary/50"
                                    variant="outline"
                                    onClick={startScanner}
                                >
                                    <QrCode className="h-8 w-8 text-primary" />
                                    <span className="font-semibold text-lg">Scan Identity QR</span>
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or enter manual</span></div>
                                </div>

                                <div className="space-y-3">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Hash className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <Input
                                            placeholder="Employee Code (e.g. EMP123)"
                                            value={employeeCode}
                                            onChange={(e) => setEmployeeCode(e.target.value)}
                                            className="pl-10 h-12 text-lg font-medium"
                                        />
                                    </div>
                                    <Button
                                        className="w-full h-12 text-lg"
                                        disabled={!employeeCode.trim()}
                                        onClick={() => setStep(2)}
                                    >
                                        Next Component <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                        <CardTitle>Ground & Vehicle Type</CardTitle>
                        <CardDescription>Where and what are they parking?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Ground Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-primary" /> Parking Ground
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {grounds.map(g => (
                                    <Button
                                        key={g._id}
                                        variant={selectedGround === g._id ? "default" : "outline"}
                                        className="justify-start h-11"
                                        onClick={() => setSelectedGround(g._id)}
                                    >
                                        <div className={`h-2 w-2 rounded-full mr-2 ${selectedGround === g._id ? "bg-white" : "bg-primary"}`} />
                                        <span className="truncate">{g.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Vehicle Type Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Car className="h-3.5 w-3.5 text-primary" /> Vehicle Type
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {VEHICLE_TYPES.map(type => (
                                    <Button
                                        key={type.id}
                                        variant="outline"
                                        className={`h-28 flex flex-col gap-2 rounded-2xl transition-all ${selectedType === type.id
                                            ? "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
                                            : "hover:border-primary/50"
                                            }`}
                                        onClick={() => setSelectedType(type.id)}
                                    >
                                        <div className={`p-3 rounded-xl ${type.bg}`}>
                                            <type.icon className={`h-6 w-6 ${type.color}`} />
                                        </div>
                                        <span className="text-sm font-semibold">{type.name}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                            <Button className="flex-1" disabled={!selectedType} onClick={() => setStep(3)}>Next Step <ArrowRight className="h-4 w-4 ml-2" /></Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 3 && (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                        <CardTitle>Parking Duration</CardTitle>
                        <CardDescription>When will they leave?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-primary" /> Till Parking Time
                            </label>
                            <Input
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="h-12 text-lg"
                            />
                            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/30">
                                Manual allocation will mark them as <strong>Checked In</strong> immediately.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                            <Button
                                className="flex-[2] h-12 text-lg"
                                onClick={handleAllocate}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
                                Allocate Spot
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 4 && result && (
                <Card className="bg-card/50 backdrop-blur-sm border-2 border-emerald-500/20 shadow-2xl shadow-emerald-500/5">
                    <CardContent className="p-8 text-center space-y-6">
                        <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                            <CheckCircle className="h-10 w-10 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">Spot Allocated!</h2>
                            <p className="text-muted-foreground mt-1">Allocation successful for <strong>{result.userName}</strong></p>
                        </div>

                        <div className="bg-muted/50 rounded-2xl p-6 grid grid-cols-2 gap-4 border border-border/50">
                            <div className="text-left">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Allocated Slot</div>
                                <div className="text-2xl font-black text-primary">#{result.slotNumber}</div>
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Vehicle Info</div>
                                <div className="text-sm font-semibold truncate">{result.vehicleNumber}</div>
                                <div className="text-xs text-muted-foreground capitalize">{selectedType}</div>
                            </div>
                        </div>

                        <Button className="w-full h-12" variant="outline" onClick={reset}>
                            New Allocation
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function Hash(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="4" x2="20" y1="9" y2="9" />
            <line x1="4" x2="20" y1="15" y2="15" />
            <line x1="10" x2="8" y1="3" y2="21" />
            <line x1="16" x2="14" y1="3" y2="21" />
        </svg>
    )
}
