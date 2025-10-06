'use client'

import { useRef } from 'react'

interface ReceiptItem {
  id: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: {
    id: string
    name: string
    sku: string
  }
}

interface ReceiptData {
  id: string
  transactionNumber: string
  totalAmount: number
  taxAmount: number
  discountAmount: number
  finalAmount: number
  paymentMethod: string
  paymentStatus: string
  createdAt: string
  cashier: {
    id: string
    name: string
  }
  items: ReceiptItem[]
}

interface ReceiptPreviewProps {
  transaction: ReceiptData
  onClose: () => void
  showPrintButton?: boolean
}

export default function ReceiptPreview({ transaction, onClose, showPrintButton = true }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Shared styles for consistent rendering
  const getSharedStyles = () => `
    @page { size: A4; margin: 20mm; }
    body { 
      font-family: 'Courier New', monospace; 
      font-size: 12px; 
      margin: 0; 
      padding: 20px; 
      background: white;
    }
    .receipt-container {
      max-width: 400px;
      margin: 0 auto;
      background: white;
      padding: 20px;
    }
    .header { 
      text-align: center; 
      margin-bottom: 20px; 
    }
    .store-name { 
      font-size: 24px; 
      font-weight: bold; 
      margin-bottom: 8px;
      color: #000;
    }
    .store-info { 
      font-size: 11px; 
      color: #666; 
      line-height: 1.6;
    }
    .divider { 
      border: none;
      border-top: 2px dashed #000; 
      margin: 15px 0; 
    }
    .info-row { 
      display: flex; 
      justify-content: space-between; 
      margin: 8px 0;
      font-size: 12px;
      color: #000;
    }
    .info-label { 
      font-weight: bold; 
    }
    .items-section {
      margin: 15px 0;
    }
    .items-title {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 10px;
      color: #000;
    }
    .item-row { 
      margin: 10px 0;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }
    .item-name { 
      font-weight: bold; 
      font-size: 12px;
      color: #000;
      margin-bottom: 4px;
    }
    .item-sku {
      font-size: 10px;
      color: #666;
      margin-bottom: 4px;
    }
    .item-calc { 
      display: flex; 
      justify-content: space-between; 
      font-size: 11px; 
      color: #000;
    }
    .item-calc-bold {
      font-weight: bold;
    }
    .total-row { 
      display: flex; 
      justify-content: space-between; 
      margin: 8px 0;
      font-size: 13px;
      color: #000;
    }
    .discount-text {
      color: #dc2626;
    }
    .grand-total { 
      font-size: 18px; 
      font-weight: bold; 
      margin: 15px 0;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #000;
    }
    .footer { 
      text-align: center; 
      margin-top: 20px; 
      font-size: 11px;
      color: #666;
      line-height: 1.8;
    }
    .footer-bold {
      font-weight: bold;
      margin-bottom: 8px;
      color: #000;
    }
    .footer-small {
      font-size: 9px;
      margin-top: 12px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: bold;
    }
    .status-paid { 
      background: #d1fae5; 
      color: #065f46; 
    }
    .status-pending { 
      background: #fef3c7; 
      color: #92400e; 
    }
    @media print {
      body { 
        padding: 0; 
      }
      .receipt-container { 
        box-shadow: none;
        padding: 20px;
      }
    }
  `

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow && receiptRef.current) {
      const receiptHTML = receiptRef.current.innerHTML
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt - ${transaction.transactionNumber}</title>
          <style>
            ${getSharedStyles()}
          </style>
        </head>
        <body>
          ${receiptHTML}
        </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      // Use browser's print to PDF functionality
      const printWindow = window.open('', '_blank')
      if (printWindow && receiptRef.current) {
        const receiptHTML = receiptRef.current.innerHTML
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Receipt - ${transaction.transactionNumber}</title>
            <style>
              ${getSharedStyles()}
            </style>
          </head>
          <body>
            ${receiptHTML}
          </body>
          </html>
        `)
        printWindow.document.close()
        
        // Trigger print dialog which allows saving as PDF
        setTimeout(() => {
          printWindow.print()
        }, 250)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Receipt Preview</h3>
            <p className="text-sm text-gray-600 mt-1">{transaction.transactionNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="p-6 bg-gray-50 max-h-[60vh] overflow-y-auto">
          <style dangerouslySetInnerHTML={{ __html: getSharedStyles() }} />
          <div ref={receiptRef} className="receipt-container">
            {/* Store Header */}
            <div className="header">
              <div className="store-name">TokoKu Store</div>
              <div className="store-info">
                <div>Jl. Example No. 123</div>
                <div>Tel: 021-12345678</div>
                <div>Email: info@tokoku.com</div>
              </div>
            </div>

            <div className="divider"></div>

            {/* Transaction Info */}
            <div>
              <div className="info-row">
                <span className="info-label">Transaction #:</span>
                <span>{transaction.transactionNumber}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Date:</span>
                <span>{formatDate(transaction.createdAt)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Cashier:</span>
                <span>{transaction.cashier.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Payment:</span>
                <span>{transaction.paymentMethod}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className={`status-badge ${
                  transaction.paymentStatus === 'PAID' ? 'status-paid' : 'status-pending'
                }`}>
                  {transaction.paymentStatus}
                </span>
              </div>
            </div>

            <div className="divider"></div>

            {/* Items */}
            <div className="items-section">
              <div className="items-title">ITEMS</div>
              {transaction.items.map((item) => (
                <div key={item.id} className="item-row">
                  <div className="item-name">{item.product.name}</div>
                  <div className="item-sku">SKU: {item.product.sku}</div>
                  <div className="item-calc">
                    <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                    <span className="item-calc-bold">{formatCurrency(item.totalPrice)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="divider"></div>

            {/* Totals */}
            <div>
              <div className="total-row">
                <span>Subtotal:</span>
                <span>{formatCurrency(transaction.totalAmount)}</span>
              </div>
              <div className="total-row">
                <span>Tax:</span>
                <span>{formatCurrency(transaction.taxAmount)}</span>
              </div>
              <div className="total-row">
                <span>Discount:</span>
                <span className="discount-text">-{formatCurrency(transaction.discountAmount)}</span>
              </div>
            </div>

            <div className="divider"></div>

            {/* Grand Total */}
            <div className="grand-total">
              <span>TOTAL:</span>
              <span>{formatCurrency(transaction.finalAmount)}</span>
            </div>

            {/* Footer */}
            <div className="footer">
              <div className="footer-bold">Thank you for your purchase!</div>
              <div>Please come again</div>
              <div className="footer-small">
                This is a computer-generated receipt
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        {showPrintButton && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Receipt
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
