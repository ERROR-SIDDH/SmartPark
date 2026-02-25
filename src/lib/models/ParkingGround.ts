import mongoose, { Schema, Document } from 'mongoose';

export interface IDrawingShape {
    type: 'line' | 'rect' | 'arc' | 'freehand';
    points: number[]; // [x1,y1, x2,y2, ...] for line/freehand, [x,y,w,h] for rect, [cx,cy,r,startAngle,endAngle] for arc
    color: string;
    lineWidth: number;
    fill?: string;
}

export interface IParkingGround extends Document {
    name: string;
    address: string;
    location: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    };
    layoutImage: string; // draft reference image (can be removed)
    layoutDrawing: IDrawingShape[]; // vector drawing data
    totalCapacity: number;
    allowedVehicleTypes: string[];
    entryTimeWindow: number; // minutes before booking start that entry is allowed
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const DrawingShapeSchema = new Schema({
    type: { type: String, enum: ['line', 'rect', 'arc', 'freehand'], required: true },
    points: [{ type: Number }],
    color: { type: String, default: '#ffffff' },
    lineWidth: { type: Number, default: 2 },
    fill: { type: String, default: '' },
}, { _id: false });

const ParkingGroundSchema = new Schema<IParkingGround>({
    name: { type: String, required: true },
    address: { type: String, required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    layoutImage: { type: String, default: '' },
    layoutDrawing: { type: [DrawingShapeSchema], default: [] },
    totalCapacity: { type: Number, default: 0 },
    allowedVehicleTypes: [{ type: String, enum: ['car', 'bike', 'pickup', 'ev'] }],
    entryTimeWindow: { type: Number, default: 15 }, // minutes before booking start
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

ParkingGroundSchema.index({ location: '2dsphere' });
ParkingGroundSchema.index({ name: 'text' });

export default mongoose.models.ParkingGround || mongoose.model<IParkingGround>('ParkingGround', ParkingGroundSchema);
