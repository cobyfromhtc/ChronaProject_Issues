'use client'

import { useEffect, useCallback } from 'react'
import { usePersonaStore, Persona, PersonaConnection, PersonalitySpectrums, transformPersona } from '@/stores/persona-store'
import { useAuthStore } from '@/stores/auth-store'
import { apiFetch } from '@/lib/api-client'

// Full persona data type for creation/update
export interface PersonaFormData {
  // Overview
  name: string
  avatarUrl?: string | null
  description?: string | null
  archetype?: string | null
  gender?: string | null
  age?: number | null
  tags?: string[]
  
  // Personality
  personalityDescription?: string | null
  personalitySpectrums?: PersonalitySpectrums
  strengths?: string[]
  flaws?: string[]
  values?: string[]
  fears?: string[]
  
  // Attributes
  species?: string | null
  likes?: string[]
  dislikes?: string[]
  hobbies?: string[]
  skills?: string[]
  languages?: string[]
  habits?: string[]
  speechPatterns?: string[]
  
  // Backstory
  backstory?: string | null
  appearance?: string | null
  
  // MBTI
  mbtiType?: string | null
  
  // Connections
  connections?: {
    characterName: string
    relationshipType: string
    specificRole?: string | null
    characterAge?: number | null
    description?: string | null
  }[]
}

export function usePersonas() {
  const { 
    personas, 
    activePersona, 
    isLoading, 
    setPersonas, 
    addPersona, 
    updatePersona, 
    removePersona, 
    setActivePersona, 
    setLoading 
  } = usePersonaStore()
  
  const { isAuthenticated } = useAuthStore()
  
  // Fetch personas on mount or when auth state changes
  useEffect(() => {
    async function fetchPersonas() {
      if (!isAuthenticated) {
        setPersonas([])
        return
      }
      
      try {
        const response = await apiFetch('/api/personas')
        
        if (response.ok) {
          const data = await response.json()
          const transformedPersonas = data.personas.map(transformPersona)
          setPersonas(transformedPersonas)
        } else {
          setPersonas([])
        }
      } catch (error) {
        console.error('Failed to fetch personas:', error)
        setPersonas([])
      }
    }
    
    fetchPersonas()
  }, [isAuthenticated, setPersonas])
  
  // Create a new persona with all fields
  const createPersona = useCallback(async (data: PersonaFormData): Promise<Persona> => {
    const response = await apiFetch('/api/personas', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    
    const responseData = await response.json()
    
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to create persona')
    }
    
    const transformedPersona = transformPersona(responseData.persona)
    addPersona(transformedPersona)
    return transformedPersona
  }, [addPersona])
  
  // Update a persona with all fields
  const updatePersonaById = useCallback(async (id: string, updates: Partial<PersonaFormData>): Promise<Persona> => {
    const response = await apiFetch(`/api/personas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update persona')
    }
    
    const transformedPersona = transformPersona(data.persona)
    updatePersona(id, transformedPersona)
    return transformedPersona
  }, [updatePersona])
  
  // Delete a persona
  const deletePersona = useCallback(async (id: string) => {
    const response = await apiFetch(`/api/personas/${id}`, {
      method: 'DELETE',
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete persona')
    }
    
    removePersona(id)
  }, [removePersona])
  
  // Activate a persona
  const activatePersona = useCallback(async (id: string) => {
    const response = await apiFetch(`/api/personas/${id}/activate`, {
      method: 'POST',
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to activate persona')
    }
    
    const transformedPersona = transformPersona(data.persona)
    setActivePersona(transformedPersona)
    return transformedPersona
  }, [setActivePersona])
  
  // Upload avatar
  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiFetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload avatar')
    }
    
    return data.url || data.avatarUrl
  }, [])
  
  // Fetch a single persona by ID
  const fetchPersona = useCallback(async (id: string): Promise<Persona> => {
    const response = await apiFetch(`/api/personas/${id}`)
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch persona')
    }
    
    return transformPersona(data.persona)
  }, [])
  
  // Add a connection to a persona
  const addConnection = useCallback(async (personaId: string, connection: {
    characterName: string
    relationshipType: string
    specificRole?: string | null
    characterAge?: number | null
    description?: string | null
  }): Promise<PersonaConnection> => {
    const response = await apiFetch(`/api/personas/${personaId}/connections`, {
      method: 'POST',
      body: JSON.stringify(connection),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add connection')
    }
    
    return data.connection
  }, [])
  
  // Update a connection
  const updateConnection = useCallback(async (personaId: string, connectionId: string, updates: Partial<{
    characterName: string
    relationshipType: string
    specificRole: string | null
    characterAge: number | null
    description: string | null
  }>): Promise<PersonaConnection> => {
    const response = await apiFetch(`/api/personas/${personaId}/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update connection')
    }
    
    return data.connection
  }, [])
  
  // Delete a connection
  const deleteConnection = useCallback(async (personaId: string, connectionId: string) => {
    const response = await apiFetch(`/api/personas/${personaId}/connections/${connectionId}`, {
      method: 'DELETE',
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete connection')
    }
  }, [])
  
  return {
    personas,
    activePersona,
    isLoading,
    createPersona,
    updatePersona: updatePersonaById,
    deletePersona,
    activatePersona,
    uploadAvatar,
    fetchPersona,
    addConnection,
    updateConnection,
    deleteConnection,
  }
}
