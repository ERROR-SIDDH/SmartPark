import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import ParkingGround from '@/lib/models/ParkingGround';
import '@/lib/models/User';   // register schema for populate
import '@/lib/models/Vehicle'; // register schema for populate
import '@/lib/models/Slot';    // register schema for populate
import { requireAuth } from '@/lib/auth';
import { logError, extractRequestInfo } from '@/lib/errorLogger';

// Admin scans a QR code to allow entry or mark exit
export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const user = requireAuth(req, 'ADMIN');

        const { qrToken, action } = await req.json();

        if (!qrToken || !['entry', 'exit'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request. Provide qrToken and action (entry/exit).' }, { status: 400 });
        }

        const booking = await Booking.findOne({ qrToken })
            .populate('userId', 'name email employeeCode')
            .populate('vehicleId', 'vehicleNumber vehicleType')
            .populate('parkingGroundId', 'name address entryTimeWindow')
            .populate('slotId', 'slotNumber vehicleType');

        if (!booking) {
            return NextResponse.json({ error: 'Invalid QR code. No booking found.' }, { status: 404 });
        }

        const now = new Date();

        if (action === 'entry') {
            // Booking must be active
            if (booking.status !== 'active') {
                return NextResponse.json({
                    error: `Booking is ${booking.status}. Entry not allowed.`,
                    booking: formatBooking(booking),
                }, { status: 400 });
            }

            // Already checked in
            if (booking.checkedIn) {
                return NextResponse.json({
                    error: 'Already checked in.',
                    booking: formatBooking(booking),
                }, { status: 400 });
            }

            // Time window check
            const entryTimeWindow = (booking.parkingGroundId as unknown as { entryTimeWindow: number })?.entryTimeWindow || 15;
            const earliestEntry = new Date(booking.startTime.getTime() - entryTimeWindow * 60 * 1000);
            const latestEntry = booking.endTime;

            if (now < earliestEntry) {
                const minsUntil = Math.ceil((earliestEntry.getTime() - now.getTime()) / 60000);
                return NextResponse.json({
                    error: `Too early. Entry allowed ${entryTimeWindow}min before booking. Try again in ${minsUntil} minutes.`,
                    booking: formatBooking(booking),
                    earliestEntry: earliestEntry.toISOString(),
                }, { status: 400 });
            }

            if (now > latestEntry) {
                return NextResponse.json({
                    error: 'Booking time has passed. Entry no longer allowed.',
                    booking: formatBooking(booking),
                }, { status: 400 });
            }

            // Allow entry
            booking.checkedIn = now;
            await booking.save();

            return NextResponse.json({
                message: 'Entry allowed. Vehicle checked in.',
                booking: formatBooking(booking),
            });
        }

        if (action === 'exit') {
            if (!booking.checkedIn) {
                return NextResponse.json({
                    error: 'Vehicle has not checked in yet.',
                    booking: formatBooking(booking),
                }, { status: 400 });
            }

            if (booking.checkedOut) {
                return NextResponse.json({
                    error: 'Vehicle has already checked out.',
                    booking: formatBooking(booking),
                }, { status: 400 });
            }

            // Mark exit
            booking.checkedOut = now;
            booking.status = 'completed';
            await booking.save();

            return NextResponse.json({
                message: 'Exit recorded. Booking completed.',
                booking: formatBooking(booking),
            });
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        if (status === 500) {
            logError({
                ...extractRequestInfo(req),
                message,
                stack: error instanceof Error ? error.stack || '' : '',
                statusCode: status,
            });
        }
        return NextResponse.json({ error: message }, { status });
    }
}

function formatBooking(booking: Record<string, unknown>) {
    return {
        _id: booking._id,
        status: booking.status,
        startTime: booking.startTime,
        endTime: booking.endTime,
        checkedIn: booking.checkedIn,
        checkedOut: booking.checkedOut,
        user: booking.userId,
        vehicle: booking.vehicleId,
        parkingGround: booking.parkingGroundId,
        slot: booking.slotId,
    };
}
