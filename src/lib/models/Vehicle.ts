import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVehicle extends Document {
    userId: Types.ObjectId;
    vehicleNumber: string;
    vehicleType: 'car' | 'bike' | 'pickup' | 'ev';
    color: string;
    vehicleModel: string;
    isDefault: boolean;
    createdAt: Date;
}

const VehicleSchema = new Schema<IVehicle>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleNumber: { type: String, required: true },
    vehicleType: { type: String, required: true, enum: ['car', 'bike', 'pickup', 'ev'] },
    color: { type: String, default: '' },
    vehicleModel: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
}, { timestamps: true });

VehicleSchema.index({ userId: 1 });

export default mongoose.models.Vehicle || mongoose.model<IVehicle>('Vehicle', VehicleSchema);
