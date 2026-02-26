import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Vehicle from '@/lib/models/Vehicle';
import '@/lib/models/User';
import { requireAuth } from '@/lib/auth';

// Admin: paginated vehicle registry with search
export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        requireAuth(req, 'ADMIN');

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const vehicleType = searchParams.get('type') || '';

        const query: Record<string, unknown> = {};
        if (vehicleType) query.vehicleType = vehicleType;
        if (search) {
            query.$or = [
                { vehicleNumber: { $regex: search, $options: 'i' } },
                { vehicleModel: { $regex: search, $options: 'i' } },
                { color: { $regex: search, $options: 'i' } },
            ];
        }

        const [vehicles, total, typeCounts] = await Promise.all([
            Vehicle.find(query)
                .populate('userId', 'name email employeeCode department')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Vehicle.countDocuments(query),
            Vehicle.aggregate([
                { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
            ]),
        ]);

        const counts: Record<string, number> = {};
        typeCounts.forEach((t: { _id: string; count: number }) => { counts[t._id] = t.count; });

        return NextResponse.json({ vehicles, total, page, limit, counts });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error';
        const status = message === 'Unauthorized' || message === 'Forbidden' ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
