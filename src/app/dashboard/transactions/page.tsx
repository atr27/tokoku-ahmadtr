'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import ReceiptPreview from '@/components/ReceiptPreview'

interface Transaction {
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
  items: Array<{
    id: string
    quantity: number
    unitPrice: number
    totalPrice: number
    product: {
      id: string
      name: string
      sku: string
    }
  }>
}

export default function TransactionsPage() {
  useSession()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null)

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
      })

      const response = await fetch(`/api/transactions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm])

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(Number(amount))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const checkPaymentStatus = async (transactionId: string) => {
    try {
      const response = await fetch('/api/payments/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId }),
      })

      if (response.ok) {
        const { status } = await response.json()
        alert(`Payment status updated: ${status}`)
        fetchTransactions() // Refresh the list
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
      alert('Error checking payment status')
    }
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)

      // Fetch all transactions (without pagination)
      const response = await fetch('/api/transactions?limit=1000')
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }

      const data = await response.json()
      const transactions = data.transactions

      if (transactions.length === 0) {
        alert('No transactions to export')
        return
      }

      // Convert to CSV
      const csvContent = convertToCSV(transactions)

      // Download CSV file
      downloadCSV(csvContent, 'transactions.csv')
    } catch (error) {
      console.error('Error exporting transactions:', error)
      alert('Error exporting transactions')
    } finally {
      setIsExporting(false)
    }
  }

  const convertToCSV = (transactions: Transaction[]) => {
    const headers = [
      'Transaction Number',
      'Date & Time',
      'Cashier',
      'Payment Method',
      'Payment Status',
      'Total Amount',
      'Tax Amount',
      'Discount Amount',
      'Final Amount',
      'Items'
    ]

    const rows = transactions.map(transaction => [
      transaction.transactionNumber,
      formatDate(transaction.createdAt),
      transaction.cashier.name,
      transaction.paymentMethod,
      transaction.paymentStatus,
      transaction.totalAmount.toString(),
      transaction.taxAmount.toString(),
      transaction.discountAmount.toString(),
      transaction.finalAmount.toString(),
      transaction.items.map(item => `${item.product.name} (${item.quantity}x)`).join('; ')
    ])

    const csvString = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    return csvString
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
            <p className="text-sm text-gray-500 mt-1">View and manage all your transactions</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-80 px-4 py-2.5 pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`px-4 py-2.5 text-white text-sm font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 ${
                isExporting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Exporting...
                </>
              ) : (
                'Export'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Transaction #
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Cashier
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-blue-600 text-xs font-bold">#</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {transaction.transactionNumber}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(transaction.createdAt).split(',')[0]}</div>
                    <div className="text-xs text-gray-500">{formatDate(transaction.createdAt).split(',')[1]}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-2">
                        <span className="text-white text-xs font-semibold">
                          {transaction.cashier.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{transaction.cashier.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-2 ${
                        transaction.paymentMethod === 'CASH' ? 'bg-green-100' :
                        transaction.paymentMethod === 'CARD' ? 'bg-blue-100' :
                        'bg-purple-100'
                      }`}>
                        <span className="text-xs">
                          {transaction.paymentMethod === 'CASH' ? '💵' :
                           transaction.paymentMethod === 'CARD' ? '💳' : '📱'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900">{transaction.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                      transaction.paymentStatus === 'PAID'
                        ? 'bg-green-100 text-green-700'
                        : transaction.paymentStatus === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        transaction.paymentStatus === 'PAID' ? 'bg-green-500' :
                        transaction.paymentStatus === 'PENDING' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></span>
                      {transaction.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(transaction.finalAmount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {transaction.paymentStatus === 'PENDING' && transaction.paymentMethod !== 'CASH' && (
                        <button
                          onClick={() => checkPaymentStatus(transaction.id)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Check payment status"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Sync
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedTransaction(transaction)}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {transactions.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No transactions found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
          <div className="text-sm text-gray-600">
            Showing page <span className="font-semibold text-gray-900">{currentPage}</span> of <span className="font-semibold text-gray-900">{totalPages}</span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Transaction Details
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTransaction.transactionNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Transaction Info */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Transaction Info
                  </h4>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <dt className="text-sm font-medium text-gray-600">Date & Time</dt>
                      <dd className="text-sm font-semibold text-gray-900">{formatDate(selectedTransaction.createdAt)}</dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <dt className="text-sm font-medium text-gray-600">Cashier</dt>
                      <dd className="text-sm font-semibold text-gray-900">{selectedTransaction.cashier.name}</dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <dt className="text-sm font-medium text-gray-600">Payment Method</dt>
                      <dd className="text-sm font-semibold text-gray-900">{selectedTransaction.paymentMethod}</dd>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <dt className="text-sm font-medium text-gray-600">Status</dt>
                      <dd>
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                          selectedTransaction.paymentStatus === 'PAID'
                            ? 'bg-green-100 text-green-700'
                            : selectedTransaction.paymentStatus === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            selectedTransaction.paymentStatus === 'PAID' ? 'bg-green-500' :
                            selectedTransaction.paymentStatus === 'PENDING' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></span>
                          {selectedTransaction.paymentStatus}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Payment Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Payment Summary
                  </h4>
                  <dl className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-blue-200">
                      <dt className="text-sm font-medium text-gray-600">Subtotal</dt>
                      <dd className="text-sm font-semibold text-gray-900">{formatCurrency(selectedTransaction.totalAmount)}</dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-200">
                      <dt className="text-sm font-medium text-gray-600">Tax</dt>
                      <dd className="text-sm font-semibold text-gray-900">{formatCurrency(selectedTransaction.taxAmount)}</dd>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-200">
                      <dt className="text-sm font-medium text-gray-600">Discount</dt>
                      <dd className="text-sm font-semibold text-red-600">-{formatCurrency(selectedTransaction.discountAmount)}</dd>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-white rounded-lg px-3 mt-2">
                      <dt className="text-base font-bold text-gray-900">Total Amount</dt>
                      <dd className="text-lg font-bold text-blue-600">{formatCurrency(selectedTransaction.finalAmount)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Items ({selectedTransaction.items.length})
                </h4>
                <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {selectedTransaction.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-4 hover:bg-white transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 text-lg">📦</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.product.name}</p>
                            <p className="text-sm text-gray-500">SKU: {item.product.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </p>
                          <p className="text-base font-bold text-gray-900">
                            {formatCurrency(item.totalPrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setReceiptTransaction(selectedTransaction)
                  setShowReceiptPreview(true)
                }}
                className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {showReceiptPreview && receiptTransaction && (
        <ReceiptPreview
          transaction={receiptTransaction}
          onClose={() => {
            setShowReceiptPreview(false)
            setReceiptTransaction(null)
          }}
        />
      )}
    </div>
  )
}
