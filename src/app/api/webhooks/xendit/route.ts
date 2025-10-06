import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'
import { notifyPaymentReceived, notifyPaymentFailed, notifyLowStock } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Xendit webhook received:', JSON.stringify(body, null, 2))

    // Xendit sends different webhook formats depending on the payment type
    // Invoice webhook format
    const externalId = body.external_id || body.externalId
    const status = body.status
    const id = body.id

    if (!externalId) {
      console.log('No external_id found in webhook')
      return NextResponse.json({ received: true })
    }

    // Extract transaction ID from external ID (format: txn-{transactionId}-{timestamp})
    const transactionIdMatch = externalId.match(/^txn-([^-]+)-/)
    const transactionId = transactionIdMatch ? transactionIdMatch[1] : null

    console.log('Extracted transaction ID:', transactionId)

    // Find transaction by ID or xenditPaymentId
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          ...(transactionId ? [{ id: transactionId }] : []),
          { xenditPaymentId: externalId },
          { xenditPaymentId: id }
        ]
      }
    })

    if (!transaction) {
      console.log('Transaction not found for external_id:', externalId)
      return NextResponse.json({ received: true })
    }

    console.log('Found transaction:', transaction.id, 'Current status:', transaction.paymentStatus)

    // Map Xendit status to our payment status
    let paymentStatus: PaymentStatus = PaymentStatus.PENDING
    
    if (status === 'PAID' || status === 'SETTLED' || status === 'SUCCEEDED') {
      paymentStatus = PaymentStatus.PAID
    } else if (status === 'FAILED') {
      paymentStatus = PaymentStatus.FAILED
    } else if (status === 'EXPIRED') {
      paymentStatus = PaymentStatus.EXPIRED
    }

    console.log('Updating transaction to status:', paymentStatus)

    // Update transaction status
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentStatus,
        xenditPaymentId: id || externalId
      }
    })

    console.log('Transaction updated successfully:', updatedTransaction.id, 'New status:', updatedTransaction.paymentStatus)

    // If payment is successful, update product stock
    if (paymentStatus === PaymentStatus.PAID && transaction.paymentStatus !== PaymentStatus.PAID) {
      console.log('Payment confirmed, updating stock for transaction:', transaction.id)
      
      const transactionWithItems = await prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: { items: true }
      })

      if (transactionWithItems) {
        for (const item of transactionWithItems.items) {
          // Get product before update to track stock changes
          const product = await prisma.product.findUnique({
            where: { id: item.productId }
          })

          if (product) {
            // Update product stock
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.quantity
                }
              }
            })

            // Create inventory log
            await prisma.inventoryLog.create({
              data: {
                productId: item.productId,
                type: 'SALE',
                quantity: item.quantity,
                previousStock: product.stock,
                newStock: product.stock - item.quantity,
                reason: `Sale - Transaction ${transaction.transactionNumber}`,
                createdBy: transaction.cashierId
              }
            })

            // Check for low stock and notify
            const newStock = product.stock - item.quantity
            if (newStock <= product.minStock) {
              await notifyLowStock(transaction.cashierId, product.name, newStock)
            }
          }
        }
        console.log('Stock updated for', transactionWithItems.items.length, 'items')

        // Notify payment received
        await notifyPaymentReceived(
          transaction.cashierId,
          transaction.transactionNumber,
          parseFloat(transaction.finalAmount.toString())
        )
      }
    } else if (paymentStatus === PaymentStatus.FAILED) {
      // Notify payment failed
      await notifyPaymentFailed(
        transaction.cashierId,
        transaction.transactionNumber,
        status
      )
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing Xendit webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
