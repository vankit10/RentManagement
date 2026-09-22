import { z } from 'zod';

export const CreatePaymentSchema = z.object({
  tenantId: z.string().cuid('Invalid tenant ID'),
  rentRecordId: z.string().cuid('Invalid rent record ID'),
  amount: z.number().positive('Amount must be positive'),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  paymentMethod: z
    .enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'])
    .default('CASH'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const PaymentQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  tenantId: z.string().optional(),
  rentRecordId: z.string().optional(),
  paymentMethod: z
    .enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'])
    .optional(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
