"use client";

import { useEffect } from "react";

/**
 * Global client-side error catcher.
 * Captures uncaught errors and unhandled promise rejections
 * and sends them to /api/errors for admin review.
 */
export function ClientErrorCatcher() {
    useEffect(() => {
        const sendError = (message: string, stack: string, meta?: Record<string, unknown>) => {
            try {
                fetch("/api/errors", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message,
                        stack,
                        url: window.location.pathname,
                        meta: { ...meta, url: window.location.href },
                    }),
                }).catch(() => { /* silently fail */ });
            } catch { /* silently fail */ }
        };

        const handleError = (event: ErrorEvent) => {
            sendError(
                event.message || "Uncaught error",
                event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
            );
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            const err = event.reason;
            sendError(
                err?.message || String(err) || "Unhandled promise rejection",
                err?.stack || "",
                { type: "unhandledrejection" },
            );
        };

        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleRejection);

        return () => {
            window.removeEventListener("error", handleError);
            window.removeEventListener("unhandledrejection", handleRejection);
        };
    }, []);

    return null;
}
