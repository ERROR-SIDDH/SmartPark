import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBooking extends Document {
    userId: Types.ObjectId;
    vehicleId: Types.ObjectId;
    parkingGroundId: Types.ObjectId;
    slotId: Types.ObjectId;
    startTime: Date;
    endTime: Date;
    status: 'active' | 'cancelled' | 'completed';
    qrToken: string;
    checkedIn: Date | null;
    checkedOut: Date | null;
    extendedFrom: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    parkingGroundId: { type: Schema.Types.ObjectId, ref: 'ParkingGround', required: true },
    slotId: { type: Schema.Types.ObjectId, ref: 'Slot', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, default: 'active', enum: ['active', 'cancelled', 'completed'] },
    qrToken: { type: String, unique: true, sparse: true },
    checkedIn: { type: Date, default: null },
    checkedOut: { type: Date, default: null },
    extendedFrom: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
}, { timestamps: true });

BookingSchema.index({ userId: 1 });
BookingSchema.index({ slotId: 1, startTime: 1, endTime: 1 });
BookingSchema.index({ parkingGroundId: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ qrToken: 1 });

export default mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);

