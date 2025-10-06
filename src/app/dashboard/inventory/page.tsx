'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Product {
  id: string
  name: string
  sku: string
  stock: number
  minStock: number
  category: {
    id: string
    name: string
  }
}

interface InventoryLog {
  id: string
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason: string
  createdAt: string
  product: {
    name: string
    sku: string
    category: {
      name: string
    }
  }
  createdByUser?: {
    name: string
  }
}

interface AdjustmentItem {
  productId: string
  productName: string
  currentStock: number
  newStock: number
  reason: string
}

export default function InventoryPage() {
  useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [logCurrentPage, setLogCurrentPage] = useState(1)
  const [logTotalPages, setLogTotalPages] = useState(1)

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
      })

      const response = await fetch(`/api/inventory?${params}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: logCurrentPage.toString(),
        limit: '20',
      })

      const response = await fetch(`/api/inventory/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setLogTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    if (activeTab === 'logs') {
      fetchLogs()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, selectedCategory, activeTab, logCurrentPage])

  const handleStockAdjustment = (product: Product) => {
    const adjustment: AdjustmentItem = {
      productId: product.id,
      productName: product.name,
      currentStock: product.stock,
      newStock: product.stock,
      reason: ''
    }
    setAdjustments([adjustment])
    setShowAdjustmentModal(true)
  }

  const addAdjustment = () => {
    const newAdjustment: AdjustmentItem = {
      productId: '',
      productName: '',
      currentStock: 0,
      newStock: 0,
      reason: ''
    }
    setAdjustments([...adjustments, newAdjustment])
  }

  const updateAdjustment = (index: number, field: keyof AdjustmentItem, value: string | number) => {
    const updatedAdjustments = [...adjustments]
    updatedAdjustments[index] = { ...updatedAdjustments[index], [field]: value }

    // If productId changed, find product and update name and current stock
    if (field === 'productId' && value) {
      const product = products.find(p => p.id === value)
      if (product) {
        updatedAdjustments[index].productName = product.name
        updatedAdjustments[index].currentStock = product.stock
        updatedAdjustments[index].newStock = product.stock
      }
    }

    setAdjustments(updatedAdjustments)
  }

  const removeAdjustment = (index: number) => {
    setAdjustments(adjustments.filter((_, i) => i !== index))
  }

  const submitAdjustments = async () => {
    try {
      const validAdjustments = adjustments.filter(adj =>
        adj.productId && adj.reason && adj.newStock !== adj.currentStock
      )

      if (validAdjustments.length === 0) {
        alert('No valid adjustments to submit')
        return
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adjustments: validAdjustments }),
      })

      if (response.ok) {
        alert('Stock adjustments completed successfully!')
        setShowAdjustmentModal(false)
        setAdjustments([])
        fetchProducts()
        if (activeTab === 'logs') {
          fetchLogs()
        }
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error submitting adjustments:', error)
      alert('Error submitting adjustments')
    }
  }

  const getStockStatus = (product: Product) => {
    if (product.stock <= 0) return { status: 'Out of Stock', color: 'bg-red-100 text-red-800' }
    if (product.stock <= product.minStock) return { status: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' }
    return { status: 'In Stock', color: 'bg-green-100 text-green-800' }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading && activeTab === 'overview') {
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
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Stock Adjustment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Stock Overview' },
            { id: 'logs', name: 'Inventory Logs' },
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

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Search</label>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory(''); setCurrentPage(1); }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Products Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
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
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => {
                  const stockStatus = getStockStatus(product)
                  return (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.sku}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.category.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.stock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.minStock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}>
                          {stockStatus.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleStockAdjustment(product)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {products.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No products found.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 border border-gray-300 rounded-md">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Inventory Logs Tab */}
      {activeTab === 'logs' && (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock Change
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{log.product.name}</div>
                        <div className="text-sm text-gray-500">{log.product.sku}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.type === 'SALE' ? 'bg-red-100 text-red-800' :
                        log.type.includes('ADJUSTMENT_IN') ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {log.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.previousStock} → {log.newStock}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.createdByUser?.name || 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {logs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No inventory logs found.</p>
              </div>
            )}
          </div>

          {/* Logs Pagination */}
          {logTotalPages > 1 && (
            <div className="flex justify-center">
              <div className="flex space-x-2">
                <button
                  onClick={() => setLogCurrentPage(logCurrentPage - 1)}
                  disabled={logCurrentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 border border-gray-300 rounded-md">
                  Page {logCurrentPage} of {logTotalPages}
                </span>
                <button
                  onClick={() => setLogCurrentPage(logCurrentPage + 1)}
                  disabled={logCurrentPage === logTotalPages}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Stock Adjustments
                </h3>
                <button
                  onClick={() => setShowAdjustmentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {adjustments.map((adjustment, index) => (
                  <div key={index} className="border rounded-md p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Product</label>
                        <select
                          value={adjustment.productId}
                          onChange={(e) => updateAdjustment(index, 'productId', e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="">Select Product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.stock} in stock)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">New Stock</label>
                        <input
                          type="number"
                          value={adjustment.newStock}
                          onChange={(e) => updateAdjustment(index, 'newStock', parseInt(e.target.value) || 0)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Reason</label>
                        <input
                          type="text"
                          value={adjustment.reason}
                          onChange={(e) => updateAdjustment(index, 'reason', e.target.value)}
                          placeholder="Reason for adjustment"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                    </div>
                    {adjustments.length > 1 && (
                      <div className="mt-2 text-right">
                        <button
                          onClick={() => removeAdjustment(index)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  onClick={addAdjustment}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-md font-medium"
                >
                  Add Another Adjustment
                </button>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setShowAdjustmentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAdjustments}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Submit Adjustments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
