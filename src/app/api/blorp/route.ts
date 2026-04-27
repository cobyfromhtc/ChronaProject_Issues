import { NextResponse } from 'next/server'
import { ensureBlorpExists } from '@/lib/blorp'

// Initialize Blorp on first call
let blorpInitialized = false

export async function GET() {
  try {
    if (!blorpInitialized) {
      await ensureBlorpExists()
      blorpInitialized = true
    }

    return NextResponse.json({ success: true, initialized: blorpInitialized })
  } catch (error) {
    console.error('Error initializing Blorp:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
