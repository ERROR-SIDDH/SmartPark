import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { requireAuth, hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const body = await req.json();
        const { users } = body;

        if (!Array.isArray(users) || users.length === 0) {
            return NextResponse.json({ error: 'users array required' }, { status: 400 });
        }

        const results = { created: 0, skipped: 0, errors: [] as string[] };

        for (const u of users) {
            try {
                const existing = await User.findOne({
                    $or: [{ email: u.email }, { employeeCode: u.employeeCode }],
                });
                if (existing) {
                    results.skipped++;
                    continue;
                }

                const password = u.password || `SP${u.employeeCode}@2026`;
                const hashed = await hashPassword(password);

                await User.create({
                    employeeCode: u.employeeCode,
                    name: u.name,
                    email: u.email,
                    phone: u.phone || '',
                    department: u.department || '',
                    password: hashed,
                });
                results.created++;
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Unknown error';
                results.errors.push(`${u.employeeCode}: ${msg}`);
            }
        }

        return NextResponse.json(results, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
