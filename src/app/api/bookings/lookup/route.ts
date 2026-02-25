import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import '@/lib/models/User';         // register schema for populate
import '@/lib/models/Vehicle';      // register schema for populate
import '@/lib/models/ParkingGround'; // register schema for populate
import '@/lib/models/Slot';         // register schema for populate
import { requireAuth } from '@/lib/auth';
import { logError, extractRequestInfo } from '@/lib/errorLogger';

// Admin looks up a booking by QR token without taking action
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { searchParams } = new URL(req.url);
        const qrToken = searchParams.get('qrToken');

        if (!qrToken) {
            return NextResponse.json({ error: 'Missing qrToken' }, { status: 400 });
        }

        const booking = await Booking.findOne({ qrToken })
            .populate('userId', 'name email employeeCode')
            .populate('vehicleId', 'vehicleNumber vehicleType')
            .populate('parkingGroundId', 'name address entryTimeWindow')
            .populate('slotId', 'slotNumber vehicleType');

        if (!booking) {
            return NextResponse.json({ error: 'Invalid QR code. No booking found.' }, { status: 404 });
        }

        return NextResponse.json({
            _id: booking._id,
            status: booking.status,
            startTime: booking.startTime,
            endTime: booking.endTime,
            checkedIn: booking.checkedIn,
            checkedOut: booking.checkedOut,
            qrToken: booking.qrToken,
            user: booking.userId,
            vehicle: booking.vehicleId,
            parkingGround: booking.parkingGroundId,
            slot: booking.slotId,
        });
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
