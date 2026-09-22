import { z } from 'zod';

export const CreateNotificationSchema = z.object({
  tenantId: z.string().cuid('Invalid tenant ID').optional(),
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required').max(1000),
  type: z
    .enum([
      'RENT_REMINDER',
      'RENT_OVERDUE',
      'PAYMENT_CONFIRMATION',
      'ELECTRICITY_BILL',
      'GENERAL',
    ])
    .default('GENERAL'),
});

export const NotificationQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  tenantId: z.string().optional(),
  isRead: z.enum(['true', 'false']).optional(),
  type: z
    .enum([
      'RENT_REMINDER',
      'RENT_OVERDUE',
      'PAYMENT_CONFIRMATION',
      'ELECTRICITY_BILL',
      'GENERAL',
    ])
    .optional(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
