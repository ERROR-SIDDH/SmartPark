import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    employeeCode: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    password: string;
    role: 'USER';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
    employeeCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, default: '' },
    department: { type: String, default: '' },
    password: { type: String, required: true },
    role: { type: String, default: 'USER', enum: ['USER'] },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

UserSchema.index({ employeeCode: 1 });
UserSchema.index({ email: 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
