import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionWithFreshRoleFromRequest } from '@/lib/auth'

// GET - List reports
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is staff
    if (!['mod', 'admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - Staff only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (status) {
      where.status = status
    }
    if (type) {
      where.type = type
    }

    const [reports, total] = await Promise.all([
      db.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      db.report.count({ where })
    ])

    // Get reporter info
    const reporterIds = [...new Set(reports.map(r => r.reporterId))]
    const reporters = await db.user.findMany({
      where: { id: { in: reporterIds } },
      select: { id: true, username: true, avatarUrl: true }
    })
    const reporterMap = Object.fromEntries(reporters.map(r => [r.id, r]))

    // Get reported user info
    const reportedIds = [...new Set(reports.filter(r => r.reportedId).map(r => r.reportedId!))]
    const reportedUsers = await db.user.findMany({
      where: { id: { in: reportedIds } },
      select: { id: true, username: true, avatarUrl: true }
    })
    const reportedMap = Object.fromEntries(reportedUsers.map(r => [r.id, r]))

    // Enrich reports with user info
    const enrichedReports = reports.map(report => ({
      ...report,
      reporter: reporterMap[report.reporterId] || null,
      reportedUser: report.reportedId ? reportedMap[report.reportedId] || null : null
    }))

    return NextResponse.json({
      reports: enrichedReports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update report status
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionWithFreshRoleFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is staff
    if (!['mod', 'admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden - Staff only' }, { status: 403 })
    }

    const body = await request.json()
    const { reportId, status, reviewNote } = body

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Missing reportId or status' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Update report
    const report = await db.report.update({
      where: { id: reportId },
      data: {
        status,
        reviewNote,
        reviewedById: user.id,
        reviewedAt: new Date()
      }
    })

    // Log the action
    await db.adminLog.create({
      data: {
        adminId: user.id,
        action: 'review_report',
        targetType: 'report',
        targetId: reportId,
        details: JSON.stringify({ status, reviewNote })
      }
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Error updating report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
