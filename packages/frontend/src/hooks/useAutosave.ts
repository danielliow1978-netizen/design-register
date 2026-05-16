import { useState, useEffect, useRef, useCallback } from 'react'
import { draftsApi } from '../api/drafts'

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutosaveOptions {
  draftId?: string
  onDraftCreated?: (id: string) => void
}

export function useAutosave(formData: Record<string, unknown>, completionPct: number, opts: UseAutosaveOptions = {}) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [draftId, setDraftId] = useState<string | undefined>(opts.draftId)
  const lastSavedDataRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hardFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSavingRef = useRef(false)

  const save = useCallback(async (data: Record<string, unknown>, pct: number, id?: string) => {
    if (isSavingRef.current) return
    const serialized = JSON.stringify(data)
    if (serialized === lastSavedDataRef.current) return // no changes

    isSavingRef.current = true
    setStatus('saving')
    try {
      const draft = await draftsApi.upsert(id, data, pct)
      lastSavedDataRef.current = serialized
      setSavedAt(new Date())
      setStatus('saved')
      if (!id && draft.id) {
        setDraftId(draft.id)
        opts.onDraftCreated?.(draft.id)
      }
    } catch {
      setStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }, [opts])

  // Debounce: save 5s after last change
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      save(formData, completionPct, draftId)
    }, 5000)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [formData, completionPct, draftId, save])

  // Hard flush every 30s
  useEffect(() => {
    hardFlushTimerRef.current = setInterval(() => {
      save(formData, completionPct, draftId)
    }, 30_000)
    return () => {
      if (hardFlushTimerRef.current) clearInterval(hardFlushTimerRef.current)
    }
  }, [formData, completionPct, draftId, save])

  // "Xs ago" label
  const [savedAgo, setSavedAgo] = useState<string>('')
  useEffect(() => {
    if (!savedAt) return
    const update = () => {
      const secs = Math.round((Date.now() - savedAt.getTime()) / 1000)
      if (secs < 5) setSavedAgo('just now')
      else if (secs < 60) setSavedAgo(`${secs}s ago`)
      else setSavedAgo(`${Math.round(secs / 60)}m ago`)
    }
    update()
    const interval = setInterval(update, 10_000)
    return () => clearInterval(interval)
  }, [savedAt])

  const deleteDraft = useCallback(async () => {
    if (draftId) {
      try { await draftsApi.remove(draftId) } catch { /* ignore */ }
      setDraftId(undefined)
    }
  }, [draftId])

  return { status, savedAgo, draftId, deleteDraft }
}
