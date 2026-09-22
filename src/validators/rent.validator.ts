import { z } from 'zod';

export const GenerateRentSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
    .optional(),
});

export const UpdateRentStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'], {
    errorMap: () => ({ message: 'Invalid rent status' }),
  }),
});

export const RentQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  tenantId: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type GenerateRentInput = z.infer<typeof GenerateRentSchema>;
export type UpdateRentStatusInput = z.infer<typeof UpdateRentStatusSchema>;
