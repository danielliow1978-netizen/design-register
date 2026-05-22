import { Resend } from 'resend'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { format, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const prisma = new PrismaClient()

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

function loadTemplate(name: string): string {
  const templatePath = path.join(__dirname, '../templates', name)
  return fs.readFileSync(templatePath, 'utf-8')
}

function replace(template: string, tokens: Record<string, string>): string {
  let result = template
  for (const [key, val] of Object.entries(tokens)) {
    result = result.replaceAll(`{{${key}}}`, val)
  }
  return result
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatSGT(date: Date): string {
  const sgt = toZonedTime(date, 'Asia/Singapore')
  return format(sgt, 'dd MMM yyyy')
}

export async function sendDailyDigest(): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set, skipping daily digest')
    return
  }

  const template = loadTemplate('daily-digest.html')
  const now = new Date()
  const threeDaysFromNow = addDays(now, 3)

  // Get all designers with digest enabled who have open drawings
  const designers = await prisma.user.findMany({
    where: {
      emailDigestEnabled: true,
      active: true,
      role: { in: ['DESIGNER', 'SENIOR_DESIGNER', 'DESIGN_MANAGER'] },
    },
  })

  for (const designer of designers) {
    const openDrawings = await prisma.drawing.findMany({
      where: {
        designerId: designer.id,
        isDeleted: false,
        status: { in: ['IN_PROGRESS', 'OVERDUE'] },
      },
      include: { project: true },
      orderBy: { endDate: 'asc' },
    })

    if (openDrawings.length === 0) continue

    const overdue = openDrawings.filter(d => d.status === 'OVERDUE')
    const upcoming = openDrawings.filter(d => d.status === 'IN_PROGRESS' && d.endDate <= threeDaysFromNow)
    const completedCount = await prisma.drawing.count({
      where: { designerId: designer.id, status: 'COMPLETED', isDeleted: false },
    })

    const summaryParts: string[] = []
    if (overdue.length > 0) summaryParts.push(`${overdue.length} overdue`)
    if (upcoming.length > 0) summaryParts.push(`${upcoming.length} due within 3 days`)
    if (summaryParts.length === 0) summaryParts.push(`${openDrawings.length} drawings in progress`)
    const summaryLine = `You have ${summaryParts.join(', ')}.`

    const rows = openDrawings.map(d => {
      const isOverdue = d.status === 'OVERDUE'
      const isUpcoming = !isOverdue && d.endDate <= threeDaysFromNow
      const rowBg = isOverdue ? '#FCEBEB' : isUpcoming ? '#FFFBF0' : '#FFFFFF'
      const dateColor = isOverdue ? '#791F1F' : isUpcoming ? '#633806' : '#2C2C2A'
      const dateStr = formatSGT(d.endDate) + (isOverdue ? ' ⚠' : '')
      const statusBg = isOverdue ? '#FCEBEB' : isUpcoming ? '#FAEEDA' : '#E6F1FB'
      const statusColor = isOverdue ? '#791F1F' : isUpcoming ? '#633806' : '#0C447C'
      const statusLabel = isOverdue ? 'Overdue' : isUpcoming ? 'Due soon' : 'In progress'

      return `<tr style="background:${rowBg};">
        <td style="padding:8px 12px;font-size:12px;font-weight:500;color:#2C2C2A;border-top:1px solid rgba(0,0,0,0.06);">${d.drawingNumber}</td>
        <td style="padding:8px 12px;font-size:12px;color:#2C2C2A;border-top:1px solid rgba(0,0,0,0.06);">${d.drawingTitle}</td>
        <td style="padding:8px 12px;font-size:11px;color:#5F5E5A;border-top:1px solid rgba(0,0,0,0.06);">${d.project.code}</td>
        <td style="padding:8px 12px;font-size:12px;font-weight:500;color:${dateColor};border-top:1px solid rgba(0,0,0,0.06);">${dateStr}</td>
        <td style="padding:8px 12px;border-top:1px solid rgba(0,0,0,0.06);"><span style="background:${statusBg};color:${statusColor};font-size:10px;padding:2px 8px;border-radius:4px;font-weight:500;">${statusLabel}</span></td>
      </tr>`
    }).join('')

    const overdueCount = overdue.length
    const upcomingCount = upcoming.length
    const subject = overdueCount > 0
      ? `📐 Your drawings — ${openDrawings.length} open, ${overdueCount} overdue`
      : upcomingCount > 0
      ? `📐 Your drawings — ${upcomingCount} due this week`
      : `📐 Your drawings — ${openDrawings.length} in progress`

    const html = replace(template, {
      date: formatSGT(now),
      userName: designer.fullName.split(' ')[0],
      summaryLine,
      inProgressCount: String(openDrawings.filter(d => d.status === 'IN_PROGRESS').length),
      overdueCount: String(overdueCount),
      upcomingCount: String(upcomingCount),
      completedCount: String(completedCount),
      rows,
      appUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`,
    })

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@designregister.com',
        to: designer.email,
        subject,
        html,
      })
      console.log(`[email] Daily digest sent to ${designer.email}`)
    } catch (err) {
      console.error(`[email] Failed to send daily digest to ${designer.email}:`, err)
    }
  }
}

export async function sendWeeklyDigest(): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set, skipping weekly digest')
    return
  }

  const template = loadTemplate('weekly-digest.html')
  const now = new Date()

  // Team stats
  const allDrawings = await prisma.drawing.findMany({
    where: { isDeleted: false },
    select: { status: true, designerId: true, endDate: true, actualCompletionDate: true },
  })
  const overdue = allDrawings.filter(d => d.status === 'OVERDUE')
  const completed = allDrawings.filter(d => d.status === 'COMPLETED')
  const onTimeCompleted = completed.filter(d => d.actualCompletionDate && d.actualCompletionDate <= d.endDate)
  const onTimePct = completed.length > 0 ? Math.round((onTimeCompleted.length / completed.length) * 100) : 0

  // Completed this week
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - 7)
  const completedThisWeek = completed.filter(
    d => d.actualCompletionDate && d.actualCompletionDate >= weekStart
  ).length

  // Overloaded designers (>= 6 active drawings)
  const activeByDesigner: Record<string, number> = {}
  for (const d of allDrawings.filter(d => ['IN_PROGRESS', 'OVERDUE'].includes(d.status))) {
    activeByDesigner[d.designerId] = (activeByDesigner[d.designerId] || 0) + 1
  }
  const overloadedIds = Object.entries(activeByDesigner)
    .filter(([_, count]) => count >= 6)
    .map(([id]) => id)
  const overloadedDesigners = await prisma.user.findMany({
    where: { id: { in: overloadedIds } },
    select: { fullName: true, id: true },
  })

  // Top 3 at-risk: overdue + soonest end date
  const atRiskDrawings = await prisma.drawing.findMany({
    where: { isDeleted: false, status: { in: ['IN_PROGRESS', 'OVERDUE'] } },
    include: {
      designer: { select: { fullName: true, initials: true } },
      project: { select: { code: true } },
    },
    orderBy: { endDate: 'asc' },
    take: 3,
  })

  const atRiskRows = atRiskDrawings.map(d =>
    `<div style="padding:10px 12px;background:${d.status === 'OVERDUE' ? '#FCEBEB' : '#FAEEDA'};border-radius:6px;margin-bottom:6px;">
      <div style="font-size:12px;font-weight:500;color:#2C2C2A;">${d.drawingNumber} — ${d.drawingTitle}</div>
      <div style="font-size:11px;color:#5F5E5A;margin-top:2px;">${d.project.code} · ${d.designer.fullName} · Due: ${formatSGT(d.endDate)}</div>
    </div>`
  ).join('') || '<div style="font-size:12px;color:#5F5E5A;">No at-risk drawings 🎉</div>'

  const overloadedRows = overloadedDesigners.map(d =>
    `<div style="padding:8px 12px;background:#FAEEDA;border-radius:6px;margin-bottom:6px;font-size:12px;color:#633806;">
      ${d.fullName} — ${activeByDesigner[d.id]} active drawings
    </div>`
  ).join('') || '<div style="font-size:12px;color:#5F5E5A;">No overloaded designers ✅</div>'

  // Send to managers
  const managers = await prisma.user.findMany({
    where: {
      emailDigestEnabled: true,
      active: true,
      role: { in: ['DESIGN_MANAGER', 'PROJECT_MANAGER', 'DEPARTMENT_HEAD'] },
    },
  })

  for (const manager of managers) {
    const html = replace(template, {
      weekOf: formatSGT(weekStart),
      userName: manager.fullName.split(' ')[0],
      onTimePct: String(onTimePct),
      overdueCount: String(overdue.length),
      completedThisWeek: String(completedThisWeek),
      overloadedCount: String(overloadedDesigners.length),
      atRiskRows,
      overloadedRows,
      appUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    })

    const subject = `📊 Design team weekly — ${overdue.length} overdue, ${onTimePct}% on-time`

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@designregister.com',
        to: manager.email,
        subject,
        html,
      })
      console.log(`[email] Weekly digest sent to ${manager.email}`)
    } catch (err) {
      console.error(`[email] Failed to send weekly digest to ${manager.email}:`, err)
    }
  }
}

interface ApprovalEmailParams {
  drawingNumber: string
  drawingTitle: string
  projectName: string
  status: 'APPROVED' | 'REJECTED'
  comment: string | null
  designerEmail: string
  designerName: string
  approverEmail: string
  approverName: string
  approvalDate: Date
  ccRecipients?: { email: string; name: string }[]
}

export async function sendApprovalEmail(params: ApprovalEmailParams): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.log('[email] RESEND_API_KEY not set, skipping approval notification')
    return
  }

  const {
    drawingNumber, drawingTitle, projectName, status, comment,
    designerEmail, designerName, approverEmail, approverName, approvalDate,
    ccRecipients = [],
  } = params

  const isApproved = status === 'APPROVED'
  const statusLabel = isApproved ? 'Approved' : 'Rejected'
  const statusIcon = isApproved ? '✅' : '❌'
  const statusColor = isApproved ? '#27500A' : '#791F1F'
  const statusBg = isApproved ? '#EAF3DE' : '#FCEBEB'
  const formattedDate = formatSGT(approvalDate)
  const commentText = comment?.trim() || 'No comment provided'

  const template = loadTemplate('approval-notification.html')

  const recipients = [
    { email: designerEmail, name: designerName },
    { email: approverEmail, name: approverName },
    ...ccRecipients,
  ]

  // Deduplicate — designer, approver, and DH may overlap
  const unique = recipients.filter((r, i, arr) => arr.findIndex(x => x.email === r.email) === i)

  for (const recipient of unique) {
    const html = replace(template, {
      RECIPIENT_NAME: escapeHtml(recipient.name.split(' ')[0] || recipient.name || 'there'),
      DRAWING_NUMBER: escapeHtml(drawingNumber),
      DRAWING_TITLE: escapeHtml(drawingTitle),
      PROJECT_NAME: escapeHtml(projectName),
      STATUS: statusLabel,               // derived from enum — safe
      STATUS_ICON: statusIcon,           // hardcoded emoji — safe
      STATUS_COLOR: statusColor,         // hardcoded hex — safe
      STATUS_BG: statusBg,               // hardcoded hex — safe
      COMMENT: escapeHtml(commentText),
      APPROVER_NAME: escapeHtml(approverName),
      APPROVAL_DATE: formattedDate,      // formatted date string — safe
    })

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@designregister.com',
        to: recipient.email,
        subject: `Drawing ${drawingNumber} has been ${statusLabel}`,
        html,
      })
      console.log(`[email] Approval notification sent to ${recipient.email}`)
    } catch (err) {
      console.error(`[email] Failed to send approval notification to ${recipient.email}:`, err)
    }
  }
}
