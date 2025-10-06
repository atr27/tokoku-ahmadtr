import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get total number of products
    const totalProducts = await prisma.product.count()
    
    // Get total number of transactions
    const totalTransactions = await prisma.transaction.count()
    
    // Get total revenue (sum of all final amounts from transactions)
    const revenueResult = await prisma.transaction.aggregate({
      _sum: {
        finalAmount: true
      }
    })
    
    // Get count of low stock products (assuming we consider < 10 as low stock)
    const lowStockProducts = await prisma.product.count({
      where: {
        stock: {
          lt: 10
        }
      }
    })

    return NextResponse.json({
      totalProducts,
      totalTransactions,
totalRevenue: Number(revenueResult._sum.finalAmount) || 0,
      lowStockProducts
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
