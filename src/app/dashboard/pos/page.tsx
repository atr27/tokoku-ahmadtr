'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import ReceiptPreview from '@/components/ReceiptPreview'

interface Product {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  minStock?: number
  category: {
    id: string
    name: string
  }
  image?: string
  barcode?: string
}

interface CompletedTransaction {
  id: string
  transactionNumber: string
  totalAmount: number
  taxAmount: number
  discountAmount: number
  finalAmount: number
  paymentMethod: string
  paymentStatus: string
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    unitPrice: number
    totalPrice: number
    product: {
      id: string
      name: string
      sku: string
      category: {
        id: string
        name: string
      }
    }
  }>
  cashier: {
    id: string
    name: string
  }
}

function POSPageContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCart, setShowCart] = useState(false)
  const [cart, setCart] = useState<{ product: Product; quantity: number; unitPrice: number; totalPrice: number }[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [clickedProductId, setClickedProductId] = useState<string | null>(null)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState<CompletedTransaction | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products?limit=100')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  const fetchTransactionAndShowReceipt = useCallback(async (transactionId: string) => {
    try {
      const checkResponse = await fetch('/api/payments/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId }),
      })

      if (checkResponse.ok) {
        const { transaction, status } = await checkResponse.json()
        
        console.log('Payment status checked:', status)
        
        if (status === 'PAID') {
          setCompletedTransaction(transaction)
          setShowReceiptPreview(true)
        } else if (status === 'PENDING') {
          alert('Payment is still pending. Please wait for confirmation.')
        } else {
          alert(`Payment status: ${status}`)
        }
      } else {
        const response = await fetch(`/api/transactions/${transactionId}`)
        if (response.ok) {
          const transaction = await response.json()
          setCompletedTransaction(transaction)
          setShowReceiptPreview(true)
        } else {
          console.error('Failed to fetch transaction')
        }
      }
    } catch (error) {
      console.error('Error fetching transaction:', error)
      alert('Error checking payment status')
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    
    // Check for payment success/failure from Xendit redirect
    const paymentStatus = searchParams.get('payment')
    const transactionId = searchParams.get('transaction_id')
    
    if (paymentStatus === 'success' && transactionId) {
      // Fetch the transaction and show receipt
      fetchTransactionAndShowReceipt(transactionId)
      // Clean up URL
      router.replace('/dashboard/pos')
    } else if (paymentStatus === 'failed') {
      alert('Payment failed or was cancelled')
      router.replace('/dashboard/pos')
    }
  }, [fetchProducts, fetchCategories, searchParams, router, fetchTransactionAndShowReceipt])

  useEffect(() => {
    // Filter products based on search and category
    let filtered = products

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchTerm))
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(product => product.category.id === selectedCategory)
    }

    // Sort products: Food items first, then drinks
    // Drink categories typically include: Coffee, Tea, Juice, Soft Drink, Smoothie, etc.
    const drinkCategories = ['Coffee', 'Tea', 'Juice', 'Soft Drink', 'Smoothie', 'Beverage']
    filtered = filtered.sort((a, b) => {
      const aIsDrink = drinkCategories.some(cat => 
        a.category.name.toLowerCase().includes(cat.toLowerCase())
      )
      const bIsDrink = drinkCategories.some(cat => 
        b.category.name.toLowerCase().includes(cat.toLowerCase())
      )
      
      // Food items (non-drinks) come first
      if (!aIsDrink && bIsDrink) return -1
      if (aIsDrink && !bIsDrink) return 1
      
      // If both are same type, sort by name
      return a.name.localeCompare(b.name)
    })

    setFilteredProducts(filtered)
  }, [products, searchTerm, selectedCategory])


  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert('Product is out of stock')
      return
    }

    // Trigger animation
    setClickedProductId(product.id)
    setTimeout(() => setClickedProductId(null), 600)

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id)

      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          alert('Not enough stock available')
          return prevCart
        }

        return prevCart.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.unitPrice
              }
            : item
        )
      } else {
        return [...prevCart, {
          product,
          quantity: 1,
          unitPrice: Number(product.price),
          totalPrice: Number(product.price)
        }]
      }
    })
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    const product = products.find(p => p.id === productId)
    if (!product || newQuantity > product.stock) {
      alert('Not enough stock available')
      return
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice: newQuantity * item.unitPrice
            }
          : item
      )
    )
  }

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId))
  }

  const clearCart = () => {
    if (confirm('Are you sure you want to clear the cart?')) {
      setCart([])
    }
  }

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0)
  }

  const processSale = async (selectedPaymentMethod?: string) => {
    if (cart.length === 0) {
      alert('Cart is empty')
      return
    }

    if (!session?.user?.id) {
      alert('You must be logged in to process a sale')
      return
    }

    const method = selectedPaymentMethod || 'CASH'

    if (method === 'CASH') {
      // Process cash payment immediately
      try {
        const transactionData = {
          totalAmount: calculateTotal(),
          taxAmount: 0,
          discountAmount: 0,
          finalAmount: calculateTotal(),
          paymentMethod: method,
          paymentStatus: 'PAID',
          cashierId: session.user.id,
          items: cart.map(item => ({
            productId: item.product.id,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice)
          }))
        }

        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData),
        })

        if (response.ok) {
          const transaction = await response.json()
          setCart([])
          setCompletedTransaction(transaction)
          setShowReceiptPreview(true)
          fetchProducts() // Refresh products to update stock
        } else {
          const error = await response.json()
          const errorMessage = error.error || 'Unknown error occurred'
          alert(`Error processing sale: ${errorMessage}`)
          
          // If it's an auth issue, suggest re-login
          if (errorMessage.includes('cashier ID') || errorMessage.includes('log in')) {
            console.error('Session issue detected. User may need to re-login.')
          }
        }
      } catch (error) {
        console.error('Error processing sale:', error)
        alert('Error processing sale. Please check your connection and try again.')
      }
    }
  }

  const scanBarcode = async (barcode?: string) => {
    const barcodeToScan = barcode || barcodeInput

    if (!barcodeToScan.trim()) {
      alert('Please enter a barcode')
      return
    }

    try {
      const response = await fetch(`/api/products/barcode?barcode=${encodeURIComponent(barcodeToScan)}`)

      if (response.ok) {
        const data = await response.json()
        if (data.product) {
          addToCart(data.product)
          setBarcodeInput('')
        } else {
          alert(data.message || 'Product not found')
        }
      } else {
        alert('Error scanning barcode')
      }
    } catch (error) {
      console.error('Error scanning barcode:', error)
      alert('Error scanning barcode')
    }
  }

  // Uncomment when print functionality is needed
  // const printReceipt = async (transactionId: string, format = 'html') => {
  //   try {
  //     const response = await fetch(`/api/receipts?transactionId=${transactionId}&format=${format}`)
  //
  //     if (response.ok) {
  //       if (format === 'thermal') {
  //         const receiptText = await response.text()
  //         const printWindow = window.open('', '_blank')
  //         if (printWindow) {
  //           printWindow.document.write('<pre>' + receiptText + '</pre>')
  //           printWindow.document.close()
  //           printWindow.print()
  //         }
  //       } else {
  //         const receiptHTML = await response.text()
  //         const printWindow = window.open('', '_blank')
  //         if (printWindow) {
  //           printWindow.document.write(receiptHTML)
  //           printWindow.document.close()
  //           printWindow.print()
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error printing receipt:', error)
  //     alert('Error printing receipt')
  //   }
  // }

  const processDigitalPayment = async (selectedMethod: string) => {
    if (cart.length === 0) {
      alert('Cart is empty')
      return
    }

    if (!session?.user?.id) {
      alert('You must be logged in to process a payment')
      return
    }

    setPaymentLoading(true)

    try {
      // Use default customer info
      const defaultCustomerName = session.user.name || 'Customer'
      const defaultCustomerEmail = session.user.email || 'customer@example.com'

      // Step 1: Create transaction
      const transactionData = {
        totalAmount: calculateTotal(),
        taxAmount: 0,
        discountAmount: 0,
        finalAmount: calculateTotal(),
        paymentMethod: selectedMethod,
        paymentStatus: 'PENDING',
        cashierId: session.user.id,
        customerName: defaultCustomerName,
        customerEmail: defaultCustomerEmail,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice)
        }))
      }

      const transactionResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      })

      if (!transactionResponse.ok) {
        const error = await transactionResponse.json()
        alert(`Error creating transaction: ${error.error}`)
        return
      }

      const transaction = await transactionResponse.json()

      // Step 2: Create Xendit payment
      const paymentData = {
        amount: calculateTotal(),
        paymentMethod: selectedMethod,
        customerName: defaultCustomerName,
        customerEmail: defaultCustomerEmail,
        transactionId: transaction.id
      }

      const paymentResponse = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      })

      if (!paymentResponse.ok) {
        const error = await paymentResponse.json()
        alert(`Error creating payment: ${error.error}`)
        return
      }

      const paymentResult = await paymentResponse.json()

      // Step 3: Update transaction with Xendit payment details
      if (paymentResult.payment) {
        // Xendit v7 uses camelCase for property names
        const invoiceUrl = paymentResult.payment.invoiceUrl || 
                          paymentResult.payment.invoice_url || 
                          paymentResult.payment.checkout_url || 
                          paymentResult.payment.qr_string
        
        const paymentId = paymentResult.payment.id || 
                         paymentResult.payment.externalId ||
                         paymentResult.payment.external_id

        await fetch(`/api/transactions/${transaction.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            xenditPaymentId: paymentId,
            xenditInvoiceUrl: invoiceUrl
          }),
        })
      }

      // Step 4: Redirect to Xendit payment page
      setCart([])
      
      // Redirect to Xendit payment page if available (check both camelCase and snake_case)
      const redirectUrl = paymentResult.payment?.invoiceUrl || 
                         paymentResult.payment?.invoice_url || 
                         paymentResult.payment?.checkout_url
      
      if (redirectUrl) {
        window.location.href = redirectUrl
      } else {
        console.error('Payment response:', paymentResult.payment)
        alert('Payment created but no payment URL available. Check console for details.')
      }

      fetchProducts() // Refresh products to update stock
    } catch (error) {
      console.error('Error processing digital payment:', error)
      alert('Error processing digital payment')
    } finally {
      setPaymentLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col">
        {/* Search and Filters */}
        <div className="bg-white p-4 shadow-sm border-b">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search products by name, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Scan barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    scanBarcode()
                  }
                }}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => scanBarcode()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Scan
              </button>
            </div>
            <div className="text-sm text-gray-600">
              {filteredProducts.length} products
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className={`relative bg-white rounded-lg shadow-md p-4 cursor-pointer transition-all duration-300 ${
                  product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:scale-105'
                } ${
                  clickedProductId === product.id
                    ? 'animate-pulse bg-gradient-to-br from-green-100 to-blue-100 scale-95 shadow-2xl ring-4 ring-green-400'
                    : ''
                }`}
              >
                {product.image && (
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={400}
                    height={128}
                    className="w-full h-32 object-cover rounded-md mb-3"
                  />
                )}
                <h3 className="font-medium text-sm mb-1 truncate">{product.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{product.category.name}</p>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-indigo-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(product.price))}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    product.stock <= (product.minStock || 5)
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {product.stock} left
                  </span>
                </div>
                {product.stock <= 0 && (
                  <div className="text-xs text-red-600 font-medium mt-1">Out of Stock</div>
                )}
                {clickedProductId === product.id && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-bounce shadow-lg">
                    +1 ✓
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No products found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-lg transform transition-transform z-30 ${
        showCart ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Current Sale</h2>
          <button
            onClick={() => setShowCart(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Cart is empty</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.product.name}</h4>
                    <p className="text-xs text-gray-500">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="ml-3 text-right">
                    <p className="font-medium">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.totalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Total:</span>
              <span className="text-xl font-bold text-indigo-600">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(calculateTotal())}
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => processSale('CASH')}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-medium"
              >
                Cash Payment - Complete Sale
              </button>
              <button
                onClick={() => processDigitalPayment('XENDIT_QRIS')}
                disabled={paymentLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-medium disabled:opacity-50"
              >
                {paymentLoading ? 'Processing...' : 'Pay with Xendit'}
              </button>
              <button
                onClick={clearCart}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-md font-medium"
              >
                Clear Cart
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cart Toggle Button */}
      <button
        onClick={() => setShowCart(!showCart)}
        className={`fixed bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg z-40 transition-all duration-300 ${
          clickedProductId ? 'scale-110 bg-green-600 ring-4 ring-green-300' : ''
        }`}
      >
        🛒 ({cart.length})
      </button>

      {/* Receipt Preview Modal */}
      {showReceiptPreview && completedTransaction && (
        <ReceiptPreview
          transaction={completedTransaction}
          onClose={() => {
            setShowReceiptPreview(false)
            setCompletedTransaction(null)
          }}
        />
      )}
    </div>
  )
}

export default function POSPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <POSPageContent />
    </Suspense>
  )
}
