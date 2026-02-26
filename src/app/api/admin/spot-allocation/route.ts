import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import Booking from '@/lib/models/Booking';
import Slot from '@/lib/models/Slot';
import Vehicle from '@/lib/models/Vehicle';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { searchParams } = new URL(req.url);
        const code = searchParams.get('employeeCode');

        if (!code) return NextResponse.json({ error: 'Employee code required' }, { status: 400 });

        const user = await User.findOne({ employeeCode: code.trim() }).lean();
        if (!user) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        return NextResponse.json({
            name: (user as any).name,
            department: (user as any).department,
            employeeCode: (user as any).employeeCode,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { employeeCode, parkingGroundId, vehicleType, endTime } = await req.json();

        if (!employeeCode || !parkingGroundId || !vehicleType || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Find user
        const user = await User.findOne({ employeeCode: employeeCode.trim() });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // 2. Find/Create vehicle of that type for this user
        let vehicle = await Vehicle.findOne({ userId: user._id, vehicleType });
        if (!vehicle) {
            // Create a placeholder vehicle for spot allocation
            vehicle = await Vehicle.create({
                userId: user._id,
                vehicleNumber: `SPOT-${employeeCode}-${vehicleType.toUpperCase()}`,
                vehicleType,
                color: 'Unknown',
                dimensions: { length: 0, width: 0 } // dummy dimensions, bypass validation
            });
        }

        // 3. Find an available slot
        const now = new Date();
        const end = new Date(endTime);

        if (end <= now) {
            return NextResponse.json({ error: 'End time must be in the future' }, { status: 400 });
        }

        // Potential slots of this type in this ground
        const potentialSlots = await Slot.find({
            parkingGroundId,
            vehicleType,
            status: 'available'
        });

        if (potentialSlots.length === 0) {
            return NextResponse.json({ error: `No available ${vehicleType} slots in this ground` }, { status: 404 });
        }

        // Check for conflicts for each potential slot
        let allotedSlot = null;
        for (const slot of potentialSlots) {
            const conflict = await Booking.findOne({
                slotId: slot._id,
                status: 'active',
                $or: [
                    { startTime: { $lt: end }, endTime: { $gt: now } },
                ],
            });
            if (!conflict) {
                allotedSlot = slot;
                break;
            }
        }

        if (!allotedSlot) {
            return NextResponse.json({ error: 'All matching slots are already booked for this time' }, { status: 409 });
        }

        // 4. Create booking & check-in immediately
        const booking = await Booking.create({
            userId: user._id,
            vehicleId: vehicle._id,
            parkingGroundId,
            slotId: allotedSlot._id,
            startTime: now,
            endTime: end,
            status: 'active',
            qrToken: randomUUID(),
            checkedIn: now, // Check in immediately
        });

        return NextResponse.json({
            message: 'Spot allocated successfully',
            booking: {
                _id: booking._id,
                slotNumber: allotedSlot.slotNumber,
                userName: user.name,
                vehicleNumber: vehicle.vehicleNumber
            }
        }, { status: 201 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
