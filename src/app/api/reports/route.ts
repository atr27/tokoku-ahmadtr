import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'overview'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const categoryId = searchParams.get('categoryId')

    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1) // Include the entire end date
      }
    } : {}

    // Type for transaction date filter
    type TransactionDateFilter = {
      transaction: {
        createdAt?: {
          gte: Date;
          lte: Date;
        };
        paymentStatus: PaymentStatus;
      };
    };

    // Helper function to apply date filter to transaction-related queries
    const getTransactionDateFilter = (filter: { createdAt?: { gte: Date; lte: Date } }): TransactionDateFilter => {
      return startDate && endDate && filter.createdAt ? {
        transaction: {
          createdAt: filter.createdAt,
          paymentStatus: PaymentStatus.PAID
        }
      } : {
        transaction: {
          paymentStatus: PaymentStatus.PAID
        }
      }
    }

    type ReportData = {
      overview?: {
        totalRevenue: number;
        totalTransactions: number;
        totalProducts?: number;
        lowStockCount?: number;
        averageOrderValue?: number;
        topSellingProducts?: Array<{ name: string; quantity: number; revenue: number }>;
      };
      dailySales?: unknown;
      paymentMethods?: unknown;
      revenueTrends?: unknown;
      topProducts?: unknown;
      inventoryStats?: unknown;
      lowStockProducts?: unknown;
      salesByCategory?: Array<{ name: string; total: number }>;
      recentTransactions?: Array<{ id: string; date: string; amount: number; status: string }>;
    };

    let reportData: ReportData = {}

    switch (reportType) {
      case 'overview':
        // Overview data - this should return basic stats
        const totalRevenue = await prisma.transaction.aggregate({
          _sum: {
            finalAmount: true,
          },
          where: {
            ...dateFilter,
            paymentStatus: 'PAID'
          }
        })

        const totalTransactions = await prisma.transaction.count({
          where: {
            ...dateFilter,
            paymentStatus: 'PAID'
          }
        })

        const totalProducts = await prisma.product.count({
          where: {
            isActive: true
          }
        })

        const lowStockCount = await prisma.product.count({
          where: {
            stock: {
              lte: 5
            },
            isActive: true
          }
        })

        reportData = {
          overview: {
            totalRevenue: Number(totalRevenue._sum.finalAmount) || 0,
            totalTransactions,
            totalProducts,
            lowStockCount,
          }
        }
        break

      case 'sales':
        // Sales analytics data
        const dailySales = await prisma.transaction.groupBy({
          by: ['paymentStatus'],
          where: {
            ...dateFilter,
            paymentStatus: 'PAID'
          },
          _sum: {
            totalAmount: true,
            finalAmount: true,
          },
          _count: {
            id: true,
          },
        })

        const paymentMethods = await prisma.transaction.groupBy({
          by: ['paymentMethod'],
          where: {
            ...dateFilter,
            paymentStatus: 'PAID'
          },
          _sum: {
            finalAmount: true,
          },
          _count: {
            id: true,
          },
        })

        // Revenue trends for sales tab
        const revenueTrends = await prisma.transaction.findMany({
          where: {
            ...dateFilter,
            paymentStatus: 'PAID'
          },
          select: {
            createdAt: true,
            finalAmount: true,
            paymentMethod: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        })

        // Group by date
        const groupedTrends = revenueTrends.reduce((acc: Record<string, { date: string; revenue: number; transactions: number; cash_transactions: number; digital_transactions: number }>, transaction) => {
          const date = transaction.createdAt.toISOString().split('T')[0]
          if (!acc[date]) {
            acc[date] = {
              date,
              revenue: 0,
              transactions: 0,
              cash_transactions: 0,
              digital_transactions: 0
            }
          }
          acc[date].revenue += Number(transaction.finalAmount)
          acc[date].transactions += 1
          if (transaction.paymentMethod === 'CASH') {
            acc[date].cash_transactions += 1
          } else {
            acc[date].digital_transactions += 1
          }
          return acc
        }, {})

        reportData = {
          dailySales,
          paymentMethods,
          revenueTrends: Object.values(groupedTrends)
        }
        break

      case 'products':
        // Product performance data
        const topProducts = await prisma.transactionItem.groupBy({
          by: ['productId'],
          where: getTransactionDateFilter(dateFilter),
          _sum: {
            quantity: true,
            totalPrice: true,
          },
          _count: {
            id: true,
          },
          orderBy: {
            _sum: {
              totalPrice: 'desc'
            }
          },
          take: 10,
        })

        const productDetails = await Promise.all(
          topProducts.map(async (item) => {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { id: true, name: true, sku: true, category: true }
            })
            return {
              ...item,
              product
            }
          })
        )

        reportData = { topProducts: productDetails }
        break

      case 'inventory':
        // Inventory status data
        const inventoryStats = await prisma.product.aggregate({
          _sum: {
            stock: true,
          },
          _count: {
            id: true,
          },
          where: categoryId ? { categoryId } : {}
        })

        const lowStockProducts = await prisma.product.findMany({
          where: {
            stock: {
              lte: 5
            },
            isActive: true,
            ... (categoryId ? { categoryId } : {})
          },
          include: {
            category: true
          },
          orderBy: {
            stock: 'asc'
          }
        })

        reportData = {
          inventoryStats,
          lowStockProducts,
        }
        break

      default:
        // Fallback to overview data
        reportData = {
          overview: {
            totalRevenue: 0,
            totalTransactions: 0,
            totalProducts: 0,
            lowStockCount: 0,
          }
        }
    }

    return NextResponse.json(reportData)
  } catch (error: unknown) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
