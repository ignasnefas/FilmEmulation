import { useState, useRef, useCallback, useEffect } from 'react';
import { collageLayouts, collageBackgroundColors, CollageLayout, CollageSettings, defaultCollageSettings } from './collagePresets';

const collageAspectRatios = [
  { id: '16:9', label: '16:9', width: 16, height: 9 },
  { id: '9:16', label: '9:16', width: 9, height: 16 },
  { id: '4:3', label: '4:3', width: 4, height: 3 },
  { id: '1:1', label: '1:1', width: 1, height: 1 },
  { id: '6:7', label: '6:7', width: 6, height: 7 },
] as const;

type CollageAspectRatio = (typeof collageAspectRatios)[number];

interface ImageDataEntry {
  file: File;
  url: string;
  width: number;
  height: number;
}

interface CollageState {
  images: ImageDataEntry[];
  selectedLayoutId: string;
  selectedRatioId: string;
  settings: CollageSettings;
}

interface CollageMarkerToolProps {
  isOpen: boolean;
  onClose: () => void;
}

const moveArrayItem = <T,>(array: T[], fromIndex: number, toIndex: number): T[] => {
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

// Calculate cell dimensions for a layout
const getLayoutCells = (
  availableWidth: number,
  availableHeight: number,
  layout: CollageLayout,
  gap: number
) => {
  const cellWidth = (availableWidth - gap * (layout.cols - 1)) / layout.cols;
  const cellHeight = (availableHeight - gap * (layout.rows - 1)) / layout.rows;
  return { cellWidth, cellHeight };
};

export default function CollageMarkerTool({ isOpen, onClose }: CollageMarkerToolProps) {
  const [images, setImages] = useState<ImageDataEntry[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<CollageLayout>(collageLayouts[3]);
  const [settings, setSettings] = useState<CollageSettings>(defaultCollageSettings);
  const [processing, setProcessing] = useState(false);
  const [availableLayouts, setAvailableLayouts] = useState<CollageLayout[]>(collageLayouts);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<CollageAspectRatio>(collageAspectRatios[2]);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<CollageState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageListRef = useRef<HTMLDivElement>(null);
  const dragImageIndexRef = useRef<number | null>(null);
  const listDragDataRef = useRef<{ startIndex: number; currentIndex: number; pointerId: number } | null>(null);
  const renderIdRef = useRef(0);
  const cachedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const clearAll = useCallback(() => {
    if (window.confirm('Clear all images? This action cannot be undone.')) {
      setImages([]);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const state = history[historyIndex - 1];
      setImages(state.images);
      setSelectedLayout(collageLayouts.find((l) => l.id === state.selectedLayoutId) || collageLayouts[0]);
      setSelectedAspectRatio(collageAspectRatios.find((r) => r.id === state.selectedRatioId) || collageAspectRatios[2]);
      setSettings(state.settings);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const state = history[historyIndex + 1];
      setImages(state.images);
      setSelectedLayout(collageLayouts.find((l) => l.id === state.selectedLayoutId) || collageLayouts[0]);
      setSelectedAspectRatio(collageAspectRatios.find((r) => r.id === state.selectedRatioId) || collageAspectRatios[2]);
      setSettings(state.settings);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Track history on state changes
  useEffect(() => {
    if (historyIndex >= 0 && images.length > 0) {
      const currentState: CollageState = {
        images,
        selectedLayoutId: selectedLayout.id,
        selectedRatioId: selectedAspectRatio.id,
        settings,
      };
      const lastState = history[historyIndex];
      if (
        lastState.selectedLayoutId !== currentState.selectedLayoutId ||
        lastState.selectedRatioId !== currentState.selectedRatioId ||
        JSON.stringify(lastState.settings) !== JSON.stringify(currentState.settings)
      ) {
        setHistory((prev) => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(currentState);
          return newHistory;
        });
        setHistoryIndex((prev) => prev + 1);
      }
    }
  }, [selectedLayout.id, selectedAspectRatio.id, settings, historyIndex, history, images]);

  // Update available layouts based on number of images
  useEffect(() => {
    if (images.length === 0) {
      setAvailableLayouts(collageLayouts);
      return;
    }
    const filtered = collageLayouts.filter((layout) => layout.photoCount <= images.length);
    setAvailableLayouts(filtered);
    // If current selection is no longer available, select first available
    if (!filtered.some((l) => l.id === selectedLayout.id)) {
      setSelectedLayout(filtered[0] || collageLayouts[0]);
    }
  }, [images.length, selectedLayout.id]);

  const addImages = useCallback((files: FileList) => {
    const newImages: ImageDataEntry[] = [];
    let loadedCount = 0;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;

    imageFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        newImages.push({ file, url, width: img.width, height: img.height });
        loadedCount++;
        
        // When all images are loaded, update state
        if (loadedCount === imageFiles.length) {
          setImages((prev) => [...prev, ...newImages]);
        }
      };
      img.onerror = () => {
        console.error(`Failed to load image: ${file.name}`);
        loadedCount++;
        if (loadedCount === imageFiles.length) {
          setImages((prev) => [...prev, ...newImages]);
        }
      };
      img.src = url;
    });
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    addImages(files);
    if (e.target) e.target.value = '';
  }, [addImages]);

  const loadImage = useCallback((url: string) => {
    const cached = cachedImagesRef.current.get(url);
    if (cached && cached.complete && cached.naturalWidth) {
      return Promise.resolve(cached);
    }

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = cached || new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        cachedImagesRef.current.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    addImages(files);
  }, [addImages]);

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const swapImages = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setImages((prev) => moveArrayItem(prev, fromIndex, toIndex));
  }, []);

  const randomizeOrder = useCallback(() => {
    setImages((prev) => {
      const shuffled = [...prev].sort(() => Math.random() - 0.5);
      return shuffled;
    });
  }, []);

  const handleImageDragStart = useCallback((index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    dragImageIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleImageDragEnd = useCallback(() => {
    dragImageIndexRef.current = null;
    setDragOverImageIndex(null);
  }, []);

  const handleImageDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleImageDrop = useCallback((index: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromIndex = dragImageIndexRef.current;
    if (fromIndex === null || fromIndex === index) return;
    swapImages(fromIndex, index);
    dragImageIndexRef.current = null;
    setDragOverImageIndex(null);
  }, [swapImages]);

  const handleImageRowPointerDown = useCallback((index: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    listDragDataRef.current = {
      startIndex: index,
      currentIndex: index,
      pointerId: e.pointerId,
    };
    setDragOverImageIndex(index);
  }, []);

  const handleImageListPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!listDragDataRef.current) return;
    const element = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const row = element?.closest('[data-image-index]') as HTMLElement | null;
    if (!row || !imageListRef.current?.contains(row)) {
      setDragOverImageIndex(null);
      return;
    }
    const nextIndex = Number(row.dataset.imageIndex);
    if (Number.isFinite(nextIndex)) {
      listDragDataRef.current.currentIndex = nextIndex;
      setDragOverImageIndex(nextIndex);
    }
  }, []);

  const handleImageListPointerUp = useCallback(() => {
    if (!listDragDataRef.current) return;
    const { startIndex, currentIndex } = listDragDataRef.current;
    if (currentIndex !== startIndex) {
      swapImages(startIndex, currentIndex);
    }
    listDragDataRef.current = null;
    setDragOverImageIndex(null);
  }, [swapImages]);

  const drawPhotoInCell = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    // Contain: preserve aspect ratio with letterboxing/pillarboxing
    const imgRatio = img.width / img.height;
    const cellRatio = width / height;

    let drawWidth = width;
    let drawHeight = height;
    let drawX = x;
    let drawY = y;

    if (imgRatio > cellRatio) {
      // Image is wider: fit to width, center vertically
      drawHeight = width / imgRatio;
      drawY = y + (height - drawHeight) / 2;
    } else {
      // Image is taller: fit to height, center horizontally
      drawWidth = height * imgRatio;
      drawX = x + (width - drawWidth) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  };

  const getEffectiveOffset = (imageIndex: number) => {
    return { x: 0, y: 0 };
  };

  const updatePreview = useCallback(async () => {
    if (images.length === 0 || !previewCanvasRef.current) return;

    const renderId = ++renderIdRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxWidth = 400;
    const maxHeight = 300;
    const previewRatio = selectedAspectRatio.width / selectedAspectRatio.height;
    let previewWidth = maxWidth;
    let previewHeight = Math.round(previewWidth / previewRatio);
    if (previewHeight > maxHeight) {
      previewHeight = maxHeight;
      previewWidth = Math.round(previewHeight * previewRatio);
    }

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const gap = settings.gapSize;
    const paddingPixels = (settings.padding / 100) * Math.min(previewWidth, previewHeight);
    const availableWidth = previewWidth - paddingPixels * 2;
    const availableHeight = previewHeight - paddingPixels * 2;
    const usedImages = images.slice(0, selectedLayout.photoCount);

    const loadedImages = await Promise.all(usedImages.map((image) => loadImage(image.url)));

    if (renderId !== renderIdRef.current) return;

    // Draw background
    ctx.fillStyle = settings.backgroundColor;
    ctx.globalAlpha = settings.backgroundOpacity;
    ctx.fillRect(0, 0, previewWidth, previewHeight);
    ctx.globalAlpha = 1;

    const { cellWidth, cellHeight } = getLayoutCells(availableWidth, availableHeight, selectedLayout, gap);

    if (selectedLayout.template === 'grid') {
      for (let i = 0; i < loadedImages.length; i++) {
        if (renderId !== renderIdRef.current) return;
        const img = loadedImages[i];
        const row = Math.floor(i / selectedLayout.cols);
        const col = i % selectedLayout.cols;
        const x = paddingPixels + col * (cellWidth + gap);
        const y = paddingPixels + row * (cellHeight + gap);
        drawPhotoInCell(ctx, img, x, y, cellWidth, cellHeight);
      }
    } else if (selectedLayout.positions) {
      for (let i = 0; i < loadedImages.length && i < selectedLayout.positions.length; i++) {
        if (renderId !== renderIdRef.current) return;
        const pos = selectedLayout.positions[i];
        const img = loadedImages[i];
        const x = paddingPixels + pos.col * (cellWidth + gap);
        const y = paddingPixels + pos.row * (cellHeight + gap);
        const width = (pos.colSpan || 1) * cellWidth + (pos.colSpan ? (pos.colSpan - 1) * gap : 0);
        const height = (pos.rowSpan || 1) * cellHeight + (pos.rowSpan ? (pos.rowSpan - 1) * gap : 0);
        drawPhotoInCell(ctx, img, x, y, width, height);
      }
    }
  }, [images, selectedLayout, selectedAspectRatio, settings, loadImage]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const calculateFinalSize = (baseWidth: number) => {
    return {
      width: Math.round(baseWidth),
      height: Math.round((baseWidth * selectedAspectRatio.height) / selectedAspectRatio.width),
    };
  };

  const handleDownload = useCallback(
    async (width: number = 1600, format: 'jpeg' | 'png' = 'jpeg') => {
      if (images.length === 0) return;

      setProcessing(true);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const size = calculateFinalSize(width);
      canvas.width = size.width;
      canvas.height = size.height;

      // Draw background
      ctx.fillStyle = settings.backgroundColor;
      ctx.globalAlpha = settings.backgroundOpacity;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;

      const previewCanvasWidth = previewCanvasRef.current?.width || 400;
      const gap = (settings.gapSize / previewCanvasWidth) * canvas.width;
      const paddingPixels = (settings.padding / 100) * Math.min(canvas.width, canvas.height);
      const availableWidth = canvas.width - paddingPixels * 2;
      const availableHeight = canvas.height - paddingPixels * 2;
      const usedImages = images.slice(0, selectedLayout.photoCount);

      const { cellWidth, cellHeight } = getLayoutCells(availableWidth, availableHeight, selectedLayout, gap);

      if (selectedLayout.template === 'grid') {
        for (let i = 0; i < usedImages.length; i++) {
          const img = await loadImage(usedImages[i].url);
          const row = Math.floor(i / selectedLayout.cols);
          const col = i % selectedLayout.cols;
          const x = paddingPixels + col * (cellWidth + gap);
          const y = paddingPixels + row * (cellHeight + gap);
          drawPhotoInCell(ctx, img, x, y, cellWidth, cellHeight);
        }
      } else if (selectedLayout.positions) {
        for (let i = 0; i < usedImages.length && i < selectedLayout.positions.length; i++) {
          const pos = selectedLayout.positions[i];
          const img = await loadImage(usedImages[i].url);
          const x = paddingPixels + pos.col * (cellWidth + gap);
          const y = paddingPixels + pos.row * (cellHeight + gap);
          const w = (pos.colSpan || 1) * cellWidth + (pos.colSpan ? (pos.colSpan - 1) * gap : 0);
          const h = (pos.rowSpan || 1) * cellHeight + (pos.rowSpan ? (pos.rowSpan - 1) * gap : 0);
          drawPhotoInCell(ctx, img, x, y, w, h);
        }
      }

      const link = document.createElement('a');
      const ext = format === 'png' ? 'png' : 'jpg';
      link.download = `collage_${selectedLayout.id}_${Date.now()}.${ext}`;
      link.href =
        format === 'png'
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.95);
      link.click();

      setProcessing(false);
    },
    [images, selectedLayout, settings, loadImage, selectedAspectRatio]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl max-h-[90vh] w-full max-w-2xl flex flex-col border border-zinc-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 bg-zinc-800/50">
          <h2 className="text-xl font-bold text-white">Collage Maker</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {images.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-amber-500/40 rounded-xl p-12 text-center cursor-pointer hover:border-amber-400/60 hover:bg-amber-500/5 transition-all"
            >
              <div className="text-5xl mb-3">🖼️</div>
              <p className="text-white font-medium mb-1">Drop images here</p>
              <p className="text-zinc-400 text-sm">or click to browse (add 2+ images)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Preview</h3>
                    <div className="flex items-center justify-center bg-zinc-950/50 rounded-lg p-4 min-h-64">
                      <canvas
                        ref={previewCanvasRef}
                        className="max-w-full max-h-80 rounded shadow-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Layout</p>
                          <h3 className="text-sm font-semibold text-white">{selectedLayout.name}</h3>
                        </div>
                        <span className="text-xs text-zinc-400">{images.length} photos</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableLayouts.map((layout) => (
                          <button
                            key={layout.id}
                            onClick={() => setSelectedLayout(layout)}
                            title={layout.description}
                            className={`rounded-full px-3 py-2 text-[12px] font-medium transition ${
                              selectedLayout.id === layout.id
                                ? 'bg-amber-500 text-black shadow-sm'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {layout.name}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 rounded-3xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                        <div className="flex items-center justify-between gap-4 mb-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Export ratio</p>
                            <h3 className="text-sm font-semibold text-white">{selectedAspectRatio.label}</h3>
                          </div>
                          <span className="text-xs text-zinc-400">Shape preview</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {collageAspectRatios.map((ratio) => (
                            <button
                              key={ratio.id}
                              type="button"
                              onClick={() => setSelectedAspectRatio(ratio)}
                              className={`rounded-full px-3 py-2 text-[12px] font-medium transition ${
                                selectedAspectRatio.id === ratio.id
                                  ? 'bg-amber-500 text-black shadow-sm'
                                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              }`}
                            >
                              {ratio.label}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Background</p>
                          <h3 className="text-sm font-semibold text-white">Color</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, backgroundColor: '#FFFFFF' })}
                          className="text-xs text-zinc-400 hover:text-white"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {collageBackgroundColors.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setSettings({ ...settings, backgroundColor: color.value })}
                            className={`h-10 w-10 rounded-full border-2 transition ${
                              settings.backgroundColor === color.value
                                ? 'border-amber-500 shadow-inner'
                                : 'border-zinc-700/50 hover:border-zinc-500'
                            }`}
                            style={{ backgroundColor: color.value }}
                            aria-label={`Set background color to ${color.name}`}
                          />
                        ))}
                        <div className="relative h-10 w-10 rounded-full border-2 border-zinc-700/50 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500 transition flex items-center justify-center overflow-hidden">
                          <span className="pointer-events-none">+</span>
                          <input
                            type="color"
                            value={settings.backgroundColor}
                            onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                            aria-label="Pick a custom background color"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                        <span className="uppercase tracking-[0.2em]">Selected</span>
                        <span className="h-5 w-5 rounded-full border border-zinc-700" style={{ backgroundColor: settings.backgroundColor }} />
                        <span className="font-mono text-zinc-200">{settings.backgroundColor.toUpperCase()}</span>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Gap</p>
                            <h3 className="text-sm font-semibold text-white">{settings.gapSize}px</h3>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={settings.gapSize}
                            onChange={(e) =>
                              setSettings({ ...settings, gapSize: parseInt(e.target.value, 10) })
                            }
                            className="w-full"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Padding</p>
                            <h3 className="text-sm font-semibold text-white">{settings.padding}%</h3>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={settings.padding}
                            onChange={(e) =>
                              setSettings({ ...settings, padding: parseInt(e.target.value, 10) })
                            }
                            className="w-full"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Opacity</p>
                            <h3 className="text-sm font-semibold text-white">
                              {Math.round(settings.backgroundOpacity * 100)}%
                            </h3>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={settings.backgroundOpacity * 100}
                            onChange={(e) =>
                              setSettings({ ...settings, backgroundOpacity: parseInt(e.target.value, 10) / 100 })
                            }
                            className="w-full"
                          />
                        </div>

                      </div>

                      <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/60 p-4 mt-4 space-y-3">
                        <div className="flex gap-2 flex-col">
                          <button
                            type="button"
                            onClick={() => handleDownload(1600, 'jpeg')}
                            disabled={processing}
                            className="w-full px-4 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-all disabled:opacity-50"
                          >
                            {processing ? 'Rendering…' : 'Download JPEG (1600px)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(3200, 'jpeg')}
                            disabled={processing}
                            className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-all disabled:opacity-50 text-sm"
                          >
                            JPEG (3200px)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(1600, 'png')}
                            disabled={processing}
                            className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-all disabled:opacity-50 text-sm"
                          >
                            PNG (1600px)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/60 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Images ({images.length})</h3>
                        <p className="text-xs text-zinc-500">Drag images to reorder collage positions.</p>
                      </div>
                    </div>
                    <div
                      ref={imageListRef}
                      className="space-y-2 max-h-96 overflow-y-auto"
                      style={{ touchAction: 'none' }}
                      onPointerMove={handleImageListPointerMove}
                      onPointerUp={handleImageListPointerUp}
                      onPointerCancel={handleImageListPointerUp}
                    >
                      {images.map((image, index) => (
                        <div
                          key={image.url}
                          draggable
                          data-image-index={index}
                          onPointerDown={handleImageRowPointerDown(index)}
                          style={{ touchAction: 'none' }}
                          onDragStart={handleImageDragStart(index)}
                          onDragEnd={handleImageDragEnd}
                          onDragOver={handleImageDragOver}
                          onDragEnter={() => setDragOverImageIndex(index)}
                          onDragLeave={() => setDragOverImageIndex(null)}
                          onDrop={handleImageDrop(index)}
                          className={`flex items-center gap-2 rounded-lg p-2 transition ${
                            dragOverImageIndex === index
                              ? 'border border-amber-500 bg-amber-500/10'
                              : 'bg-zinc-800/50'
                          }`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-900 text-zinc-400 text-xs font-semibold">
                            ≡
                          </div>
                          <img
                            src={image.url}
                            alt={`Photo ${index + 1}`}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate">{image.file.name}</p>
                            <p className="text-xs text-zinc-400">Position {index + 1}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => swapImages(index, index - 1)}
                              disabled={index === 0}
                              className="px-2 py-1 rounded-lg text-xs bg-zinc-900 text-zinc-300 hover:text-white disabled:opacity-50"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => swapImages(index, index + 1)}
                              disabled={index === images.length - 1}
                              className="px-2 py-1 rounded-lg text-xs bg-zinc-900 text-zinc-300 hover:text-white disabled:opacity-50"
                            >
                              ↓
                            </button>
                          </div>
                          <button
                            onClick={() => removeImage(index)}
                            className="px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-red-400 hover:bg-red-950/20 transition"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full mt-3 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition text-sm"
                    >
                      Add more images
                    </button>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={randomizeOrder}
                        className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition text-xs font-medium"
                      >
                        🎲 Randomize
                      </button>
                      <button
                        onClick={clearAll}
                        className="px-3 py-2 rounded-lg bg-red-950/40 text-red-300 hover:bg-red-950/60 transition text-xs font-medium"
                      >
                        ✕ Clear All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition text-xs font-medium disabled:opacity-50"
                      >
                        ↶ Undo
                      </button>
                      <button
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition text-xs font-medium disabled:opacity-50"
                      >
                        ↷ Redo
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
