'use client';

// Drag-and-drop / click image picker. Emits a decoded HTMLImageElement plus a
// data URL preview once the file has loaded.
import { useCallback, useRef, useState } from 'react';
import { UploadCloud, ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';

export function ImageDropzone({
  onSelect,
  disabled,
}: {
  onSelect: (img: HTMLImageElement, dataUrl: string) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const img = new Image();
        img.onload = () => {
          setPreview(dataUrl);
          onSelect(img, dataUrl);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [onSelect],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={clsx(
          'card grid min-h-[200px] cursor-pointer place-items-center overflow-hidden p-4 text-center transition-colors',
          drag && 'border-brand bg-surface-2',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected leaf" className="max-h-72 rounded-xl object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <UploadCloud className="h-10 w-10" />
            <p className="text-sm font-medium text-fg">Drop a leaf photo here, or click to browse</p>
            <p className="text-xs">JPG / PNG · analysed privately in your browser</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {preview && (
        <button type="button" className="btn-ghost mt-2 text-xs" onClick={() => inputRef.current?.click()}>
          <ImageIcon className="h-3.5 w-3.5" /> Choose another photo
        </button>
      )}
    </div>
  );
}
