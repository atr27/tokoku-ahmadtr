import { NextRequest, NextResponse } from 'next/server'
import { xendit } from '@/lib/xendit'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentStatus } from '@prisma/client'
import { notifyPaymentReceived, notifyLowStock } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { transactionId } = body

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        cashier: true
      }
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // If already paid, return current status
    if (transaction.paymentStatus === 'PAID') {
      return NextResponse.json({
        status: 'PAID',
        transaction
      })
    }

    // Check with Xendit if we have a payment ID
    if (transaction.xenditPaymentId) {
      try {
        const invoice = await xendit.Invoice.getInvoiceById({
          invoiceId: transaction.xenditPaymentId
        })

        console.log('Xendit invoice status:', invoice.status)

        // Update transaction based on Xendit status
        let paymentStatus: PaymentStatus = PaymentStatus.PENDING

        if (invoice.status === 'PAID' || invoice.status === 'SETTLED') {
          paymentStatus = PaymentStatus.PAID
        } else if (invoice.status === 'EXPIRED') {
          paymentStatus = PaymentStatus.EXPIRED
        }

        // Update transaction if status changed
        if (paymentStatus !== transaction.paymentStatus) {
          const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: { paymentStatus },
            include: {
              items: {
                include: {
                  product: true
                }
              },
              cashier: true
            }
          })

          // If payment is successful, update stock
          if (paymentStatus === PaymentStatus.PAID) {
            for (const item of transaction.items) {
              // Get product before update to track stock changes
              const product = await prisma.product.findUnique({
                where: { id: item.productId }
              })

              if (product) {
                const previousStock = product.stock
                const newStock = previousStock - item.quantity

                // Update product stock
                await prisma.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: newStock
                  }
                })

                // Create inventory log
                await prisma.inventoryLog.create({
                  data: {
                    productId: item.productId,
                    type: 'SALE',
                    quantity: item.quantity,
                    previousStock,
                    newStock,
                    reason: `Sale - Transaction ${transaction.transactionNumber}`,
                    createdBy: transaction.cashierId
                  }
                })

                // Check for low stock and notify
                if (newStock <= product.minStock) {
                  await notifyLowStock(transaction.cashierId, product.name, newStock)
                }
              }
            }

            // Notify payment received
            await notifyPaymentReceived(
              transaction.cashierId,
              transaction.transactionNumber,
              parseFloat(transaction.finalAmount.toString())
            )
          }

          return NextResponse.json({
            status: paymentStatus,
            transaction: updatedTransaction
          })
        }
      } catch (error) {
        console.error('Error checking Xendit invoice:', error)
      }
    }

    return NextResponse.json({
      status: transaction.paymentStatus,
      transaction
    })

  } catch (error) {
    console.error('Error checking payment status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
