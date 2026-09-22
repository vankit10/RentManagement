import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../lib/response';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 *
 * Usage:
 *   router.post('/', validate(MySchema), handler)
 *   router.get('/',  validate(QuerySchema, 'query'), handler)
 */
export function validate(schema: ZodSchema, target: ValidateTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      sendError(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }

    // Replace request data with validated + coerced data
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
