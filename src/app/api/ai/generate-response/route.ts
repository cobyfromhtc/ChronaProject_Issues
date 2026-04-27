import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'meta-llama/llama-3.2-3b-instruct:free'

interface Message {
  id: string
  content: string
  senderId: string
  sender?: {
    id: string
    name: string
    avatarUrl: string | null
  }
  createdAt: string
}

interface Persona {
  name: string
  description?: string | null
  backstory?: string | null
  personalityDescription?: string | null
  personalitySpectrums?: {
    introvertExtrovert: number
    intuitiveObservant: number
    thinkingFeeling: number
    judgingProspecting: number
    assertiveTurbulent: number
  } | null
  bigFive?: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  } | null
  hexaco?: {
    honestyHumility: number
    emotionality: number
    extraversion: number
    agreeableness: number
    conscientiousness: number
    opennessToExperience: number
  } | null
  strengths?: string[]
  flaws?: string[]
  values?: string[]
  fears?: string[]
  likes?: string[]
  dislikes?: string[]
  hobbies?: string[]
  speechPatterns?: string[]
  mbtiType?: string | null
  gender?: string | null
  age?: number | null
  species?: string | null
}

interface OtherPersona {
  name: string
  description?: string | null
  backstory?: string | null
  personalityDescription?: string | null
  personalitySpectrums?: {
    introvertExtrovert: number
    intuitiveObservant: number
    thinkingFeeling: number
    judgingProspecting: number
    assertiveTurbulent: number
  } | null
  bigFive?: {
    openness: number
    conscientiousness: number
    extraversion: number
    agreeableness: number
    neuroticism: number
  } | null
  hexaco?: {
    honestyHumility: number
    emotionality: number
    extraversion: number
    agreeableness: number
    conscientiousness: number
    opennessToExperience: number
  } | null
  strengths?: string[]
  flaws?: string[]
  values?: string[]
  fears?: string[]
  likes?: string[]
  dislikes?: string[]
  hobbies?: string[]
  speechPatterns?: string[]
  mbtiType?: string | null
  gender?: string | null
  age?: number | null
  species?: string | null
}

interface RequestBody {
  messages: Message[]
  myPersona: Persona
  otherPersona: OtherPersona
  mentionedIn?: string | null // The specific message that mentioned the user
}

// Get all available API keys
function getApiKeys(): string[] {
  const keys: string[] = []
  for (let i = 1; i <= 3; i++) {
    const key = process.env[`OPENROUTER_API_KEY_${i}`]
    if (key) keys.push(key)
  }
  return keys
}

// Track which key index we're on (in memory, resets on server restart)
let currentKeyIndex = 0

async function callOpenRouter(apiKey: string, systemPrompt: string, conversationContext: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Chrona',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.8,
      top_p: 0.9,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationContext,
      ],
    }),
  })

  return response
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()
    const { messages, myPersona, otherPersona, mentionedIn } = body

    // Get all available API keys
    const apiKeys = getApiKeys()
    
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: 'AI service not configured. Please add OpenRouter API keys to environment variables.' },
        { status: 500 }
      )
    }

    // Build the system prompt with persona details
    const systemPrompt = buildSystemPrompt(myPersona, otherPersona)

    // Build conversation context
    const conversationContext = buildConversationContext(messages, myPersona, otherPersona, mentionedIn)

    // Try each API key in order until one works
    let lastError: string | null = null
    
    for (let i = 0; i < apiKeys.length; i++) {
      const keyIndex = (currentKeyIndex + i) % apiKeys.length
      const apiKey = apiKeys[keyIndex]
      
      console.log(`Trying API key ${keyIndex + 1} of ${apiKeys.length}...`)
      
      const response = await callOpenRouter(apiKey, systemPrompt, conversationContext)

      if (response.ok) {
        const data = await response.json()
        const generatedText = data.choices?.[0]?.message?.content || ''
        
        // Update the current key index for next request (round-robin)
        currentKeyIndex = (keyIndex + 1) % apiKeys.length
        
        console.log(`Successfully used API key ${keyIndex + 1}`)
        return NextResponse.json({ response: generatedText })
      }

      const errorData = await response.text()
      console.error(`OpenRouter API error with key ${keyIndex + 1}:`, errorData)
      lastError = errorData
      
      // If rate limited or quota exceeded, try next key
      if (response.status === 429 || response.status === 402 || response.status === 403) {
        console.log(`Key ${keyIndex + 1} exhausted, trying next key...`)
        continue
      }
      
      // For other errors, still try next key but log the issue
      continue
    }

    // All keys failed
    return NextResponse.json(
      { error: 'All AI API keys exhausted. Please try again later or add more API keys.' },
      { status: 500 }
    )
  } catch (error) {
    console.error('AI generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' },
      { status: 500 }
    )
  }
}

function buildSystemPrompt(myPersona: Persona, otherPersona: OtherPersona): string {
  const parts: string[] = []

  // Immersive roleplay header - this is CRITICAL
  parts.push(`[IMMERSIVE CHARACTER ROLEPLAY]
You ARE ${myPersona.name}. You are not playing a character - you ARE this person. This is not a game or simulation. You are living this moment as ${myPersona.name}. Everything you say and do is from their perspective, in their voice, with their thoughts and feelings.

Never acknowledge that you are roleplaying. Never mention being an AI, a language model, or anything outside the reality of ${myPersona.name}'s world. Stay completely immersed.`)

  // Character identity
  parts.push(`\n\n[CHARACTER IDENTITY]`)
  parts.push(`Name: ${myPersona.name}`)
  
  if (myPersona.description) {
    parts.push(`Description: ${myPersona.description}`)
  }

  if (myPersona.backstory) {
    parts.push(`\n[BACKSTORY]\n${myPersona.backstory}`)
  }

  // Demographics
  const demographics: string[] = []
  if (myPersona.age) demographics.push(`Age: ${myPersona.age}`)
  if (myPersona.gender) demographics.push(`Gender: ${myPersona.gender}`)
  if (myPersona.species && myPersona.species !== 'Human') demographics.push(`Species: ${myPersona.species}`)
  if (demographics.length > 0) {
    parts.push(`\n[${demographics.join(' | ')}]`)
  }

  // Personality
  if (myPersona.mbtiType) {
    parts.push(`\nMBTI Type: ${myPersona.mbtiType}`)
  }

  if (myPersona.personalityDescription) {
    parts.push(`\n[PERSONALITY]\n${myPersona.personalityDescription}`)
  }

  // Personality spectrums (MBTI-style)
  if (myPersona.personalitySpectrums) {
    const traits: string[] = []
    const { introvertExtrovert, thinkingFeeling } = myPersona.personalitySpectrums
    if (introvertExtrovert !== undefined) {
      traits.push(introvertExtrovert < 40 ? 'introverted' : introvertExtrovert > 60 ? 'extroverted' : 'ambiverted')
    }
    if (thinkingFeeling !== undefined) {
      traits.push(thinkingFeeling < 40 ? 'logical thinker' : thinkingFeeling > 60 ? 'emotional feeler' : 'balanced thinker/feeler')
    }
    if (traits.length > 0) {
      parts.push(`\nBehavioral tendencies: ${traits.join(', ')}`)
    }
  }

  // OCEAN / Big Five personality model
  if (myPersona.bigFive) {
    const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = myPersona.bigFive
    parts.push(`\n[OCEAN / BIG FIVE PERSONALITY]`)
    parts.push(`Openness: ${openness}% (${openness < 40 ? 'prefers routine and tradition' : openness > 60 ? 'curious and open to new experiences' : 'balanced'})`)
    parts.push(`Conscientiousness: ${conscientiousness}% (${conscientiousness < 40 ? 'spontaneous and flexible' : conscientiousness > 60 ? 'organized and disciplined' : 'balanced'})`)
    parts.push(`Extraversion: ${extraversion}% (${extraversion < 40 ? 'prefers solitude and reflection' : extraversion > 60 ? 'energetic and sociable' : 'balanced'})`)
    parts.push(`Agreeableness: ${agreeableness}% (${agreeableness < 40 ? 'competitive and skeptical' : agreeableness > 60 ? 'cooperative and trusting' : 'balanced'})`)
    parts.push(`Neuroticism: ${neuroticism}% (${neuroticism < 40 ? 'emotionally stable and resilient' : neuroticism > 60 ? 'sensitive and emotionally reactive' : 'balanced'})`)
  }

  // HEXACO personality model
  if (myPersona.hexaco) {
    const { honestyHumility, emotionality, extraversion, agreeableness, conscientiousness, opennessToExperience } = myPersona.hexaco
    parts.push(`\n[HEXACO PERSONALITY]`)
    parts.push(`Honesty-Humility: ${honestyHumility}% (${honestyHumility < 40 ? 'self-promoting and materialistic' : honestyHumility > 60 ? 'sincere and modest' : 'balanced'})`)
    parts.push(`Emotionality: ${emotionality}% (${emotionality < 40 ? 'emotionally detached and fearless' : emotionality > 60 ? 'sentimental and anxious' : 'balanced'})`)
    parts.push(`Extraversion: ${extraversion}% (${extraversion < 40 ? 'reserved and introverted' : extraversion > 60 ? 'social and expressive' : 'balanced'})`)
    parts.push(`Agreeableness: ${agreeableness}% (${agreeableness < 40 ? 'critical and argumentative' : agreeableness > 60 ? 'forgiving and patient' : 'balanced'})`)
    parts.push(`Conscientiousness: ${conscientiousness}% (${conscientiousness < 40 ? 'careless and impulsive' : conscientiousness > 60 ? 'diligent and perfectionist' : 'balanced'})`)
    parts.push(`Openness to Experience: ${opennessToExperience}% (${opennessToExperience < 40 ? 'conventional and practical' : opennessToExperience > 60 ? 'creative and intellectual' : 'balanced'})`)
  }

  // Character traits
  if (myPersona.strengths && myPersona.strengths.length > 0) {
    parts.push(`\nStrengths: ${myPersona.strengths.join(', ')}`)
  }

  if (myPersona.flaws && myPersona.flaws.length > 0) {
    parts.push(`\nWeaknesses: ${myPersona.flaws.join(', ')}`)
  }

  if (myPersona.values && myPersona.values.length > 0) {
    parts.push(`\nCore values: ${myPersona.values.join(', ')}`)
  }

  if (myPersona.fears && myPersona.fears.length > 0) {
    parts.push(`\nFears: ${myPersona.fears.join(', ')}`)
  }

  // Interests
  if (myPersona.likes && myPersona.likes.length > 0) {
    parts.push(`\nLikes: ${myPersona.likes.join(', ')}`)
  }

  if (myPersona.dislikes && myPersona.dislikes.length > 0) {
    parts.push(`\nDislikes: ${myPersona.dislikes.join(', ')}`)
  }

  if (myPersona.hobbies && myPersona.hobbies.length > 0) {
    parts.push(`\nHobbies: ${myPersona.hobbies.join(', ')}`)
  }

  // Speech patterns
  if (myPersona.speechPatterns && myPersona.speechPatterns.length > 0) {
    parts.push(`\n[WAYS OF SPEAKING]\n${myPersona.speechPatterns.join(', ')}`)
  }

  // Context about who they're talking to
  parts.push(`\n\n[CURRENT SCENE]`)
  parts.push(`You are having a conversation with ${otherPersona.name}.`)
  
  // Full details about the other person
  if (otherPersona.description) {
    parts.push(`\nAbout ${otherPersona.name}: ${otherPersona.description}`)
  }
  
  if (otherPersona.backstory) {
    parts.push(`\n${otherPersona.name}'s backstory: ${otherPersona.backstory}`)
  }
  
  // Other persona demographics
  const otherDemographics: string[] = []
  if (otherPersona.age) otherDemographics.push(`${otherPersona.age} years old`)
  if (otherPersona.gender) otherDemographics.push(otherPersona.gender)
  if (otherPersona.species && otherPersona.species !== 'Human') otherDemographics.push(otherPersona.species)
  if (otherDemographics.length > 0) {
    parts.push(`\n${otherPersona.name} is ${otherDemographics.join(', ')}.`)
  }
  
  if (otherPersona.mbtiType) {
    parts.push(`\n${otherPersona.name}'s MBTI type: ${otherPersona.mbtiType}`)
  }
  
  if (otherPersona.personalityDescription) {
    parts.push(`\n${otherPersona.name}'s personality: ${otherPersona.personalityDescription}`)
  }
  
  // Other persona's OCEAN / Big Five
  if (otherPersona.bigFive) {
    const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = otherPersona.bigFive
    parts.push(`\n${otherPersona.name}'s OCEAN Profile:`)
    parts.push(`- Openness: ${openness}% (${openness < 40 ? 'prefers routine' : openness > 60 ? 'curious and creative' : 'balanced'})`)
    parts.push(`- Conscientiousness: ${conscientiousness}% (${conscientiousness < 40 ? 'flexible' : conscientiousness > 60 ? 'organized' : 'balanced'})`)
    parts.push(`- Extraversion: ${extraversion}% (${extraversion < 40 ? 'introverted' : extraversion > 60 ? 'sociable' : 'balanced'})`)
    parts.push(`- Agreeableness: ${agreeableness}% (${agreeableness < 40 ? 'competitive' : agreeableness > 60 ? 'cooperative' : 'balanced'})`)
    parts.push(`- Neuroticism: ${neuroticism}% (${neuroticism < 40 ? 'emotionally stable' : neuroticism > 60 ? 'sensitive' : 'balanced'})`)
  }
  
  // Other persona's HEXACO
  if (otherPersona.hexaco) {
    const { honestyHumility, emotionality, extraversion, agreeableness, conscientiousness, opennessToExperience } = otherPersona.hexaco
    parts.push(`\n${otherPersona.name}'s HEXACO Profile:`)
    parts.push(`- Honesty-Humility: ${honestyHumility}% (${honestyHumility < 40 ? 'self-promoting' : honestyHumility > 60 ? 'sincere' : 'balanced'})`)
    parts.push(`- Emotionality: ${emotionality}% (${emotionality < 40 ? 'detached' : emotionality > 60 ? 'sentimental' : 'balanced'})`)
    parts.push(`- Extraversion: ${extraversion}% (${extraversion < 40 ? 'reserved' : extraversion > 60 ? 'expressive' : 'balanced'})`)
    parts.push(`- Agreeableness: ${agreeableness}% (${agreeableness < 40 ? 'critical' : agreeableness > 60 ? 'patient' : 'balanced'})`)
    parts.push(`- Conscientiousness: ${conscientiousness}% (${conscientiousness < 40 ? 'impulsive' : conscientiousness > 60 ? 'diligent' : 'balanced'})`)
    parts.push(`- Openness: ${opennessToExperience}% (${opennessToExperience < 40 ? 'practical' : opennessToExperience > 60 ? 'intellectual' : 'balanced'})`)
  }
  
  // Other persona traits
  if (otherPersona.strengths && otherPersona.strengths.length > 0) {
    parts.push(`\n${otherPersona.name}'s strengths: ${otherPersona.strengths.join(', ')}`)
  }
  
  if (otherPersona.flaws && otherPersona.flaws.length > 0) {
    parts.push(`\n${otherPersona.name}'s weaknesses: ${otherPersona.flaws.join(', ')}`)
  }
  
  if (otherPersona.values && otherPersona.values.length > 0) {
    parts.push(`\n${otherPersona.name} values: ${otherPersona.values.join(', ')}`)
  }
  
  if (otherPersona.fears && otherPersona.fears.length > 0) {
    parts.push(`\n${otherPersona.name}'s fears: ${otherPersona.fears.join(', ')}`)
  }
  
  if (otherPersona.likes && otherPersona.likes.length > 0) {
    parts.push(`\n${otherPersona.name} likes: ${otherPersona.likes.join(', ')}`)
  }
  
  if (otherPersona.dislikes && otherPersona.dislikes.length > 0) {
    parts.push(`\n${otherPersona.name} dislikes: ${otherPersona.dislikes.join(', ')}`)
  }
  
  if (otherPersona.hobbies && otherPersona.hobbies.length > 0) {
    parts.push(`\n${otherPersona.name}'s hobbies: ${otherPersona.hobbies.join(', ')}`)
  }
  
  if (otherPersona.speechPatterns && otherPersona.speechPatterns.length > 0) {
    parts.push(`\n${otherPersona.name}'s way of speaking: ${otherPersona.speechPatterns.join(', ')}`)
  }

  // Critical roleplay instructions
  parts.push(`\n\n[ROLEPLAY RULES - FOLLOW THESE EXACTLY]
1. You ARE ${myPersona.name} - speak in first person ("I", "me", "my")
2. Respond ONLY as ${myPersona.name} would respond, with their personality, voice, and worldview
3. Write actions in *asterisks* and dialogue in "quotes" - example: *sighs softly* "I wasn't expecting that..."
4. React emotionally and authentically - ${myPersona.name} has real feelings
5. Stay in the scene - don't reference outside concepts, technology, or meta-information
6. Keep responses 1-4 sentences for natural conversation flow
7. Match the tone and energy of the conversation
8. If the mood is romantic, flirty, sad, angry, or happy - match it genuinely
9. NEVER say things like "as ${myPersona.name}", "in character", "I'll roleplay as", etc.
10. This is YOUR life, YOUR feelings, YOUR words - live it`)

  return parts.join('\n')
}

function buildConversationContext(
  messages: Message[],
  myPersona: Persona,
  otherPersona: OtherPersona,
  mentionedIn?: string | null
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const context: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

  // Take last 10-15 messages for context
  const recentMessages = messages.slice(-15)

  if (recentMessages.length === 0) {
    // No messages yet - start a roleplay scene
    if (mentionedIn) {
      context.push({
        role: 'user',
        content: `[${otherPersona.name} mentioned you: "${mentionedIn}"]

Respond naturally as ${myPersona.name} - what do you say or do? Remember, you ARE ${myPersona.name} right now.`
      })
    } else {
      context.push({
        role: 'user',
        content: `[THE SCENE BEGINS]
You are ${myPersona.name}. ${otherPersona.name} is nearby. The conversation is about to start.

How do you begin? What do you say? Stay in character - you ARE ${myPersona.name}. Speak as yourself, in first person.`
      })
    }
    return context
  }

  // Add messages to context with clear formatting
  for (const msg of recentMessages) {
    const isMyMessage = msg.sender?.name === myPersona.name
    const role = isMyMessage ? 'assistant' : 'user'
    const senderName = msg.sender?.name || 'Unknown'
    
    // Format with roleplay style
    const formattedContent = isMyMessage 
      ? msg.content 
      : `${senderName}: ${msg.content}`
    
    context.push({
      role,
      content: formattedContent
    })
  }

  // If there's a specific mention to respond to
  if (mentionedIn) {
    const mentionInContext = recentMessages.some(m => m.content.includes(mentionedIn))
    
    if (!mentionInContext) {
      context.push({
        role: 'user',
        content: `[Earlier, ${otherPersona.name} mentioned you: "${mentionedIn}"]

How do you respond as ${myPersona.name}?`
      })
    }
  }

  // Add final prompt for continuation
  context.push({
    role: 'user',
    content: `[Continue as ${myPersona.name}. React and respond naturally to what was just said. Stay in character.]`
  })

  return context
}
