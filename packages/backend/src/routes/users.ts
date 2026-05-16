import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireMinRole } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  pdfDefault: z.enum(['a4-portrait', 'a4-landscape', 'letter-landscape']).optional(),
  emailDigestEnabled: z.boolean().optional(),
})

// GET /api/users — list all users (manager+)
router.get('/', requireAuth, requireMinRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true, email: true, fullName: true, initials: true,
        avatarColor: true, role: true, discipline: true,
        active: true, emailDigestEnabled: true, theme: true, pdfDefault: true, createdAt: true,
        _count: { select: { drawingsAsDesigner: { where: { isDeleted: false } } } },
      },
      orderBy: { fullName: 'asc' },
    })
    return res.json({ users })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/users/:id/preferences
router.patch('/:id/preferences', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    // Users can only update their own preferences; managers can update any
    const userLevel = ['DESIGNER','SENIOR_DESIGNER','DESIGN_MANAGER','PROJECT_MANAGER','DEPARTMENT_HEAD','ADMIN'].indexOf(req.user!.role)
    if (id !== req.user!.id && userLevel < 2) {
      return res.status(403).json({ error: 'Can only update your own preferences', code: 'FORBIDDEN' })
    }

    const data = preferencesSchema.parse(req.body)
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, theme: true, pdfDefault: true, emailDigestEnabled: true,
      },
    })
    return res.json({ user: updated })
  } catch (err) {
    next(err)
  }
})

export default router
