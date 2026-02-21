import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/lib/models/User';
import { comparePassword, signToken, signRefreshToken } from '@/lib/auth';
import { userLoginSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const parsed = userLoginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        }

        const user = await User.findOne({ employeeCode: parsed.data.employeeCode });
        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
        }

        const isValid = await comparePassword(parsed.data.password, user.password);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const payload = { id: user._id.toString(), role: 'USER' as const, email: user.email };
        const token = signToken(payload);
        const refreshToken = signRefreshToken(payload);

        const response = NextResponse.json({
            user: {
                id: user._id, name: user.name, email: user.email,
                employeeCode: user.employeeCode, department: user.department, role: 'USER',
            },
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
