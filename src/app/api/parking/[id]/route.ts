import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import ParkingGround from '@/lib/models/ParkingGround';
import Slot from '@/lib/models/Slot';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await params;
        const ground = await ParkingGround.findById(id);
        if (!ground) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const slots = await Slot.find({ parkingGroundId: id });
        return NextResponse.json({ ...ground.toObject(), slots });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;

        const body = await req.json();
        const updateData: Record<string, unknown> = {};
        if (body.name) updateData.name = body.name;
        if (body.address) updateData.address = body.address;
        if (body.latitude !== undefined && body.longitude !== undefined) {
            updateData.location = { type: 'Point', coordinates: [body.longitude, body.latitude] };
        }
        if (body.totalCapacity !== undefined) updateData.totalCapacity = body.totalCapacity;
        if (body.allowedVehicleTypes) updateData.allowedVehicleTypes = body.allowedVehicleTypes;
        if (body.layoutImage) updateData.layoutImage = body.layoutImage;

        const ground = await ParkingGround.findByIdAndUpdate(id, updateData, { new: true });
        if (!ground) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json(ground);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;

        await ParkingGround.findByIdAndUpdate(id, { isActive: false });
        await Slot.updateMany({ parkingGroundId: id }, { status: 'blocked' });

        return NextResponse.json({ message: 'Deleted' });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
