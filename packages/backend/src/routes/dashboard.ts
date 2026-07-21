import { prisma } from '../lib/prisma'
import { Router, Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/auth'
import { subWeeks, startOfWeek, endOfWeek, format } from 'date-fns'

const router = Router()

// GET /api/dashboard/team
router.get('/team', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designerId, from, to } = req.query as Record<string, string>

    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)

    const baseWhere: Record<string, unknown> = { isDeleted: false }
    if (designerId) baseWhere.designerId = designerId
    if (from || to) baseWhere.createdAt = dateFilter

    const now = new Date()

    // KPI 1: Completed count
    const completedCount = await prisma.drawing.count({
      where: { ...baseWhere as any, status: 'COMPLETED' },
    })

    // KPI 2: Active workload
    const activeWorkload = await prisma.drawing.count({
      where: { ...baseWhere as any, status: { in: ['IN_PROGRESS', 'OVERDUE'] } },
    })

    // KPI 3: On-time %
    const completedDrawings = await prisma.drawing.findMany({
      where: { ...baseWhere as any, status: 'COMPLETED' },
      select: { endDate: true, actualCompletionDate: true },
    })
    const onTimeCount = completedDrawings.filter(
      d => d.actualCompletionDate && d.actualCompletionDate <= d.endDate
    ).length
    const onTimePct = completedDrawings.length > 0
      ? Math.round((onTimeCount / completedDrawings.length) * 100)
      : null

    // KPI 4: Avg duration (completed drawings)
    const completedWithDates = await prisma.drawing.findMany({
      where: { ...baseWhere as any, status: 'COMPLETED' },
      select: { startDate: true, endDate: true, actualCompletionDate: true, lateReason: true },
    })
    const MS = 1000 * 60 * 60 * 24
    const avgDuration = completedWithDates.length > 0
      ? Math.round(
          completedWithDates.reduce((sum, d) =>
            sum + (d.endDate.getTime() - d.startDate.getTime()) / MS, 0
          ) / completedWithDates.length
        )
      : null

    // KPI 5: Avg delay (late completions only)
    const lateDrawings = completedWithDates.filter(
      d => d.actualCompletionDate && d.actualCompletionDate > d.endDate
    )
    const avgDelay = lateDrawings.length > 0
      ? Math.round(
          lateDrawings.reduce((sum, d) =>
            sum + (d.actualCompletionDate!.getTime() - d.endDate.getTime()) / MS, 0
          ) / lateDrawings.length
        )
      : null

    // Weekly trend: last 12 weeks
    const weeklyTrend = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const weekFilter = {
        ...(designerId ? { designerId } : {}),
        isDeleted: false,
        status: 'COMPLETED',
        actualCompletionDate: { gte: weekStart, lte: weekEnd },
      }
      const weekDrawings = await prisma.drawing.findMany({
        where: weekFilter as any,
        select: { endDate: true, actualCompletionDate: true },
      })
      const onTime = weekDrawings.filter(d => d.actualCompletionDate! <= d.endDate).length
      weeklyTrend.push({
        week: format(weekStart, 'MMM dd'),
        completed: weekDrawings.length,
        onTime,
        late: weekDrawings.length - onTime,
      })
    }

    // Category breakdown
    const allDrawings = await prisma.drawing.findMany({
      where: baseWhere as any,
      select: { category: true },
    })
    const categoryMap: Record<string, number> = {}
    for (const d of allDrawings) {
      categoryMap[d.category] = (categoryMap[d.category] || 0) + 1
    }
    const categoryBreakdown = Object.entries(categoryMap).map(([category, count]) => ({ category, count }))

    // Per-drawing breakdown (completed only, with delay)
    const perDrawing = await prisma.drawing.findMany({
      where: { ...baseWhere as any, status: 'COMPLETED' },
      select: {
        id: true, drawingNumber: true, drawingTitle: true, category: true, discipline: true,
        startDate: true, endDate: true, actualCompletionDate: true, lateReason: true,
        designer: { select: { id: true, fullName: true, initials: true, avatarColor: true } },
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { actualCompletionDate: 'desc' },
      take: 100,
    })

    const perDrawingEnriched = perDrawing.map(d => ({
      ...d,
      duration: Math.round((d.endDate.getTime() - d.startDate.getTime()) / MS),
      delay: d.actualCompletionDate
        ? Math.round((d.actualCompletionDate.getTime() - d.endDate.getTime()) / MS)
        : null,
    }))

    return res.json({
      kpis: { completedCount, onTimePct, avgDuration, activeWorkload, avgDelay },
      weeklyTrend,
      categoryBreakdown,
      perDrawing: perDrawingEnriched,
    })
  } catch (err) {
    next(err)
  }
})

export default router
