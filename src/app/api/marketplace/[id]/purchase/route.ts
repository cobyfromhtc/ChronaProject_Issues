import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendBlorpMessage, ensureBlorpExists } from '@/lib/blorp';

// POST - Purchase a persona from marketplace
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the listing
    const listing = await db.marketplacePersona.findUnique({
      where: { id },
      include: {
        persona: true,
        creator: true,
      },
    });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (!listing.isActive) {
      return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 });
    }

    // Can't purchase your own listing
    if (listing.creatorId === user.id) {
      return NextResponse.json({ error: 'Cannot purchase your own listing' }, { status: 400 });
    }

    // Check if already purchased
    const existingPurchase = await db.marketplacePurchase.findUnique({
      where: {
        marketplacePersonaId_buyerId: {
          marketplacePersonaId: id,
          buyerId: user.id,
        },
      },
    });

    if (existingPurchase) {
      return NextResponse.json({ error: 'You already own this persona' }, { status: 400 });
    }

    // Check if user has enough Chronos
    const buyer = await db.user.findUnique({
      where: { id: user.id },
      select: { chronos: true },
    });

    if (!buyer || buyer.chronos < listing.price) {
      return NextResponse.json({ 
        error: `Not enough Chronos. You need ${listing.price} Chronos.` 
      }, { status: 400 });
    }

    // Calculate creator earnings:
    // - If price > 120: 15% platform fee (85% to creator)
    // - If price <= 120: 10% platform fee (90% to creator)
    const platformFeeRate = listing.price > 120 ? 0.15 : 0.10;
    const creatorEarnings = Math.floor(listing.price * (1 - platformFeeRate));

    // Start transaction
    const result = await db.$transaction(async (tx) => {
      // Deduct Chronos from buyer
      const updatedBuyer = await tx.user.update({
        where: { id: user.id },
        data: {
          chronos: { decrement: listing.price },
        },
      });

      // Add Chronos to creator (if price > 0)
      if (creatorEarnings > 0) {
        await tx.user.update({
          where: { id: listing.creatorId },
          data: {
            chronos: { increment: creatorEarnings },
          },
        });

        // Record transaction for buyer
        await tx.chronosTransaction.create({
          data: {
            userId: user.id,
            amount: -listing.price,
            balance: updatedBuyer.chronos,
            type: 'spend',
            category: 'marketplace_purchase',
            description: `Purchased "${listing.name}" from marketplace`,
            referenceId: listing.id,
          },
        });

        // Record transaction for creator
        await tx.chronosTransaction.create({
          data: {
            userId: listing.creatorId,
            amount: creatorEarnings,
            balance: 0, // We don't track creator's balance here for simplicity
            type: 'earn',
            category: 'marketplace_sale',
            description: `Sold "${listing.name}" on marketplace`,
            referenceId: listing.id,
          },
        });
      }

      // Copy the persona for the buyer (keeping displayId and originalCreatorId)
      const originalPersona = listing.persona;
      const copiedPersona = await tx.persona.create({
        data: {
          userId: user.id,
          displayId: originalPersona.displayId, // Keep the same display ID
          originalCreatorId: originalPersona.originalCreatorId || originalPersona.userId, // Preserve original creator
          name: originalPersona.name,
          avatarUrl: originalPersona.avatarUrl,
          description: originalPersona.description,
          archetype: originalPersona.archetype,
          gender: originalPersona.gender,
          pronouns: originalPersona.pronouns,
          age: originalPersona.age,
          tags: originalPersona.tags,
          personalityDescription: originalPersona.personalityDescription,
          personalitySpectrums: originalPersona.personalitySpectrums,
          strengths: originalPersona.strengths,
          flaws: originalPersona.flaws,
          values: originalPersona.values,
          fears: originalPersona.fears,
          species: originalPersona.species,
          likes: originalPersona.likes,
          dislikes: originalPersona.dislikes,
          hobbies: originalPersona.hobbies,
          skills: originalPersona.skills,
          languages: originalPersona.languages,
          habits: originalPersona.habits,
          speechPatterns: originalPersona.speechPatterns,
          backstory: originalPersona.backstory,
          appearance: originalPersona.appearance,
          mbtiType: originalPersona.mbtiType,
          bigFive: originalPersona.bigFive,
          rpStyle: originalPersona.rpStyle,
          rpPreferredGenders: originalPersona.rpPreferredGenders,
          rpGenres: originalPersona.rpGenres,
          rpLimits: originalPersona.rpLimits,
          rpThemes: originalPersona.rpThemes,
          rpExperienceLevel: originalPersona.rpExperienceLevel,
          rpResponseTime: originalPersona.rpResponseTime,
        },
      });

      // Record the purchase
      const purchase = await tx.marketplacePurchase.create({
        data: {
          marketplacePersonaId: id,
          buyerId: user.id,
          pricePaid: listing.price,
          creatorEarnings,
          copiedPersonaId: copiedPersona.id,
        },
      });

      // Update listing stats
      await tx.marketplacePersona.update({
        where: { id },
        data: {
          downloads: { increment: 1 },
          revenue: { increment: creatorEarnings },
        },
      });

      return { purchase, copiedPersona };
    });

    // Send Blorp messages (async, don't block response)
    ensureBlorpExists().then(() => {
      // Message to buyer
      sendBlorpMessage(user.id, {
        type: 'marketplace_purchase',
        personaName: listing.name,
        price: listing.price,
      }).catch(err => console.error('Failed to send Blorp message to buyer:', err));

      // Message to seller (if they opted in to notifications)
      if (listing.notifyOnPurchase) {
        sendBlorpMessage(listing.creatorId, {
          type: 'marketplace_sale',
          personaName: listing.name,
          price: listing.price,
          earnings: creatorEarnings > 0 ? creatorEarnings : 0,
        }).catch(err => console.error('Failed to send Blorp message to seller:', err));
      }
    });

    return NextResponse.json({
      success: true,
      purchase: result.purchase,
      copiedPersona: result.copiedPersona,
      newBalance: result.purchase.pricePaid > 0 ? 
        (await db.user.findUnique({ where: { id: user.id }, select: { chronos: true } }))?.chronos : 
        buyer.chronos,
    });
  } catch (error) {
    console.error('Marketplace purchase error:', error);
    return NextResponse.json({ error: 'Failed to complete purchase' }, { status: 500 });
  }
}
