import { z } from 'zod';

export const CreateMeterReadingSchema = z.object({
  tenantId: z.string().cuid('Invalid tenant ID'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
  previousReading: z.number().min(0, 'Previous reading cannot be negative'),
  currentReading: z.number().min(0, 'Current reading cannot be negative'),
  rate: z.number().positive('Rate must be positive'),
  readingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const UpdateElectricityRateSchema = z.object({
  ratePerUnit: z.number().positive('Rate per unit must be positive'),
});

export const ElectricityQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  tenantId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type CreateMeterReadingInput = z.infer<typeof CreateMeterReadingSchema>;
export type UpdateElectricityRateInput = z.infer<typeof UpdateElectricityRateSchema>;
