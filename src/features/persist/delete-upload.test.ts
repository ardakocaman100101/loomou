// @ts-nocheck
import { describe, expect, it, beforeEach } from 'bun:test'
import * as idb from 'idb-keyval'
import Storage from './storage'
import {
  uploadedSongsAtom,
  uploadedFilesAtom,
  deleteUploadedSong,
} from './persistence'
import * as jotai from 'jotai'

describe('LOOMO-75: Deletion of Self Uploads', () => {
  const store = jotai.getDefaultStore()

  beforeEach(() => {
    store.set(uploadedSongsAtom, [])
    store.set(uploadedFilesAtom, new Map())
  })

  it('TC-01: deleteUploadedSong removes upload metadata, files, and stored song data', async () => {
    const songId = 'test-upload-123'
    const songMetadata = {
      id: songId,
      title: 'My Custom Song',
      file: songId,
      source: 'upload',
      difficulty: 0,
      duration: 120,
    }

    const otherSongId = 'test-upload-456'
    const otherMetadata = {
      id: otherSongId,
      title: 'Another Upload',
      file: otherSongId,
      source: 'upload',
      difficulty: 0,
      duration: 90,
    }

    // Populate store
    store.set(uploadedSongsAtom, [songMetadata, otherMetadata])
    const filesMap = new Map()
    filesMap.set(songId, new File(['dummy'], 'test.mid'))
    filesMap.set(otherSongId, new File(['dummy2'], 'test2.mid'))
    store.set(uploadedFilesAtom, filesMap)

    // Populate storage
    Storage.set(songId, { title: 'My Custom Song' })
    Storage.set(`${songId}/settings`, { speed: 1 })
    Storage.set(`${songId}/edited_midi`, 'base64data')

    // Execute deletion
    await deleteUploadedSong(songId)

    // Verify uploadedSongsAtom updated
    const remainingUploaded = store.get(uploadedSongsAtom)
    expect(remainingUploaded.length).toBe(1)
    expect(remainingUploaded[0].id).toBe(otherSongId)

    // Verify uploadedFilesAtom updated
    const remainingFiles = store.get(uploadedFilesAtom)
    expect(remainingFiles.has(songId)).toBe(false)
    expect(remainingFiles.has(otherSongId)).toBe(true)

    // Verify Storage cleanup
    expect(Storage.get(songId)).toBeNull()
    expect(Storage.get(`${songId}/settings`)).toBeNull()
    expect(Storage.get(`${songId}/edited_midi`)).toBeNull()
  })
})
