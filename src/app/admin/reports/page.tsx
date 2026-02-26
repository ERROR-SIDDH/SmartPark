"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Download, Loader2, FileSpreadsheet, Calendar, Filter,
    CheckCircle, XCircle, Timer,
} from "lucide-react";

export default function AdminReportsPage() {
    const { token } = useAuthStore();
    const [downloading, setDownloading] = useState(false);
    const [status, setStatus] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const downloadCSV = async () => {
        setDownloading(true);
        try {
            const params = new URLSearchParams();
            if (status) params.set("status", status);
            if (from) params.set("from", from);
            if (to) params.set("to", to);

            const res = await fetch(`/api/admin/reports?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error("Failed to generate report");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bookings_report_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
        }
        setDownloading(false);
    };

    const presets = [
        {
            label: "Today's Bookings",
            desc: "All bookings created today",
            action: () => {
                const today = new Date().toISOString().slice(0, 10);
                setFrom(today); setTo(today); setStatus("");
            },
        },
        {
            label: "Active Bookings",
            desc: "All currently active bookings",
            action: () => { setFrom(""); setTo(""); setStatus("active"); },
        },
        {
            label: "This Week",
            desc: "Bookings from the last 7 days",
            action: () => {
                const now = new Date();
                const week = new Date(now.getTime() - 7 * 86400000);
                setFrom(week.toISOString().slice(0, 10));
                setTo(now.toISOString().slice(0, 10));
                setStatus("");
            },
        },
        {
            label: "This Month",
            desc: "All bookings from current month",
            action: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                setFrom(start.toISOString().slice(0, 10));
                setTo(now.toISOString().slice(0, 10));
                setStatus("");
            },
        },
        {
            label: "Cancelled Bookings",
            desc: "All cancelled bookings",
            action: () => { setFrom(""); setTo(""); setStatus("cancelled"); },
        },
        {
            label: "Completed Bookings",
            desc: "All completed (checked-out) bookings",
            action: () => { setFrom(""); setTo(""); setStatus("completed"); },
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <FileSpreadsheet className="h-6 w-6 text-primary" /> Reports
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Generate and download booking reports as CSV</p>
            </div>

            {/* Quick Presets */}
            <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Presets</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {presets.map((p, i) => (
                        <Card
                            key={i}
                            className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/20 cursor-pointer transition-all"
                            onClick={p.action}
                        >
                            <CardContent className="p-3">
                                <h3 className="text-sm font-medium">{p.label}</h3>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Custom Filter */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Custom Report
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Status filter */}
                    <div className="space-y-1.5">
                        <Label className="text-xs">Booking Status</Label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { v: "", l: "All", icon: Calendar },
                                { v: "active", l: "Active", icon: Timer },
                                { v: "completed", l: "Completed", icon: CheckCircle },
                                { v: "cancelled", l: "Cancelled", icon: XCircle },
                            ].map((f) => (
                                <Button
                                    key={f.v}
                                    size="sm"
                                    variant={status === f.v ? "default" : "outline"}
                                    onClick={() => setStatus(f.v)}
                                >
                                    <f.icon className="h-3.5 w-3.5 mr-1" /> {f.l}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">From Date</Label>
                            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">To Date</Label>
                            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                        </div>
                    </div>

                    {/* Current selection summary */}
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {status && <Badge variant="outline" className="capitalize">{status}</Badge>}
                        {from && <Badge variant="outline">From: {from}</Badge>}
                        {to && <Badge variant="outline">To: {to}</Badge>}
                        {!status && !from && !to && <span>All bookings (no filters applied)</span>}
                    </div>

                    {/* Download button */}
                    <Button
                        onClick={downloadCSV}
                        disabled={downloading}
                        className="w-full sm:w-auto bg-gradient-to-r from-primary to-chart-1 hover:opacity-90"
                        size="lg"
                    >
                        {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download Report (CSV)
                    </Button>
                </CardContent>
            </Card>

            {/* Info */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="p-4 text-sm text-muted-foreground">
                    <h3 className="font-medium text-foreground mb-2">CSV Report Contents</h3>
                    <p>Each report includes: Booking ID, Status, Employee Name, Email, Employee Code, Department, Vehicle Number, Vehicle Type, Parking Ground, Slot, Start/End Times, Check-in/out Times, and Creation Date.</p>
                </CardContent>
            </Card>
        </div>
    );
}
