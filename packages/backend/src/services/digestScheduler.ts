import { prisma } from '../lib/prisma'
import cron from 'node-cron'
import { sendDailyDigest, sendWeeklyDigest } from './emailService'


async function updateDrawingStatuses(): Promise<void> {
  const now = new Date()
  // Mark IN_PROGRESS drawings past their endDate as OVERDUE
  const result = await prisma.drawing.updateMany({
    where: {
      isDeleted: false,
      actualCompletionDate: null,
      status: 'IN_PROGRESS',
      endDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  })
  if (result.count > 0) {
    console.log(`[cron] Updated ${result.count} drawings to OVERDUE`)
  }
}

async function purgeExpiredDrafts(): Promise<void> {
  const result = await prisma.drawingDraft.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  if (result.count > 0) {
    console.log(`[cron] Purged ${result.count} expired drafts`)
  }
}

async function purgeExpiredRecycleBin(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const expiredDrawings = await prisma.drawing.findMany({
    where: { isDeleted: true, deletedAt: { lt: thirtyDaysAgo } },
    select: { id: true, drawingNumber: true },
  })

  for (const drawing of expiredDrawings) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'PERMANENTLY_DELETED',
          drawingId: drawing.id,
          details: JSON.stringify({ reason: 'Auto-purged after 30-day retention', drawingNumber: drawing.drawingNumber }),
        },
      })
    } catch (err) {
      console.warn(`[cron] Could not create audit log for drawing ${drawing.drawingNumber}:`, err)
    }
    await prisma.drawing.delete({ where: { id: drawing.id } })
  }

  if (expiredDrawings.length > 0) {
    console.log(`[cron] Auto-purged ${expiredDrawings.length} drawings from recycle bin`)
  }
}

export function initCronJobs(): void {
  // Midnight SGT (UTC+8) = 16:00 UTC — update statuses, purge drafts, purge recycle bin
  cron.schedule('0 16 * * *', async () => {
    console.log('[cron] Running midnight SGT jobs...')
    await Promise.allSettled([
      updateDrawingStatuses(),
      purgeExpiredDrafts(),
      purgeExpiredRecycleBin(),
    ])
  }, { timezone: 'UTC' })

  // 08:00 SGT (UTC+8) = 00:00 UTC — daily digest
  cron.schedule('0 0 * * *', async () => {
    console.log('[cron] Sending daily digest...')
    await sendDailyDigest()
  }, { timezone: 'UTC' })

  // Monday 09:00 SGT (UTC+8) = Monday 01:00 UTC — weekly digest
  cron.schedule('0 1 * * 1', async () => {
    console.log('[cron] Sending weekly digest...')
    await sendWeeklyDigest()
  }, { timezone: 'UTC' })

  console.log('[cron] All cron jobs scheduled (SGT timezone)')
}
