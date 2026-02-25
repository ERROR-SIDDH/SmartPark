import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;
        const user = await User.findById(id).select('-password');
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
        return NextResponse.json(user);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;
        const body = await req.json();

        const updateData: Record<string, unknown> = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.department !== undefined) updateData.department = body.department;
        if (body.employeeCode !== undefined) updateData.employeeCode = body.employeeCode;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;

        // Only update password if provided and non-empty
        if (body.password && body.password.trim().length >= 6) {
            updateData.password = await bcrypt.hash(body.password.trim(), 12);
        }

        const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json(user);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
