import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  unitId: z.string().cuid('Invalid unit ID').optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  rentAmount: z.number().positive('Rent amount must be positive').optional(),
  dueDay: z.number().int().min(1).max(28, 'Due day must be between 1 and 28').optional(),
});

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).trim().optional(),
  email: z.string().email().optional().or(z.literal('')),
  unitId: z.string().cuid().optional().nullable(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rentAmount: z.number().positive().optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
});

export const TenantStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    errorMap: () => ({ message: 'Status must be ACTIVE or INACTIVE' }),
  }),
});

export const TenantQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  unitId: z.string().optional(),
});

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantInput = z.infer<typeof UpdateTenantSchema>;
export type TenantStatusInput = z.infer<typeof TenantStatusSchema>;
