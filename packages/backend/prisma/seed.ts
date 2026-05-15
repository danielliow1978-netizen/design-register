import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addDays, subDays } from 'date-fns'

const prisma = new PrismaClient()

// String constants replacing enums (SQLite does not support native enums)
const Role = {
  DESIGNER: 'DESIGNER',
  SENIOR_DESIGNER: 'SENIOR_DESIGNER',
  DESIGN_MANAGER: 'DESIGN_MANAGER',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  ADMIN: 'ADMIN',
} as const

const Discipline = {
  MECHANICAL: 'MECHANICAL',
  ELECTRICAL: 'ELECTRICAL',
  ELV: 'ELV',
  FIRE_PROTECTION: 'FIRE_PROTECTION',
  PLUMBING: 'PLUMBING',
} as const

const ContractType = {
  EPC: 'EPC',
  EPCM: 'EPCM',
} as const

const ProjectStatus = {
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const

const DrawingCategory = {
  TENDER: 'TENDER',
  SHOP: 'SHOP',
  CONSTRUCTION: 'CONSTRUCTION',
  AS_BUILT: 'AS_BUILT',
} as const

const DrawingStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
} as const

const AuditAction = {
  CREATED: 'CREATED',
  EDITED: 'EDITED',
  COMPLETED: 'COMPLETED',
  COMPLETED_LATE: 'COMPLETED_LATE',
  DELETED: 'DELETED',
  RESTORED: 'RESTORED',
  PERMANENTLY_DELETED: 'PERMANENTLY_DELETED',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
} as const

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up existing data
  await prisma.auditLog.deleteMany()
  await prisma.drawingDraft.deleteMany()
  await prisma.drawing.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash('Password123!', 12)
  const today = new Date()

  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'admin@designregister.com',
      passwordHash,
      fullName: 'Andrew Lim',
      initials: 'AL',
      avatarColor: 'info',
      role: Role.ADMIN,
      discipline: Discipline.MECHANICAL,
      theme: 'auto',
    },
  })

  const deptHead = await prisma.user.create({
    data: {
      email: 'dept@designregister.com',
      passwordHash,
      fullName: 'Patricia Lee',
      initials: 'PL',
      avatarColor: 'info',
      role: Role.DEPARTMENT_HEAD,
      discipline: Discipline.MECHANICAL,
      theme: 'auto',
    },
  })

  const manager = await prisma.user.create({
    data: {
      email: 'manager@designregister.com',
      passwordHash,
      fullName: 'Kevin Ng',
      initials: 'KN',
      avatarColor: 'purple',
      role: Role.DESIGN_MANAGER,
      discipline: Discipline.MECHANICAL,
      theme: 'auto',
    },
  })

  const pm = await prisma.user.create({
    data: {
      email: 'pm@designregister.com',
      passwordHash,
      fullName: 'James Wong',
      initials: 'JW',
      avatarColor: 'teal',
      role: Role.PROJECT_MANAGER,
      theme: 'auto',
    },
  })

  const daniel = await prisma.user.create({
    data: {
      email: 'daniel@designregister.com',
      passwordHash,
      fullName: 'Daniel Liow',
      initials: 'DL',
      avatarColor: 'success',
      role: Role.SENIOR_DESIGNER,
      discipline: Discipline.MECHANICAL,
      theme: 'auto',
    },
  })

  const sarah = await prisma.user.create({
    data: {
      email: 'sarah@designregister.com',
      passwordHash,
      fullName: 'Sarah Chen',
      initials: 'SC',
      avatarColor: 'warning',
      role: Role.DESIGNER,
      discipline: Discipline.ELECTRICAL,
      theme: 'auto',
    },
  })

  const raj = await prisma.user.create({
    data: {
      email: 'raj@designregister.com',
      passwordHash,
      fullName: 'Raj Kumar',
      initials: 'RK',
      avatarColor: 'danger',
      role: Role.DESIGNER,
      discipline: Discipline.MECHANICAL,
      theme: 'auto',
    },
  })

  const marcus = await prisma.user.create({
    data: {
      email: 'marcus@designregister.com',
      passwordHash,
      fullName: 'Marcus Tan',
      initials: 'MT',
      avatarColor: 'purple',
      role: Role.SENIOR_DESIGNER,
      discipline: Discipline.ELV,
      theme: 'auto',
    },
  })

  console.log('✅ Users created')

  // ── Projects ───────────────────────────────────────────────────────────────
  const proj101 = await prisma.project.create({
    data: {
      code: 'PRJ-101',
      name: 'LPDRAM Cleanroom',
      client: 'LPDRAM Semiconductor',
      contractType: ContractType.EPCM,
      status: ProjectStatus.ACTIVE,
      projectManagerId: pm.id,
      iconEmoji: '🏭',
      iconColor: 'info',
      startDate: subDays(today, 120),
      endDate: addDays(today, 180),
    },
  })

  const proj102 = await prisma.project.create({
    data: {
      code: 'PRJ-102',
      name: 'DataHub Fit-out',
      client: 'DataHub Pte Ltd',
      contractType: ContractType.EPC,
      status: ProjectStatus.ACTIVE,
      projectManagerId: pm.id,
      iconEmoji: '💾',
      iconColor: 'success',
      startDate: subDays(today, 60),
      endDate: addDays(today, 120),
    },
  })

  const proj103 = await prisma.project.create({
    data: {
      code: 'PRJ-103',
      name: 'Office Tower Tender',
      client: 'Meridian Properties',
      contractType: ContractType.EPC,
      status: ProjectStatus.ACTIVE,
      projectManagerId: pm.id,
      iconEmoji: '📑',
      iconColor: 'warning',
      startDate: subDays(today, 30),
      endDate: addDays(today, 60),
    },
  })

  console.log('✅ Projects created')

  // ── Drawings ───────────────────────────────────────────────────────────────
  const drawings = [
    // PRJ-101 — Daniel (overdue)
    {
      drawingNumber: 'PRJ-101-M-CD-022',
      drawingTitle: 'AHU Plant Room L4',
      projectId: proj101.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.CONSTRUCTION,
      designerId: daniel.id,
      requestorId: manager.id,
      requestDate: subDays(today, 24),
      startDate: subDays(today, 21),
      endDate: subDays(today, 4),
      status: DrawingStatus.OVERDUE,
      createdById: manager.id,
    },
    // PRJ-101 — Daniel (in progress)
    {
      drawingNumber: 'PRJ-101-M-SD-001',
      drawingTitle: 'L3 Chilled Water Piping',
      projectId: proj101.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.SHOP,
      designerId: daniel.id,
      requestorId: pm.id,
      requestDate: subDays(today, 18),
      startDate: subDays(today, 14),
      endDate: addDays(today, 1),
      status: DrawingStatus.IN_PROGRESS,
      createdById: manager.id,
    },
    // PRJ-101 — Daniel (in progress, future)
    {
      drawingNumber: 'PRJ-101-M-CD-018',
      drawingTitle: 'Chilled Water Riser Diagram',
      projectId: proj101.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.CONSTRUCTION,
      designerId: daniel.id,
      requestorId: pm.id,
      requestDate: subDays(today, 11),
      startDate: subDays(today, 8),
      endDate: addDays(today, 4),
      status: DrawingStatus.IN_PROGRESS,
      createdById: manager.id,
    },
    // PRJ-101 — Daniel (completed late)
    {
      drawingNumber: 'PRJ-101-M-AB-001',
      drawingTitle: 'As-built — L1 Chilled Water',
      projectId: proj101.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.AS_BUILT,
      designerId: daniel.id,
      requestorId: pm.id,
      requestDate: subDays(today, 26),
      startDate: subDays(today, 21),
      endDate: subDays(today, 6),
      actualCompletionDate: subDays(today, 4),
      lateReason: 'CLIENT_DELAY',
      lateReasonDetail: 'Client delayed approval of L1 layout drawings',
      status: DrawingStatus.COMPLETED,
      createdById: manager.id,
    },
    // PRJ-101 — Daniel (completed on time)
    {
      drawingNumber: 'PRJ-101-M-SD-005',
      drawingTitle: 'Process Exhaust Ductwork',
      projectId: proj101.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.SHOP,
      designerId: daniel.id,
      requestorId: pm.id,
      requestDate: subDays(today, 36),
      startDate: subDays(today, 31),
      endDate: subDays(today, 16),
      actualCompletionDate: subDays(today, 18),
      status: DrawingStatus.COMPLETED,
      createdById: manager.id,
    },
    // PRJ-101 — Sarah (electrical)
    {
      drawingNumber: 'PRJ-101-E-SD-003',
      drawingTitle: 'MDB-L4 Single Line Diagram',
      projectId: proj101.id,
      discipline: Discipline.ELECTRICAL,
      category: DrawingCategory.SHOP,
      designerId: sarah.id,
      requestorId: manager.id,
      requestDate: subDays(today, 12),
      startDate: subDays(today, 10),
      endDate: addDays(today, 5),
      status: DrawingStatus.IN_PROGRESS,
      createdById: manager.id,
    },
    // PRJ-101 — Sarah (overdue)
    {
      drawingNumber: 'PRJ-101-E-CD-007',
      drawingTitle: 'Emergency Lighting Layout L2',
      projectId: proj101.id,
      discipline: Discipline.ELECTRICAL,
      category: DrawingCategory.CONSTRUCTION,
      designerId: sarah.id,
      requestorId: manager.id,
      requestDate: subDays(today, 20),
      startDate: subDays(today, 18),
      endDate: subDays(today, 3),
      status: DrawingStatus.OVERDUE,
      createdById: manager.id,
    },
    // PRJ-102 — Raj
    {
      drawingNumber: 'PRJ-102-M-CD-001',
      drawingTitle: 'FCU Layout Plan Level 1',
      projectId: proj102.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.CONSTRUCTION,
      designerId: raj.id,
      requestorId: pm.id,
      requestDate: subDays(today, 8),
      startDate: subDays(today, 6),
      endDate: addDays(today, 8),
      status: DrawingStatus.IN_PROGRESS,
      createdById: manager.id,
    },
    // PRJ-102 — Marcus (ELV)
    {
      drawingNumber: 'PRJ-102-V-SD-002',
      drawingTitle: 'CCTV System Riser Diagram',
      projectId: proj102.id,
      discipline: Discipline.ELV,
      category: DrawingCategory.SHOP,
      designerId: marcus.id,
      requestorId: pm.id,
      requestDate: subDays(today, 14),
      startDate: subDays(today, 12),
      endDate: addDays(today, 2),
      status: DrawingStatus.IN_PROGRESS,
      createdById: manager.id,
    },
    // PRJ-103 — tender drawings
    {
      drawingNumber: 'PRJ-103-M-TD-001',
      drawingTitle: 'ACMV Tender Layout — Typical Floor',
      projectId: proj103.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.TENDER,
      designerId: daniel.id,
      requestorId: manager.id,
      requestDate: subDays(today, 5),
      startDate: subDays(today, 4),
      endDate: addDays(today, 10),
      status: DrawingStatus.IN_PROGRESS,
      createdById: manager.id,
    },
    {
      drawingNumber: 'PRJ-103-E-TD-001',
      drawingTitle: 'Electrical Tender — Power Layout',
      projectId: proj103.id,
      discipline: Discipline.ELECTRICAL,
      category: DrawingCategory.TENDER,
      designerId: sarah.id,
      requestorId: manager.id,
      requestDate: subDays(today, 5),
      startDate: subDays(today, 4),
      endDate: addDays(today, 10),
      status: DrawingStatus.IN_PROGRESS,
      createdById: manager.id,
    },
    // Completed on time examples
    {
      drawingNumber: 'PRJ-101-M-CD-010',
      drawingTitle: 'Cooling Tower Piping Layout',
      projectId: proj101.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.CONSTRUCTION,
      designerId: daniel.id,
      requestorId: manager.id,
      requestDate: subDays(today, 50),
      startDate: subDays(today, 48),
      endDate: subDays(today, 35),
      actualCompletionDate: subDays(today, 37),
      status: DrawingStatus.COMPLETED,
      createdById: manager.id,
    },
    {
      drawingNumber: 'PRJ-101-M-CD-011',
      drawingTitle: 'AHU-L1 Ductwork Layout',
      projectId: proj101.id,
      discipline: Discipline.MECHANICAL,
      category: DrawingCategory.CONSTRUCTION,
      designerId: raj.id,
      requestorId: manager.id,
      requestDate: subDays(today, 45),
      startDate: subDays(today, 43),
      endDate: subDays(today, 30),
      actualCompletionDate: subDays(today, 32),
      status: DrawingStatus.COMPLETED,
      createdById: manager.id,
    },
    {
      drawingNumber: 'PRJ-101-E-CD-002',
      drawingTitle: 'LV Switchboard Layout',
      projectId: proj101.id,
      discipline: Discipline.ELECTRICAL,
      category: DrawingCategory.CONSTRUCTION,
      designerId: sarah.id,
      requestorId: manager.id,
      requestDate: subDays(today, 40),
      startDate: subDays(today, 38),
      endDate: subDays(today, 25),
      actualCompletionDate: subDays(today, 26),
      status: DrawingStatus.COMPLETED,
      createdById: manager.id,
    },
  ]

  for (const d of drawings) {
    await prisma.drawing.create({ data: d as any })
  }

  console.log(`✅ ${drawings.length} drawings created`)

  // ── Audit entries for created drawings ─────────────────────────────────────
  const allDrawings = await prisma.drawing.findMany()
  for (const drawing of allDrawings) {
    await prisma.auditLog.create({
      data: {
        userId: drawing.createdById,
        action: AuditAction.CREATED,
        drawingId: drawing.id,
        details: JSON.stringify({ drawingNumber: drawing.drawingNumber }),
        ipAddress: '127.0.0.1',
        createdAt: drawing.createdAt,
      },
    })
    if (drawing.actualCompletionDate) {
      const isLate = drawing.lateReason != null
      await prisma.auditLog.create({
        data: {
          userId: drawing.designerId,
          action: isLate ? AuditAction.COMPLETED_LATE : AuditAction.COMPLETED,
          drawingId: drawing.id,
          details: JSON.stringify({
            actualCompletionDate: drawing.actualCompletionDate,
            lateReason: drawing.lateReason,
          }),
          ipAddress: '127.0.0.1',
          createdAt: drawing.actualCompletionDate,
        },
      })
    }
  }

  // LOGIN audit for all users
  for (const user of [admin, deptHead, manager, pm, daniel, sarah, raj, marcus]) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.LOGIN,
        details: JSON.stringify({}),
        ipAddress: '127.0.0.1',
      },
    })
  }

  console.log('✅ Audit log seeded')
  console.log('')
  console.log('🎉 Seed complete! Test accounts (all passwords: Password123!):')
  console.log('   admin@designregister.com       — Admin')
  console.log('   dept@designregister.com        — Department Head')
  console.log('   manager@designregister.com     — Design Manager')
  console.log('   pm@designregister.com          — Project Manager')
  console.log('   daniel@designregister.com      — Senior Designer (Mechanical)')
  console.log('   sarah@designregister.com       — Designer (Electrical)')
  console.log('   raj@designregister.com         — Designer (Mechanical)')
  console.log('   marcus@designregister.com      — Senior Designer (ELV)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
