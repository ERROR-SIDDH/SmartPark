import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Vehicle from '@/lib/models/Vehicle';
import { requireAuth } from '@/lib/auth';
import { vehicleSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const user = requireAuth(req, 'USER');
        const vehicles = await Vehicle.find({ userId: user.id }).sort({ isDefault: -1 });
        return NextResponse.json(vehicles);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const user = requireAuth(req, 'USER');
        const body = await req.json();
        const parsed = vehicleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        // If setting as default, unset others
        if (parsed.data.isDefault) {
            await Vehicle.updateMany({ userId: user.id }, { isDefault: false });
        }

        const vehicle = await Vehicle.create({ ...parsed.data, userId: user.id });
        return NextResponse.json(vehicle, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
