import { NextRequest, NextResponse } from 'next/server'
import { xendit } from '@/lib/xendit'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PaymentStatus } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      amount,
      paymentMethod,
      customerEmail,
      transactionId
    } = body

    // Validate required fields
    if (!amount || !paymentMethod) {
      return NextResponse.json(
        { error: 'Amount and payment method are required' },
        { status: 400 }
      )
    }

    const paymentResult: Record<string, unknown> | null = null
    const externalId = `txn-${transactionId}-${Date.now()}`

    // Use Xendit Invoice API for all payment methods
    // Note: Comment out specific payment methods to allow all available methods
    // This is useful for test accounts that may not have all payment methods enabled
    const invoiceSpecificOptions: Record<string, unknown> = {}

    // Uncomment these when your Xendit account has these payment methods enabled
    /*
    switch (paymentMethod) {
      case 'XENDIT_QRIS':
        invoiceSpecificOptions.paymentMethods = ['QR_CODE']
        break

      case 'XENDIT_EWALLET':
        invoiceSpecificOptions.paymentMethods = ['EWALLET']
        break

      case 'XENDIT_VIRTUAL_ACCOUNT':
        invoiceSpecificOptions.paymentMethods = ['BANK_TRANSFER']
        break

      default:
        return NextResponse.json(
          { error: 'Unsupported payment method' },
          { status: 400 }
        )
    }
    */

    // Create invoice using xendit-node v7 API
    console.log('Creating Xendit invoice with data:', {
      externalId,
      amount: parseFloat(amount),
      paymentMethod,
      customerEmail: customerEmail as string || 'customer@example.com'
    })

    const invoiceData = {
      externalId: externalId,
      amount: parseFloat(amount),
      currency: 'IDR',
      payerEmail: customerEmail || 'customer@example.com',
      description: `Payment for Transaction ${transactionId}`,
      invoiceDuration: 86400, // 24 hours in seconds
      successRedirectUrl: `${process.env.NEXTAUTH_URL}/dashboard/pos?payment=success&transaction_id=${transactionId}`,
      failureRedirectUrl: `${process.env.NEXTAUTH_URL}/dashboard/pos?payment=failed&transaction_id=${transactionId}`,
      webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/xendit`,
      ...invoiceSpecificOptions
    }

    console.log('Invoice data being sent:', JSON.stringify(invoiceData, null, 2))

    // Define proper types for Xendit invoice data
    interface XenditInvoiceData {
      externalId: string;
      amount: number;
      currency: string;
      payerEmail: string;
      description: string;
      invoiceDuration: number;
      successRedirectUrl: string;
      failureRedirectUrl: string;
      webhookUrl: string;
      paymentMethods?: string[];
    }

    const invoice = await xendit.Invoice.createInvoice({
      data: invoiceData as XenditInvoiceData
    });

    console.log('Xendit invoice created successfully:', invoice);
    console.log('Invoice URL:', invoice.invoiceUrl);
    console.log('Invoice ID:', invoice.id);

    return NextResponse.json({
      success: true,
      payment: invoice,
      paymentMethod
    })

  } catch (error: unknown) {
    console.error('Error creating payment:', error)

    // Try to extract more details from the error
    let errorDetails = 'Unknown error'
    if (error instanceof Error) {
      errorDetails = error.message
    }

    // For Xendit errors, try to access error properties safely
    const xenditError = error && typeof error === 'object' && 'body' in error ? (error as { body: unknown }).body : null

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorDetails,
        xenditError: xenditError || null
      },
      { status: 500 }
    )
  }
}

// Webhook endpoint for payment status updates
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    interface XenditWebhookBody {
      external_id: string;
      status: string;
      payment_method?: string | { type?: string } | null;
      invoice_url?: string;
      [key: string]: unknown;
    }

    const bodyData = body as XenditWebhookBody;
    const { external_id, status, payment_method } = bodyData;

    console.log('Payment webhook received:', body)

    // Find transaction by external ID or metadata
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { xenditPaymentId: external_id },
          { id: external_id.replace(/^txn-/, '') }
        ]
      }
    });

    if (!transaction) {
      console.error('Transaction not found for external ID:', external_id);
      return NextResponse.json({ received: true, message: 'Transaction not found' });
    }

    // Update transaction status based on payment status
    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
    let paymentMethod = 'UNKNOWN';
    
    if (status === 'PAID' || status === 'SETTLED') {
      paymentStatus = PaymentStatus.PAID;
      paymentMethod = typeof payment_method === 'string' 
        ? payment_method 
        : (payment_method?.type || 'UNKNOWN');
    } else if (status === 'FAILED') {
      paymentStatus = PaymentStatus.FAILED;
    } else if (status === 'EXPIRED') {
      paymentStatus = PaymentStatus.EXPIRED;
    }

    // Update transaction
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentStatus,
        xenditPaymentId: external_id,
        paymentMethod: paymentMethod as 'CASH' | 'XENDIT_QRIS' | 'XENDIT_EWALLET' | 'XENDIT_VIRTUAL_ACCOUNT',
        xenditInvoiceUrl: (typeof body === 'object' && body !== null && 'invoice_url' in body) 
          ? body.invoice_url as string 
          : transaction.xenditInvoiceUrl
      }
    });

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing payment webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
