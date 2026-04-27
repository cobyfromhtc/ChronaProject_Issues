import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, getSessionFromRequest } from '@/lib/auth';
import { isMinor } from '@/lib/age-utils';

// GET - List marketplace personas
export async function GET(request: NextRequest) {
  try {
    // Get current user if authenticated
    const user = await getSessionFromRequest(request);
    
    // Age-gating: Check if user is a minor for NSFW filtering
    let isUserMinor = true // Default to minor (safe) if not authenticated
    if (user) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { dateOfBirth: true }
      })
      isUserMinor = isMinor(dbUser?.dateOfBirth ?? null)
    }
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tag = searchParams.get('tag') || '';
    const sortBy = searchParams.get('sortBy') || 'newest';
    const priceMin = parseInt(searchParams.get('priceMin') || '0');
    const priceMax = parseInt(searchParams.get('priceMax') || '430');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
    };

    // Price filter
    if (priceMin > 0 || priceMax < 430) {
      where.price = {
        gte: priceMin,
        lte: priceMax,
      };
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    // Tag filter
    if (tag) {
      where.tags = { contains: tag };
    }

    // Sorting
    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'popular') {
      orderBy = { downloads: 'desc' };
    } else if (sortBy === 'price_low') {
      orderBy = { price: 'asc' };
    } else if (sortBy === 'price_high') {
      orderBy = { price: 'desc' };
    }

    const [listings, total] = await Promise.all([
      db.marketplacePersona.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              dateOfBirth: true,
            },
          },
          persona: {
            select: {
              nsfwEnabled: true,
            },
          },
          _count: {
            select: { purchases: true },
          },
        },
      }),
      db.marketplacePersona.count({ where }),
    ]);

    // Get user's purchases if authenticated
    let userPurchases: string[] = [];
    if (user) {
      const purchases = await db.marketplacePurchase.findMany({
        where: { buyerId: user.id },
        select: { marketplacePersonaId: true },
      });
      userPurchases = purchases.map(p => p.marketplacePersonaId);
    }

    // Age-gating: Filter out NSFW marketplace personas for minors
    const filteredListings = isUserMinor
      ? listings.filter((l) => {
          // Filter out NSFW-enabled personas
          if (l.persona?.nsfwEnabled) return false
          return true
        })
      : listings

    return NextResponse.json({
      listings: filteredListings.map((l) => ({
        ...l,
        purchaseCount: l._count.purchases,
        isOwner: user ? l.creatorId === user.id : false,
        hasPurchased: userPurchases.includes(l.id),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Marketplace list error:', error);
    return NextResponse.json({ error: 'Failed to fetch marketplace' }, { status: 500 });
  }
}

// POST - Publish a persona to marketplace
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { personaId, description, tags, price, notifyOnPurchase } = body;

    // Validate price (max 430)
    const listingPrice = Math.min(Math.max(0, parseInt(price) || 0), 430);

    // Check if persona exists and belongs to user
    const persona = await db.persona.findFirst({
      where: {
        id: personaId,
        userId: user.id,
      },
    });

    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Check if already listed
    const existingListing = await db.marketplacePersona.findUnique({
      where: { personaId },
    });

    if (existingListing) {
      return NextResponse.json({ error: 'Persona already listed on marketplace' }, { status: 400 });
    }

    // Create marketplace listing
    const listing = await db.marketplacePersona.create({
      data: {
        personaId,
        creatorId: user.id,
        name: persona.name,
        avatarUrl: persona.avatarUrl,
        description: description || persona.description,
        tags: tags || persona.tags,
        price: listingPrice,
        notifyOnPurchase: notifyOnPurchase !== false, // Default to true
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ listing });
  } catch (error) {
    console.error('Marketplace publish error:', error);
    return NextResponse.json({ error: 'Failed to publish to marketplace' }, { status: 500 });
  }
}
