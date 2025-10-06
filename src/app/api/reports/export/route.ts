import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentStatus } from '@prisma/client'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const exportType = searchParams.get('type') || 'transactions'
    const format = searchParams.get('format') || 'excel'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1) // Include the entire end date
      }
    } : {}

    // Type for transaction date filter
    interface TransactionDateFilter {
      transaction: {
        createdAt?: {
          gte: Date;
          lte: Date;
        };
        paymentStatus: PaymentStatus;
      };
    }

    // Helper function to apply date filter to transaction-related queries
    const getTransactionDateFilter = (filter: { createdAt: { gte: Date; lte: Date } }): TransactionDateFilter => {
      if (!startDate || !endDate) {
        return {
          transaction: {
            paymentStatus: PaymentStatus.PAID
          }
        };
      }
      
      return {
        transaction: {
          createdAt: {
            gte: filter.createdAt.gte,
            lte: filter.createdAt.lte
          },
          paymentStatus: PaymentStatus.PAID
        }
      };
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook()

      if (exportType === 'transactions') {
        // Transactions export
        const transactions = await prisma.transaction.findMany({
          where: {
            ...(startDate && endDate ? dateFilter : {}),
            paymentStatus: 'PAID'
          },
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, sku: true, category: { select: { name: true } } }
                }
              }
            },
            cashier: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        const worksheet = workbook.addWorksheet('Transactions')

        // Headers
        worksheet.columns = [
          { header: 'Transaction #', key: 'transactionNumber', width: 15 },
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Cashier', key: 'cashier', width: 15 },
          { header: 'Payment Method', key: 'paymentMethod', width: 15 },
          { header: 'Total Amount', key: 'totalAmount', width: 12 },
          { header: 'Tax Amount', key: 'taxAmount', width: 12 },
          { header: 'Discount', key: 'discountAmount', width: 12 },
          { header: 'Final Amount', key: 'finalAmount', width: 12 },
        ]

        // Data
        transactions.forEach((transaction) => {
          worksheet.addRow({
            transactionNumber: transaction.transactionNumber,
            date: transaction.createdAt.toISOString().split('T')[0],
            cashier: transaction.cashier.name,
            paymentMethod: transaction.paymentMethod,
            totalAmount: transaction.totalAmount,
            taxAmount: transaction.taxAmount,
            discountAmount: transaction.discountAmount,
            finalAmount: transaction.finalAmount,
          })
        })

      } else if (exportType === 'products') {
        // Products export
        const products = await prisma.product.findMany({
          where: { isActive: true },
          include: {
            category: {
              select: { name: true }
            }
          },
          orderBy: { name: 'asc' }
        })

        const worksheet = workbook.addWorksheet('Products')

        worksheet.columns = [
          { header: 'Name', key: 'name', width: 25 },
          { header: 'SKU', key: 'sku', width: 15 },
          { header: 'Category', key: 'category', width: 20 },
          { header: 'Price', key: 'price', width: 12 },
          { header: 'Cost', key: 'cost', width: 12 },
          { header: 'Stock', key: 'stock', width: 10 },
          { header: 'Min Stock', key: 'minStock', width: 10 },
        ]

        products.forEach((product) => {
          worksheet.addRow({
            name: product.name,
            sku: product.sku,
            category: product.category.name,
            price: product.price,
            cost: product.cost,
            stock: product.stock,
            minStock: product.minStock,
          })
        })
      }

      // Set headers for file download
      const buffer = await workbook.xlsx.writeBuffer()
      const headers = new Headers()
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      headers.set('Content-Disposition', `attachment; filename="${exportType}_${new Date().toISOString().split('T')[0]}.xlsx"`)

      return new Response(buffer, { headers })

    } else if (format === 'csv') {
      // CSV export
      if (exportType === 'transactions') {
        const transactions = await prisma.transaction.findMany({
          where: {
            ...dateFilter,
            paymentStatus: 'PAID'
          },
          include: {
            cashier: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        })

        const csvData = [
          'Transaction #,Date,Cashier,Payment Method,Total Amount,Tax Amount,Discount,Final Amount',
          ...transactions.map(t =>
            `${t.transactionNumber},${t.createdAt.toISOString().split('T')[0]},${t.cashier.name},${t.paymentMethod},${t.totalAmount},${t.taxAmount},${t.discountAmount},${t.finalAmount}`
          )
        ].join('\n')

        return new Response(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${exportType}_${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      }
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })

  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
