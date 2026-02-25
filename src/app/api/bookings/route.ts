import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import Slot from '@/lib/models/Slot';
import Vehicle from '@/lib/models/Vehicle';
import '@/lib/models/ParkingGround'; // register for populate
import '@/lib/models/User';          // register for populate
import { requireAuth, authenticateRequest } from '@/lib/auth';
import { bookingSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const user = authenticateRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');

        const query: Record<string, unknown> = {};
        if (user.role === 'USER') query.userId = user.id;
        if (status) query.status = status;

        const bookings = await Booking.find(query)
            .populate('vehicleId')
            .populate('parkingGroundId')
            .populate('slotId')
            .sort({ createdAt: -1 });

        return NextResponse.json(bookings);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const user = requireAuth(req, 'USER');

        const body = await req.json();
        const parsed = bookingSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const { slotId, startTime, endTime } = parsed.data;

        const slot = await Slot.findById(slotId);
        if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });

        const vehicle = await Vehicle.findById(parsed.data.vehicleId);
        if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });

        // Size validation
        if (slot.realDimensions && vehicle.dimensions) {
            const reqL = vehicle.dimensions.length + slot.clearance;
            const reqW = vehicle.dimensions.width + slot.clearance;
            const slotL = slot.realDimensions.length;
            const slotW = slot.realDimensions.width;

            const fitsNormally = reqL <= slotL && reqW <= slotW;
            const fitsRotated = reqL <= slotW && reqW <= slotL;

            if (!fitsNormally && !fitsRotated) {
                return NextResponse.json({
                    error: `Vehicle size (${vehicle.dimensions.length}x${vehicle.dimensions.width}cm) + clearance (${slot.clearance}cm) exceeds slot limits (${slotL}x${slotW}cm).`
                }, { status: 400 });
            }
        }

        // Check for conflicts
        const conflict = await Booking.findOne({
            slotId,
            status: 'active',
            $or: [
                { startTime: { $lt: new Date(endTime) }, endTime: { $gt: new Date(startTime) } },
            ],
        });

        if (conflict) {
            return NextResponse.json({ error: 'Slot already booked for this time' }, { status: 409 });
        }

        const booking = await Booking.create({
            ...parsed.data,
            userId: user.id,
            qrToken: randomUUID(),
            startTime: new Date(startTime),
            endTime: new Date(endTime),
        });

        // Slot status is computed dynamically — do not permanently mark as 'booked'

        return NextResponse.json(booking, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
