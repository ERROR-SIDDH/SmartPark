import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ErrorLog from '@/lib/models/ErrorLog';
import { requireAuth } from '@/lib/auth';

// POST — mark all errors as read
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        await ErrorLog.updateMany({ isRead: false }, { isRead: true });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
