import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import dbConnect from '@/lib/db';
import ParkingGround from '@/lib/models/ParkingGround';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');
        const { id } = await params;

        const formData = await req.formData();
        const file = formData.get('layout') as File;
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const filename = `layout_${id}_${Date.now()}.png`;
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);

        const layoutImage = `/uploads/${filename}`;
        await ParkingGround.findByIdAndUpdate(id, { layoutImage });

        return NextResponse.json({ layoutImage });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
