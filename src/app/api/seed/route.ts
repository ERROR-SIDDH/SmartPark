import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/lib/models/Admin';
import User from '@/lib/models/User';
import { hashPassword } from '@/lib/auth';

async function seedDatabase() {
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
            message: 'Seed complete! You can now login.',
            credentials: {
                admin: { email: 'admin@smartparking.com', password: 'admin123', loginPage: '/admin-login' },
                user: { employeeCode: 'EMP001', password: 'user123', loginPage: '/login' },
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        console.error('Seed error:', message);
        return NextResponse.json({
            error: message,
            hint: message.includes('auth')
                ? 'MongoDB authentication failed. Check your MONGODB_URI in .env — the username/password may be wrong, or your IP may not be whitelisted in MongoDB Atlas.'
                : message.includes('ECONNREFUSED') || message.includes('timeout')
                    ? 'Cannot connect to MongoDB. Check if your MongoDB server is running and the URI is correct.'
                    : 'Database error. Check the server console for details.',
        }, { status: 500 });
    }
}

// Support both GET and POST so you can seed from the browser URL bar
export async function GET(req: NextRequest) {
    return seedDatabase();
}

export async function POST(req: NextRequest) {
    return seedDatabase();
}
