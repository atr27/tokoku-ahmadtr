import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TransactionWithDetails } from '@/types/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    const format = searchParams.get('format') || 'html' // html, text, thermal

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    // Fetch transaction with items and cashier info
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                price: true
              }
            }
          }
        },
        cashier: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Generate receipt content based on format
    let receiptContent: string

    if (format === 'thermal') {
      // Thermal printer format (ESC/POS style)
      receiptContent = generateThermalReceipt(transaction)
    } else if (format === 'text') {
      // Plain text format
      receiptContent = generateTextReceipt(transaction)
    } else {
      // HTML format for web preview/printing
      receiptContent = generateHTMLReceipt(transaction)
    }

    // Set appropriate headers
    const headers = new Headers()
    if (format === 'html') {
      headers.set('Content-Type', 'text/html')
    } else {
      headers.set('Content-Type', 'text/plain')
    }

    return new Response(receiptContent, { headers })

  } catch (error) {
    console.error('Error generating receipt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateThermalReceipt(transaction: TransactionWithDetails): string {
  const storeName = 'NextPOS Store'
  const storeAddress = 'Jl. Example No. 123'
  const storePhone = '021-12345678'

  let receipt = ''

  // Header
  receipt += '\x1B\x40' // Initialize printer
  receipt += '\x1B\x61\x01' // Center alignment
  receipt += `${storeName}\n`
  receipt += `${storeAddress}\n`
  receipt += `Tel: ${storePhone}\n`
  receipt += '='.repeat(32) + '\n'

  // Transaction info
  receipt += '\x1B\x61\x00' // Left alignment
  receipt += `Transaction: ${transaction.transactionNumber}\n`
  receipt += `Date: ${new Date(transaction.createdAt).toLocaleString('id-ID')}\n`
  receipt += `Cashier: ${transaction.cashier.name}\n`
  receipt += '-'.repeat(32) + '\n'

  // Items
  receipt += '\x1B\x61\x00' // Left alignment
  transaction.items.forEach((item) => {
    receipt += `${item.product.name.substring(0, 20)}\n`
    receipt += `  ${item.quantity} x ${formatCurrency(item.unitPrice.toNumber())} = ${formatCurrency(item.totalPrice.toNumber())}\n`
  })

  // Totals
  receipt += '-'.repeat(32) + '\n'
  receipt += `Subtotal: ${formatCurrency(transaction.totalAmount.toNumber())}\n`
  receipt += `Tax: ${formatCurrency(transaction.taxAmount.toNumber())}\n`
  receipt += `Discount: ${formatCurrency(transaction.discountAmount.toNumber())}\n`
  receipt += '='.repeat(32) + '\n'
  receipt += `TOTAL: ${formatCurrency(transaction.finalAmount.toNumber())}\n`
  receipt += `Payment: ${transaction.paymentMethod}\n`

  // Footer
  receipt += '\n'
  receipt += '\x1B\x61\x01' // Center alignment
  receipt += 'Thank you for your purchase!\n'
  receipt += 'Please come again\n'
  receipt += '\n\n\n'

  // Cut paper
  receipt += '\x1D\x56\x42\x00'

  return receipt
}

function generateTextReceipt(transaction: TransactionWithDetails): string {
  const storeName = 'NextPOS Store'
  const storeAddress = 'Jl. Example No. 123'
  const storePhone = '021-12345678'

  let receipt = ''

  // Header
  receipt += `${storeName}\n`
  receipt += `${storeAddress}\n`
  receipt += `Tel: ${storePhone}\n`
  receipt += '='.repeat(50) + '\n'

  // Transaction info
  receipt += `Transaction: ${transaction.transactionNumber}\n`
  receipt += `Date: ${new Date(transaction.createdAt).toLocaleString('id-ID')}\n`
  receipt += `Cashier: ${transaction.cashier.name}\n`
  receipt += '-'.repeat(50) + '\n'

  // Items
  transaction.items.forEach((item) => {
    receipt += `${item.product.name.padEnd(30)} ${item.quantity.toString().padStart(3)} x ${formatCurrency(item.unitPrice.toNumber()).padStart(10)} = ${formatCurrency(item.totalPrice.toNumber()).padStart(12)}\n`
  })

  // Totals
  receipt += '-'.repeat(50) + '\n'
  receipt += `Subtotal:${' '.repeat(38)}${formatCurrency(transaction.totalAmount.toNumber())}\n`
  receipt += `Tax:${' '.repeat(44)}${formatCurrency(transaction.taxAmount.toNumber())}\n`
  receipt += `Discount:${' '.repeat(37)}${formatCurrency(transaction.discountAmount.toNumber())}\n`
  receipt += '='.repeat(50) + '\n'
  receipt += `TOTAL:${' '.repeat(44)}${formatCurrency(transaction.finalAmount.toNumber())}\n`
  receipt += `Payment Method: ${transaction.paymentMethod}\n`

  // Footer
  receipt += '\n'
  receipt += 'Thank you for your purchase!\n'
  receipt += 'Please come again\n'

  return receipt
}

function generateHTMLReceipt(transaction: TransactionWithDetails): string {
  const storeName = 'NextPOS Store'
  const storeAddress = 'Jl. Example No. 123'
  const storePhone = '021-12345678'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${transaction.transactionNumber}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .store-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .total { font-weight: bold; font-size: 14px; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        .item { margin: 5px 0; }
        .item-name { display: inline-block; width: 200px; }
        .item-details { display: inline-block; width: 100px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="store-name">${storeName}</div>
        <div>${storeAddress}</div>
        <div>Tel: ${storePhone}</div>
      </div>

      <div class="divider"></div>

      <div style="margin-bottom: 15px;">
        <div><strong>Transaction:</strong> ${transaction.transactionNumber}</div>
        <div><strong>Date:</strong> ${new Date(transaction.createdAt).toLocaleString('id-ID')}</div>
        <div><strong>Cashier:</strong> ${transaction.cashier.name}</div>
      </div>

      <div class="divider"></div>

      ${transaction.items.map((item) => `
        <div class="item">
          <span class="item-name">${item.product.name}</span>
          <span class="item-details">${item.quantity} x ${formatCurrency(item.unitPrice.toNumber())}</span>
          <span class="item-details">${formatCurrency(item.totalPrice.toNumber())}</span>
        </div>
      `).join('')}

      <div class="divider"></div>

      <div style="margin: 10px 0;">
        <div><span style="width: 300px; display: inline-block;">Subtotal:</span><span style="text-align: right;">${formatCurrency(transaction.totalAmount.toNumber())}</span></div>
        <div><span style="width: 300px; display: inline-block;">Tax:</span><span style="text-align: right;">${formatCurrency(transaction.taxAmount.toNumber())}</span></div>
        <div><span style="width: 300px; display: inline-block;">Discount:</span><span style="text-align: right;">${formatCurrency(transaction.discountAmount.toNumber())}</span></div>
      </div>

      <div class="divider"></div>

      <div class="total" style="margin: 10px 0;">
        <span style="width: 300px; display: inline-block;">TOTAL:</span><span style="text-align: right;">${formatCurrency(transaction.finalAmount.toNumber())}</span>
      </div>

      <div><strong>Payment Method:</strong> ${transaction.paymentMethod}</div>

      <div class="divider"></div>

      <div class="footer">
        <div>Thank you for your purchase!</div>
        <div>Please come again</div>
      </div>
    </body>
    </html>
  `
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}
