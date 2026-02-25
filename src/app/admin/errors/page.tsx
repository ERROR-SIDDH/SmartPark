"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle, CheckCircle, Circle, Loader2, Trash2, Eye, EyeOff,
    Server, Globe, Monitor, RefreshCw, CheckCheck,
} from "lucide-react";

interface ErrorEntry {
    _id: string;
    source: "API" | "CLIENT" | "SERVER";
    endpoint: string;
    method: string;
    message: string;
    stack: string;
    statusCode: number;
    userId: string;
    userAgent: string;
    isRead: boolean;
    createdAt: string;
    meta: Record<string, unknown>;
}

export default function ErrorLogsPage() {
    const { token } = useAuthStore();
    const [errors, setErrors] = useState<ErrorEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("");
    const [sourceFilter, setSourceFilter] = useState<string>("");
    const [expanded, setExpanded] = useState<string | null>(null);

    const fetchErrors = (p = page) => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(p), limit: "30" });
        if (filter) params.set("filter", filter);
        if (sourceFilter) params.set("source", sourceFilter);

        fetch(`/api/errors?${params}`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((data) => {
                setErrors(data.errors || []);
                setTotal(data.total || 0);
                setUnreadCount(data.unreadCount || 0);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchErrors(); }, [token, filter, sourceFilter]);

    const toggleRead = async (id: string, currently: boolean) => {
        await fetch(`/api/errors/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ isRead: !currently }),
        });
        fetchErrors(page);
    };

    const deleteError = async (id: string) => {
        await fetch(`/api/errors/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchErrors(page);
    };

    const markAllRead = async () => {
        await fetch("/api/errors/mark-all-read", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
        fetchErrors(page);
    };

    const sourceIcon = (s: string) => {
        switch (s) {
            case "API": return <Server className="h-3.5 w-3.5" />;
            case "CLIENT": return <Monitor className="h-3.5 w-3.5" />;
            default: return <Globe className="h-3.5 w-3.5" />;
        }
    };

    const sourceColor = (s: string) => {
        switch (s) {
            case "API": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
            case "CLIENT": return "text-red-500 bg-red-500/10 border-red-500/20";
            default: return "text-blue-500 bg-blue-500/10 border-blue-500/20";
        }
    };

    const timeAgo = (d: string) => {
        const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        if (s < 60) return `${s}s ago`;
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
        return `${Math.floor(s / 86400)}d ago`;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-amber-500" /> Error Logs
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="ml-2">{unreadCount} unread</Badge>
                        )}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{total} total errors logged</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchErrors(page)}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                    </Button>
                    {unreadCount > 0 && (
                        <Button size="sm" onClick={markAllRead} className="bg-gradient-to-r from-primary to-chart-1">
                            <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark All Read
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="flex gap-1">
                    {[
                        { v: "", l: "All" },
                        { v: "unread", l: "Unread" },
                        { v: "read", l: "Read" },
                    ].map((f) => (
                        <Button key={f.v} size="sm" variant={filter === f.v ? "default" : "outline"} onClick={() => { setFilter(f.v); setPage(1); }}>
                            {f.l}
                        </Button>
                    ))}
                </div>
                <div className="flex gap-1">
                    {[
                        { v: "", l: "All Sources" },
                        { v: "API", l: "API" },
                        { v: "CLIENT", l: "Client" },
                        { v: "SERVER", l: "Server" },
                    ].map((s) => (
                        <Button key={s.v} size="sm" variant={sourceFilter === s.v ? "default" : "outline"} onClick={() => { setSourceFilter(s.v); setPage(1); }}>
                            {s.l}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Error List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : errors.length === 0 ? (
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-16 text-center">
                        <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Errors</h3>
                        <p className="text-sm text-muted-foreground">
                            {filter === "unread" ? "All errors have been reviewed!" : "No errors logged yet — great!"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {errors.map((e) => (
                        <Card
                            key={e._id}
                            className={`border transition-all cursor-pointer ${!e.isRead
                                ? "bg-card border-amber-500/20 shadow-sm"
                                : "bg-card/50 border-border/50 opacity-70"
                                }`}
                            onClick={() => setExpanded(expanded === e._id ? null : e._id)}
                        >
                            <CardContent className="p-3 sm:p-4">
                                <div className="flex items-start gap-3">
                                    {/* Unread indicator */}
                                    <div className="mt-1 flex-shrink-0">
                                        {!e.isRead ? (
                                            <Circle className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                        ) : (
                                            <Circle className="h-2.5 w-2.5 text-muted-foreground/30" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <Badge variant="outline" className={`text-[10px] ${sourceColor(e.source)}`}>
                                                {sourceIcon(e.source)} <span className="ml-1">{e.source}</span>
                                            </Badge>
                                            {e.method && (
                                                <Badge variant="secondary" className="text-[10px]">{e.method}</Badge>
                                            )}
                                            {e.statusCode > 0 && (
                                                <Badge variant={e.statusCode >= 500 ? "destructive" : "warning"} className="text-[10px]">
                                                    {e.statusCode}
                                                </Badge>
                                            )}
                                            <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                                                {timeAgo(e.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium truncate">{e.message}</p>
                                        {e.endpoint && (
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{e.endpoint}</p>
                                        )}

                                        {/* Expanded details */}
                                        {expanded === e._id && (
                                            <div className="mt-3 space-y-2 text-xs">
                                                {e.stack && (
                                                    <pre className="bg-muted/50 rounded-lg p-3 overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                                                        {e.stack}
                                                    </pre>
                                                )}
                                                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                                                    <div>
                                                        <span className="font-medium text-foreground">Time:</span>{" "}
                                                        {new Date(e.createdAt).toLocaleString()}
                                                    </div>
                                                    {e.userId && (
                                                        <div>
                                                            <span className="font-medium text-foreground">User:</span> {e.userId}
                                                        </div>
                                                    )}
                                                    {e.userAgent && (
                                                        <div className="col-span-2 truncate">
                                                            <span className="font-medium text-foreground">UA:</span> {e.userAgent}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1 flex-shrink-0" onClick={(ev) => ev.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => toggleRead(e._id, e.isRead)}
                                            title={e.isRead ? "Mark as unread" : "Mark as read"}
                                        >
                                            {e.isRead ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive"
                                            onClick={() => deleteError(e._id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {total > 30 && (
                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchErrors(page - 1); }}>Prev</Button>
                    <span className="text-sm text-muted-foreground flex items-center">Page {page} of {Math.ceil(total / 30)}</span>
                    <Button variant="outline" size="sm" disabled={errors.length < 30} onClick={() => { setPage(page + 1); fetchErrors(page + 1); }}>Next</Button>
                </div>
            )}
        </div>
    );
}
