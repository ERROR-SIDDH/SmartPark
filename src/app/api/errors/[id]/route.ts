import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ErrorLog from '@/lib/models/ErrorLog';
import { requireAuth } from '@/lib/auth';

// PUT — mark error as read/unread
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;
        const body = await req.json();

        const error = await ErrorLog.findByIdAndUpdate(id, { isRead: body.isRead }, { new: true });
        if (!error) return NextResponse.json({ error: 'Error not found' }, { status: 404 });
        return NextResponse.json(error);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE — delete an error log entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;
        await ErrorLog.findByIdAndDelete(id);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
