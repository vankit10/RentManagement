import { z } from 'zod';

export const CreateAccessRequestSchema = z.object({
  ownerEmail: z.string().email('Enter a valid owner email address').transform(value => value.trim().toLowerCase()),
});

export const UpdateAccessRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
});

export type CreateAccessRequestInput = z.infer<typeof CreateAccessRequestSchema>;
export type UpdateAccessRequestInput = z.infer<typeof UpdateAccessRequestSchema>;
