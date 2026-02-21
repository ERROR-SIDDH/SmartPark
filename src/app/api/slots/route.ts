import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Slot from '@/lib/models/Slot';
import { requireAuth } from '@/lib/auth';
import { slotSchema, slotBatchSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const parkingGroundId = searchParams.get('parkingGroundId');
        if (!parkingGroundId) {
            return NextResponse.json({ error: 'parkingGroundId required' }, { status: 400 });
        }
        const slots = await Slot.find({ parkingGroundId }).sort({ slotNumber: 1 });
        return NextResponse.json(slots);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const body = await req.json();

        // Support batch creation
        if (body.slots && Array.isArray(body.slots)) {
            const parsed = slotBatchSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
            }
            const slots = await Slot.insertMany(
                parsed.data.slots.map(s => ({ ...s, parkingGroundId: parsed.data.parkingGroundId }))
            );
            return NextResponse.json(slots, { status: 201 });
        }

        // Single slot
        const parsed = slotSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const slot = await Slot.create(parsed.data);
        return NextResponse.json(slot, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
