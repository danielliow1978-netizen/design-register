import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth, requireMinRole } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const ROLE_LEVELS = ['DESIGNER','SENIOR_DESIGNER','DESIGN_MANAGER','PROJECT_MANAGER','DEPARTMENT_HEAD','ADMIN']

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  pdfDefault: z.enum(['a4-portrait', 'a4-landscape', 'letter-landscape']).optional(),
  emailDigestEnabled: z.boolean().optional(),
})

const roleEnum = z.enum(['DESIGNER','SENIOR_DESIGNER','DESIGN_MANAGER','PROJECT_MANAGER','DEPARTMENT_HEAD','ADMIN'])

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  initials: z.string().min(2).max(3).regex(/^[A-Z]+$/, 'Initials must be uppercase letters'),
  role: roleEnum,
  discipline: z.string().optional(),
  avatarColor: z.string().optional(),
  password: z.string().min(8),
})

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  initials: z.string().min(2).max(3).regex(/^[A-Z]+$/, 'Initials must be uppercase letters').optional(),
  role: roleEnum.optional(),
  discipline: z.string().nullable().optional(),
  avatarColor: z.string().optional(),
  active: z.boolean().optional(),
})

// GET /api/users — list all users (manager+)
router.get('/', requireAuth, requireMinRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeInactive = req.query.includeInactive === 'true'

    if (includeInactive) {
      const requesterLevel = ROLE_LEVELS.indexOf(req.user!.role)
      if (requesterLevel < ROLE_LEVELS.indexOf('ADMIN')) {
        return res.status(403).json({ error: 'Only admins can view inactive users', code: 'FORBIDDEN' })
      }
    }

    const users = await prisma.user.findMany({
      where: includeInactive ? undefined : { active: true },
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

// POST /api/users — create user (DESIGN_MANAGER+)
router.post('/', requireAuth, requireMinRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body)

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already in use', code: 'EMAIL_TAKEN' })
    }

    const passwordHash = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        initials: data.initials,
        role: data.role,
        discipline: data.discipline ?? null,
        avatarColor: data.avatarColor ?? 'info',
        passwordHash,
      },
      select: {
        id: true, email: true, fullName: true, initials: true,
        avatarColor: true, role: true, discipline: true, active: true, createdAt: true,
      },
    })

    return res.status(201).json({ user })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/users/:id — update user (DESIGN_MANAGER+)
router.patch('/:id', requireAuth, requireMinRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const data = updateUserSchema.parse(req.body)

    if (data.active !== undefined) {
      const requesterLevel = ROLE_LEVELS.indexOf(req.user!.role)
      if (requesterLevel < ROLE_LEVELS.indexOf('ADMIN')) {
        return res.status(403).json({ error: 'Only admins can change user active status', code: 'FORBIDDEN' })
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, fullName: true, initials: true,
        avatarColor: true, role: true, discipline: true, active: true, createdAt: true,
      },
    })

    return res.json({ user })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/users/:id — hard delete, blocked if user has any drawings
router.delete('/:id', requireAuth, requireMinRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Prevent deleting yourself
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own account', code: 'SELF_DELETE' })
    }

    // Block if user has drawings as designer or requestor
    const [asDesigner, asRequestor] = await Promise.all([
      prisma.drawing.count({ where: { designerId: id } }),
      prisma.drawing.count({ where: { requestorId: id } }),
    ])
    const total = asDesigner + asRequestor
    if (total > 0) {
      return res.status(409).json({
        error: `Cannot delete: this user is linked to ${total} drawing${total > 1 ? 's' : ''}`,
        code: 'HAS_DRAWINGS',
      })
    }

    await prisma.user.delete({ where: { id } })
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/users/:id/preferences
router.patch('/:id/preferences', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    // Users can only update their own preferences; managers can update any
    const userLevel = ROLE_LEVELS.indexOf(req.user!.role)
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
