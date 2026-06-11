import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth, requireMinRole } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// GET /api/audit — any authenticated user, read-only
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, action, drawingId, from, to, limit = '100', offset = '0', search } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (action) where.action = action
    if (drawingId) where.drawingId = drawingId
    if (search) where.details = { contains: search, mode: 'insensitive' }
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      }
    }

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: where as any,
        include: {
          user: { select: { id: true, fullName: true, initials: true, avatarColor: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit), 500),
        skip: parseInt(offset),
      }),
      prisma.auditLog.count({ where: where as any }),
    ])

    const parsed = entries.map(e => ({
      ...e,
      details: JSON.parse(e.details as string),
    }))

    return res.json({ entries: parsed, total })
  } catch (err) {
    next(err)
  }
})

export default router
