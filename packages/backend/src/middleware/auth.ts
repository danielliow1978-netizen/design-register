import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AuthUser {
  id: string
  email: string
  fullName: string
  initials: string
  avatarColor: string
  role: string
  discipline: string | null
  active: boolean
  emailDigestEnabled: boolean
  theme: string
  pdfDefault: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided', code: 'UNAUTHORIZED' })
  }
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as { userId: string }
    req.user = { id: payload.userId } as AuthUser
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_EXPIRED' })
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  verifyToken(req, res, async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true, email: true, fullName: true, initials: true, avatarColor: true,
          role: true, discipline: true, active: true, emailDigestEnabled: true,
          theme: true, pdfDefault: true,
        },
      })
      if (!user || !user.active) {
        return res.status(401).json({ error: 'User not found or inactive', code: 'UNAUTHORIZED' })
      }
      req.user = user as AuthUser
      next()
    } catch (err) {
      next(err)
    }
  })
}

const ROLE_HIERARCHY = ['DESIGNER','SENIOR_DESIGNER','PROJECT_ENGINEER','QS_DEPARTMENT','DESIGN_MANAGER','PROJECT_MANAGER','DEPARTMENT_HEAD','COO','CEO','ADMIN']

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' })
    next()
  }
}

export function requireMinRole(minRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' })
    const userLevel = ROLE_HIERARCHY.indexOf(req.user.role)
    const minLevel = ROLE_HIERARCHY.indexOf(minRole)
    if (userLevel < minLevel) return res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' })
    next()
  }
}

export async function canDeleteDrawing(user: AuthUser, drawingId: string): Promise<boolean> {
  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
    include: { project: true },
  })
  if (!drawing) return false
  switch (user.role) {
    case 'DESIGNER': return drawing.designerId === user.id
    case 'SENIOR_DESIGNER': return drawing.designerId === user.id || drawing.discipline === user.discipline
    case 'DESIGN_MANAGER': return drawing.discipline === user.discipline
    case 'PROJECT_MANAGER': return drawing.project.projectManagerId === user.id
    case 'DEPARTMENT_HEAD': return true
    case 'ADMIN': return true
    default: return false
  }
}
