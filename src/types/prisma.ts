import { Prisma } from '@prisma/client'

export type ProductWhereInput = Prisma.ProductWhereInput
export type InventoryLogWhereInput = Prisma.InventoryLogWhereInput
export type TransactionWithDetails = Prisma.TransactionGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: {
            name: true
            sku: true
            price: true
          }
        }
      }
    }
    cashier: {
      select: {
        name: true
        email: true
      }
    }
  }
}>

export interface PaymentResult {
  id?: string
  externalID?: string
  amount?: number
  status?: string
  qr_string?: string
  checkout_url?: string
  account_number?: string
  bank_code?: string
  [key: string]: unknown
}
