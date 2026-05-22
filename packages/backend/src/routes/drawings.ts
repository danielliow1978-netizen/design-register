import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, requireRole, canDeleteDrawing } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'

// ── Supabase Storage client ───────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || `https://zkhdbpsesuzdreinnjxn.supabase.co`
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const STORAGE_BUCKET = 'drawing-pdfs'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Multer: store file in memory (max 50 MB, PDF only) ────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are allowed'))
  },
})

const router = Router()
const prisma = new PrismaClient()

// ── Shared drawing select (for consistent responses) ─────────────────────────
const drawingSelect = {
  id: true,
  drawingNumber: true,
  drawingTitle: true,
  projectId: true,
  project: { select: { id: true, code: true, name: true, iconEmoji: true, iconColor: true } },
  discipline: true,
  category: true,
  designerId: true,
  designer: { select: { id: true, fullName: true, initials: true, avatarColor: true, role: true, discipline: true } },
  requestorId: true,
  requestor: { select: { id: true, fullName: true, initials: true, avatarColor: true, role: true } },
  requestDate: true,
  startDate: true,
  endDate: true,
  actualCompletionDate: true,
  lateReason: true,
  lateReasonDetail: true,
  notes: true,
  status: true,
  pdfUrl: true,
  approvalStatus: true,
  approvalComment: true,
  approvalDate: true,
  approvedById: true,
  isDeleted: true,
  deletedAt: true,
  deletedById: true,
  deletedReason: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
}

function computeDurationAndDelay(drawing: {
  startDate: Date
  endDate: Date
  actualCompletionDate: Date | null
}) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const duration = Math.round((drawing.endDate.getTime() - drawing.startDate.getTime()) / MS_PER_DAY)
  const delay = drawing.actualCompletionDate
    ? Math.round((drawing.actualCompletionDate.getTime() - drawing.endDate.getTime()) / MS_PER_DAY)
    : null
  return { duration, delay }
}

// ── Zod schemas ──────────────────────────────────────────────────────────────
const createDrawingSchema = z.object({
  drawingNumber: z.string().min(1).max(100),
  drawingTitle: z.string().min(1).max(500),
  projectId: z.string().min(1),
  discipline: z.string().min(1).max(100),
  category: z.enum(['TENDER', 'SHOP', 'CONSTRUCTION', 'AS_BUILT']),
  designerId: z.string().min(1),
  requestorId: z.string().min(1),
  requestDate: z.string().datetime(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().optional(),
})

const patchDrawingSchema = z.object({
  drawingNumber: z.string().min(1).max(100).optional(),
  projectId: z.string().optional(),
  drawingTitle: z.string().min(1).max(500).optional(),
  discipline: z.string().min(1).max(100).optional(),
  category: z.enum(['TENDER', 'SHOP', 'CONSTRUCTION', 'AS_BUILT']).optional(),
  designerId: z.string().optional(),
  requestorId: z.string().optional(),
  lateReasonDetail: z.string().max(1000).optional(),
  notes: z.string().optional(),
  // Locked fields — if any of these arrive we reject the whole request
  requestDate: z.never({ message: 'requestDate is locked after creation' }).optional(),
  startDate: z.never({ message: 'startDate is locked after creation' }).optional(),
  endDate: z.never({ message: 'endDate is locked after creation' }).optional(),
})

const completeSchema = z.object({
  lateReason: z.enum([
    'CLIENT_SCOPE_CHANGE', 'CLIENT_DELAY', 'SITE_CHANGE', 'VENDOR_DELAY',
    'SICK_LEAVE', 'AWAITING_OTHER_DISCIPLINE', 'SOFTWARE_ISSUE', 'OTHER',
  ]).optional(),
  lateReasonDetail: z.string().optional(),
})

const deleteSchema = z.object({
  password: z.string().min(1),
  reason: z.string().min(1).max(500),
})

const approveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(1000).optional(),
})

// ── GET /api/drawings ────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designerId, projectId, status, search, sort } = req.query as Record<string, string>

    const where: Record<string, unknown> = { isDeleted: false }
    if (designerId) where.designerId = designerId
    if (projectId) where.projectId = projectId
    if (status) where.status = status
    if (search) {
      where.OR = [
        { drawingNumber: { contains: search } },
        { drawingTitle: { contains: search } },
      ]
    }

    // Parse sort: "status:asc,endDate:desc"
    const SORTABLE_FIELDS: Record<string, string> = {
      drawingNumber: 'drawingNumber',
      drawingTitle: 'drawingTitle',
      status: 'status',
      endDate: 'endDate',
      startDate: 'startDate',
      requestDate: 'requestDate',
      actualCompletionDate: 'actualCompletionDate',
      category: 'category',
      discipline: 'discipline',
      createdAt: 'createdAt',
    }

    let orderBy: Record<string, string>[] = [{ endDate: 'asc' }]
    if (sort) {
      const parsed = sort.split(',').map(s => {
        const [field, dir] = s.split(':')
        if (SORTABLE_FIELDS[field] && (dir === 'asc' || dir === 'desc')) {
          return { [SORTABLE_FIELDS[field]]: dir }
        }
        return null
      }).filter(Boolean) as Record<string, string>[]
      if (parsed.length > 0) orderBy = parsed
    }

    const drawings = await prisma.drawing.findMany({
      where: where as any,
      select: drawingSelect,
      orderBy: orderBy as any,
    })

    const enriched = drawings.map(d => ({
      ...d,
      ...computeDurationAndDelay(d),
    }))

    return res.json({ drawings: enriched })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/drawings ───────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createDrawingSchema.parse(req.body)

    // Check uniqueness among active (non-deleted) drawings only
    const duplicate = await prisma.drawing.findFirst({
      where: { drawingNumber: data.drawingNumber, isDeleted: false },
    })
    if (duplicate) {
      return res.status(409).json({ error: 'Drawing number already exists in the active register', code: 'DUPLICATE_DRAWING_NUMBER' })
    }

    const reqDate = new Date(data.requestDate)
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    if (endDate < startDate) {
      return res.status(400).json({ error: 'endDate cannot be before startDate', code: 'INVALID_DATES' })
    }

    // Derive initial status
    const now = new Date()
    const status = now > endDate ? 'OVERDUE' : 'IN_PROGRESS'

    const drawing = await prisma.drawing.create({
      data: {
        drawingNumber: data.drawingNumber,
        drawingTitle: data.drawingTitle,
        projectId: data.projectId,
        discipline: data.discipline,
        category: data.category,
        designerId: data.designerId,
        requestorId: data.requestorId,
        requestDate: reqDate,
        startDate,
        endDate,
        notes: data.notes,
        status,
        createdById: req.user!.id,
      },
      select: drawingSelect,
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATED',
        drawingId: drawing.id,
        details: JSON.stringify({ drawingNumber: drawing.drawingNumber, drawingTitle: drawing.drawingTitle }),
        ipAddress: req.ip || null,
      },
    })

    return res.status(201).json({ drawing: { ...drawing, ...computeDurationAndDelay(drawing) } })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/drawings/:id ────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drawing = await prisma.drawing.findUnique({
      where: { id: req.params.id },
      select: drawingSelect,
    })
    if (!drawing || drawing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }
    return res.json({ drawing: { ...drawing, ...computeDurationAndDelay(drawing) } })
  } catch (err) {
    next(err)
  }
})

// ── PATCH /api/drawings/:id ──────────────────────────────────────────────────
router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Explicitly block locked date fields
    const LOCKED_FIELDS = ['requestDate', 'startDate', 'endDate']
    for (const field of LOCKED_FIELDS) {
      if (field in req.body) {
        return res.status(403).json({
          error: `${field} cannot be changed after creation`,
          code: 'DATES_LOCKED',
        })
      }
    }

    const data = patchDrawingSchema.parse(req.body)
    const existing = await prisma.drawing.findUnique({ where: { id: req.params.id } })
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }

    // If drawing number is being changed, check for duplicates among active drawings
    if (data.drawingNumber && data.drawingNumber !== existing.drawingNumber) {
      const duplicate = await prisma.drawing.findFirst({
        where: { drawingNumber: data.drawingNumber, isDeleted: false, id: { not: req.params.id } },
      })
      if (duplicate) {
        return res.status(409).json({ error: 'Drawing number already exists in the active register', code: 'DUPLICATE_DRAWING_NUMBER' })
      }
    }

    // Build audit details
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined && (existing as any)[key] !== val) {
        changes[key] = { from: (existing as any)[key], to: val }
      }
    }

    const drawing = await prisma.drawing.update({
      where: { id: req.params.id },
      data: data as any,
      select: drawingSelect,
    })

    if (Object.keys(changes).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'EDITED',
          drawingId: drawing.id,
          details: JSON.stringify(changes),
          ipAddress: req.ip || null,
        },
      })
    }

    return res.json({ drawing: { ...drawing, ...computeDurationAndDelay(drawing) } })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/drawings/:id/complete ─────────────────────────────────────────
router.post('/:id/complete', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = completeSchema.parse(req.body)
    const drawing = await prisma.drawing.findUnique({ where: { id: req.params.id } })

    if (!drawing || drawing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }
    if (drawing.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Drawing is already completed', code: 'ALREADY_COMPLETED' })
    }

    const now = new Date()
    const isLate = now > drawing.endDate

    if (isLate && !data.lateReason) {
      return res.status(400).json({
        error: 'A late reason is required because the end date has passed',
        code: 'LATE_REASON_REQUIRED',
        daysLate: Math.round((now.getTime() - drawing.endDate.getTime()) / (1000 * 60 * 60 * 24)),
      })
    }

    const updated = await prisma.drawing.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        actualCompletionDate: now,
        lateReason: data.lateReason || null,
        lateReasonDetail: data.lateReasonDetail || null,
      },
      select: drawingSelect,
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: isLate ? 'COMPLETED_LATE' : 'COMPLETED',
        drawingId: updated.id,
        details: JSON.stringify({
          actualCompletionDate: now,
          lateReason: data.lateReason || null,
          daysLate: isLate ? Math.round((now.getTime() - drawing.endDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        }),
        ipAddress: req.ip || null,
      },
    })

    return res.json({ drawing: { ...updated, ...computeDurationAndDelay(updated) } })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/drawings/:id (soft delete) ───────────────────────────────────
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, reason } = deleteSchema.parse(req.body)

    // Re-auth: verify password
    const fullUser = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!fullUser) {
      return res.status(401).json({ error: 'User not found', code: 'UNAUTHORIZED' })
    }
    const validPassword = await bcrypt.compare(password, fullUser.passwordHash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect password', code: 'INVALID_PASSWORD' })
    }

    // RBAC check
    const allowed = await canDeleteDrawing(req.user!, req.params.id)
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have permission to delete this drawing', code: 'FORBIDDEN' })
    }

    const drawing = await prisma.drawing.findUnique({ where: { id: req.params.id } })
    if (!drawing || drawing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }

    await prisma.drawing.update({
      where: { id: req.params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: req.user!.id,
        deletedReason: reason,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'DELETED',
        drawingId: req.params.id,
        details: JSON.stringify({ reason, drawingNumber: drawing.drawingNumber }),
        ipAddress: req.ip || null,
      },
    })

    return res.json({ message: 'Drawing moved to recycle bin' })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/drawings/:id/upload ────────────────────────────────────────────
router.post('/:id/upload', requireAuth, upload.single('pdf'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return res.status(503).json({ error: 'PDF upload not configured (missing SUPABASE_SERVICE_KEY)', code: 'NOT_CONFIGURED' })
    }

    const drawing = await prisma.drawing.findUnique({ where: { id: req.params.id } })
    if (!drawing || drawing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided', code: 'NO_FILE' })
    }

    // If there's an existing PDF, remove it first
    if (drawing.pdfUrl) {
      const oldPath = drawing.pdfUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`)[1]
      if (oldPath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([decodeURIComponent(oldPath)])
      }
    }

    // Upload to Supabase Storage: drawings/<drawingId>/<timestamp>-<filename>
    const timestamp = Date.now()
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `drawings/${req.params.id}/${timestamp}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      return res.status(500).json({ error: 'Failed to upload PDF', code: 'UPLOAD_FAILED', detail: uploadError.message })
    }

    // Build public URL
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
    const pdfUrl = urlData.publicUrl

    const updated = await prisma.drawing.update({
      where: { id: req.params.id },
      data: { pdfUrl },
      select: drawingSelect,
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'EDITED',
        drawingId: updated.id,
        details: JSON.stringify({ pdfUploaded: true, fileName: req.file.originalname }),
        ipAddress: req.ip || null,
      },
    })

    return res.json({ drawing: { ...updated, ...computeDurationAndDelay(updated) } })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/drawings/:id/pdf ──────────────────────────────────────────────
router.delete('/:id/pdf', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return res.status(503).json({ error: 'PDF upload not configured (missing SUPABASE_SERVICE_KEY)', code: 'NOT_CONFIGURED' })
    }

    const drawing = await prisma.drawing.findUnique({ where: { id: req.params.id } })
    if (!drawing || drawing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }

    if (!drawing.pdfUrl) {
      return res.status(404).json({ error: 'No PDF attached to this drawing', code: 'NO_PDF' })
    }

    // Remove from Supabase Storage
    const oldPath = drawing.pdfUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`)[1]
    if (oldPath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([decodeURIComponent(oldPath)])
    }

    const updated = await prisma.drawing.update({
      where: { id: req.params.id },
      data: { pdfUrl: null },
      select: drawingSelect,
    })

    return res.json({ drawing: { ...updated, ...computeDurationAndDelay(updated) } })
  } catch (err) {
    next(err)
  }
})

// TODO: replaced by emailService import in Task 3
const sendApprovalEmail = async (_params: unknown): Promise<void> => { /* replaced in Task 3 */ }

// ── POST /api/drawings/:id/approve ───────────────────────────────────────────
router.post('/:id/approve', requireAuth, requireRole('DESIGN_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { status, comment } = approveSchema.parse(req.body)

    const drawing = await prisma.drawing.findUnique({
      where: { id },
      select: {
        id: true, status: true, isDeleted: true,
        drawingNumber: true, drawingTitle: true,
        project: { select: { name: true } },
        designer: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!drawing || drawing.isDeleted) {
      return res.status(404).json({ error: 'Drawing not found', code: 'NOT_FOUND' })
    }
    if (drawing.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Only completed drawings can be approved or rejected', code: 'NOT_COMPLETED' })
    }

    const now = new Date()

    // Re-approval is intentional: a Design Manager can change a previous decision.
    // Fields are simply overwritten; each call creates a new audit log entry.
    const updated = await prisma.drawing.update({
      where: { id },
      data: {
        approvalStatus: status,
        approvalComment: comment ?? null,
        approvalDate: now,
        approvedById: req.user!.id,
      },
      select: drawingSelect,
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: status,
        drawingId: id,
        details: JSON.stringify({
          drawingNumber: drawing.drawingNumber,
          drawingTitle: drawing.drawingTitle,
          status,
          comment: comment ?? null,
          approvedBy: req.user!.fullName,
        }),
        ipAddress: req.ip || null,
      },
    })

    // Fire-and-forget — do not await
    sendApprovalEmail({
      drawingNumber: drawing.drawingNumber,
      drawingTitle: drawing.drawingTitle,
      projectName: drawing.project.name,
      status,
      comment: comment ?? null,
      designerEmail: drawing.designer.email,
      designerName: drawing.designer.fullName,
      approverEmail: req.user!.email,
      approverName: req.user!.fullName,
      approvalDate: now,
    }).catch(err => console.error('[email] approval notification failed:', err))

    const { duration, delay } = computeDurationAndDelay(updated as Parameters<typeof computeDurationAndDelay>[0])
    return res.json({ drawing: { ...updated, duration, delay } })
  } catch (err) {
    next(err)
  }
})

export default router
