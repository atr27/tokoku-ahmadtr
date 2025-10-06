import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface SalesSummary {
  totalRevenue: number
  monthlyRevenue: number
  percentageChange: number
  lastUpdated: string
}

export async function GET() {
  try {
    // Calculate total revenue from paid transactions
    const result = await prisma.transaction.aggregate({
      _sum: {
        finalAmount: true,
      },
      where: {
        paymentStatus: 'PAID',
      },
    })

    // Calculate revenue for the current month
    const currentDate = new Date()
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    
    const monthlyResult = await prisma.transaction.aggregate({
      _sum: {
        finalAmount: true,
      },
      where: {
        paymentStatus: 'PAID',
        createdAt: {
          gte: firstDayOfMonth,
        },
      },
    })

    // Calculate revenue for the previous month for comparison
    const firstDayOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    const lastDayOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
    
    const lastMonthResult = await prisma.transaction.aggregate({
      _sum: {
        finalAmount: true,
      },
      where: {
        paymentStatus: 'PAID',
        createdAt: {
          gte: firstDayOfLastMonth,
          lte: lastDayOfLastMonth,
        },
      },
    })

    const totalRevenue = Number(result._sum.finalAmount || 0)
    const monthlyRevenue = Number(monthlyResult._sum.finalAmount || 0)
    const lastMonthRevenue = Number(lastMonthResult._sum.finalAmount || 0)
    
    // Calculate percentage change from last month
    const percentageChange = lastMonthRevenue > 0 
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : monthlyRevenue > 0 ? 100 : 0

    const response: SalesSummary = {
      totalRevenue,
      monthlyRevenue,
      percentageChange: Math.round(percentageChange * 100) / 100, // Round to 2 decimal places
      lastUpdated: new Date().toISOString(),
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching sales summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales data' },
      { status: 500 }
    )
  }
}
