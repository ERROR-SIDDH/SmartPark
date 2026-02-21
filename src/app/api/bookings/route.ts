import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import Slot from '@/lib/models/Slot';
import Vehicle from '@/lib/models/Vehicle';
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
            // Check if vehicle fits (requiring clearance on all sides might be too strict, usually it's length + clearance, width + clearance)
            const requiredLength = vehicle.dimensions.length + slot.clearance;
            const requiredWidth = vehicle.dimensions.width + slot.clearance;

            if (requiredLength > slot.realDimensions.length || requiredWidth > slot.realDimensions.width) {
                return NextResponse.json({
                    error: `Vehicle size (${vehicle.dimensions.length}x${vehicle.dimensions.width}cm) + clearance (${slot.clearance}cm) exceeds slot limits (${slot.realDimensions.length}x${slot.realDimensions.width}cm).`
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
            startTime: new Date(startTime),
            endTime: new Date(endTime),
        });

        // Update slot status
        await Slot.findByIdAndUpdate(slotId, { status: 'booked' });

        return NextResponse.json(booking, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
