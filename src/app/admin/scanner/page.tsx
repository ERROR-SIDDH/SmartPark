"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    ScanLine, CheckCircle, XCircle, AlertTriangle, Clock, Car, MapPin,
    User, LogIn, LogOut, Loader2, Camera, CameraOff, KeyboardIcon,
} from "lucide-react";

interface BookingInfo {
    _id: string;
    status: string;
    startTime: string;
    endTime: string;
    checkedIn: string | null;
    checkedOut: string | null;
    qrToken: string;
    user: { name: string; email: string; employeeCode: string };
    vehicle: { vehicleNumber: string; vehicleType: string };
    parkingGround: { name: string; address: string };
    slot: { slotNumber: string; vehicleType: string };
}

interface ScanResult {
    type: "success" | "error" | "warning";
    message: string;
    booking?: BookingInfo;
}

export default function ScannerPage() {
    const { token } = useAuthStore();
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [processing, setProcessing] = useState(false);
    const [manualToken, setManualToken] = useState("");
    const [showManual, setShowManual] = useState(false);
    const [scannedToken, setScannedToken] = useState("");
    const scannerContainerRef = useRef<HTMLDivElement>(null);
    const scannerRef = useRef<unknown>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    const getAudioCtx = () => {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        return audioCtxRef.current;
    };

    const playApprovedSound = () => {
        try {
            const ctx = getAudioCtx();
            const now = ctx.currentTime;
            // Pleasant ascending two-tone chime
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, now + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + i * 0.12);
                osc.stop(now + i * 0.12 + 0.3);
            });
        } catch { /* audio not available */ }
    };

    const playDeniedSound = () => {
        try {
            const ctx = getAudioCtx();
            const now = ctx.currentTime;
            // Harsh descending buzzer
            [349.23, 261.63].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "square";
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.2, now + i * 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.25);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + i * 0.2);
                osc.stop(now + i * 0.2 + 0.25);
            });
        } catch { /* audio not available */ }
    };

    const stopCamera = useCallback(async () => {
        if (scannerRef.current) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (scannerRef.current as any).stop();
            } catch { /* already stopped */ }
            scannerRef.current = null;
        }
        setScanning(false);
    }, []);

    // Look up a booking by its QR token (read-only)
    const lookupQrToken = async (qrToken: string) => {
        setProcessing(true);
        setScannedToken(qrToken);
        try {
            const res = await fetch(`/api/bookings/lookup?qrToken=${encodeURIComponent(qrToken)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                setResult({ type: "success", message: "Booking found! Review details below.", booking: data });
                playApprovedSound();
            } else {
                setResult({ type: "error", message: data.error || "QR token not recognized." });
                playDeniedSound();
            }
        } catch {
            setResult({ type: "error", message: "Network error. Please try again." });
        }
        setProcessing(false);
    };

    // Perform entry or exit action
    const performAction = async (action: "entry" | "exit") => {
        if (!scannedToken) return;
        setProcessing(true);
        try {
            const res = await fetch("/api/bookings/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ qrToken: scannedToken, action }),
            });
            const data = await res.json();
            if (res.ok) {
                setResult({ type: "success", message: data.message, booking: data.booking });
                playApprovedSound();
            } else {
                setResult({
                    type: data.booking ? "warning" : "error",
                    message: data.error,
                    booking: data.booking,
                });
                playDeniedSound();
            }
        } catch {
            setResult({ type: "error", message: "Network error. Please try again." });
        }
        setProcessing(false);
    };

    const startCamera = async () => {
        setResult(null);
        setScannedToken("");
        try {
            const { Html5Qrcode } = await import("html5-qrcode");
            const scannerId = "qr-reader";

            // Ensure the container div exists
            if (!scannerContainerRef.current) return;
            scannerContainerRef.current.id = scannerId;

            const scanner = new Html5Qrcode(scannerId);
            scannerRef.current = scanner;
            setScanning(true);

            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    // QR code scanned successfully
                    scanner.stop().catch(() => { });
                    scannerRef.current = null;
                    setScanning(false);
                    lookupQrToken(decodedText);
                },
                () => { /* ignore scan errors */ }
            );
        } catch {
            setShowManual(true);
            setScanning(false);
        }
    };

    useEffect(() => {
        return () => { stopCamera(); };
    }, [stopCamera]);

    const resultIcon = result?.type === "success" ? <CheckCircle className="h-8 w-8 text-emerald-500" /> :
        result?.type === "warning" ? <AlertTriangle className="h-8 w-8 text-amber-500" /> :
            <XCircle className="h-8 w-8 text-red-500" />;

    const resultBorderColor = result?.type === "success" ? "border-emerald-500/30 bg-emerald-500/5" :
        result?.type === "warning" ? "border-amber-500/30 bg-amber-500/5" :
            "border-red-500/30 bg-red-500/5";

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ScanLine className="h-6 w-6 text-primary" /> QR Scanner
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Scan employee QR codes for parking entry & exit</p>
            </div>

            {/* Camera / Scanner Area */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        {scanning ? <Camera className="h-4 w-4 text-emerald-500" /> : <CameraOff className="h-4 w-4" />}
                        {scanning ? "Camera Active — Point at QR Code" : "Scanner"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Scanner container for html5-qrcode */}
                    <div className="relative rounded-xl overflow-hidden bg-black/50 min-h-[300px]">
                        <div ref={scannerContainerRef} className="w-full" />
                        {!scanning && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-primary/40 flex items-center justify-center">
                                    <ScanLine className="h-10 w-10 text-primary/40" />
                                </div>
                                <p className="text-sm text-muted-foreground">Start scanner to scan QR codes</p>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex gap-2">
                        {!scanning ? (
                            <Button onClick={startCamera} className="flex-1 bg-gradient-to-r from-chart-2 to-primary">
                                <Camera className="h-4 w-4 mr-2" /> Start Scanner
                            </Button>
                        ) : (
                            <Button onClick={stopCamera} variant="destructive" className="flex-1">
                                <CameraOff className="h-4 w-4 mr-2" /> Stop Scanner
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => { setShowManual(!showManual); setResult(null); }}>
                            <KeyboardIcon className="h-4 w-4 mr-2" /> Manual
                        </Button>
                    </div>

                    {/* Manual Token Input */}
                    {showManual && (
                        <div className="flex gap-2">
                            <Input
                                placeholder="Paste QR token here..."
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                onClick={() => { if (manualToken.trim()) lookupQrToken(manualToken.trim()); }}
                                disabled={!manualToken.trim() || processing}
                            >
                                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Scan Result */}
            {result && (
                <Card className={`border ${resultBorderColor} transition-all`}>
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 mt-1">{resultIcon}</div>
                            <div className="flex-1 space-y-4">
                                <h3 className="font-bold text-lg">{result.message}</h3>

                                {result.booking && (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-muted-foreground text-xs">Employee</p>
                                                <p className="font-medium">{result.booking.user?.name || "—"}</p>
                                                <p className="text-xs text-muted-foreground">{result.booking.user?.employeeCode || ""}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Car className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-muted-foreground text-xs">Vehicle</p>
                                                <p className="font-medium">{result.booking.vehicle?.vehicleNumber || "—"}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{result.booking.vehicle?.vehicleType || ""}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-muted-foreground text-xs">Parking / Slot</p>
                                                <p className="font-medium">{result.booking.parkingGround?.name} — {result.booking.slot?.slotNumber}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-muted-foreground text-xs">Booking Time</p>
                                                <p className="font-medium">
                                                    {new Date(result.booking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(result.booking.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{new Date(result.booking.startTime).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Status badges */}
                                {result.booking && (
                                    <div className="flex gap-2 flex-wrap">
                                        <Badge variant={result.booking.status === "active" ? "success" : "secondary"} className="capitalize">
                                            {result.booking.status}
                                        </Badge>
                                        {result.booking.checkedIn && (
                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                                                <LogIn className="h-3 w-3 mr-1" />
                                                In: {new Date(result.booking.checkedIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </Badge>
                                        )}
                                        {result.booking.checkedOut && (
                                            <Badge variant="outline" className="text-muted-foreground">
                                                <LogOut className="h-3 w-3 mr-1" />
                                                Out: {new Date(result.booking.checkedOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </Badge>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                {result.booking && (
                                    <div className="flex gap-2 pt-2">
                                        {/* Show Entry button if not checked in yet and booking is active */}
                                        {!result.booking.checkedIn && result.booking.status === "active" && (
                                            <Button
                                                className="bg-gradient-to-r from-emerald-600 to-emerald-500"
                                                onClick={() => performAction("entry")}
                                                disabled={processing}
                                            >
                                                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                                                Allow Entry
                                            </Button>
                                        )}
                                        {/* Show Exit button if checked in but not checked out */}
                                        {result.booking.checkedIn && !result.booking.checkedOut && (
                                            <Button
                                                variant="outline"
                                                className="border-primary/30"
                                                onClick={() => performAction("exit")}
                                                disabled={processing}
                                            >
                                                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                                                Mark Exit
                                            </Button>
                                        )}
                                        <Button variant="ghost" onClick={() => { setResult(null); setScannedToken(""); setManualToken(""); }}>
                                            Scan Another
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
