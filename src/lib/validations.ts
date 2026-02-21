import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const userLoginSchema = z.object({
    employeeCode: z.string().min(1, 'Employee code is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerUserSchema = z.object({
    employeeCode: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    department: z.string().optional(),
    password: z.string().min(6),
});

export const parkingGroundSchema = z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    totalCapacity: z.number().int().min(0).optional(),
    allowedVehicleTypes: z.array(z.enum(['car', 'bike', 'pickup', 'ev'])).optional(),
});

export const slotSchema = z.object({
    parkingGroundId: z.string().min(1),
    slotNumber: z.string().min(1),
    vehicleType: z.enum(['car', 'bike', 'pickup', 'ev']),
    position: z.object({ x: z.number(), y: z.number() }),
    dimensions: z.object({ width: z.number(), height: z.number() }),
    rotation: z.number().optional(),
    row: z.string().optional(),
    isEV: z.boolean().optional(),
    isAccessible: z.boolean().optional(),
});

export const slotBatchSchema = z.object({
    parkingGroundId: z.string().min(1),
    slots: z.array(slotSchema.omit({ parkingGroundId: true })),
});

export const vehicleSchema = z.object({
    vehicleNumber: z.string().min(1),
    vehicleType: z.enum(['car', 'bike', 'pickup', 'ev']),
    color: z.string().optional(),
    model: z.string().optional(),
    isDefault: z.boolean().optional(),
});

export const bookingSchema = z.object({
    vehicleId: z.string().min(1),
    parkingGroundId: z.string().min(1),
    slotId: z.string().min(1),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
});
