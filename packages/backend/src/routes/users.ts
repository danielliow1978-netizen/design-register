import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAuth, requireMinRole } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

const ROLE_LEVELS = ['DRAFTER','SENIOR_DRAFTER','DESIGNER','SENIOR_DESIGNER','PROJECT_ENGINEER','QS_DEPARTMENT','ASSISTANT_DESIGN_MANAGER','DESIGN_MANAGER','PROJECT_MANAGER','DEPARTMENT_HEAD','COO','CEO','ADMIN']

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  pdfDefault: z.enum(['a4-portrait', 'a4-landscape', 'letter-landscape']).optional(),
  emailDigestEnabled: z.boolean().optional(),
})

const roleEnum = z.enum(['DRAFTER','SENIOR_DRAFTER','DESIGNER','SENIOR_DESIGNER','PROJECT_ENGINEER','QS_DEPARTMENT','ASSISTANT_DESIGN_MANAGER','DESIGN_MANAGER','PROJECT_MANAGER','DEPARTMENT_HEAD','COO','CEO','ADMIN'])

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),          // optional for requestor-only accounts
  initials: z.string().min(2).max(3).regex(/^[A-Z]+$/, 'Initials must be uppercase letters'),
  role: roleEnum,
  discipline: z.string().optional(),
  avatarColor: z.string().optional(),
  password: z.string().min(8).optional(),        // optional for requestor-only accounts
})

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  initials: z.string().min(2).max(3).regex(/^[A-Z]+$/, 'Initials must be uppercase letters').optional(),
  role: roleEnum.optional(),
  discipline: z.string().nullable().optional(),
  avatarColor: z.string().optional(),
  active: z.boolean().optional(),
})

// GET /api/users — list all users (any authenticated user; includeInactive restricted to ADMIN)
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
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

// POST /api/users — create user (any authenticated user)
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body)

    // Auto-generate email for requestor-only accounts (no login needed)
    const email = data.email ?? `${data.initials.toLowerCase()}_${Date.now()}@requestor.local`

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already in use', code: 'EMAIL_TAKEN' })
    }

    // Auto-generate a random password for requestor-only accounts
    const rawPassword = data.password ?? Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!1'
    const passwordHash = await bcrypt.hash(rawPassword, 10)

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email,
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

// DELETE /api/users/:id — hard delete, blocked if user has any drawings (any authenticated user)
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    // Prevent deleting yourself
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own account', code: 'SELF_DELETE' })
    }

    // Fetch the target user to check account type
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' })
    }

    // Requestor-only accounts (auto-generated @requestor.local email) can be deleted by anyone.
    // Real team accounts can only be deleted by ADMIN.
    const isRequestorAccount = targetUser.email.endsWith('@requestor.local')
    if (!isRequestorAccount) {
      const requesterLevel = ROLE_LEVELS.indexOf(req.user!.role)
      if (requesterLevel < ROLE_LEVELS.indexOf('ADMIN')) {
        return res.status(403).json({ error: 'Only admins can delete team member accounts', code: 'FORBIDDEN' })
      }
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

    // Clean up dependent records before deleting (FK constraints)
    await prisma.$transaction([
      // Remove drafts owned by this user
      prisma.drawingDraft.deleteMany({ where: { userId: id } }),
      // Delete audit log entries for this user
      prisma.auditLog.deleteMany({ where: { userId: id } }),
      // Nullify project manager references
      prisma.project.updateMany({ where: { projectManagerId: id }, data: { projectManagerId: null } }),
      // Hard delete the user
      prisma.user.delete({ where: { id } }),
    ])
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
