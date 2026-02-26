"use client";

import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Building, Hash, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function ProfilePage() {
    const { user } = useAuthStore();

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-sm text-muted-foreground mt-1">Your account information</p>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader className="text-center pb-4">
                    <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-chart-2 to-primary flex items-center justify-center mb-3">
                        <span className="text-2xl font-bold text-white">{user?.name?.charAt(0) || "U"}</span>
                    </div>
                    <CardTitle className="text-xl">{user?.name}</CardTitle>
                    <div className="flex justify-center gap-2 mt-1">
                        <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        {[
                            { icon: Hash, label: "Employee Code", value: user?.employeeCode },
                            { icon: Mail, label: "Email", value: user?.email },
                            { icon: Building, label: "Department", value: user?.department || "—" },
                        ].filter(Boolean).map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm">
                                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                                    <item.icon className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">{item.label}</div>
                                    <div className="font-medium">{item.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-border/50 flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-4 text-sm font-medium">
                            <QrCode className="h-4 w-4 text-primary" />
                            Identity QR Code
                        </div>
                        <div className="p-4 bg-white rounded-2xl shadow-sm">
                            <QRCodeSVG
                                value={user?.employeeCode || ""}
                                size={180}
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-4 text-center max-w-[200px]">
                            Show this QR code to the security or admin for quick spot allocation.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
