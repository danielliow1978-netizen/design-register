import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { SortColumn } from '../types'

export function useSort(pageKey: string, defaultSort: SortColumn[] = []) {
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse sort from URL: ?sort=status:asc,endDate:desc
  const parseSortFromUrl = (): SortColumn[] => {
    const raw = searchParams.get('sort')
    if (!raw) {
      // Fall back to localStorage
      const stored = localStorage.getItem(`dr_sort_${pageKey}`)
      if (stored) {
        try { return JSON.parse(stored) } catch { /* ignore */ }
      }
      return defaultSort
    }
    return raw.split(',').map(s => {
      const [field, direction] = s.split(':')
      return { field, direction: (direction === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' }
    }).filter(s => s.field)
  }

  const [sortColumns, setSortColumnsState] = useState<SortColumn[]>(parseSortFromUrl)

  const handleHeaderClick = useCallback((field: string, shiftKey: boolean) => {
    setSortColumnsState(prev => {
      let next: SortColumn[]
      if (shiftKey) {
        // Shift+click: append or toggle direction
        const existing = prev.find(s => s.field === field)
        if (existing) {
          next = prev.map(s => s.field === field
            ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } as SortColumn
            : s
          )
        } else {
          next = [...prev, { field, direction: 'asc' as const }]
        }
      } else {
        // Normal click: replace sort
        const existing = prev.find(s => s.field === field)
        const newDir: 'asc' | 'desc' = existing?.direction === 'asc' ? 'desc' : 'asc'
        next = [{ field, direction: newDir }]
      }
      // Persist to URL and localStorage
      const sortStr = next.map(c => `${c.field}:${c.direction}`).join(',')
      setSearchParams(p => {
        if (sortStr) p.set('sort', sortStr)
        else p.delete('sort')
        return p
      }, { replace: true })
      localStorage.setItem(`dr_sort_${pageKey}`, JSON.stringify(next))
      return next
    })
  }, [pageKey, setSearchParams])

  const removeSort = useCallback((field: string) => {
    setSortColumnsState(prev => {
      const next = prev.filter(s => s.field !== field)
      const sortStr = next.map(c => `${c.field}:${c.direction}`).join(',')
      setSearchParams(p => {
        if (sortStr) p.set('sort', sortStr)
        else p.delete('sort')
        return p
      }, { replace: true })
      localStorage.setItem(`dr_sort_${pageKey}`, JSON.stringify(next))
      return next
    })
  }, [pageKey, setSearchParams])

  const sortString = sortColumns.map(c => `${c.field}:${c.direction}`).join(',')

  return { sortColumns, handleHeaderClick, removeSort, sortString }
}
