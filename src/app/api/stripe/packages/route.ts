import { getStripePlansForHttp } from '@/modules/stripe/stripe-plans'
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(getStripePlansForHttp())
}
