import { prisma } from '../lib/prisma'
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'

const router = Router()

// Managers and above may edit/delete any team member's entry (override).
const MANAGER_ROLES = ['ASSISTANT_DESIGN_MANAGER', 'DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD', 'COO', 'CEO', 'ADMIN']

const siteLocationSelect = {
  id: true,
  userId: true,
  user: { select: { id: true, fullName: true, initials: true, avatarColor: true, role: true } },
  date: true,
  siteName: true,
  siteArea: true,
  timeIn: true,
  timeOut: true,
  note: true,
  createdAt: true,
  updatedAt: true,
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm')

const createSchema = z.object({
  date: dateStr,
  siteName: z.string().min(1).max(200),
  siteArea: z.string().max(200).optional(),
  timeIn: timeStr.optional(),
  timeOut: timeStr.optional(),
  note: z.string().max(500).optional(),
})

const updateSchema = createSchema.partial()

// GET /api/site-locations — list site-location entries.
//   ?date=YYYY-MM-DD          → all team entries for a single day (board)
//   ?from=YYYY-MM-DD&to=...   → date range (history view). Dates are "YYYY-MM-DD"
//                               strings, which sort chronologically, so gte/lte work.
//   ?userId=...               → limit to one person
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, userId, from, to } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (date) where.date = date
    else if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      }
    }
    if (userId) where.userId = userId

    const entries = await prisma.siteLocation.findMany({
      where,
      select: siteLocationSelect,
      orderBy: [{ date: 'desc' }, { timeIn: 'asc' }, { createdAt: 'asc' }],
      take: date ? 500 : 2000,
    })

    return res.json({ entries })
  } catch (err) {
    next(err)
  }
})

// POST /api/site-locations — any authenticated user logs their own location
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createSchema.parse(req.body)
    const entry = await prisma.siteLocation.create({
      data: { ...data, userId: req.user!.id },
      select: siteLocationSelect,
    })
    return res.status(201).json({ entry })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/site-locations/:id — owner (or manager+) edits an entry
router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const existing = await prisma.siteLocation.findUnique({ where: { id }, select: { userId: true } })
    if (!existing) return res.status(404).json({ error: 'Site location not found', code: 'NOT_FOUND' })

    const isOwner = existing.userId === req.user!.id
    const isManager = MANAGER_ROLES.includes(req.user!.role)
    if (!isOwner && !isManager) {
      return res.status(403).json({ error: 'You can only edit your own site locations', code: 'FORBIDDEN' })
    }

    const data = updateSchema.parse(req.body)
    const entry = await prisma.siteLocation.update({
      where: { id },
      data,
      select: siteLocationSelect,
    })
    return res.json({ entry })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/site-locations/:id — owner (or manager+) removes an entry
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const existing = await prisma.siteLocation.findUnique({ where: { id }, select: { userId: true } })
    if (!existing) return res.status(404).json({ error: 'Site location not found', code: 'NOT_FOUND' })

    const isOwner = existing.userId === req.user!.id
    const isManager = MANAGER_ROLES.includes(req.user!.role)
    if (!isOwner && !isManager) {
      return res.status(403).json({ error: 'You can only delete your own site locations', code: 'FORBIDDEN' })
    }

    await prisma.siteLocation.delete({ where: { id } })
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
