import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireMinRole } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const createProjectSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  client: z.string().optional(),
  contractType: z.enum(['EPC', 'EPCM']).optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  projectManagerId: z.string().optional(),
  iconEmoji: z.string().optional(),
  iconColor: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// GET /api/projects — list all with drawing counts
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        projectManager: {
          select: { id: true, fullName: true, initials: true, avatarColor: true },
        },
        _count: {
          select: {
            drawings: { where: { isDeleted: false } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ projects })
  } catch (err) {
    next(err)
  }
})

// GET /api/projects/:id — with stats
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        projectManager: {
          select: { id: true, fullName: true, initials: true, avatarColor: true },
        },
      },
    })
    if (!project) {
      return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' })
    }

    // Stats
    const [total, inProgress, completed, overdue] = await Promise.all([
      prisma.drawing.count({ where: { projectId: id, isDeleted: false } }),
      prisma.drawing.count({ where: { projectId: id, status: 'IN_PROGRESS', isDeleted: false } }),
      prisma.drawing.count({ where: { projectId: id, status: 'COMPLETED', isDeleted: false } }),
      prisma.drawing.count({ where: { projectId: id, status: 'OVERDUE', isDeleted: false } }),
    ])

    // On-time %: completed drawings where actualCompletionDate <= endDate
    const completedDrawings = await prisma.drawing.findMany({
      where: { projectId: id, status: 'COMPLETED', isDeleted: false },
      select: { endDate: true, actualCompletionDate: true },
    })
    const onTime = completedDrawings.filter(d => d.actualCompletionDate && d.actualCompletionDate <= d.endDate).length
    const onTimePct = completedDrawings.length > 0 ? Math.round((onTime / completedDrawings.length) * 100) : null

    return res.json({
      project,
      stats: { total, inProgress, completed, overdue, onTimePct },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/projects — any authenticated user
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createProjectSchema.parse(req.body)
    const project = await prisma.project.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: {
        projectManager: {
          select: { id: true, fullName: true, initials: true, avatarColor: true },
        },
      },
    })
    return res.status(201).json({ project })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/projects/:id — manager+ only, blocked if project has drawings
router.delete('/:id', requireAuth, requireMinRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Block delete if project has any active (non-deleted) drawings
    const drawingCount = await prisma.drawing.count({ where: { projectId: id, isDeleted: false } })
    if (drawingCount > 0) {
      return res.status(409).json({
        error: `Cannot delete: this project has ${drawingCount} drawing${drawingCount > 1 ? 's' : ''} linked to it`,
        code: 'HAS_DRAWINGS',
      })
    }

    await prisma.project.delete({ where: { id } })
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
