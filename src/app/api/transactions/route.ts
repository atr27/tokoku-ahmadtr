import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { notifyNewOrder, notifyLowStock } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      totalAmount: number | string;
      taxAmount?: number | string;
      discountAmount?: number | string;
      finalAmount: number | string;
      paymentMethod: string;
      paymentStatus?: string;
      cashierId: string;
      xenditPaymentId?: string;
      xenditInvoiceUrl?: string;
      items: Array<{
        productId: string;
        quantity: number | string;
        unitPrice: number | string;
        totalPrice: number | string;
      }>;
    };
    
    const {
      totalAmount,
      taxAmount,
      discountAmount,
      finalAmount,
      paymentMethod,
      paymentStatus,
      cashierId,
      xenditPaymentId,
      xenditInvoiceUrl,
      items
    } = body;

    // Validate required fields
    if (!totalAmount || !finalAmount || !paymentMethod || !cashierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Total amount, final amount, payment method, cashier ID, and items are required' },
        { status: 400 }
      )
    }

    // Verify cashier exists in database
    const cashierExists = await prisma.user.findUnique({
      where: { id: cashierId }
    })

    if (!cashierExists) {
      console.error(`Cashier ID ${cashierId} not found in database`)
      return NextResponse.json(
        { error: 'Invalid cashier ID. Please log out and log in again.' },
        { status: 400 }
      )
    }

    // Validate item quantities
    for (const item of items) {
      if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for product ${item.productId}` },
          { status: 400 }
        )
      }
    }

    // Generate transaction number
    const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    // Ensure all numeric values are properly converted
    const totalAmountNum = typeof totalAmount === 'string' ? parseFloat(totalAmount) : Number(totalAmount);
    const taxAmountNum = taxAmount ? (typeof taxAmount === 'string' ? parseFloat(taxAmount) : Number(taxAmount)) : 0;
    const discountAmountNum = discountAmount ? (typeof discountAmount === 'string' ? parseFloat(discountAmount) : Number(discountAmount)) : 0;
    const finalAmountNum = typeof finalAmount === 'string' ? parseFloat(finalAmount) : Number(finalAmount);

    // Create transaction with items
    const transaction = await prisma.transaction.create({
      data: {
        transactionNumber,
        totalAmount: totalAmountNum,
        taxAmount: taxAmountNum,
        discountAmount: discountAmountNum,
        finalAmount: finalAmountNum,
        paymentMethod: paymentMethod as 'CASH' | 'XENDIT_QRIS' | 'XENDIT_EWALLET' | 'XENDIT_VIRTUAL_ACCOUNT',
        paymentStatus: paymentMethod === 'CASH' ? 'PAID' : 'PENDING',
        xenditPaymentId: xenditPaymentId || null,
        xenditInvoiceUrl: xenditInvoiceUrl || null,
        cashierId,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice)
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        cashier: true
      }
    })

    // Only update stock if payment is immediate (cash) or if it's a Xendit payment that's already paid
    type XenditPaymentMethod = 'XENDIT_QRIS' | 'XENDIT_EWALLET' | 'XENDIT_VIRTUAL_ACCOUNT';
    const isXenditPayment: XenditPaymentMethod[] = ['XENDIT_QRIS', 'XENDIT_EWALLET', 'XENDIT_VIRTUAL_ACCOUNT'];
    const currentPaymentMethod = paymentMethod as 'CASH' | XenditPaymentMethod;
    
    if (currentPaymentMethod === 'CASH' || 
        (isXenditPayment.includes(currentPaymentMethod as XenditPaymentMethod) && paymentStatus === 'PAID')) {
      // Update product stock levels and create inventory logs
      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const quantity = Number(item.quantity);
        const previousStock = product.stock;
        const newStock = previousStock - quantity;

        // Update product stock
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: quantity
            }
          }
        });

        // Create inventory log
        await prisma.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: Number(item.quantity),
            previousStock,
            newStock,
            reason: `Sale - Transaction ${transactionNumber}`,
            createdBy: cashierId
          }
        });

        // Check for low stock and notify
        if (newStock <= product.minStock) {
          await notifyLowStock(cashierId, product.name, newStock)
        }
      }
    }

    // Notify about new order
    await notifyNewOrder(cashierId, transactionNumber, finalAmountNum)

    return NextResponse.json(transaction, { status: 201 })
  } catch (error: unknown) {
    console.error('Error in transactions API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    const where: Prisma.TransactionWhereInput = {}

    if (search) {
      where.transactionNumber = {
        contains: search,
        mode: 'insensitive'
      }
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          items: {
            include: {
              product: true
            }
          },
          cashier: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
