import { prisma } from '../lib/prisma'
import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireAuth, requireMinRole } from '../middleware/auth'

const router = Router()

const drawingSelect = {
  id: true, drawingNumber: true, drawingTitle: true,
  discipline: true, category: true, status: true,
  project: { select: { id: true, code: true, name: true } },
  designer: { select: { id: true, fullName: true, initials: true, avatarColor: true } },
  deletedAt: true, deletedById: true, deletedReason: true, isDeleted: true,
  requestDate: true, startDate: true, endDate: true, actualCompletionDate: true,
  createdAt: true,
}

// GET /api/recycle — soft-deleted drawings (any authenticated user)
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drawings = await prisma.drawing.findMany({
      where: { isDeleted: true },
      select: drawingSelect,
      orderBy: { deletedAt: 'desc' },
    })
    return res.json({ drawings })
  } catch (err) {
    next(err)
  }
})

// POST /api/recycle/:id/restore — restore to active register
router.post('/:id/restore', requireAuth, requireMinRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drawing = await prisma.drawing.findUnique({ where: { id: req.params.id } })
    if (!drawing || !drawing.isDeleted) {
      return res.status(404).json({ error: 'Deleted drawing not found', code: 'NOT_FOUND' })
    }

    // Recompute status on restore
    const now = new Date()
    let status = 'IN_PROGRESS'
    if (drawing.actualCompletionDate) status = 'COMPLETED'
    else if (now > drawing.endDate) status = 'OVERDUE'

    await prisma.drawing.update({
      where: { id: req.params.id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletedReason: null,
        status,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'RESTORED',
        drawingId: req.params.id,
        details: JSON.stringify({ drawingNumber: drawing.drawingNumber }),
        ipAddress: req.ip || null,
      },
    })

    return res.json({ message: 'Drawing restored' })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/recycle/:id/purge — permanent delete (DEPARTMENT_HEAD only)
router.delete('/:id/purge', requireAuth, requireMinRole('DEPARTMENT_HEAD'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body)

    // Re-auth
    const fullUser = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!fullUser) return res.status(401).json({ error: 'User not found', code: 'UNAUTHORIZED' })
    const valid = await bcrypt.compare(password, fullUser.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Incorrect password', code: 'INVALID_PASSWORD' })

    const drawing = await prisma.drawing.findUnique({ where: { id: req.params.id } })
    if (!drawing || !drawing.isDeleted) {
      return res.status(404).json({ error: 'Deleted drawing not found', code: 'NOT_FOUND' })
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'PERMANENTLY_DELETED',
        drawingId: req.params.id,
        details: JSON.stringify({ drawingNumber: drawing.drawingNumber }),
        ipAddress: req.ip || null,
      },
    })

    // Hard delete after audit log
    await prisma.drawing.delete({ where: { id: req.params.id } })

    return res.json({ message: 'Drawing permanently deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
