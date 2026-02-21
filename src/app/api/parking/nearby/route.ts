import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ParkingGround from '@/lib/models/ParkingGround';
import Slot from '@/lib/models/Slot';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const lat = parseFloat(searchParams.get('lat') || '0');
        const lng = parseFloat(searchParams.get('lng') || '0');
        const maxDistance = parseFloat(searchParams.get('maxDistance') || '10000'); // meters
        const vehicleType = searchParams.get('vehicleType');

        const query: Record<string, unknown> = {
            isActive: true,
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [lng, lat] },
                    $maxDistance: maxDistance,
                },
            },
        };

        if (vehicleType) {
            query.allowedVehicleTypes = vehicleType;
        }

        const grounds = await ParkingGround.find(query).limit(20);

        const results = await Promise.all(
            grounds.map(async (g) => {
                const slots = await Slot.find({ parkingGroundId: g._id });
                const available = slots.filter(s => s.status === 'available').length;
                const evSlots = slots.filter(s => s.isEV || s.vehicleType === 'ev').length;

                // Calculate distance
                const [gLng, gLat] = g.location.coordinates;
                const R = 6371;
                const dLat = (gLat - lat) * Math.PI / 180;
                const dLon = (gLng - lng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(gLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                return {
                    ...g.toObject(),
                    slotsAvailable: available,
                    totalSlots: slots.length,
                    evSlots,
                    distance: Math.round(distance * 100) / 100,
                };
            })
        );

        return NextResponse.json(results);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
