import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/lib/models/Admin';
import User from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        // Create default admin if none exists
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const hashedPassword = await hashPassword('admin123');
            await Admin.create({
                email: 'admin@smartparking.com',
                password: hashedPassword,
                name: 'System Admin',
            });
        }

        // Create default test user if none exists
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            const hashedPassword = await hashPassword('user123');
            await User.create({
                employeeCode: 'EMP001',
                name: 'John Doe',
                email: 'john@company.com',
                phone: '9999999999',
                department: 'Engineering',
                password: hashedPassword,
            });
        }

        return NextResponse.json({
            message: 'Seed complete',
            admin: { email: 'admin@smartparking.com', password: 'admin123' },
            user: { employeeCode: 'EMP001', password: 'user123' },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
