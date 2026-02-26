import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import '@/lib/models/User';
import '@/lib/models/Vehicle';
import '@/lib/models/ParkingGround';
import '@/lib/models/Slot';
import { requireAuth } from '@/lib/auth';

// Admin: paginated bookings listing with search & filter
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status');
        const search = searchParams.get('search') || '';
        const groundId = searchParams.get('groundId');

        const query: Record<string, unknown> = {};
        if (status) query.status = status;
        if (groundId) query.parkingGroundId = groundId;

        let bookings = Booking.find(query)
            .populate('userId', 'name email employeeCode department')
            .populate('vehicleId', 'vehicleNumber vehicleType color')
            .populate('parkingGroundId', 'name address')
            .populate('slotId', 'slotNumber vehicleType')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const [results, total, statusCounts] = await Promise.all([
            bookings.lean(),
            Booking.countDocuments(query),
            Booking.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);

        // If search is provided, we filter in-memory after populate (for user name/email)
        let filteredResults = results;
        if (search) {
            const s = search.toLowerCase();
            filteredResults = results.filter((b: Record<string, unknown>) => {
                const user = b.userId as Record<string, string> | null;
                const vehicle = b.vehicleId as Record<string, string> | null;
                return (
                    user?.name?.toLowerCase().includes(s) ||
                    user?.email?.toLowerCase().includes(s) ||
                    user?.employeeCode?.toLowerCase().includes(s) ||
                    vehicle?.vehicleNumber?.toLowerCase().includes(s) ||
                    (b.qrToken as string)?.includes(s)
                );
            });
        }

        const counts: Record<string, number> = {};
        statusCounts.forEach((s: { _id: string; count: number }) => { counts[s._id] = s.count; });

        return NextResponse.json({
            bookings: filteredResults,
            total,
            page,
            limit,
            counts,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
