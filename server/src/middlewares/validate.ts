import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';

// A missing required field reads "Required" instead of Zod's "expected string, received undefined".
z.config({
  customError: (issue) =>
    issue.code === 'invalid_type' && issue.input === undefined ? 'Required' : undefined,
});

type Schemas = { body?: ZodType; query?: ZodType; params?: ZodType };

// Parses (and strips unknown fields from) the request parts. A ZodError reaches the error
// handler, which answers 400 VALIDATION_ERROR with one detail per field.
export const validate =
  ({ body, query, params }: Schemas): RequestHandler =>
  (req, _res, next) => {
    if (body) req.body = body.parse(req.body ?? {});
    if (params) req.params = params.parse(req.params) as typeof req.params;
    if (query) {
      // Express 5's req.query is a read-only getter, so replace the property itself.
      Object.defineProperty(req, 'query', {
        value: query.parse(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
