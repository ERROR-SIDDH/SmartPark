import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import { authenticateRequest } from '@/lib/auth';

// Returns slotIds that have active bookings overlapping the given time range
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const user = authenticateRequest(req);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const parkingGroundId = searchParams.get('parkingGroundId');
        const startTime = searchParams.get('startTime');
        const endTime = searchParams.get('endTime');

        if (!parkingGroundId || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
        }

        // Find all active bookings that overlap with the requested time window
        const overlapping = await Booking.find({
            parkingGroundId,
            status: 'active',
            startTime: { $lt: new Date(endTime) },
            endTime: { $gt: new Date(startTime) },
        }).select('slotId');

        return NextResponse.json(overlapping.map(b => ({ slotId: b.slotId.toString() })));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
