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
 * 🆕 Użytkownik który obecnie edytuje element
 */
export interface TypingUser {
  userId: number
  username: string
  elementId: string
}

/**
 * 🆕 Viewport innego użytkownika (dla Follow Mode)
 */
export interface RemoteViewport {
  userId: number
  username: string
  x: number
  y: number
  scale: number
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
  | { type: 'typing-started'; elementId: string; userId: number; username: string }
  | { type: 'typing-stopped'; elementId: string; userId: number; username: string }
  | { type: 'viewport-changed'; x: number; y: number; scale: number; userId: number; username: string }

/**
 * Context Type
 */
interface BoardRealtimeContextType {
  // Użytkownicy online
  onlineUsers: OnlineUser[]
  isConnected: boolean
  
  // 🆕 Subskrypcja kursorów (nie powoduje re-renderów context!)
  subscribeCursors: (callback: (cursors: RemoteCursor[]) => void) => () => void
  
  // Synchronizacja elementów
  broadcastElementCreated: (element: DrawingElement) => Promise<void>
  broadcastElementUpdated: (element: DrawingElement) => Promise<void>
  broadcastElementDeleted: (elementId: string) => Promise<void>
  broadcastElementsBatch: (elements: DrawingElement[]) => Promise<void>
  
  // Kursor
  broadcastCursorMove: (x: number, y: number) => Promise<void>
  
  // 🆕 Typing indicator
  broadcastTypingStarted: (elementId: string) => Promise<void>
  broadcastTypingStopped: (elementId: string) => Promise<void>
  subscribeTyping: (callback: (typingUsers: TypingUser[]) => void) => () => void
  
  // 🆕 Viewport tracking (dla Follow Mode)
  broadcastViewportChange: (x: number, y: number, scale: number) => Promise<void>
  subscribeViewports: (callback: (viewports: RemoteViewport[]) => void) => () => void
  
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
  
  // 🆕 KURSORY - używamy ref + subscribers zamiast state
  // To zapobiega re-renderom WhiteboardCanvas przy każdym ruchu kursora
  const remoteCursorsRef = useRef<RemoteCursor[]>([])
  const cursorSubscribersRef = useRef<Set<(cursors: RemoteCursor[]) => void>>(new Set())
  
  // 🆕 TYPING INDICATOR - ref + subscribers
  const typingUsersRef = useRef<TypingUser[]>([])
  const typingSubscribersRef = useRef<Set<(typing: TypingUser[]) => void>>(new Set())
  
  // 🆕 VIEWPORT TRACKING - ref + subscribers (dla Follow Mode)
  const remoteViewportsRef = useRef<RemoteViewport[]>([])
  const viewportSubscribersRef = useRef<Set<(viewports: RemoteViewport[]) => void>>(new Set())
  
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  const { user } = useAuth()
  
  // Kolory dla kursorów (cyklicznie przydzielane)
  const cursorColors = useRef(['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'])
  
  // 🛡️ THROTTLE - Ref do przechowywania ostatnich czasów broadcast
  const lastBroadcastTimeRef = useRef({
    elementUpdate: 0,
    cursorMove: 0,
    viewportChange: 0
  })
  
  // 🛡️ THROTTLE - Limity częstotliwości (w ms)
  const THROTTLE_MS = {
    ELEMENT_UPDATE: 100,    // Max 10 updates/s podczas operacji
    CURSOR_MOVE: 50,        // Max 20 pozycji kursora/s
    VIEWPORT_CHANGE: 200    // Max 5 viewport updates/s
  }
  
  // Funkcja do notyfikacji subscriberów o zmianie kursorów
  const notifyCursorSubscribers = useCallback(() => {
    cursorSubscribersRef.current.forEach(callback => {
      callback(remoteCursorsRef.current)
    })
  }, [])
  
  // 🆕 Funkcja do notyfikacji subscriberów o zmianie typing
  const notifyTypingSubscribers = useCallback(() => {
    typingSubscribersRef.current.forEach(callback => {
      callback(typingUsersRef.current)
    })
  }, [])
  
  // 🆕 Funkcja do notyfikacji subscriberów o zmianie viewportów
  const notifyViewportSubscribers = useCallback(() => {
    viewportSubscribersRef.current.forEach(callback => {
      callback(remoteViewportsRef.current)
    })
  }, [])
  
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
        remoteCursorsRef.current = remoteCursorsRef.current.filter(c => !leftUserIds.includes(c.userId))
        notifyCursorSubscribers()
      })
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔄 BROADCAST - Synchronizacja elementów
    // ═══════════════════════════════════════════════════════════════════════
    
    channel
      .on('broadcast', { event: 'element-created' }, ({ payload }) => {
        const { element, userId, username } = payload as BoardEvent & { type: 'element-created' }
        
        // Ignoruj własne eventy (już mamy lokalnie)
        if (userId === user.id) return
        
        console.log(`📥 Otrzymano element-created od ${username}:`, element.id, `(typ: ${element.type})`)
        
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
        
        // Automatycznie aktualizuj remote cursors (używamy ref zamiast state!)
        const prev = remoteCursorsRef.current
        const existing = prev.find(c => c.userId === userId)
        const color = existing?.color || cursorColors.current[userId % cursorColors.current.length]
        
        if (existing) {
          remoteCursorsRef.current = prev.map(c => 
            c.userId === userId 
              ? { ...c, x, y, lastUpdate: Date.now() }
              : c
          )
        } else {
          remoteCursorsRef.current = [...prev, { userId, username, x, y, color, lastUpdate: Date.now() }]
        }
        
        // Notyfikuj subscriberów (nie powoduje re-rendera context!)
        notifyCursorSubscribers()
        
        if (cursorMoveHandlerRef.current) {
          cursorMoveHandlerRef.current(x, y, userId, username)
        }
      })
      // 🆕 TYPING INDICATOR - ktoś zaczął edytować
      .on('broadcast', { event: 'typing-started' }, ({ payload }) => {
        const { elementId, userId, username } = payload as BoardEvent & { type: 'typing-started' }
        
        console.log(`✏️ [TYPING] ${username} zaczął edytować element ${elementId}`)
        
        if (userId === user.id) return
        
        // Dodaj do listy (jeśli jeszcze nie ma)
        const exists = typingUsersRef.current.some(t => t.userId === userId && t.elementId === elementId)
        if (!exists) {
          typingUsersRef.current = [...typingUsersRef.current, { userId, username, elementId }]
          console.log(`✏️ [TYPING] Aktualna lista:`, typingUsersRef.current)
          notifyTypingSubscribers()
        }
      })
      // 🆕 TYPING INDICATOR - ktoś skończył edytować
      .on('broadcast', { event: 'typing-stopped' }, ({ payload }) => {
        const { elementId, userId } = payload as BoardEvent & { type: 'typing-stopped' }
        
        console.log(`✏️ [TYPING] User ${userId} skończył edytować element ${elementId}`)
        
        if (userId === user.id) return
        
        // Usuń z listy
        typingUsersRef.current = typingUsersRef.current.filter(
          t => !(t.userId === userId && t.elementId === elementId)
        )
        console.log(`✏️ [TYPING] Aktualna lista po usunięciu:`, typingUsersRef.current)
        notifyTypingSubscribers()
      })
      // 🆕 VIEWPORT CHANGED - ktoś zmienił swój viewport (dla Follow Mode)
      .on('broadcast', { event: 'viewport-changed' }, ({ payload }) => {
        const { x, y, scale, userId, username } = payload as BoardEvent & { type: 'viewport-changed' }
        
        if (userId === user.id) return
        
        // Aktualizuj lub dodaj viewport użytkownika
        const prev = remoteViewportsRef.current
        const existing = prev.find(v => v.userId === userId)
        
        if (existing) {
          remoteViewportsRef.current = prev.map(v => 
            v.userId === userId 
              ? { ...v, x, y, scale, lastUpdate: Date.now() }
              : v
          )
        } else {
          remoteViewportsRef.current = [...prev, { userId, username, x, y, scale, lastUpdate: Date.now() }]
        }
        
        notifyViewportSubscribers()
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
      remoteCursorsRef.current = []
      notifyCursorSubscribers()
    }
  }, [boardId, user, notifyCursorSubscribers])
  
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
    
    // 🛡️ THROTTLE: sprawdź czy minęło wystarczająco czasu od ostatniego broadcast
    const now = Date.now()
    if (now - lastBroadcastTimeRef.current.elementUpdate < THROTTLE_MS.ELEMENT_UPDATE) {
      // console.log('⏱️ Throttle: Pomijam element-updated (zbyt szybko)');
      return // Zbyt szybko - pomiń ten update
    }
    
    lastBroadcastTimeRef.current.elementUpdate = now
    
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
    
    // 🛡️ THROTTLE: ograniczenie częstotliwości kursorów
    const now = Date.now()
    if (now - lastBroadcastTimeRef.current.cursorMove < THROTTLE_MS.CURSOR_MOVE) {
      return // Zbyt szybko - pomiń
    }
    
    lastBroadcastTimeRef.current.cursorMove = now
    
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
  
  // 🆕 SUBSKRYPCJA KURSORÓW - nie powoduje re-renderów context!
  const subscribeCursors = useCallback((callback: (cursors: RemoteCursor[]) => void) => {
    // Dodaj subscriber
    cursorSubscribersRef.current.add(callback)
    
    // Od razu wywołaj z aktualnym stanem
    callback(remoteCursorsRef.current)
    
    // Zwróć funkcję do anulowania subskrypcji
    return () => {
      cursorSubscribersRef.current.delete(callback)
    }
  }, [])
  
  // ───────────────────────────────────────────────────────────────────────
  // 🆕 TYPING INDICATOR FUNCTIONS
  // ───────────────────────────────────────────────────────────────────────
  
  const broadcastTypingStarted = useCallback(async (elementId: string) => {
    if (!channelRef.current || !user) {
      console.log(`⚠️ [TYPING] Nie można wysłać typing-started - brak kanału lub użytkownika`)
      return
    }
    
    console.log(`📤 [TYPING] Wysyłam typing-started dla elementu ${elementId}`)
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'typing-started',
      payload: {
        elementId,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  const broadcastTypingStopped = useCallback(async (elementId: string) => {
    if (!channelRef.current || !user) {
      console.log(`⚠️ [TYPING] Nie można wysłać typing-stopped - brak kanału lub użytkownika`)
      return
    }
    
    console.log(`📤 [TYPING] Wysyłam typing-stopped dla elementu ${elementId}`)
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'typing-stopped',
      payload: {
        elementId,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  // 🆕 SUBSKRYPCJA TYPING - dla komponentów które chcą wiedzieć kto edytuje
  const subscribeTyping = useCallback((callback: (typingUsers: TypingUser[]) => void) => {
    // Dodaj subscriber
    typingSubscribersRef.current.add(callback)
    
    // Od razu wywołaj z aktualnym stanem
    callback(typingUsersRef.current)
    
    // Zwróć funkcję do anulowania subskrypcji
    return () => {
      typingSubscribersRef.current.delete(callback)
    }
  }, [])
  
  // ───────────────────────────────────────────────────────────────────────
  // 🆕 VIEWPORT TRACKING FUNCTIONS (dla Follow Mode)
  // ───────────────────────────────────────────────────────────────────────
  
  const broadcastViewportChange = useCallback(async (x: number, y: number, scale: number) => {
    if (!channelRef.current || !user) return
    
    // 🛡️ THROTTLE: ograniczenie częstotliwości viewport updates
    const now = Date.now()
    if (now - lastBroadcastTimeRef.current.viewportChange < THROTTLE_MS.VIEWPORT_CHANGE) {
      return // Zbyt szybko - pomiń
    }
    
    lastBroadcastTimeRef.current.viewportChange = now
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'viewport-changed',
      payload: {
        x,
        y,
        scale,
        userId: user.id,
        username: user.username
      }
    })
  }, [user])
  
  // 🆕 SUBSKRYPCJA VIEWPORTÓW - dla Follow Mode
  const subscribeViewports = useCallback((callback: (viewports: RemoteViewport[]) => void) => {
    // Dodaj subscriber
    viewportSubscribersRef.current.add(callback)
    
    // Od razu wywołaj z aktualnym stanem
    callback(remoteViewportsRef.current)
    
    // Zwróć funkcję do anulowania subskrypcji
    return () => {
      viewportSubscribersRef.current.delete(callback)
    }
  }, [])
  
  // ───────────────────────────────────────────────────────────────────────
  // PROVIDER
  // ───────────────────────────────────────────────────────────────────────
  
  return (
    <BoardRealtimeContext.Provider
      value={{
        onlineUsers,
        isConnected,
        subscribeCursors,
        subscribeTyping,
        subscribeViewports,
        broadcastElementCreated,
        broadcastElementUpdated,
        broadcastElementDeleted,
        broadcastElementsBatch,
        broadcastCursorMove,
        broadcastTypingStarted,
        broadcastTypingStopped,
        broadcastViewportChange,
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
