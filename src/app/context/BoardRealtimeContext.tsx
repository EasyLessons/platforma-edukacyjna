/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        BOARD REALTIME CONTEXT
 *                   Synchronizacja Tablicy w Czasie Rzeczywistym
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 CEL:
 * Ten Context zarządza synchronizacją tablicy między użytkownikami w czasie rzeczywistym.
 * Używa Supabase Realtime (Broadcast + Presence) do:
 * - Synchronizacji elementów (rysunki, kształty, teksty)
 * - Śledzenia użytkowników online
 * - Pokazywania kursorów innych użytkowników
 * 
 * 📡 TECHNOLOGIA:
 * - Supabase Broadcast → wysyłanie zmian do innych użytkowników
 * - Supabase Presence → śledzenie kto jest online
 * 
 * 📦 UŻYWANE W:
 * - WhiteboardCanvas.tsx → główny komponent tablicy
 * - layout.tsx → opakowuje stronę /tablica
 * 
 * 🔄 JAK TO DZIAŁA:
 * 1. User A rysuje → wysyła event przez Broadcast
 * 2. User B odbiera event → dodaje element do swojej tablicy
 * 3. User C wchodzi → widzi listę online users (Presence)
 */

'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode
} from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { DrawingElement } from '@/app/tablica/whiteboard/types'

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Użytkownik online na tablicy
 */
interface OnlineUser {
  user_id: number
  username: string
  online_at: string
  cursor_x?: number // Opcjonalnie: pozycja kursora
  cursor_y?: number
  viewport_x?: number // 🆕 Viewport pozycja
  viewport_y?: number
  viewport_scale?: number
}

/**
 * Kursor innego użytkownika
 */
export interface RemoteCursor {
  userId: number
  username: string
  x: number
  y: number
  color: string
  lastUpdate: number
}

/**
 * Typy eventów synchronizacji
 */
type BoardEvent =
  | { type: 'element-created'; element: DrawingElement; userId: number; username: string }
  | { type: 'element-updated'; element: DrawingElement; userId: number; username: string }
  | { type: 'element-deleted'; elementId: string; userId: number; username: string }
  | { type: 'elements-batch'; elements: DrawingElement[]; userId: number; username: string }
  | { type: 'cursor-moved'; x: number; y: number; userId: number; username: string }

/**
 * Context Type
 */
interface BoardRealtimeContextType {
  // Użytkownicy online
  onlineUsers: OnlineUser[]
  isConnected: boolean
  
  // 🆕 Kursory innych użytkowników
  remoteCursors: RemoteCursor[]
  
  // Synchronizacja elementów
  broadcastElementCreated: (element: DrawingElement) => Promise<void>
  broadcastElementUpdated: (element: DrawingElement) => Promise<void>
  broadcastElementDeleted: (elementId: string) => Promise<void>
  broadcastElementsBatch: (elements: DrawingElement[]) => Promise<void>
  
  // Kursor
  broadcastCursorMove: (x: number, y: number) => Promise<void>
  
  // Handlery dla przychodzących eventów
  onRemoteElementCreated: (handler: (element: DrawingElement, userId: number, username: string) => void) => void
  onRemoteElementUpdated: (handler: (element: DrawingElement, userId: number, username: string) => void) => void
  onRemoteElementDeleted: (handler: (elementId: string, userId: number, username: string) => void) => void
  onRemoteElementsBatch: (handler: (elements: DrawingElement[], userId: number, username: string) => void) => void
  onRemoteCursorMove: (handler: (x: number, y: number, userId: number, username: string) => void) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎁 CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const BoardRealtimeContext = createContext<BoardRealtimeContextType | undefined>(undefined)

// ═══════════════════════════════════════════════════════════════════════════
// 📦 PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * BoardRealtimeProvider - Manager synchronizacji tablicy
 * 
 * PARAMETRY:
 * - boardId: ID tablicy (string)
 * - children: Komponenty które będą miały dostęp
 * 
 * UŻYCIE:
 * <BoardRealtimeProvider boardId="123">
 *   <WhiteboardCanvas />
 * </BoardRealtimeProvider>
 */
export function BoardRealtimeProvider({
  boardId,
  children
}: {
  boardId: string
  children: ReactNode
}) {
  // ───────────────────────────────────────────────────────────────────────
  // STANY
  // ───────────────────────────────────────────────────────────────────────
  
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  const { user } = useAuth()
  
  // Kolory dla kursorów (cyklicznie przydzielane)
  const cursorColors = useRef(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'])
  
  // Handlery dla eventów (refs żeby uniknąć re-renderów)
  const elementCreatedHandlerRef = useRef<((element: DrawingElement, userId: number, username: string) => void) | null>(null)
  const elementUpdatedHandlerRef = useRef<((element: DrawingElement, userId: number, username: string) => void) | null>(null)
  const elementDeletedHandlerRef = useRef<((elementId: string, userId: number, username: string) => void) | null>(null)
  const elementsBatchHandlerRef = useRef<((elements: DrawingElement[], userId: number, username: string) => void) | null>(null)
  const cursorMoveHandlerRef = useRef<((x: number, y: number, userId: number, username: string) => void) | null>(null)
  
  // ───────────────────────────────────────────────────────────────────────
  // POŁĄCZENIE Z SUPABASE
  // ───────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!user || !boardId) return
    
    console.log(`🔌 Łączenie z kanałem tablicy: board:${boardId}`)
    
    // Utwórz kanał dla tej tablicy
    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { ack: false }, // Bez potwierdzenia (szybsze)
        presence: { key: user.id.toString() }
      }
    })
    
    // ═══════════════════════════════════════════════════════════════════════
    // 👥 PRESENCE - Śledzenie użytkowników online
    // ═══════════════════════════════════════════════════════════════════════
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const usersMap = new Map<number, OnlineUser>() // Deduplikacja przez Map
        
        // Konwertuj state na listę użytkowników (bez duplikatów)
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            const onlineUser = presence as OnlineUser
            // Zachowaj tylko jednego użytkownika z danym user_id (najnowszy)
            usersMap.set(onlineUser.user_id, onlineUser)
          })
        })
        
        // Konwertuj Map na Array
        const users = Array.from(usersMap.values())
        
        setOnlineUsers(users)
        console.log(`👥 Użytkownicy online (${users.length}):`, users.map(u => u.username))
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('🟢 Użytkownik dołączył:', newPresences)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('🔴 Użytkownik wyszedł:', leftPresences)
        // Usuń kursory użytkowników którzy wyszli
        const leftUserIds = leftPresences.map((p: any) => p.user_id)
        setRemoteCursors(prev => prev.filter(c => !leftUserIds.includes(c.userId)))
      })
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 BROADCAST - Synchronizacja elementów
    // ═══════════════════════════════════════════════════════════════════════
    
    channel
      .on('broadcast', { event: 'element-created' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-created' }
        
        // Ignoruj własne eventy (już mamy lokalnie)
        if (userId === user.id) return
        
        console.log(`📥 Otrzymano element-created od ${username}:`, element.id)
        
        // Wywołaj handler (jeśli zarejestrowany)
        if (elementCreatedHandlerRef.current) {
          elementCreatedHandlerRef.current(element, userId, username)
        }
      })
      .on('broadcast', { event: 'element-updated' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-updated' }
        
        if (userId === user.id) return
        
        console.log(`📥 Otrzymano element-updated od ${username}:`, element.id)
        
        if (elementUpdatedHandlerRef.current) {
          elementUpdatedHandlerRef.current(element, userId, username)
        }
      })
      .on('broadcast', { event: 'element-deleted' }, ({ payload }) => {
        const { elementId, userId, username } = payload as BoardEvent & { type: 'element-deleted' }
        
        if (userId === user.id) return
        
        console.log(`📥 Otrzymano element-deleted od ${username}:`, elementId)
        
        if (elementDeletedHandlerRef.current) {
          elementDeletedHandlerRef.current(elementId, userId, username)
        }
      })
      .on('broadcast', { event: 'elements-batch' }, ({ payload }) => {
        const { elements, userId, username } = payload as BoardEvent & { type: 'elements-batch' }
        
        if (userId === user.id) return
        
        console.log(`📥 Otrzymano elements-batch od ${username}: ${elements.length} elementów`)
        
        if (elementsBatchHandlerRef.current) {
          elementsBatchHandlerRef.current(elements, userId, username)
        }
      })
      .on('broadcast', { event: 'cursor-moved' }, ({ payload }) => {
        const { x, y, userId, username } = payload as BoardEvent & { type: 'cursor-moved' }
        
        if (userId === user.id) return
        
        // Automatycznie aktualizuj remote cursors
        setRemoteCursors(prev => {
          const existing = prev.find(c => c.userId === userId)
          const color = existing?.color || cursorColors.current[userId % cursorColors.current.length]
          
          if (existing) {
            return prev.map(c => 
              c.userId === userId 
                ? { ...c, x, y, lastUpdate: Date.now() }
                : c
            )
          } else {
            return [...prev, { userId, username, x, y, color, lastUpdate: Date.now() }]
          }
        })
        
        if (cursorMoveHandlerRef.current) {
          cursorMoveHandlerRef.current(x, y, userId, username)
        }
      })
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🚀 SUBSKRYPCJA
    // ═══════════════════════════════════════════════════════════════════════
    
    let presenceHeartbeat: NodeJS.Timeout | null = null
    
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        console.log('✅ Połączono z kanałem tablicy')
        
        // Wyślij swoją obecność (Presence) z viewport
        const trackPresence = async (viewport?: { x: number; y: number; scale: number }) => {
          const presenceData: any = {
            user_id: user.id,
            username: user.username,
            online_at: new Date().toISOString()
          }
          
          // Dodaj viewport jeśli jest dostępny
          if (viewport) {
            presenceData.viewport_x = viewport.x
            presenceData.viewport_y = viewport.y
            presenceData.viewport_scale = viewport.scale
          }
          
          await channel.track(presenceData)
        }
        
        await trackPresence()
        
        // Funkcja do update viewport (może być wywołana z zewnątrz)
        ;(window as any).__updateViewportPresence = (x: number, y: number, scale: number) => {
          trackPresence({ x, y, scale })
        }
        
        // Heartbeat co 15 sekund żeby utrzymać obecność
        presenceHeartbeat = setInterval(() => trackPresence(), 15000)
      } else if (status === 'CHANNEL_ERROR') {
        setIsConnected(false)
        console.error('❌ Błąd połączenia z kanałem')
      } else if (status === 'TIMED_OUT') {
        setIsConnected(false)
        console.error('⏰ Timeout połączenia z kanałem')
      }
    })
    
    channelRef.current = channel
    
    // ═══════════════════════════════════════════════════════════════════════
    // ⏰ CLEANUP NIEAKTYWNYCH KURSORÓW - WYŁĄCZONY
    // ═══════════════════════════════════════════════════════════════════════
    // Kursory są czyszczone tylko gdy użytkownik opuści tablicę (presence.leave)
    // Nie używamy timeoutu bo kursor ma być widoczny cały czas gdy user jest online
    
    // const cursorCleanupInterval = setInterval(() => {
    //   const now = Date.now()
    //   const CURSOR_TIMEOUT = 600000 // 10 minut
    //   setRemoteCursors(prev => prev.filter(c => now - c.lastUpdate < CURSOR_TIMEOUT))
    // }, 60000)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🧹 CLEANUP
    // ═══════════════════════════════════════════════════════════════════════
    
    return () => {
      console.log('🔌 Rozłączanie z kanału tablicy')
      if (presenceHeartbeat) clearInterval(presenceHeartbeat)
      channel.unsubscribe()
      // clearInterval(cursorCleanupInterval)
      setIsConnected(false)
      setRemoteCursors([])
    }
  }, [boardId, user])
  
  // ───────────────────────────────────────────────────────────────────────
  // FUNKCJE BROADCAST (wysyłanie do innych użytkowników)
  // ───────────────────────────────────────────────────────────────────────
  
  const broadcastElementCreated = useCallback(async (element: DrawingElement) => {
    if (!channelRef.current || !user) return
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'element-created',
      payload: {
        element,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  const broadcastElementUpdated = useCallback(async (element: DrawingElement) => {
    if (!channelRef.current || !user) return
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'element-updated',
      payload: {
        element,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  const broadcastElementDeleted = useCallback(async (elementId: string) => {
    if (!channelRef.current || !user) return
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'element-deleted',
      payload: {
        elementId,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  const broadcastElementsBatch = useCallback(async (elements: DrawingElement[]) => {
    if (!channelRef.current || !user) return
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'elements-batch',
      payload: {
        elements,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  const broadcastCursorMove = useCallback(async (x: number, y: number) => {
    if (!channelRef.current || !user) return
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'cursor-moved',
      payload: {
        x,
        y,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  // ───────────────────────────────────────────────────────────────────────
  // REJESTRACJA HANDLERÓW (dla komponentów)
  // ───────────────────────────────────────────────────────────────────────
  
  const onRemoteElementCreated = useCallback((handler: (element: DrawingElement, userId: number, username: string) => void) => {
    elementCreatedHandlerRef.current = handler
  }, [])
  
  const onRemoteElementUpdated = useCallback((handler: (element: DrawingElement, userId: number, username: string) => void) => {
    elementUpdatedHandlerRef.current = handler
  }, [])
  
  const onRemoteElementDeleted = useCallback((handler: (elementId: string, userId: number, username: string) => void) => {
    elementDeletedHandlerRef.current = handler
  }, [])
  
  const onRemoteElementsBatch = useCallback((handler: (elements: DrawingElement[], userId: number, username: string) => void) => {
    elementsBatchHandlerRef.current = handler
  }, [])
  
  const onRemoteCursorMove = useCallback((handler: (x: number, y: number, userId: number, username: string) => void) => {
    cursorMoveHandlerRef.current = handler
  }, [])
  
  // ───────────────────────────────────────────────────────────────────────
  // PROVIDER
  // ───────────────────────────────────────────────────────────────────────
  
  return (
    <BoardRealtimeContext.Provider
      value={{
        onlineUsers,
        isConnected,
        remoteCursors,
        broadcastElementCreated,
        broadcastElementUpdated,
        broadcastElementDeleted,
        broadcastElementsBatch,
        broadcastCursorMove,
        onRemoteElementCreated,
        onRemoteElementUpdated,
        onRemoteElementDeleted,
        onRemoteElementsBatch,
        onRemoteCursorMove
      }}
    >
      {children}
    </BoardRealtimeContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * useBoardRealtime - Hook do użycia w komponentach
 * 
 * PRZYKŁAD:
 * const { broadcastElementCreated, onlineUsers } = useBoardRealtime()
 */
export function useBoardRealtime() {
  const context = useContext(BoardRealtimeContext)
  
  if (!context) {
    throw new Error(
      '❌ useBoardRealtime musi być użyty wewnątrz BoardRealtimeProvider! ' +
      'Upewnij się że Twój komponent jest owinięty w <BoardRealtimeProvider>...</BoardRealtimeProvider>'
    )
  }
  
  return context
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 PRZYKŁADY UŻYCIA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 1. OWINIĘCIE APLIKACJI:
 * 
 * <BoardRealtimeProvider boardId="123">
 *   <WhiteboardCanvas />
 * </BoardRealtimeProvider>
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * 2. WYSYŁANIE ELEMENTU:
 * 
 * const { broadcastElementCreated } = useBoardRealtime()
 * 
 * const handleDraw = (newPath) => {
 *   setElements([...elements, newPath])
 *   broadcastElementCreated(newPath) // Wyślij do innych
 * }
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * 3. ODBIERANIE ELEMENTÓW:
 * 
 * const { onRemoteElementCreated } = useBoardRealtime()
 * 
 * useEffect(() => {
 *   onRemoteElementCreated((element, userId, username) => {
 *     console.log(`${username} dodał element:`, element)
 *     setElements(prev => [...prev, element])
 *   })
 * }, [])
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */
