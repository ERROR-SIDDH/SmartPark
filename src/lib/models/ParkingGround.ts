import mongoose, { Schema, Document } from 'mongoose';

export interface IParkingGround extends Document {
    name: string;
    address: string;
    location: {
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
    };
    layoutImage: string; // path to uploaded PNG
    totalCapacity: number;
    allowedVehicleTypes: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ParkingGroundSchema = new Schema<IParkingGround>({
    name: { type: String, required: true },
    address: { type: String, required: true },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    layoutImage: { type: String, default: '' },
    totalCapacity: { type: Number, default: 0 },
    allowedVehicleTypes: [{ type: String, enum: ['car', 'bike', 'pickup', 'ev'] }],
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

ParkingGroundSchema.index({ location: '2dsphere' });
ParkingGroundSchema.index({ name: 'text' });

export default mongoose.models.ParkingGround || mongoose.model<IParkingGround>('ParkingGround', ParkingGroundSchema);
