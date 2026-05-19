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

interface ImageOffset {
  x: number;
  y: number;
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

export default function CollageMarkerTool({ isOpen, onClose }: CollageMarkerToolProps) {
  const [images, setImages] = useState<ImageDataEntry[]>([]);
  const [selectedLayout, setSelectedLayout] = useState<CollageLayout>(collageLayouts[3]);
  const [settings, setSettings] = useState<CollageSettings>(defaultCollageSettings);
  const [processing, setProcessing] = useState(false);
  const [availableLayouts, setAvailableLayouts] = useState<CollageLayout[]>(collageLayouts);
  const [imageOffsets, setImageOffsets] = useState<ImageOffset[]>([]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<CollageAspectRatio>(collageAspectRatios[2]);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const customColorInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragDataRef = useRef<{ imageIndex: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number; currentOffsetX: number; currentOffsetY: number } | null>(null);
  const dragImageIndexRef = useRef<number | null>(null);
  const renderIdRef = useRef(0);
  const cachedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

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
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImages((prev) => [
          ...prev,
          { file, url, width: img.width, height: img.height },
        ]);
        setImageOffsets((prev) => [...prev, { x: 0, y: 0 }]);
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
    setImageOffsets((prev) => prev.filter((_, i) => i !== index));
  };

  const swapImages = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setImages((prev) => moveArrayItem(prev, fromIndex, toIndex));
    setImageOffsets((prev) => moveArrayItem(prev, fromIndex, toIndex));
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

  const drawPhotoInCell = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    offset: ImageOffset = { x: 0, y: 0 }
  ) => {
    // Cover: crop to fit only
    const imgRatio = img.width / img.height;
    const cellRatio = width / height;
    let srcX = 0,
      srcY = 0,
      srcWidth = img.width,
      srcHeight = img.height;

    if (imgRatio > cellRatio) {
      srcWidth = img.height * cellRatio;
      srcX = (img.width - srcWidth) / 2 + offset.x;
    } else {
      srcHeight = img.width / cellRatio;
      srcY = (img.height - srcHeight) / 2 + offset.y;
    }

    // Clamp source coordinates to image bounds
    srcX = Math.max(0, Math.min(srcX, img.width - srcWidth));
    srcY = Math.max(0, Math.min(srcY, img.height - srcHeight));
    ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, x, y, width, height);
  };

  const getEffectiveOffset = (imageIndex: number): ImageOffset => {
    if (dragDataRef.current && dragDataRef.current.imageIndex === imageIndex) {
      return {
        x: dragDataRef.current.currentOffsetX,
        y: dragDataRef.current.currentOffsetY,
      };
    }
    return imageOffsets[imageIndex] || { x: 0, y: 0 };
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

    const loadedImages = await Promise.all(
      usedImages.map((image) => loadImage(image.url))
    );

    if (renderId !== renderIdRef.current) return;

    // Draw background
    ctx.fillStyle = settings.backgroundColor;
    ctx.globalAlpha = settings.backgroundOpacity;
    ctx.fillRect(0, 0, previewWidth, previewHeight);
    ctx.globalAlpha = 1;

    if (selectedLayout.template === 'grid') {
      const cellWidth = (availableWidth - gap * (selectedLayout.cols - 1)) / selectedLayout.cols;
      const cellHeight = (availableHeight - gap * (selectedLayout.rows - 1)) / selectedLayout.rows;

      for (let i = 0; i < loadedImages.length; i++) {
        if (renderId !== renderIdRef.current) return;
        const img = loadedImages[i];
        const row = Math.floor(i / selectedLayout.cols);
        const col = i % selectedLayout.cols;
        const x = paddingPixels + col * (cellWidth + gap);
        const y = paddingPixels + row * (cellHeight + gap);
        drawPhotoInCell(ctx, img, x, y, cellWidth, cellHeight, getEffectiveOffset(i));
      }
    } else if (selectedLayout.positions) {
      const cellWidth = (availableWidth - gap * (selectedLayout.cols - 1)) / selectedLayout.cols;
      const cellHeight = (availableHeight - gap * (selectedLayout.rows - 1)) / selectedLayout.rows;

      for (let i = 0; i < loadedImages.length && i < selectedLayout.positions.length; i++) {
        if (renderId !== renderIdRef.current) return;
        const pos = selectedLayout.positions[i];
        const img = loadedImages[i];
        const x = paddingPixels + pos.col * (cellWidth + gap);
        const y = paddingPixels + pos.row * (cellHeight + gap);
        const width = (pos.colSpan || 1) * cellWidth + (pos.colSpan ? (pos.colSpan - 1) * gap : 0);
        const height = (pos.rowSpan || 1) * cellHeight + (pos.rowSpan ? (pos.rowSpan - 1) * gap : 0);
        drawPhotoInCell(ctx, img, x, y, width, height, getEffectiveOffset(i));
      }
    }
  }, [images, selectedLayout, selectedAspectRatio, settings, imageOffsets, loadImage]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  useEffect(() => {
    updatePreview();
  }, [imageOffsets, updatePreview]);

  const getImageIndexAtPoint = (canvasX: number, canvasY: number): number | null => {
    if (!previewCanvasRef.current) return null;

    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = canvasX * scaleX;
    const y = canvasY * scaleY;

    const gap = settings.gapSize;
    const paddingPixels = (settings.padding / 100) * Math.min(canvas.width, canvas.height);
    const availableWidth = canvas.width - paddingPixels * 2;
    const availableHeight = canvas.height - paddingPixels * 2;
    const usedImages = images.slice(0, selectedLayout.photoCount);

    if (selectedLayout.template === 'grid') {
      const cellWidth = (availableWidth - gap * (selectedLayout.cols - 1)) / selectedLayout.cols;
      const cellHeight = (availableHeight - gap * (selectedLayout.rows - 1)) / selectedLayout.rows;

      for (let i = 0; i < usedImages.length; i++) {
        const row = Math.floor(i / selectedLayout.cols);
        const col = i % selectedLayout.cols;
        const cellX = paddingPixels + col * (cellWidth + gap);
        const cellY = paddingPixels + row * (cellHeight + gap);

        if (x >= cellX && x < cellX + cellWidth && y >= cellY && y < cellY + cellHeight) {
          return i;
        }
      }
    } else if (selectedLayout.positions) {
      const cellWidth = (availableWidth - gap * (selectedLayout.cols - 1)) / selectedLayout.cols;
      const cellHeight = (availableHeight - gap * (selectedLayout.rows - 1)) / selectedLayout.rows;

      for (let i = 0; i < usedImages.length && i < selectedLayout.positions.length; i++) {
        const pos = selectedLayout.positions[i];
        const cellX = paddingPixels + pos.col * (cellWidth + gap);
        const cellY = paddingPixels + pos.row * (cellHeight + gap);
        const cellW = (pos.colSpan || 1) * cellWidth + (pos.colSpan ? (pos.colSpan - 1) * gap : 0);
        const cellH = (pos.rowSpan || 1) * cellHeight + (pos.rowSpan ? (pos.rowSpan - 1) * gap : 0);

        if (x >= cellX && x < cellX + cellW && y >= cellY && y < cellY + cellH) {
          return i;
        }
      }
    }

    return null;
  };

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const imageIndex = getImageIndexAtPoint(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (imageIndex !== null) {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        canvas.setPointerCapture(e.pointerId);
      }
      dragDataRef.current = {
        imageIndex,
        startX: e.nativeEvent.offsetX,
        startY: e.nativeEvent.offsetY,
        startOffsetX: imageOffsets[imageIndex]?.x || 0,
        startOffsetY: imageOffsets[imageIndex]?.y || 0,
        currentOffsetX: imageOffsets[imageIndex]?.x || 0,
        currentOffsetY: imageOffsets[imageIndex]?.y || 0,
      };
    }
  }, [getImageIndexAtPoint, imageOffsets]);

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragDataRef.current) return;

      const deltaX = e.nativeEvent.offsetX - dragDataRef.current.startX;
      const deltaY = e.nativeEvent.offsetY - dragDataRef.current.startY;

      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      const scaleX = canvas.width / canvas.getBoundingClientRect().width;
      const scaleY = canvas.height / canvas.getBoundingClientRect().height;

      dragDataRef.current.currentOffsetX = dragDataRef.current.startOffsetX + deltaX * scaleX;
      dragDataRef.current.currentOffsetY = dragDataRef.current.startOffsetY + deltaY * scaleY;

      requestAnimationFrame(updatePreview);
    },
    [updatePreview]
  );

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragDataRef.current) {
      const imageIndex = dragDataRef.current.imageIndex;
      const finalX = dragDataRef.current.currentOffsetX;
      const finalY = dragDataRef.current.currentOffsetY;

      setImageOffsets((prev) => {
        const updated = [...prev];
        updated[imageIndex] = { x: finalX, y: finalY };
        return updated;
      });
    }

    const canvas = previewCanvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    dragDataRef.current = null;
  }, []);

  const calculateFinalSize = (baseWidth: number) => {
    return {
      width: Math.round(baseWidth),
      height: Math.round(baseWidth * selectedAspectRatio.height / selectedAspectRatio.width),
    };
  };

  const handleDownload = useCallback(async (width: number = 1600) => {
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

    if (selectedLayout.template === 'grid') {
      const cellWidth = (availableWidth - gap * (selectedLayout.cols - 1)) / selectedLayout.cols;
      const cellHeight = (availableHeight - gap * (selectedLayout.rows - 1)) / selectedLayout.rows;

      for (let i = 0; i < usedImages.length; i++) {
        const img = await loadImage(usedImages[i].url);
        const row = Math.floor(i / selectedLayout.cols);
        const col = i % selectedLayout.cols;
        const x = paddingPixels + col * (cellWidth + gap);
        const y = paddingPixels + row * (cellHeight + gap);
        const scaleRatio = canvas.width / previewCanvasWidth;
        const scaledOffset = {
          x: (imageOffsets[i]?.x || 0) * scaleRatio,
          y: (imageOffsets[i]?.y || 0) * scaleRatio,
        };
        drawPhotoInCell(ctx, img, x, y, cellWidth, cellHeight, scaledOffset);
      }
    } else if (selectedLayout.positions) {
      const cellWidth = (availableWidth - gap * (selectedLayout.cols - 1)) / selectedLayout.cols;
      const cellHeight = (availableHeight - gap * (selectedLayout.rows - 1)) / selectedLayout.rows;

      for (let i = 0; i < usedImages.length && i < selectedLayout.positions.length; i++) {
        const pos = selectedLayout.positions[i];
        const img = await loadImage(usedImages[i].url);
        const x = paddingPixels + pos.col * (cellWidth + gap);
        const y = paddingPixels + pos.row * (cellHeight + gap);
        const w = (pos.colSpan || 1) * cellWidth + (pos.colSpan ? (pos.colSpan - 1) * gap : 0);
        const h = (pos.rowSpan || 1) * cellHeight + (pos.rowSpan ? (pos.rowSpan - 1) * gap : 0);
        const scaleRatio = canvas.width / previewCanvasWidth;
        const scaledOffset = {
          x: (imageOffsets[i]?.x || 0) * scaleRatio,
          y: (imageOffsets[i]?.y || 0) * scaleRatio,
        };
        drawPhotoInCell(ctx, img, x, y, w, h, scaledOffset);
      }
    }

    const link = document.createElement('a');
    link.download = `collage_${selectedLayout.id}_${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();

    setProcessing(false);
  }, [images, selectedLayout, settings, imageOffsets, loadImage, selectedAspectRatio]);

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
                    <p className="text-xs text-zinc-500 mb-2">💡 Drag on images to reposition them</p>
                    <div className="flex items-center justify-center bg-zinc-950/50 rounded-lg p-4 min-h-64">
                      <canvas
                        ref={previewCanvasRef}
                        style={{ touchAction: 'none' }}
                        className="max-w-full max-h-80 rounded shadow-lg cursor-grab active:cursor-grabbing"
                        onPointerDown={handleCanvasPointerDown}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerUp={handleCanvasPointerUp}
                        onPointerCancel={handleCanvasPointerUp}
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
                        <button
                          type="button"
                          onClick={() => customColorInputRef.current?.click()}
                          className="h-10 w-10 rounded-full border-2 border-zinc-700/50 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500 transition flex items-center justify-center"
                          aria-label="Open custom color picker"
                        >
                          +
                        </button>
                        <input
                          ref={customColorInputRef}
                          type="color"
                          value={settings.backgroundColor}
                          onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                          className="hidden"
                          aria-hidden="true"
                        />
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

                            <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setImageOffsets(images.map(() => ({ x: 0, y: 0 })))}
                            className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition text-sm"
                          >
                            Reset positions
                          </button>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-zinc-700/60 bg-zinc-950/60 p-4 mt-4 space-y-3">
                        <button
                          type="button"
                          onClick={() => handleDownload(1600)}
                          disabled={processing}
                          className="w-full px-4 py-3 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-all disabled:opacity-50"
                        >
                          {processing ? 'Rendering…' : 'Download collage (1600px)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(3200)}
                          disabled={processing}
                          className="w-full px-4 py-3 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-all disabled:opacity-50"
                        >
                          Download HQ (3200px)
                        </button>
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
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {images.map((image, index) => (
                        <div
                          key={image.url}
                          draggable
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
