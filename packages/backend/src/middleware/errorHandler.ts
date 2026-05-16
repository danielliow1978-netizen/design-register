import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    })
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code || 'ERROR' })
  }
  if (err.message?.includes('Unique constraint')) {
    return res.status(409).json({ error: 'A record with that value already exists', code: 'DUPLICATE' })
  }
  console.error('Unhandled error:', err)
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
}

export function createError(message: string, statusCode: number, code?: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = statusCode
  err.code = code
  return err
}
