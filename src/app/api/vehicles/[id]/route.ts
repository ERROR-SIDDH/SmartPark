import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Vehicle from '@/lib/models/Vehicle';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const user = requireAuth(req, 'USER');
        const { id } = await params;

        const body = await req.json();
        if (body.isDefault) {
            await Vehicle.updateMany({ userId: user.id }, { isDefault: false });
        }
        const vehicle = await Vehicle.findOneAndUpdate(
            { _id: id, userId: user.id }, body, { new: true }
        );
        if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(vehicle);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const user = requireAuth(req, 'USER');
        const { id } = await params;
        await Vehicle.findOneAndDelete({ _id: id, userId: user.id });
        return NextResponse.json({ message: 'Deleted' });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
