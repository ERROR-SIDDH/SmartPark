"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}>(({ className, variant = "default", ...props }, ref) => {
    const variants: Record<string, string> = {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-white shadow hover:bg-destructive/80",
        outline: "text-foreground border",
        success: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
        warning: "bg-amber-500/15 text-amber-500 border border-amber-500/20",
    };

    return (
        <div
            ref={ref}
            className={cn(
                "inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                variants[variant],
                className
            )}
            {...props}
        />
    );
});
Badge.displayName = "Badge";

export { Badge };
