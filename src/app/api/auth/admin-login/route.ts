import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Admin from '@/lib/models/Admin';
import { comparePassword, signToken, signRefreshToken } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const admin = await Admin.findOne({ email: parsed.data.email });
        if (!admin) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const isValid = await comparePassword(parsed.data.password, admin.password);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const payload = { id: admin._id.toString(), role: 'ADMIN' as const, email: admin.email };
        const token = signToken(payload);
        const refreshToken = signRefreshToken(payload);

        const response = NextResponse.json({
            user: { id: admin._id, name: admin.name, email: admin.email, role: 'ADMIN' },
            token,
        });

        response.cookies.set('token', token, {
            httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400, path: '/',
        });
        response.cookies.set('refreshToken', refreshToken, {
            httpOnly: true, secure: false, sameSite: 'lax', maxAge: 604800, path: '/',
        });

        return response;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
