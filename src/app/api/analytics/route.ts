import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Booking from '@/lib/models/Booking';
import Slot from '@/lib/models/Slot';
import ParkingGround from '@/lib/models/ParkingGround';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const now = new Date();

        // Count currently active bookings (i.e. bookings whose time window contains "now")
        const currentlyOccupiedCount = await Booking.countDocuments({
            status: 'active',
            startTime: { $lte: now },
            endTime: { $gte: now },
        });

        const [
            totalUsers, activeUsers, totalGrounds, totalSlots,
            blockedSlots, totalBookings, activeBookings, cancelledBookings, completedBookings,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isActive: true }),
            ParkingGround.countDocuments({ isActive: true }),
            Slot.countDocuments(),
            Slot.countDocuments({ status: 'blocked' }),
            Booking.countDocuments(),
            Booking.countDocuments({ status: 'active' }),
            Booking.countDocuments({ status: 'cancelled' }),
            Booking.countDocuments({ status: 'completed' }),
        ]);

        const availableSlots = totalSlots - currentlyOccupiedCount - blockedSlots;

        // Bookings by day (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const bookingsByDay = await Booking.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Vehicle type distribution (from slots)
        const vehicleTypeDist = await Slot.aggregate([
            { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
        ]);

        // Occupancy by parking ground — dynamically computed from active bookings
        const grounds = await ParkingGround.find({ isActive: true }).select('_id name').lean();
        const occupancyByGround = await Promise.all(
            grounds.map(async (g) => {
                const total = await Slot.countDocuments({ parkingGroundId: g._id });
                const booked = await Booking.countDocuments({
                    parkingGroundId: g._id,
                    status: 'active',
                    startTime: { $lte: now },
                    endTime: { $gte: now },
                });
                return { name: g.name, total, booked };
            })
        );

        // Peak hours (aggregation of booking start times by hour)
        const peakHours = await Booking.aggregate([
            { $match: { status: { $in: ['active', 'completed'] } } },
            {
                $group: {
                    _id: { $hour: '$startTime' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        return NextResponse.json({
            totalUsers,
            activeUsers,
            totalGrounds,
            totalSlots,
            availableSlots,
            bookedSlots: currentlyOccupiedCount,
            blockedSlots,
            totalBookings,
            activeBookings,
            cancelledBookings,
            completedBookings,
            bookingsByDay,
            vehicleTypeDist,
            occupancyByGround,
            peakHours,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
