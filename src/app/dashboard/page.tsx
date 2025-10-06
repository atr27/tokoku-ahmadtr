'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

interface DashboardStats {
  totalProducts: number
  totalTransactions: number
  totalRevenue: number
  lowStockProducts: number
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
  })
  // Remove unused loading state since we're not using it
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch dashboard statistics
    const fetchStats = async () => {
      try {
        setIsLoading(true)
        const statsRes = await fetch('/api/dashboard/stats')
        
        if (!statsRes.ok) throw new Error('Failed to fetch dashboard stats')
        
        // Try to fetch sales data, but don't fail if it's not available
        let salesData = { totalRevenue: 0 }
        try {
          const salesRes = await fetch('/api/sales/summary')
          if (salesRes.ok) {
            salesData = await salesRes.json()
          }
        } catch (salesError) {
          console.warn('Could not fetch sales data:', salesError)
        }
        
        const statsData = await statsRes.json()
        
        // Ensure we have valid numbers
        const totalProducts = Number(statsData.totalProducts) || 0;
        const totalTransactions = Number(statsData.totalTransactions) || 0;
        const lowStockProducts = Number(statsData.lowStockProducts) || 0;
        const totalRevenue = Number(salesData.totalRevenue) || 0;
        
        setStats({
          totalProducts,
          totalTransactions,
          totalRevenue,
          lowStockProducts,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
        console.error('Error in DashboardPage:', errorMessage);
        
        // Set default values on error
        setStats({
          totalProducts: 0,
          totalTransactions: 0,
          totalRevenue: 0,
          lowStockProducts: 0,
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats()
    
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000)
    
    // Clean up interval on component unmount
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-gray-600">Loading dashboard data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, {session?.user?.name}! 👋
            </h1>
            <p className="text-blue-100 text-lg">
              Here&apos;s what&apos;s happening with your store today.
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-6xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📦</span>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
              {stats.totalProducts ? `+${((stats.totalProducts / (stats.totalProducts - stats.lowStockProducts)) * 100).toFixed(2)}%` : 'Loading...'}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Total Products
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalProducts ? stats.totalProducts.toLocaleString() : 'Loading...'}
            </p>
          </div>
        </div>

        {/* Total Revenue Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">💰</span>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
              +23%
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Total Revenue
            </p>
            <div className="flex items-baseline">
              <p className="text-3xl font-bold text-gray-900">
                {new Intl.NumberFormat('id-ID', { 
                  style: 'currency', 
                  currency: 'IDR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                }).format(stats.totalRevenue).replace('IDR', 'Rp')}
              </p>
            </div>
          </div>
        </div>

        {/* Total Transactions Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🧾</span>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
              +8%
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Total Transactions
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalTransactions.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Low Stock Items Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">⚠️</span>
            </div>
            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
              Alert
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Low Stock Items
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {stats.lowStockProducts}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/dashboard/pos" className="group block">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-5 rounded-xl font-medium transition-all shadow-md hover:shadow-lg h-full">
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-lg font-semibold">New Sale</span>
                </div>
              </div>
            </a>
            <a href="/dashboard/products" className="group block">
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-5 rounded-xl font-medium transition-all shadow-md hover:shadow-lg h-full">
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-lg font-semibold">Add Product</span>
                </div>
              </div>
            </a>
            <a href="/dashboard/reports" className="group block">
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-5 rounded-xl font-medium transition-all shadow-md hover:shadow-lg h-full">
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-lg font-semibold">View Reports</span>
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Sales Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Today&apos;s Sales</h2>
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Sales Count</p>
                <p className="text-2xl font-bold text-gray-900">47</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xl">🛒</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(3240)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-xl">💵</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
          <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
            View All
          </button>
        </div>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-xl">🛍️</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">New transaction completed</p>
                </div>
                <span className="text-sm text-gray-400">2 min ago</span>
              </div>
              <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-xl">📦</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Product added to inventory</p>
                  <p className="text-sm text-gray-500">New product &quot;Premium Coffee Beans&quot; added</p>
                </div>
                <span className="text-sm text-gray-400">15 min ago</span>
              </div>
              <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-xl">⚠️</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">Low stock alert</p>
                  <p className="text-sm text-gray-500">Product &quot;Organic Tea&quot; is running low</p>
                </div>
                <span className="text-sm text-gray-400">1 hour ago</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
