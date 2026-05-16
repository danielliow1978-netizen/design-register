import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const upsertDraftSchema = z.object({
  id: z.string().optional(),        // if provided, update that draft
  formData: z.record(z.unknown()),  // entire form snapshot
  completionPct: z.number().int().min(0).max(100).default(0),
})

// GET /api/drafts — current user's non-expired drafts
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drafts = await prisma.drawingDraft.findMany({
      where: {
        userId: req.user!.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastSavedAt: 'desc' },
    })
    const parsed = drafts.map(d => ({
      ...d,
      formData: JSON.parse(d.formData as string),
    }))
    return res.json({ drafts: parsed })
  } catch (err) {
    next(err)
  }
})

// POST /api/drafts — create or update (idempotent)
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = upsertDraftSchema.parse(req.body)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days

    let draft
    if (data.id) {
      // Update existing draft (only if owned by current user)
      const existing = await prisma.drawingDraft.findFirst({
        where: { id: data.id, userId: req.user!.id },
      })
      if (!existing) {
        return res.status(404).json({ error: 'Draft not found', code: 'NOT_FOUND' })
      }
      draft = await prisma.drawingDraft.update({
        where: { id: data.id },
        data: {
          formData: JSON.stringify(data.formData),
          completionPct: data.completionPct,
          lastSavedAt: now,
        },
      })
    } else {
      // Create new draft
      draft = await prisma.drawingDraft.create({
        data: {
          userId: req.user!.id,
          formData: JSON.stringify(data.formData),
          completionPct: data.completionPct,
          expiresAt,
        },
      })
    }

    return res.json({ draft: { ...draft, formData: data.formData } })
  } catch (err) {
    next(err)
  }
})

// GET /api/drafts/:id — get specific draft to resume
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const draft = await prisma.drawingDraft.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        expiresAt: { gt: new Date() },
      },
    })
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found or expired', code: 'NOT_FOUND' })
    }
    return res.json({ draft: { ...draft, formData: JSON.parse(draft.formData as string) } })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/drafts/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.drawingDraft.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Draft not found', code: 'NOT_FOUND' })
    }
    await prisma.drawingDraft.delete({ where: { id: req.params.id } })
    return res.json({ message: 'Draft deleted' })
  } catch (err) {
    next(err)
  }
})

export default router
