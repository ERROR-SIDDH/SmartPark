import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Slot from '@/lib/models/Slot';
import Booking from '@/lib/models/Booking';
import ParkingGround from '@/lib/models/ParkingGround';
import { requireAuth } from '@/lib/auth';

// GET — Live map data: all slots for a parking ground with occupancy at a given time
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { searchParams } = new URL(req.url);
        const groundId = searchParams.get('groundId');
        const time = searchParams.get('time'); // ISO string, defaults to now

        if (!groundId) {
            return NextResponse.json({ error: 'groundId required' }, { status: 400 });
        }

        const ground = await ParkingGround.findById(groundId).lean();
        if (!ground) {
            return NextResponse.json({ error: 'Parking ground not found' }, { status: 404 });
        }

        const checkTime = time ? new Date(time) : new Date();

        // Get all slots for this parking ground
        const slots = await Slot.find({ parkingGroundId: groundId }).lean();

        // Get all active bookings that overlap with the check time
        const activeBookings = await Booking.find({
            parkingGroundId: groundId,
            status: 'active',
            startTime: { $lte: checkTime },
            endTime: { $gte: checkTime },
        })
            .populate('userId', 'name employeeCode')
            .populate('vehicleId', 'vehicleNumber vehicleType')
            .lean();

        // Build a map from slotId -> booking
        const slotBookingMap = new Map<string, Record<string, unknown>>();
        for (const b of activeBookings) {
            slotBookingMap.set(String(b.slotId), b);
        }

        // Merge slots with occupancy data
        const slotsWithOccupancy = slots.map((s) => {
            const booking = slotBookingMap.get(String(s._id));
            return {
                _id: s._id,
                slotNumber: (s as Record<string, unknown>).slotNumber,
                vehicleType: (s as Record<string, unknown>).vehicleType,
                status: (s as Record<string, unknown>).status,
                position: (s as Record<string, unknown>).position,
                size: (s as Record<string, unknown>).dimensions,
                rotation: (s as Record<string, unknown>).rotation,
                isOccupied: !!booking,
                isBlocked: (s as Record<string, unknown>).status === 'blocked',
                booking: booking ? {
                    _id: (booking as Record<string, unknown>)._id,
                    startTime: (booking as Record<string, unknown>).startTime,
                    endTime: (booking as Record<string, unknown>).endTime,
                    checkedIn: (booking as Record<string, unknown>).checkedIn,
                    user: (booking as Record<string, unknown>).userId,
                    vehicle: (booking as Record<string, unknown>).vehicleId,
                } : null,
            };
        });

        const stats = {
            total: slots.length,
            occupied: activeBookings.length,
            available: slots.filter((s) => (s as Record<string, unknown>).status !== 'blocked').length - activeBookings.length,
            blocked: slots.filter((s) => (s as Record<string, unknown>).status === 'blocked').length,
        };

        return NextResponse.json({
            ground: { _id: (ground as Record<string, unknown>)._id, name: (ground as Record<string, unknown>).name, address: (ground as Record<string, unknown>).address },
            slots: slotsWithOccupancy,
            stats,
            checkTime: checkTime.toISOString(),
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
