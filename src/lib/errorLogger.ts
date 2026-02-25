import dbConnect from '@/lib/db';
import ErrorLog from '@/lib/models/ErrorLog';

interface LogErrorOptions {
    source?: 'API' | 'CLIENT' | 'SERVER';
    endpoint?: string;
    method?: string;
    message: string;
    stack?: string;
    statusCode?: number;
    userId?: string;
    userAgent?: string;
    ip?: string;
    meta?: Record<string, unknown>;
}

/**
 * Log an error to the database. Fire-and-forget — will not throw.
 */
export async function logError(opts: LogErrorOptions): Promise<void> {
    try {
        await dbConnect();
        await ErrorLog.create({
            source: opts.source || 'API',
            endpoint: opts.endpoint || '',
            method: opts.method || '',
            message: opts.message,
            stack: opts.stack || '',
            statusCode: opts.statusCode || 500,
            userId: opts.userId || '',
            userAgent: opts.userAgent || '',
            ip: opts.ip || '',
            meta: opts.meta || {},
        });
    } catch {
        // Silently fail — we don't want error logging to cause more errors
        console.error('[ErrorLogger] Failed to log error:', opts.message);
    }
}

/**
 * Helper to extract request info for logging
 */
export function extractRequestInfo(req: Request) {
    return {
        endpoint: new URL(req.url).pathname,
        method: req.method,
        userAgent: req.headers.get('user-agent') || '',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '',
    };
}
