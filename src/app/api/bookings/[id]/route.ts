import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import Slot from '@/lib/models/Slot';
import { requireAuth } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const user = requireAuth(req);
        const { id } = await params;

        const body = await req.json();
        const { action } = body;

        const booking = await Booking.findById(id);
        if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (user.role === 'USER' && booking.userId.toString() !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (action === 'cancel') {
            booking.status = 'cancelled';
            await booking.save();
            await Slot.findByIdAndUpdate(booking.slotId, { status: 'available' });
            return NextResponse.json(booking);
        }

        if (action === 'complete') {
            booking.status = 'completed';
            await booking.save();
            await Slot.findByIdAndUpdate(booking.slotId, { status: 'available' });
            return NextResponse.json(booking);
        }

        if (action === 'renew') {
            const { endTime } = body;
            if (!endTime) return NextResponse.json({ error: 'endTime required' }, { status: 400 });

            // Check for conflicts with new time
            const conflict = await Booking.findOne({
                slotId: booking.slotId,
                _id: { $ne: booking._id },
                status: 'active',
                startTime: { $lt: new Date(endTime) },
                endTime: { $gt: booking.endTime },
            });

            if (conflict) {
                return NextResponse.json({ error: 'Slot not available for renewal' }, { status: 409 });
            }

            const newBooking = await Booking.create({
                userId: booking.userId,
                vehicleId: booking.vehicleId,
                parkingGroundId: booking.parkingGroundId,
                slotId: booking.slotId,
                startTime: booking.endTime,
                endTime: new Date(endTime),
                extendedFrom: booking._id,
            });

            return NextResponse.json(newBooking, { status: 201 });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
