'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface ReportData {
  overview?: {
    totalRevenue: number
    totalTransactions: number
    totalProducts: number
    lowStockCount: number
  }
  dailySales?: Array<{
    paymentStatus: string
    _sum: {
      totalAmount: number | null
      finalAmount: number | null
    }
    _count: {
      id: number
    }
  }>
  paymentMethods?: Array<{
    paymentMethod: string
    _sum: {
      finalAmount: number | null
    }
    _count: {
      id: number
    }
  }>
  topProducts?: Array<{
    productId: string
    _sum: {
      quantity: number | null
      totalPrice: number | null
    }
    _count: {
      id: number
    }
    product?: {
      id: string
      name: string
      sku: string
      category?: {
        name: string
      }
    }
  }>
  inventoryStats?: {
    _sum: {
      stock: number | null
    }
    _count: {
      id: number
    }
  }
  lowStockProducts?: Array<{
    id: string
    name: string
    sku: string
    stock: number
    minStock: number
    category: {
      name: string
    }
  }>
  revenueTrends?: Array<{
    date: string
    revenue: number
    transactions: number
    cash_transactions: number
    digital_transactions: number
  }>
}

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function ReportsPage() {
  useSession()
  const [reportData, setReportData] = useState<ReportData>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        type: activeTab,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })

      const response = await fetch(`/api/reports?${params}`)
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateRange])

  const handleExport = async (type: string, format: string) => {
    try {
      const params = new URLSearchParams({
        type,
        format,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })

      const response = await fetch(`/api/reports/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Error exporting data')
    }
  }

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(Number(amount))
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <div className="flex gap-4">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={fetchReportData}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'sales', name: 'Sales Analytics' },
            { id: 'products', name: 'Product Performance' },
            { id: 'inventory', name: 'Inventory Status' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && reportData.overview && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm">💰</span>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Revenue
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCurrency(reportData.overview.totalRevenue)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm">🧾</span>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Transactions
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {reportData.overview.totalTransactions}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm">📦</span>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Products
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {reportData.overview.totalProducts}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm">⚠️</span>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Low Stock Items
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {reportData.overview.lowStockCount}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Export Data</h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleExport('transactions', 'excel')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Export Transactions (Excel)
              </button>
              <button
                onClick={() => handleExport('transactions', 'csv')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Export Transactions (CSV)
              </button>
              <button
                onClick={() => handleExport('products', 'excel')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Export Products (Excel)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Analytics Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trends */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trends</h3>
              {reportData.revenueTrends && reportData.revenueTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData.revenueTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No data available for selected period</p>
              )}
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Methods</h3>
              {reportData.paymentMethods && reportData.paymentMethods.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={reportData.paymentMethods.map((method) => ({
                        name: method.paymentMethod,
                        value: Number(method._sum.finalAmount) || 0,
                        count: method._count.id
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => `${props.name} (${(Number(props.percent) * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {reportData.paymentMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Performance Tab */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Top Selling Products</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units Sold
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.topProducts && reportData.topProducts.length > 0 ? (
                    reportData.topProducts.map((product) => (
                      <tr key={product.productId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.product?.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {product.product?.sku}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.product?.category?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product._sum.quantity || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(Number(product._sum.totalPrice) || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No data available for selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Status Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inventory Overview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Overview</h3>
              {reportData.inventoryStats ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Products:</span>
                    <span className="font-medium">{reportData.inventoryStats._count.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Stock Value:</span>
                    <span className="font-medium">
                      {formatCurrency(Number(reportData.inventoryStats._sum.stock) * 10)} {/* Assuming average $10 cost */}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No data available</p>
              )}
            </div>

            {/* Low Stock Alert */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Low Stock Alerts</h3>
              {reportData.lowStockProducts && reportData.lowStockProducts.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {reportData.lowStockProducts.map((product) => (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-red-50 rounded-md">
                      <div>
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.category.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-600">
                          {product.stock} / {product.minStock}
                        </div>
                        <div className="text-xs text-gray-500">Need {product.minStock - product.stock} more</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-green-600 text-center py-4">All products are well stocked! 🎉</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
