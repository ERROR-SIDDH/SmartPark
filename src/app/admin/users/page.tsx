"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Search, Upload, Loader2, UserCheck, UserX } from "lucide-react";

interface UserData {
    _id: string;
    employeeCode: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    isActive: boolean;
    createdAt: string;
}

export default function UsersPage() {
    const { token } = useAuthStore();
    const [users, setUsers] = useState<UserData[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [form, setForm] = useState({ employeeCode: "", name: "", email: "", phone: "", department: "", password: "" });
    const [saving, setSaving] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const fetchUsers = (p = page, s = search) => {
        setLoading(true);
        fetch(`/api/users?page=${p}&search=${s}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => { setUsers(data.users || []); setTotal(data.total || 0); })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchUsers(); }, [token]);

    const handleAdd = async () => {
        setSaving(true);
        const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setShowAdd(false);
            setForm({ employeeCode: "", name: "", email: "", phone: "", department: "", password: "" });
            fetchUsers();
        }
        setSaving(false);
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSaving(true);

        const text = await file.text();
        const lines = text.split("\n").filter(Boolean);
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const users = lines.slice(1).map((line) => {
            const vals = line.split(",").map((v) => v.trim());
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
            return {
                employeeCode: obj.employeecode || obj.employee_code || obj.empcode || "",
                name: obj.name || "",
                email: obj.email || "",
                phone: obj.phone || "",
                department: obj.department || "",
            };
        }).filter((u) => u.employeeCode && u.email);

        const res = await fetch("/api/users/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ users }),
        });
        const result = await res.json();
        setBulkResult(result);
        fetchUsers();
        setSaving(false);
    };

    const handleSearch = () => { setPage(1); fetchUsers(1, search); };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground mt-1">{total} registered employees</p>
                </div>
                <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".csv" onChange={handleBulkUpload} className="hidden" />
                    <Button variant="outline" onClick={() => fileRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Bulk CSV
                    </Button>
                    <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-primary to-chart-1 hover:opacity-90">
                        <Plus className="mr-2 h-4 w-4" /> Add User
                    </Button>
                </div>
            </div>

            {bulkResult && (
                <Card className="bg-emerald-500/10 border-emerald-500/20">
                    <CardContent className="py-3 px-4 text-sm">
                        Bulk import: <strong>{bulkResult.created}</strong> created, <strong>{bulkResult.skipped}</strong> skipped
                        {bulkResult.errors.length > 0 && <span className="text-destructive ml-2">({bulkResult.errors.length} errors)</span>}
                        <Button variant="ghost" size="sm" className="ml-2" onClick={() => setBulkResult(null)}>Dismiss</Button>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <div className="flex gap-2">
                <Input
                    placeholder="Search by name, email, or employee code..."
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="max-w-md"
                />
                <Button variant="outline" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
            </div>

            {/* Users Table */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left p-4 font-medium text-muted-foreground">Employee</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Department</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Phone</th>
                                        <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u._id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                                            <td className="p-4">
                                                <div className="font-medium">{u.name}</div>
                                                <div className="text-xs text-muted-foreground">{u.employeeCode}</div>
                                            </td>
                                            <td className="p-4 text-muted-foreground">{u.email}</td>
                                            <td className="p-4 text-muted-foreground">{u.department || "—"}</td>
                                            <td className="p-4 text-muted-foreground">{u.phone || "—"}</td>
                                            <td className="p-4">
                                                {u.isActive ? (
                                                    <Badge variant="success"><UserCheck className="mr-1 h-3 w-3" /> Active</Badge>
                                                ) : (
                                                    <Badge variant="destructive"><UserX className="mr-1 h-3 w-3" /> Inactive</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {total > 20 && (
                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchUsers(page - 1); }}>Prev</Button>
                    <span className="text-sm text-muted-foreground flex items-center">Page {page}</span>
                    <Button variant="outline" size="sm" disabled={users.length < 20} onClick={() => { setPage(page + 1); fetchUsers(page + 1); }}>Next</Button>
                </div>
            )}

            {/* Add User Dialog */}
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="bg-card backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Add Employee</DialogTitle>
                        <DialogDescription>Create a new employee account</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Employee Code</Label>
                                <Input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="EMP002" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Name</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Email</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Phone</Label>
                                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Department</Label>
                                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Engineering" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Password</Label>
                            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 characters" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Add Employee
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
