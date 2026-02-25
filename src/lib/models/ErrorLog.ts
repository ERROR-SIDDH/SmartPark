import mongoose, { Schema, Document } from 'mongoose';

export interface IErrorLog extends Document {
    source: 'API' | 'CLIENT' | 'SERVER';
    endpoint: string;
    method: string;
    message: string;
    stack: string;
    statusCode: number;
    userId: string;
    userAgent: string;
    ip: string;
    meta: Record<string, unknown>;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ErrorLogSchema = new Schema<IErrorLog>({
    source: { type: String, enum: ['API', 'CLIENT', 'SERVER'], default: 'API' },
    endpoint: { type: String, default: '' },
    method: { type: String, default: '' },
    message: { type: String, required: true },
    stack: { type: String, default: '' },
    statusCode: { type: Number, default: 500 },
    userId: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

ErrorLogSchema.index({ createdAt: -1 });
ErrorLogSchema.index({ isRead: 1 });

export default mongoose.models.ErrorLog || mongoose.model<IErrorLog>('ErrorLog', ErrorLogSchema);
