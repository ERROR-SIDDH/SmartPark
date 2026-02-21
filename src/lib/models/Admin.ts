import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
    email: string;
    password: string;
    name: string;
    role: 'ADMIN';
    createdAt: Date;
}

const AdminSchema = new Schema<IAdmin>({
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'ADMIN', enum: ['ADMIN'] },
}, { timestamps: true });

export default mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema);
