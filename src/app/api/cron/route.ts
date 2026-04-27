import { NextRequest, NextResponse } from 'next/server'
import { runCronJob, runAllCronJobs } from '@/lib/cron'

// ===========================================
// Configuration
// ===========================================

const CRON_SECRET = process.env.CRON_SECRET

/**
 * Verify the cron secret for authentication
 * In production, this MUST be set
 */
function verifyCronSecret(request: NextRequest): boolean {
  // Check for secret in header
  const authHeader = request.headers.get('x-cron-secret')
  
  if (!CRON_SECRET) {
    // In development without secret, allow
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Cron API] No CRON_SECRET set. Using development mode.')
      return true
    }
    console.error('[Cron API] CRON_SECRET not set in production!')
    return false
  }
  
  return authHeader === CRON_SECRET
}

// ===========================================
// API Routes
// ===========================================

/**
 * GET /api/cron
 * Run all cron jobs
 * 
 * Headers:
 * - x-cron-secret: The cron secret for authentication
 * 
 * Query params:
 * - job: Run a specific job (optional)
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  const { searchParams } = new URL(request.url)
  const jobName = searchParams.get('job')
  
  try {
    if (jobName) {
      // Run specific job
      const result = await runCronJob(jobName)
      return NextResponse.json(result)
    }
    
    // Run all jobs
    const results = await runAllCronJobs()
    return NextResponse.json({
      success: true,
      message: 'All cron jobs completed',
      results
    })
  } catch (error) {
    console.error('[Cron API] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to run cron jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron
 * Run cron jobs (alternative method for external schedulers)
 * 
 * Headers:
 * - x-cron-secret: The cron secret for authentication
 * 
 * Body:
 * - job: Run a specific job (optional)
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  try {
    const body = await request.json().catch(() => ({}))
    const jobName = body.job
    
    if (jobName) {
      // Run specific job
      const result = await runCronJob(jobName)
      return NextResponse.json(result)
    }
    
    // Run all jobs
    const results = await runAllCronJobs()
    return NextResponse.json({
      success: true,
      message: 'All cron jobs completed',
      results
    })
  } catch (error) {
    console.error('[Cron API] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to run cron jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
