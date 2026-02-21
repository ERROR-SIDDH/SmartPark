import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Slot from '@/lib/models/Slot';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;

        const body = await req.json();
        const slot = await Slot.findByIdAndUpdate(id, body, { new: true });
        if (!slot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json(slot);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;

        await Slot.findByIdAndDelete(id);
        return NextResponse.json({ message: 'Deleted' });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
