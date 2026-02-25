import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ErrorLog from '@/lib/models/ErrorLog';
import { requireAuth } from '@/lib/auth';

// GET — list errors (paginated, filterable)
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '30');
        const filter = searchParams.get('filter'); // 'unread' | 'read' | null (all)
        const source = searchParams.get('source'); // 'API' | 'CLIENT' | 'SERVER' | null (all)

        const query: Record<string, unknown> = {};
        if (filter === 'unread') query.isRead = false;
        if (filter === 'read') query.isRead = true;
        if (source) query.source = source;

        const [errors, total, unreadCount] = await Promise.all([
            ErrorLog.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ErrorLog.countDocuments(query),
            ErrorLog.countDocuments({ isRead: false }),
        ]);

        return NextResponse.json({ errors, total, unreadCount, page, limit });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

// POST — log a client-side error
export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        const body = await req.json();
        await ErrorLog.create({
            source: 'CLIENT',
            endpoint: body.url || '',
            method: '',
            message: body.message || 'Unknown client error',
            stack: body.stack || '',
            statusCode: 0,
            userId: body.userId || '',
            userAgent: req.headers.get('user-agent') || '',
            ip: req.headers.get('x-forwarded-for') || '',
            meta: body.meta || {},
        });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Failed to log error' }, { status: 500 });
    }
}
