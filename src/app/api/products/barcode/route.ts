import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode is required' },
        { status: 400 }
      )
    }

    // Find product by barcode
    const product = await prisma.product.findFirst({
      where: {
        barcode: barcode,
        isActive: true
      },
      include: {
        category: true
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if product is in stock
    if (product.stock <= 0) {
      return NextResponse.json({
        product,
        message: 'Product found but out of stock'
      })
    }

    return NextResponse.json({
      product,
      message: 'Product found and in stock'
    })

  } catch (error) {
    console.error('Error scanning barcode:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
