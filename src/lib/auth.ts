import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh';

export interface TokenPayload {
    id: string;
    role: 'ADMIN' | 'USER';
    email: string;
}

export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

export function signRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function getTokenFromRequest(req: NextRequest): string | null {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    const cookie = req.cookies.get('token');
    return cookie?.value || null;
}

export function authenticateRequest(req: NextRequest): TokenPayload | null {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch {
        return null;
    }
}

export function requireAuth(req: NextRequest, role?: 'ADMIN' | 'USER'): TokenPayload {
    const payload = authenticateRequest(req);
    if (!payload) throw new Error('Unauthorized');
    if (role && payload.role !== role) throw new Error('Forbidden');
    return payload;
}
