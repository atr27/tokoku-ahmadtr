import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

interface CreateNotificationParams {
  userId: string
  title: string
  message: string
  type?: NotificationType
  metadata?: Prisma.InputJsonValue
}

export async function createNotification({
  userId,
  title,
  message,
  type = 'INFO',
  metadata,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        metadata: metadata ?? Prisma.JsonNull,
      },
    })
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

// Helper functions for common notification scenarios

export async function notifyLowStock(userId: string, productName: string, currentStock: number) {
  return createNotification({
    userId,
    title: 'Low Stock Alert',
    message: `Product "${productName}" is running low (${currentStock} remaining)`,
    type: 'WARNING',
    metadata: { productName, currentStock },
  })
}

export async function notifyNewOrder(userId: string, transactionNumber: string, amount: number) {
  return createNotification({
    userId,
    title: 'New Order',
    message: `Order #${transactionNumber} has been placed (${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)})`,
    type: 'INFO',
    metadata: { transactionNumber, amount },
  })
}

export async function notifyPaymentReceived(userId: string, transactionNumber: string, amount: number) {
  return createNotification({
    userId,
    title: 'Payment Received',
    message: `Payment of ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)} has been confirmed for order #${transactionNumber}`,
    type: 'SUCCESS',
    metadata: { transactionNumber, amount },
  })
}

export async function notifyPaymentFailed(userId: string, transactionNumber: string, reason?: string) {
  return createNotification({
    userId,
    title: 'Payment Failed',
    message: `Payment for order #${transactionNumber} has failed${reason ? `: ${reason}` : ''}`,
    type: 'ERROR',
    metadata: { transactionNumber, reason },
  })
}

export async function notifyInventoryUpdate(userId: string, productName: string, quantity: number, type: string) {
  return createNotification({
    userId,
    title: 'Inventory Updated',
    message: `${productName}: ${type} of ${quantity} units`,
    type: 'INFO',
    metadata: { productName, quantity, type },
  })
}

// Broadcast notification to all users with specific roles
export async function broadcastNotification(
  title: string,
  message: string,
  type: NotificationType = 'INFO',
  roles?: ('ADMIN' | 'MANAGER' | 'CASHIER')[]
) {
  try {
    const users = await prisma.user.findMany({
      where: roles ? { role: { in: roles } } : undefined,
      select: { id: true },
    })

    const notifications = await prisma.notification.createMany({
      data: users.map(user => ({
        userId: user.id,
        title,
        message,
        type,
      })),
    })

    return notifications
  } catch (error) {
    console.error('Error broadcasting notification:', error)
    throw error
  }
}
