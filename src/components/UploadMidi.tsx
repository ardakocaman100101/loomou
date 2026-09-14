import { addUploadedSongs } from '@/features/persist/persistence'
import { AlertCircle, FileMusic, FolderOpen, Loader2, Upload, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function UploadMidi({
  onUpload,
  className,
  children,
}: {
  onUpload?: (id: string) => void
  className?: string
  children?: React.ReactNode
}) {
  const singleInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Attach webkitdirectory to folder input on mount
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '')
      folderInputRef.current.setAttribute('directory', '')
    }
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      if (selectedFiles.length === 0) return

      try {
        setIsUploading(true)
        setErrorMessage(null)

        const id = await addUploadedSongs(selectedFiles)
        setShowModal(false)
        if (onUpload) {
          onUpload(id)
        }
      } catch (error: any) {
        console.error('Failed to upload MIDI:', error)
        setErrorMessage(error?.message || 'Failed to upload MIDI files. Please check file format.')
      } finally {
        setIsUploading(false)
        e.target.value = ''
      }
    },
    [onUpload],
  )

  const handleSingleClick = useCallback(() => {
    setErrorMessage(null)
    singleInputRef.current?.click()
  }, [])

  const handleFolderClick = useCallback(() => {
    setErrorMessage(null)
    folderInputRef.current?.click()
  }, [])

  const handleOpenModal = useCallback(() => {
    setErrorMessage(null)
    setShowModal(true)
  }, [])

  const modal = showModal
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => {
            if (!isUploading) setShowModal(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1A1D2D] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.6)] text-[#F4F5F8]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-white">Upload MIDI</h3>
                <p className="mt-0.5 text-xs text-[#9D9CB1]">Add songs or multi-track stems to loomou</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={isUploading}
                className="cursor-pointer rounded-full p-1.5 text-[#9D9CB1] transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleSingleClick}
                disabled={isUploading}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#202333] p-4 text-left transition-all hover:border-[#6E61EA]/50 hover:bg-[#25283D] active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6E61EA]/15 text-[#7569EC] transition-colors group-hover:bg-[#6E61EA]/25">
                  <FileMusic className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Single MIDI File</div>
                  <div className="mt-0.5 text-xs text-[#9D9CB1]">Upload one standalone .mid file</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleFolderClick}
                disabled={isUploading}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#202333] p-4 text-left transition-all hover:border-[#6E61EA]/50 hover:bg-[#25283D] active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8C49F4]/15 text-[#AE8DFC] transition-colors group-hover:bg-[#8C49F4]/25">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">MIDI Folder</div>
                  <div className="mt-0.5 text-xs text-[#9D9CB1]">
                    Multi-track stems in a folder
                  </div>
                </div>
              </button>
            </div>

            {isUploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#7569EC]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing and parsing MIDI...</span>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {/* Hidden file inputs — always in DOM, never removed */}
      <input
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        ref={singleInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        multiple
        ref={folderInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Main upload trigger button */}
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={isUploading}
        className={className}
      >
        {children ? (
          children
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload MIDI'}
          </>
        )}
      </button>

      {/* Portal modal */}
      {modal}
    </>
  )
}
