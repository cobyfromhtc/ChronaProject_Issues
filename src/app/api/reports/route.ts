import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

// Schema for creating a report
const createReportSchema = z.object({
  type: z.enum(['user', 'persona', 'dm_message', 'storyline_message']),
  reportedId: z.string().optional().nullable(), // User being reported (for user/persona reports)
  referenceId: z.string().optional().nullable(), // Message ID or Persona ID
  reason: z.string().min(1, 'Reason is required').max(100, 'Reason too long'),
  details: z.string().max(1000, 'Details too long').optional().nullable(),
})

// POST - Create a new report
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = createReportSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { type, reportedId, referenceId, reason, details } = result.data

    // Prevent self-reporting
    if (reportedId === user.id) {
      return NextResponse.json(
        { error: 'You cannot report yourself' },
        { status: 400 }
      )
    }

    // Check for duplicate recent reports (prevent spam)
    const recentReport = await db.report.findFirst({
      where: {
        reporterId: user.id,
        type,
        OR: [
          { reportedId: reportedId || null },
          { referenceId: referenceId || null }
        ],
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours
        }
      }
    })

    if (recentReport) {
      return NextResponse.json(
        { error: 'You have already reported this recently. Please wait for staff to review.' },
        { status: 429 }
      )
    }

    // Create the report
    const report = await db.report.create({
      data: {
        reporterId: user.id,
        reportedId: reportedId || null,
        type,
        reason,
        details: details || null,
        referenceId: referenceId || null,
        status: 'pending'
      }
    })

    return NextResponse.json({ 
      success: true, 
      report,
      message: 'Report submitted successfully. Our moderation team will review it shortly.'
    })
  } catch (error) {
    console.error('Error creating report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get user's own reports
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reports = await db.report.findMany({
      where: { reporterId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
