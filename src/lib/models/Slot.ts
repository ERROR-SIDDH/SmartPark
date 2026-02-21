import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISlot extends Document {
    parkingGroundId: Types.ObjectId;
    slotNumber: string;
    vehicleType: 'car' | 'bike' | 'pickup' | 'ev';
    position: { x: number; y: number };
    dimensions: { width: number; height: number }; // pixel dimensions on canvas
    realDimensions: {
        length: number; // cm - real-world length
        width: number;  // cm - real-world width
    };
    clearance: number; // cm - required gap around the slot
    rotation: number;
    row: string;
    status: 'available' | 'booked' | 'blocked';
    isEV: boolean;
    isAccessible: boolean;
    createdAt: Date;
}

const SlotSchema = new Schema<ISlot>({
    parkingGroundId: { type: Schema.Types.ObjectId, ref: 'ParkingGround', required: true },
    slotNumber: { type: String, required: true },
    vehicleType: { type: String, required: true, enum: ['car', 'bike', 'pickup', 'ev'] },
    position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
    },
    dimensions: {
        width: { type: Number, default: 60 },
        height: { type: Number, default: 90 },
    },
    realDimensions: {
        length: { type: Number, default: 500 }, // cm
        width: { type: Number, default: 250 },  // cm
    },
    clearance: { type: Number, default: 30 }, // cm
    rotation: { type: Number, default: 0 },
    row: { type: String, default: 'A' },
    status: { type: String, default: 'available', enum: ['available', 'booked', 'blocked'] },
    isEV: { type: Boolean, default: false },
    isAccessible: { type: Boolean, default: false },
}, { timestamps: true });

SlotSchema.index({ parkingGroundId: 1 });
SlotSchema.index({ status: 1 });

export default mongoose.models.Slot || mongoose.model<ISlot>('Slot', SlotSchema);
