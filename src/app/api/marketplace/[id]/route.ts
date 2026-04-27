import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, getSessionFromRequest } from '@/lib/auth';

// GET - Get single marketplace listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionFromRequest(request);

    const listing = await db.marketplacePersona.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        persona: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            description: true,
            gender: true,
            pronouns: true,
            age: true,
            species: true,
            archetype: true,
            personalityDescription: true,
            personalitySpectrums: true,
            strengths: true,
            flaws: true,
            values: true,
            fears: true,
            likes: true,
            dislikes: true,
            hobbies: true,
            skills: true,
            languages: true,
            habits: true,
            speechPatterns: true,
            backstory: true,
            appearance: true,
            mbtiType: true,
            bigFive: true,
            tags: true,
          },
        },
        _count: {
          select: { purchases: true },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Check if current user has purchased this
    let hasPurchased = false;
    if (user) {
      const purchase = await db.marketplacePurchase.findUnique({
        where: {
          marketplacePersonaId_buyerId: {
            marketplacePersonaId: id,
            buyerId: user.id,
          },
        },
      });
      hasPurchased = !!purchase;
    }

    // Check if current user is the creator
    const isOwner = user?.id === listing.creatorId;

    return NextResponse.json({
      listing: {
        ...listing,
        purchaseCount: listing._count.purchases,
        hasPurchased,
        isOwner,
        // Only show full persona details if purchased, free, or owner
        showFullDetails: hasPurchased || listing.price === 0 || isOwner,
      },
    });
  } catch (error) {
    console.error('Marketplace get error:', error);
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 });
  }
}

// PUT - Update marketplace listing
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const listing = await db.marketplacePersona.findUnique({
      where: { id },
    });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.creatorId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to edit this listing' }, { status: 403 });
    }

    const body = await request.json();
    const { description, tags, price, isActive, notifyOnPurchase } = body;

    // Validate price (max 430)
    const listingPrice = price !== undefined ? Math.min(Math.max(0, parseInt(price) || 0), 430) : listing.price;

    const updatedListing = await db.marketplacePersona.update({
      where: { id },
      data: {
        description: description ?? listing.description,
        tags: tags ?? listing.tags,
        price: listingPrice,
        isActive: isActive ?? listing.isActive,
        notifyOnPurchase: notifyOnPurchase !== undefined ? notifyOnPurchase : listing.notifyOnPurchase,
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

    return NextResponse.json({ listing: updatedListing });
  } catch (error) {
    console.error('Marketplace update error:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}

// DELETE - Remove marketplace listing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const listing = await db.marketplacePersona.findUnique({
      where: { id },
    });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.creatorId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this listing' }, { status: 403 });
    }

    await db.marketplacePersona.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Marketplace delete error:', error);
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}
