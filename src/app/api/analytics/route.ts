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

        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const totalGrounds = await ParkingGround.countDocuments({ isActive: true });
        const totalSlots = await Slot.countDocuments();
        const availableSlots = await Slot.countDocuments({ status: 'available' });
        const bookedSlots = await Slot.countDocuments({ status: 'booked' });
        const blockedSlots = await Slot.countDocuments({ status: 'blocked' });
        const totalBookings = await Booking.countDocuments();
        const activeBookings = await Booking.countDocuments({ status: 'active' });
        const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

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

        // Vehicle type distribution
        const vehicleTypeDist = await Slot.aggregate([
            { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
        ]);

        // Occupancy by parking ground
        const occupancyByGround = await ParkingGround.aggregate([
            { $match: { isActive: true } },
            {
                $lookup: {
                    from: 'slots',
                    localField: '_id',
                    foreignField: 'parkingGroundId',
                    as: 'slots',
                },
            },
            {
                $project: {
                    name: 1,
                    total: { $size: '$slots' },
                    booked: {
                        $size: {
                            $filter: { input: '$slots', cond: { $eq: ['$$this.status', 'booked'] } },
                        },
                    },
                },
            },
        ]);

        return NextResponse.json({
            totalUsers,
            activeUsers,
            totalGrounds,
            totalSlots,
            availableSlots,
            bookedSlots,
            blockedSlots,
            totalBookings,
            activeBookings,
            cancelledBookings,
            bookingsByDay,
            vehicleTypeDist,
            occupancyByGround,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
