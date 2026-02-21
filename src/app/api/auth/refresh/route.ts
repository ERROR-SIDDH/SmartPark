import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const refreshToken = req.cookies.get('refreshToken')?.value;
        if (!refreshToken) {
            return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
        }

        const payload = verifyRefreshToken(refreshToken);
        const newToken = signToken({ id: payload.id, role: payload.role, email: payload.email });

        const response = NextResponse.json({ token: newToken });
        response.cookies.set('token', newToken, {
            httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400, path: '/',
        });
        return response;
    } catch {
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }
}
