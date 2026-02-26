import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import '@/lib/models/User';
import '@/lib/models/Vehicle';
import '@/lib/models/ParkingGround';
import '@/lib/models/Slot';
import { requireAuth } from '@/lib/auth';

// Admin: export bookings as CSV
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const query: Record<string, unknown> = {};
        if (status) query.status = status;
        if (from || to) {
            query.createdAt = {};
            if (from) (query.createdAt as Record<string, unknown>)['$gte'] = new Date(from);
            if (to) (query.createdAt as Record<string, unknown>)['$lte'] = new Date(to + 'T23:59:59.999Z');
        }

        const bookings = await Booking.find(query)
            .populate('userId', 'name email employeeCode department')
            .populate('vehicleId', 'vehicleNumber vehicleType')
            .populate('parkingGroundId', 'name address')
            .populate('slotId', 'slotNumber vehicleType')
            .sort({ createdAt: -1 })
            .lean();

        // Build CSV
        const headers = [
            'Booking ID', 'Status', 'Employee', 'Email', 'Employee Code', 'Department',
            'Vehicle', 'Vehicle Type', 'Parking Ground', 'Slot', 'Start Time', 'End Time',
            'Checked In', 'Checked Out', 'Created At',
        ];

        const rows = bookings.map((b: Record<string, unknown>) => {
            const user = b.userId as Record<string, string> | null;
            const vehicle = b.vehicleId as Record<string, string> | null;
            const ground = b.parkingGroundId as Record<string, string> | null;
            const slot = b.slotId as Record<string, string> | null;
            return [
                b._id,
                b.status,
                user?.name || '',
                user?.email || '',
                user?.employeeCode || '',
                user?.department || '',
                vehicle?.vehicleNumber || '',
                vehicle?.vehicleType || '',
                ground?.name || '',
                slot?.slotNumber || '',
                b.startTime ? new Date(b.startTime as string).toISOString() : '',
                b.endTime ? new Date(b.endTime as string).toISOString() : '',
                b.checkedIn ? new Date(b.checkedIn as string).toISOString() : '',
                b.checkedOut ? new Date(b.checkedOut as string).toISOString() : '',
                b.createdAt ? new Date(b.createdAt as string).toISOString() : '',
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="bookings_report_${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
