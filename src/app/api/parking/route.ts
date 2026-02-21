import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ParkingGround from '@/lib/models/ParkingGround';
import Slot from '@/lib/models/Slot';
import { requireAuth } from '@/lib/auth';
import { parkingGroundSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search');
        const vehicleType = searchParams.get('vehicleType');

        const query: Record<string, unknown> = { isActive: true };
        if (search) query.$text = { $search: search };
        if (vehicleType) query.allowedVehicleTypes = vehicleType;

        const grounds = await ParkingGround.find(query).sort({ createdAt: -1 });

        const groundsWithSlots = await Promise.all(
            grounds.map(async (g) => {
                const slots = await Slot.find({ parkingGroundId: g._id });
                const available = slots.filter(s => s.status === 'available').length;
                const total = slots.length;
                const evSlots = slots.filter(s => s.isEV || s.vehicleType === 'ev').length;
                return { ...g.toObject(), slotsAvailable: available, totalSlots: total, evSlots };
            })
        );

        return NextResponse.json(groundsWithSlots);
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
        const parsed = parkingGroundSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const ground = await ParkingGround.create({
            name: parsed.data.name,
            address: parsed.data.address,
            location: {
                type: 'Point',
                coordinates: [parsed.data.longitude, parsed.data.latitude],
            },
            totalCapacity: parsed.data.totalCapacity || 0,
            allowedVehicleTypes: parsed.data.allowedVehicleTypes || ['car', 'bike', 'pickup', 'ev'],
        });

        return NextResponse.json(ground, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
