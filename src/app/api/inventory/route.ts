import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ProductWhereInput } from '@/types/prisma'
import { notifyInventoryUpdate, notifyLowStock } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const lowStock = searchParams.get('lowStock') === 'true'

    const skip = (page - 1) * limit

    const where: ProductWhereInput = {
      isActive: true,
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) {
      where.categoryId = category
    }

    if (lowStock) {
      where.stock = {
        lte: prisma.product.fields.minStock
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { adjustments } = body

    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json(
        { error: 'Adjustments array is required' },
        { status: 400 }
      )
    }

    const results = []

    for (const adjustment of adjustments) {
      const { productId, newStock, reason } = adjustment

      if (!productId || typeof newStock !== 'number' || !reason) {
        return NextResponse.json(
          { error: 'Product ID, new stock, and reason are required for each adjustment' },
          { status: 400 }
        )
      }

      // Get current product
      const product = await prisma.product.findUnique({
        where: { id: productId }
      })

      if (!product) {
        return NextResponse.json(
          { error: `Product ${productId} not found` },
          { status: 404 }
        )
      }

      const previousStock = product.stock
      const stockDifference = newStock - previousStock

      // Update product stock
      await prisma.product.update({
        where: { id: productId },
        data: {
          stock: newStock
        }
      })

      // Create inventory log
      await prisma.inventoryLog.create({
        data: {
          productId,
          type: stockDifference > 0 ? 'RESTOCK' : 'ADJUSTMENT',
          quantity: Math.abs(stockDifference),
          previousStock,
          newStock,
          reason,
          createdBy: session.user.id
        }
      })

      // Notify about inventory update
      const updateType = stockDifference > 0 ? 'RESTOCK' : 'ADJUSTMENT'
      await notifyInventoryUpdate(
        session.user.id,
        product.name,
        Math.abs(stockDifference),
        updateType
      )

      // Check for low stock and notify
      if (newStock <= product.minStock) {
        await notifyLowStock(session.user.id, product.name, newStock)
      }

      results.push({
        productId,
        previousStock,
        newStock,
        stockDifference
      })
    }

    return NextResponse.json({
      success: true,
      adjustments: results
    })

  } catch (error) {
    console.error('Error adjusting inventory:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
