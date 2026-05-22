import { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
import { calculateNeutralWB, kelvinToWhiteBalance, kelvinFromRGB, sampleRegion } from './utils/whiteBalanceUtils';
import { filmPresets } from './filmPresets';
import { decodeImage } from './utils/imageDecoder';
import {
  PRESET_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  loadFromStorage,
  saveToStorage,
  CANVAS_BLEND,
  drawImageCover,
  drawImageCoverRotated,
  drawImageContainRotated,
  drawImageDataRotated,
  getCanvasImageSourceDimensions,
  rotateImageData,
  cropImageDataRect,
  OVERLAYS,
} from './App.helpers';
import { getCropAspectRatio, clampCropRect } from './canvasUtils';
import type {
  BatchImage,
  BatchImageEditState,
  CropRect,
  CropRatio,
  CropDragType,
  HistoryEntry,
} from './App.types';
import type { OverlayCategory, BlendMode } from './App.helpers';
import type { ProcessingParams } from './filmProcessor';
import type { FilmPreset } from './filmPresets';

const OVERLAY_CATEGORY_MAP = new Map<string, OverlayCategory>();
(['lightleaks', 'bokeh', 'textures', 'frames', 'paper'] as const).forEach((category) => {
  OVERLAYS[category].urls.forEach((url) => OVERLAY_CATEGORY_MAP.set(url, category));
});

export function useFilmLabState() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<FilmPreset>(filmPresets[0]);
  const [customPresets, setCustomPresets] = useState<FilmPreset[]>(() => loadFromStorage<FilmPreset[]>(PRESET_STORAGE_KEY, []));
  const [favorites, setFavorites] = useState<string[]>(() => loadFromStorage<string[]>(FAVORITES_STORAGE_KEY, []));
  const [customPresetName, setCustomPresetName] = useState('');
  const [customPresetDescription, setCustomPresetDescription] = useState('');
  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropRatio, setCropRatio] = useState<CropRatio>('original');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const cropDragRef = useRef<{ startX: number; startY: number; startRect: CropRect | null; type: CropDragType } | null>(null);
  const [canvasBounds, setCanvasBounds] = useState<DOMRect | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'color-negative' | 'bw-negative' | 'slide' | 'cinema' | 'custom'>('all');
  const [processing, setProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [splitPos, setSplitPos] = useState(50);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [grainSeed, setGrainSeed] = useState(42);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imageWrapperRef = useRef<HTMLDivElement>(null);

  const [overlayCategories, setOverlayCategories] = useState<Array<'lightleaks' | 'bokeh' | 'textures' | 'frames' | 'paper'>>(['lightleaks']);
  const [selectedOverlays, setSelectedOverlays] = useState<string[]>([]);
  const [overlayOpacityByCategory, setOverlayOpacityByCategory] = useState<Record<OverlayCategory, number>>({
    lightleaks: 0.6,
    bokeh: 0.6,
    textures: 0.6,
    frames: 1,
    paper: 0.8,
  });
  const [overlayBlendByCategory, setOverlayBlendByCategory] = useState<Record<OverlayCategory, BlendMode>>({
    lightleaks: 'screen',
    bokeh: 'screen',
    textures: 'screen',
    frames: 'normal',
    paper: 'overlay',
  });
  const [overlayRotationByCategory, setOverlayRotationByCategory] = useState<Record<OverlayCategory, number>>({
    lightleaks: 0,
    bokeh: 0,
    textures: 0,
    frames: 0,
    paper: 0,
  });
  const [overlayZoomByCategory, setOverlayZoomByCategory] = useState<Record<OverlayCategory, number>>({
    lightleaks: 1,
    bokeh: 1,
    textures: 1,
    frames: 1,
    paper: 1,
  });
  const [overlayImagesLoadedAt, setOverlayImagesLoadedAt] = useState(0);
  const [rotation, setRotation] = useState(0);
  const clampRotationValue = useCallback((value: number) => Math.min(45, Math.max(-45, value)), []);

  const [grainAmount, setGrainAmount] = useState<number | null>(null);
  const [grainSize, setGrainSize] = useState<number | null>(null);
  const [grainRoughness, setGrainRoughness] = useState<number | null>(null);
  const [vignetteAmount, setVignetteAmount] = useState<number | null>(null);
  const [halationAmount, setHalationAmount] = useState<number | null>(null);
  const [contrastAmount, setContrastAmount] = useState<number | null>(null);
  const [saturationAmount, setSaturationAmount] = useState<number | null>(null);
  const [brightnessAmount, setBrightnessAmount] = useState<number | null>(null);
  const [fadedBlacks, setFadedBlacks] = useState<number | null>(null);
  const [exposure, setExposure] = useState(0);
  const [purpleFringing, setPurpleFringing] = useState<number | null>(null);
  const [lensDistortion, setLensDistortion] = useState<number | null>(null);
  const [colorShiftX, setColorShiftX] = useState<number | null>(null);
  const [colorShiftY, setColorShiftY] = useState<number | null>(null);
  const [whiteBalance, setWhiteBalance] = useState<number | null>(null);
  const [wbPickerActive, setWbPickerActive] = useState(false);
  const [wbMultipliers, setWbMultipliers] = useState<{ r: number; g: number; b: number } | null>(null);
  const [tintAmount, setTintAmount] = useState<number | null>(null);
  const [crossProcessAmount, setCrossProcessAmount] = useState<number | null>(null);
  const handleWhiteBalanceChange = useCallback((value: number | null) => {
    setWhiteBalance(value);
    setWbMultipliers(null);
  }, []);

  const [pushPullAmount, setPushPullAmount] = useState<number | null>(null);
  const [levelsInputBlack, setLevelsInputBlack] = useState<number | null>(null);
  const [levelsInputWhite, setLevelsInputWhite] = useState<number | null>(null);
  const [levelsGamma, setLevelsGamma] = useState<number | null>(null);
  const [levelsOutputBlack, setLevelsOutputBlack] = useState<number | null>(null);
  const [levelsOutputWhite, setLevelsOutputWhite] = useState<number | null>(null);
  const [curveChannel, setCurveChannel] = useState<'master' | 'r' | 'g' | 'b'>('master');
  const [curvePointsR, setCurvePointsR] = useState<[number, number][]>(() => filmPresets[0].curves.r.map(([x, y]) => [x, y]));
  const [curvePointsG, setCurvePointsG] = useState<[number, number][]>(() => filmPresets[0].curves.g.map(([x, y]) => [x, y]));
  const [curvePointsB, setCurvePointsB] = useState<[number, number][]>(() => filmPresets[0].curves.b.map(([x, y]) => [x, y]));
  const [curvePointsMaster, setCurvePointsMaster] = useState<[number, number][]>(() =>
    filmPresets[0].curves.r.map(([x, y], index) => [
      x,
      (y + filmPresets[0].curves.g[index][1] + filmPresets[0].curves.b[index][1]) / 3,
    ] as [number, number]),
  );
  const [processedImageData, setProcessedImageData] = useState<ImageData | null>(null);
  const [histogramProcessedImageData, setHistogramProcessedImageData] = useState<ImageData | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null);
  const pointerPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const offsetRef = useRef({ x: 0, y: 0 });
  const pendingOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const processTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestPreviewRequestRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const workerRequestIdRef = useRef(0);
  const workerResolversRef = useRef(new Map<number, { resolve: (value: any) => void; reject: (reason?: any) => void; }>());
  const overlayImgRef = useRef<HTMLImageElement[]>([]);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const cropResetImageDataRef = useRef<ImageData | null>(null);
  const originalImageData = originalImageDataRef.current;

  useEffect(() => {
    setGrainAmount(null);
    setGrainSize(null);
    setGrainRoughness(null);
    setVignetteAmount(null);
    setHalationAmount(null);
    setContrastAmount(null);
    setSaturationAmount(null);
    setBrightnessAmount(null);
    setFadedBlacks(null);
    setExposure(0);
    setPurpleFringing(null);
    setLensDistortion(null);
    setColorShiftX(null);
    setColorShiftY(null);
    setWhiteBalance(null);
    setCrossProcessAmount(null);
    setPushPullAmount(null);
    setLevelsInputBlack(null);
    setLevelsInputWhite(null);
    setLevelsGamma(null);
    setLevelsOutputBlack(null);
    setLevelsOutputWhite(null);
    setCurvePointsR(selectedPreset.curves.r.map(([x, y]) => [x, y]));
    setCurvePointsG(selectedPreset.curves.g.map(([x, y]) => [x, y]));
    setCurvePointsB(selectedPreset.curves.b.map(([x, y]) => [x, y]));
    setCurvePointsMaster(selectedPreset.curves.r.map(([x, y], index) => [
      x,
      (y + selectedPreset.curves.g[index][1] + selectedPreset.curves.b[index][1]) / 3,
    ] as [number, number]));
    setGrainSeed(Math.floor(Math.random() * 100000));
  }, [selectedPreset.id, selectedPreset.curves]);

  useEffect(() => {
    setShowOriginal(false);
  }, [splitView]);

  const currentParams: ProcessingParams = useMemo(() => ({
    grainAmountOverride: grainAmount ?? undefined,
    grainSizeOverride: grainSize ?? undefined,
    grainRoughnessOverride: grainRoughness ?? undefined,
    vignetteOverride: vignetteAmount ?? undefined,
    halationOverride: halationAmount ?? undefined,
    contrastOverride: contrastAmount ?? undefined,
    saturationOverride: saturationAmount ?? undefined,
    brightnessOverride: brightnessAmount ?? undefined,
    fadedBlacksOverride: fadedBlacks ?? undefined,
    exposureCompensation: exposure,
    purpleFringingOverride: purpleFringing ?? undefined,
    lensDistortionOverride: lensDistortion ?? undefined,
    colorShiftXOverride: colorShiftX ?? undefined,
    colorShiftYOverride: colorShiftY ?? undefined,
    whiteBalanceOverride: whiteBalance ?? undefined,
    wbMultipliers: wbMultipliers ?? undefined,
    tintOverride: tintAmount ?? undefined,
    levelsInputBlackOverride: levelsInputBlack ?? undefined,
    levelsInputWhiteOverride: levelsInputWhite ?? undefined,
    levelsGammaOverride: levelsGamma ?? undefined,
    levelsOutputBlackOverride: levelsOutputBlack ?? undefined,
    levelsOutputWhiteOverride: levelsOutputWhite ?? undefined,
    crossProcessOverride: crossProcessAmount ?? undefined,
    pushPullOverride: pushPullAmount ?? undefined,
  }), [grainAmount, grainSize, grainRoughness, vignetteAmount, halationAmount, contrastAmount, saturationAmount, brightnessAmount, fadedBlacks, exposure, purpleFringing, lensDistortion, colorShiftX, colorShiftY, whiteBalance, wbMultipliers, tintAmount, crossProcessAmount, pushPullAmount, levelsInputBlack, levelsInputWhite, levelsGamma, levelsOutputBlack, levelsOutputWhite]);

  // Params for histogram - same as current but with neutral levels (levels don't affect histogram)
  const histogramParams: ProcessingParams = useMemo(() => ({
    grainAmountOverride: grainAmount ?? undefined,
    grainSizeOverride: grainSize ?? undefined,
    grainRoughnessOverride: grainRoughness ?? undefined,
    vignetteOverride: vignetteAmount ?? undefined,
    halationOverride: halationAmount ?? undefined,
    contrastOverride: contrastAmount ?? undefined,
    saturationOverride: saturationAmount ?? undefined,
    brightnessOverride: brightnessAmount ?? undefined,
    fadedBlacksOverride: fadedBlacks ?? undefined,
    exposureCompensation: exposure,
    purpleFringingOverride: purpleFringing ?? undefined,
    lensDistortionOverride: lensDistortion ?? undefined,
    colorShiftXOverride: colorShiftX ?? undefined,
    colorShiftYOverride: colorShiftY ?? undefined,
    whiteBalanceOverride: whiteBalance ?? undefined,
    wbMultipliers: wbMultipliers ?? undefined,
    tintOverride: tintAmount ?? undefined,
    // Neutral levels - don't affect histogram
    levelsInputBlackOverride: 0,
    levelsInputWhiteOverride: 1,
    levelsGammaOverride: 1,
    levelsOutputBlackOverride: 0,
    levelsOutputWhiteOverride: 1,
    crossProcessOverride: crossProcessAmount ?? undefined,
    pushPullOverride: pushPullAmount ?? undefined,
  }), [grainAmount, grainSize, grainRoughness, vignetteAmount, halationAmount, contrastAmount, saturationAmount, brightnessAmount, fadedBlacks, exposure, purpleFringing, lensDistortion, colorShiftX, colorShiftY, whiteBalance, wbMultipliers, tintAmount, crossProcessAmount, pushPullAmount]);

  const currentPreset = useMemo(() => ({
    ...selectedPreset,
    curves: {
      r: curvePointsR,
      g: curvePointsG,
      b: curvePointsB,
    },
  }), [selectedPreset, curvePointsR, curvePointsG, curvePointsB]);


  useEffect(() => {
    const worker = new Worker(new URL('./filmWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { id, success, result, error } = event.data;
      const handlers = workerResolversRef.current.get(id);
      if (!handlers) return;
      workerResolversRef.current.delete(id);

      if (success) {
        handlers.resolve(result);
      } else {
        handlers.reject(new Error(error || 'Worker error'));
      }
    };

    worker.onerror = (event) => {
      workerResolversRef.current.forEach(({ reject }) => reject(new Error(event.message)));
      workerResolversRef.current.clear();
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      workerResolversRef.current.forEach(({ reject }) => reject(new Error('Worker terminated')));
      workerResolversRef.current.clear();
    };
  }, []);

  const sendWorkerRequest = useCallback((type: 'process', payload: unknown, transfer?: Transferable[]) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error('Processing worker is not initialized'));

    const id = ++workerRequestIdRef.current;
    return new Promise<any>((resolve, reject) => {
      workerResolversRef.current.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload }, transfer ?? []);
    });
  }, []);

  const processImageInWorker = useCallback(async (
    source: ImageData,
    preset: FilmPreset,
    params: ProcessingParams,
    grainSeed?: number,
  ) => {
    const bufferCopy = new Uint8ClampedArray(source.data);
    const result = await sendWorkerRequest('process', {
      imageData: { width: source.width, height: source.height, data: bufferCopy },
      preset,
      params,
      grainSeed,
    }, [bufferCopy.buffer]);

    return new ImageData(new Uint8ClampedArray(result.data), result.width, result.height);
  }, [sendWorkerRequest]);

  const getPreviewImageData = useCallback((source: ImageData) => {
    const maxDim = 1200;
    if (source.width <= maxDim && source.height <= maxDim) return source;

    const scale = maxDim / Math.max(source.width, source.height);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = source.width;
    srcCanvas.height = source.height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return source;
    srcCtx.putImageData(source, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = width;
    dstCanvas.height = height;
    const dstCtx = dstCanvas.getContext('2d');
    if (!dstCtx) return source;
    dstCtx.imageSmoothingQuality = 'high';
    dstCtx.drawImage(srcCanvas, 0, 0, width, height);

    return dstCtx.getImageData(0, 0, width, height);
  }, []);

  const previewImageData = useMemo(() => {
    if (!imageData) return null;
    return getPreviewImageData(imageData);
  }, [imageData, getPreviewImageData]);

  useEffect(() => {
    if (!imageData || !canvasRef.current || !workerRef.current) return;

    if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current);

    const debounceDelay = 80;
    processTimeoutRef.current = setTimeout(() => {
      setProcessing(true);
      const requestId = ++latestPreviewRequestRef.current;
      requestAnimationFrame(async () => {
        try {
          const source = previewImageData ?? imageData;
          const result = await processImageInWorker(source, currentPreset, currentParams, grainSeed);
          if (requestId === latestPreviewRequestRef.current) {
            setProcessedImageData(result);
            processedCanvasRef.current = canvasRef.current;
          }
        } catch (error) {
          console.error('Image processing worker failed', error);
        } finally {
          setProcessing(false);
        }
      });
    }, debounceDelay);

    return () => {
      if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current);
    };
  }, [imageData, previewImageData, currentPreset, currentParams, grainSeed, processImageInWorker]);

  // Separate effect to compute histogram processed image (with neutral levels)
  useEffect(() => {
    if (!imageData || !workerRef.current) return;

    const computeHistogramImage = async () => {
      try {
        const source = previewImageData ?? imageData;
        const result = await processImageInWorker(source, currentPreset, histogramParams, grainSeed);
        setHistogramProcessedImageData(result);
      } catch (error) {
        console.error('Histogram image processing failed', error);
      }
    };

    computeHistogramImage();
  }, [imageData, previewImageData, currentPreset, histogramParams, grainSeed, processImageInWorker]);

  const drawCanvasOverlays = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (selectedOverlays.length === 0 || overlayImgRef.current.length === 0) return;
    selectedOverlays.forEach((url, index) => {
      const category = OVERLAY_CATEGORY_MAP.get(url);
      if (!category) return;
      const overlayImg = overlayImgRef.current[index];
      if (!overlayImg) return;
      ctx.save();
      ctx.globalAlpha = overlayOpacityByCategory[category];
      ctx.globalCompositeOperation = CANVAS_BLEND[overlayBlendByCategory[category]] || 'source-over';
      if (category === 'frames') {
        drawImageContainRotated(
          ctx,
          overlayImg,
          width,
          height,
          overlayRotationByCategory[category] ?? 0,
          overlayZoomByCategory[category] ?? 1,
        );
      } else {
        drawImageCoverRotated(
          ctx,
          overlayImg,
          width,
          height,
          overlayRotationByCategory[category] ?? 0,
          overlayZoomByCategory[category] ?? 1,
        );
      }
      ctx.restore();
    });
  }, [selectedOverlays, overlayOpacityByCategory, overlayBlendByCategory, overlayRotationByCategory, overlayZoomByCategory]);

  const renderPreviewCanvas = useCallback((canvas: HTMLCanvasElement, source: ImageData, angle: number, drawOverlays: boolean) => {
    if (canvas.width !== source.width || canvas.height !== source.height) {
      canvas.width = source.width;
      canvas.height = source.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawImageDataRotated(ctx, source, angle);
    if (drawOverlays) {
      drawCanvasOverlays(ctx, canvas.width, canvas.height);
    }
  }, [drawCanvasOverlays]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = showOriginal ? previewImageData ?? imageData : processedImageData ?? previewImageData ?? imageData;
    if (!canvas || !source) return;
    renderPreviewCanvas(canvas, source, rotation, !showOriginal);
  }, [renderPreviewCanvas, processedImageData, previewImageData, imageData, rotation, splitView, showOriginal, overlayImagesLoadedAt]);

  useEffect(() => {
    if (!splitView || !imageData || !originalCanvasRef.current) return;
    const source = previewImageData ?? imageData;
    renderPreviewCanvas(originalCanvasRef.current, source, rotation, false);
  }, [renderPreviewCanvas, splitView, imageData, previewImageData, rotation]);

  useEffect(() => {
    overlayImgRef.current = [];
    selectedOverlays.forEach((url, index) => {
      const img = new Image();
      img.onload = () => {
        overlayImgRef.current[index] = img;
        setOverlayImagesLoadedAt((prev) => prev + 1);
      };
      img.src = url;
    });
  }, [selectedOverlays]);

  const getCurrentBatchEditState = useCallback((): BatchImageEditState => ({
    selectedPreset: currentPreset,
    selectedOverlays,
    overlayOpacityByCategory,
    overlayRotationByCategory,
    overlayZoomByCategory,
    overlayBlendByCategory,
    rotation,
    grainAmount,
    grainSize,
    grainRoughness,
    vignetteAmount,
    halationAmount,
    contrastAmount,
    saturationAmount,
    brightnessAmount,
    fadedBlacks,
    exposure,
    purpleFringing,
    lensDistortion,
    colorShiftX,
    colorShiftY,
    whiteBalance,
    crossProcessAmount,
    pushPullAmount,
    levelsInputBlack,
    levelsInputWhite,
    levelsGamma,
    levelsOutputBlack,
    levelsOutputWhite,
  }), [selectedPreset, selectedOverlays, overlayOpacityByCategory, overlayRotationByCategory, overlayZoomByCategory, overlayBlendByCategory, grainAmount, grainSize, grainRoughness, vignetteAmount, halationAmount, contrastAmount, saturationAmount, brightnessAmount, fadedBlacks, exposure, purpleFringing, lensDistortion, colorShiftX, colorShiftY, whiteBalance, crossProcessAmount, pushPullAmount, levelsInputBlack, levelsInputWhite, levelsGamma, levelsOutputBlack, levelsOutputWhite]);

  const addBatchEntry = useCallback((entry: BatchImage) => {
    setBatchImages((prev) => {
      const next = [...prev, entry];
      setActiveBatchIndex(next.length - 1);
      return next;
    });
    const img = new Image();
    img.src = entry.url;
    setImage(img);
    setProcessedImageData(null);
    setImageData(entry.data);
    originalImageDataRef.current = entry.data;
    cropResetImageDataRef.current = null;
    setSelectedPreset(entry.editState.selectedPreset);
    setSelectedOverlays(entry.editState.selectedOverlays);
    setOverlayOpacityByCategory(entry.editState.overlayOpacityByCategory);
    setOverlayBlendByCategory(entry.editState.overlayBlendByCategory);
    setRotation(clampRotationValue(entry.editState.rotation));
    setGrainAmount(entry.editState.grainAmount);
    setGrainSize(entry.editState.grainSize);
    setGrainRoughness(entry.editState.grainRoughness);
    setVignetteAmount(entry.editState.vignetteAmount);
    setHalationAmount(entry.editState.halationAmount);
    setContrastAmount(entry.editState.contrastAmount);
    setSaturationAmount(entry.editState.saturationAmount);
    setBrightnessAmount(entry.editState.brightnessAmount);
    setFadedBlacks(entry.editState.fadedBlacks);
    setExposure(entry.editState.exposure);
    setPurpleFringing(entry.editState.purpleFringing);
    setLensDistortion(entry.editState.lensDistortion);
    setColorShiftX(entry.editState.colorShiftX);
    setColorShiftY(entry.editState.colorShiftY);
    setWhiteBalance(entry.editState.whiteBalance);
    setHistory([]);
    setRedoStack([]);
    setCropMode(false);
    setCropRect(null);
  }, [getCurrentBatchEditState]);

  const handleBatchFiles = useCallback((files: FileList | File[]) => {
    const useNeutralPreset = batchImages.length === 0;
    Array.from(files).forEach((file) => {
      // Attempt to decode both standard images and RAW formats
      decodeImage(file, {
        maxDim: 3200,
        onProgress: () => {}, // Silent progress for batch
      })
        .then((data) => {
          const maxDim = 3200;
          let w = data.width;
          let h = data.height;
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }

          // Create URL for preview
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = data.width;
          tempCanvas.height = data.height;
          const ctx = tempCanvas.getContext('2d')!;
          ctx.putImageData(data, 0, 0);
          const url = tempCanvas.toDataURL('image/jpeg', 0.95);

          addBatchEntry({
            id: `${file.name}-${Date.now()}`,
            file,
            url,
            width: w,
            height: h,
            name: file.name,
            data,
            thumbUrl: url,
            editState: {
              ...getCurrentBatchEditState(),
              selectedPreset: useNeutralPreset
                ? filmPresets[0]
                : getCurrentBatchEditState().selectedPreset,
            },
          });
        })
        .catch((err) => {
          console.error(`Failed to load ${file.name}:`, err);
        });
    });
  }, [addBatchEntry, batchImages.length, getCurrentBatchEditState]);

  const handleDemo = useCallback((url: string) => {
    setLoadingDemo(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 3200;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const ctx = tempCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      addBatchEntry({
        id: `demo-${Date.now()}`,
        url,
        width: w,
        height: h,
        name: 'Sample',
        data,
        thumbUrl: url,
        editState: {
          ...getCurrentBatchEditState(),
          selectedPreset: batchImages.length === 0 ? filmPresets[0] : getCurrentBatchEditState().selectedPreset,
        },
      });
      setLoadingDemo(false);
    };
    img.onerror = () => setLoadingDemo(false);
    img.src = url;
  }, [addBatchEntry, batchImages.length, getCurrentBatchEditState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleBatchFiles(files);
    }
  }, [handleBatchFiles]);

  const selectBatchImage = useCallback((index: number) => {
    const entry = batchImages[index];
    if (!entry) return;
    if (activeBatchIndex !== null) {
      setBatchImages((prev) => prev.map((item, idx) => idx === activeBatchIndex ? { ...item, editState: getCurrentBatchEditState() } : item));
    }
    setActiveBatchIndex(index);
    setSelectedPreset(entry.editState.selectedPreset);
    setSelectedOverlays(entry.editState.selectedOverlays);
    setOverlayOpacityByCategory(entry.editState.overlayOpacityByCategory);
    setOverlayRotationByCategory(entry.editState.overlayRotationByCategory);
    setOverlayZoomByCategory(entry.editState.overlayZoomByCategory);
    setOverlayBlendByCategory(entry.editState.overlayBlendByCategory);
    setRotation(clampRotationValue(entry.editState.rotation));
    setGrainAmount(entry.editState.grainAmount);
    setGrainSize(entry.editState.grainSize);
    setGrainRoughness(entry.editState.grainRoughness);
    setVignetteAmount(entry.editState.vignetteAmount);
    setHalationAmount(entry.editState.halationAmount);
    setContrastAmount(entry.editState.contrastAmount);
    setSaturationAmount(entry.editState.saturationAmount);
    setBrightnessAmount(entry.editState.brightnessAmount);
    setFadedBlacks(entry.editState.fadedBlacks);
    setExposure(entry.editState.exposure);
    setPurpleFringing(entry.editState.purpleFringing);
    setLensDistortion(entry.editState.lensDistortion);
    setColorShiftX(entry.editState.colorShiftX);
    setColorShiftY(entry.editState.colorShiftY);
    setWhiteBalance(entry.editState.whiteBalance);
    setLevelsInputBlack(entry.editState.levelsInputBlack);
    setLevelsInputWhite(entry.editState.levelsInputWhite);
    setLevelsGamma(entry.editState.levelsGamma);
    setLevelsOutputBlack(entry.editState.levelsOutputBlack);
    setLevelsOutputWhite(entry.editState.levelsOutputWhite);
    const img = new Image();
    img.src = entry.url;
    setImage(img);
    setProcessedImageData(null);
    setImageData(entry.data);
    originalImageDataRef.current = entry.data;
    cropResetImageDataRef.current = null;
    setHistory([]);
    setRedoStack([]);
    setCropMode(false);
    setCropRect(null);
  }, [activeBatchIndex, batchImages, getCurrentBatchEditState]);

  useEffect(() => {
    if (activeBatchIndex === null) return;
    const editState = getCurrentBatchEditState();
    setBatchImages((prev) => prev.map((entry, idx) => idx === activeBatchIndex ? { ...entry, editState } : entry));
  }, [activeBatchIndex, getCurrentBatchEditState]);

  useEffect(() => {
    if (activeBatchIndex === null || !processedCanvasRef.current) return;
    const source = processedCanvasRef.current;
    const maxDim = 120;
    const scale = Math.min(1, maxDim / Math.max(source.width || 1, source.height || 1));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = Math.max(1, Math.round(source.width * scale));
    thumbCanvas.height = Math.max(1, Math.round(source.height * scale));
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
    setBatchImages((prev) => prev.map((entry, idx) => idx === activeBatchIndex ? { ...entry, thumbUrl } : entry));
  }, [processedImageData, activeBatchIndex]);

  const createSnapshot = useCallback((): HistoryEntry | null => {
    if (!imageData) return null;
    return {
      imageData: new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height),
      selectedPreset,
      grainAmount,
      grainSize,
      grainRoughness,
      vignetteAmount,
      halationAmount,
      contrastAmount,
      saturationAmount,
      brightnessAmount,
      fadedBlacks,
      exposure,
      purpleFringing,
      lensDistortion,
      colorShiftX,
      colorShiftY,
      whiteBalance,
      crossProcessAmount,
      pushPullAmount,
      levelsInputBlack,
      levelsInputWhite,
      levelsGamma,
      levelsOutputBlack,
      levelsOutputWhite,
      selectedOverlays,
      overlayOpacityByCategory,
      overlayRotationByCategory,
      overlayZoomByCategory,
      overlayBlendByCategory,
      rotation,
      activeBatchIndex,
    };
  }, [imageData, selectedPreset, grainAmount, grainSize, grainRoughness, vignetteAmount, halationAmount, contrastAmount, saturationAmount, brightnessAmount, fadedBlacks, exposure, purpleFringing, lensDistortion, colorShiftX, colorShiftY, whiteBalance, crossProcessAmount, pushPullAmount, levelsInputBlack, levelsInputWhite, levelsGamma, levelsOutputBlack, levelsOutputWhite, selectedOverlays, overlayOpacityByCategory, overlayRotationByCategory, overlayZoomByCategory, overlayBlendByCategory, rotation, activeBatchIndex]);

  const restoreSnapshot = useCallback((snapshot: HistoryEntry) => {
    setImageData(snapshot.imageData);
    originalImageDataRef.current = snapshot.imageData;
    cropResetImageDataRef.current = null;
    setImage(new Image());
    setSelectedPreset(snapshot.selectedPreset);
    setGrainAmount(snapshot.grainAmount);
    setGrainSize(snapshot.grainSize);
    setGrainRoughness(snapshot.grainRoughness);
    setVignetteAmount(snapshot.vignetteAmount);
    setHalationAmount(snapshot.halationAmount);
    setContrastAmount(snapshot.contrastAmount);
    setSaturationAmount(snapshot.saturationAmount);
    setBrightnessAmount(snapshot.brightnessAmount);
    setFadedBlacks(snapshot.fadedBlacks);
    setExposure(snapshot.exposure);
    setPurpleFringing(snapshot.purpleFringing);
    setLensDistortion(snapshot.lensDistortion);
    setColorShiftX(snapshot.colorShiftX);
    setColorShiftY(snapshot.colorShiftY);
    setWhiteBalance(snapshot.whiteBalance);
    setCrossProcessAmount(snapshot.crossProcessAmount);
    setPushPullAmount(snapshot.pushPullAmount);
    setLevelsInputBlack(snapshot.levelsInputBlack);
    setLevelsInputWhite(snapshot.levelsInputWhite);
    setLevelsGamma(snapshot.levelsGamma);
    setLevelsOutputBlack(snapshot.levelsOutputBlack);
    setLevelsOutputWhite(snapshot.levelsOutputWhite);
    setSelectedOverlays(snapshot.selectedOverlays);
    setOverlayOpacityByCategory(snapshot.overlayOpacityByCategory);
    setOverlayRotationByCategory(snapshot.overlayRotationByCategory);
    setOverlayZoomByCategory(snapshot.overlayZoomByCategory);
    setOverlayBlendByCategory(snapshot.overlayBlendByCategory);
    setRotation(clampRotationValue(snapshot.rotation));
    setActiveBatchIndex(snapshot.activeBatchIndex);
  }, [clampRotationValue]);

  const pushHistory = useCallback(() => {
    const snapshot = createSnapshot();
    if (!snapshot) return;
    setHistory((prev) => [...prev, snapshot].slice(-30));
    setRedoStack([]);
  }, [createSnapshot]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const current = createSnapshot();
    if (current) {
      setRedoStack((prev) => [current, ...prev].slice(0, 30));
    }
    setHistory((prev) => prev.slice(0, -1));
    restoreSnapshot(previous);
  }, [history, createSnapshot, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    const current = createSnapshot();
    if (current) {
      setHistory((prev) => [...prev, current].slice(-30));
    }
    setRedoStack((prev) => prev.slice(1));
    restoreSnapshot(next);
  }, [redoStack, createSnapshot, restoreSnapshot]);

  const toggleFavorite = useCallback((presetId: string) => {
    setFavorites((prev) => prev.includes(presetId) ? prev.filter((id) => id !== presetId) : [...prev, presetId]);
  }, []);

  const loadImage = useCallback((src: string | null): Promise<HTMLImageElement | null> => {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }, []);

  const buildExportCanvas = useCallback(async (sourceCanvas: HTMLCanvasElement, editState: BatchImageEditState) => {
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = sourceCanvas.width;
    baseCanvas.height = sourceCanvas.height;
    const baseCtx = baseCanvas.getContext('2d');
    if (!baseCtx) throw new Error('Failed to create canvas context');

    const overlayImgs = await Promise.all(editState.selectedOverlays.map((url) => loadImage(url)));
    const loadedOverlays = overlayImgs.filter(Boolean) as HTMLImageElement[];

    const sourceImageData = sourceCanvas.getContext('2d')!.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    drawImageDataRotated(baseCtx, sourceImageData, editState.rotation || 0);

    const drawOverlays = (ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) => {
      if (loadedOverlays.length === 0) return;
      loadedOverlays.forEach((img, index) => {
        const category = OVERLAY_CATEGORY_MAP.get(editState.selectedOverlays[index]);
        if (!category) return;
        ctx.save();
        ctx.globalAlpha = editState.overlayOpacityByCategory[category];
        ctx.globalCompositeOperation = CANVAS_BLEND[editState.overlayBlendByCategory[category]] || 'source-over';
        if (category === 'frames') {
          drawImageContainRotated(
            ctx,
            img,
            targetWidth,
            targetHeight,
            editState.overlayRotationByCategory[category] ?? 0,
            editState.overlayZoomByCategory[category] ?? 1,
          );
        } else {
          drawImageCoverRotated(
            ctx,
            img,
            targetWidth,
            targetHeight,
            editState.overlayRotationByCategory[category] ?? 0,
            editState.overlayZoomByCategory[category] ?? 1,
          );
        }
        ctx.restore();
      });
    };

    drawOverlays(baseCtx, sourceCanvas.width, sourceCanvas.height);
    return baseCanvas;
  }, [loadImage]);

  const handleDownloadBatch = useCallback(async () => {
    if (batchImages.length === 0) return;
    setProcessing(true);
    for (const entry of batchImages) {
      const editState = entry.editState || getCurrentBatchEditState();
      const params: ProcessingParams = {
        grainAmountOverride: editState.grainAmount ?? undefined,
        grainSizeOverride: editState.grainSize ?? undefined,
        grainRoughnessOverride: editState.grainRoughness ?? undefined,
        vignetteOverride: editState.vignetteAmount ?? undefined,
        halationOverride: editState.halationAmount ?? undefined,
        contrastOverride: editState.contrastAmount ?? undefined,
        saturationOverride: editState.saturationAmount ?? undefined,
        brightnessOverride: editState.brightnessAmount ?? undefined,
        fadedBlacksOverride: editState.fadedBlacks ?? undefined,
        exposureCompensation: editState.exposure,
        purpleFringingOverride: editState.purpleFringing ?? undefined,
        lensDistortionOverride: editState.lensDistortion ?? undefined,
        colorShiftXOverride: editState.colorShiftX ?? undefined,
        colorShiftYOverride: editState.colorShiftY ?? undefined,
        whiteBalanceOverride: editState.whiteBalance ?? undefined,
        crossProcessOverride: editState.crossProcessAmount ?? undefined,
        pushPullOverride: editState.pushPullAmount ?? undefined,
        levelsInputBlackOverride: editState.levelsInputBlack ?? undefined,
        levelsInputWhiteOverride: editState.levelsInputWhite ?? undefined,
        levelsGammaOverride: editState.levelsGamma ?? undefined,
        levelsOutputBlackOverride: editState.levelsOutputBlack ?? undefined,
        levelsOutputWhiteOverride: editState.levelsOutputWhite ?? undefined,
      };
      const result = await processImageInWorker(entry.data, editState.selectedPreset, params, grainSeed);
      const canvas = document.createElement('canvas');
      canvas.width = result.width;
      canvas.height = result.height;
      canvas.getContext('2d')!.putImageData(result, 0, 0);
      const exportCanvas = await buildExportCanvas(canvas, editState);
      const link = document.createElement('a');
      const name = entry.file?.name.replace(/\.[^/.]+$/, '') || entry.name || 'batch-image';
      link.download = `${name}-${editState.selectedPreset.name.replace(/\s+/g, '-')}.jpg`;
      link.href = exportCanvas.toDataURL('image/jpeg', 0.92);
      link.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    setProcessing(false);
  }, [batchImages, getCurrentBatchEditState, grainSeed, processImageInWorker]);

  useEffect(() => {
    saveToStorage(PRESET_STORAGE_KEY, customPresets);
  }, [customPresets]);

  useEffect(() => {
    saveToStorage(FAVORITES_STORAGE_KEY, favorites);
  }, [favorites]);

  useLayoutEffect(() => {
    const updateBounds = () => {
      if (canvasRef.current) {
        setCanvasBounds(canvasRef.current.getBoundingClientRect());
      }
    };
    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [imageData, zoom, splitView, cropMode]);

  useEffect(() => {
    if (!imageData || !cropMode) return;

    const targetRatio = getCropAspectRatio(cropRatio, imageData.width, imageData.height);

    const width = imageData.width;
    const height = imageData.height;
    let cropWidth = width;
    let cropHeight = height;

    if (width / height > targetRatio) {
      cropWidth = Math.round(height * targetRatio);
    } else {
      cropHeight = Math.round(width / targetRatio);
    }

    setCropRect({
      x: (width - cropWidth) / 2 / width,
      y: (height - cropHeight) / 2 / height,
      w: cropWidth / width,
      h: cropHeight / height,
    });
  }, [imageData, cropMode, cropRatio]);

  const applyRotation = useCallback((angle: number) => {
    if (!imageData) return;
    pushHistory();
    cropResetImageDataRef.current = null;
    const rotated = rotateImageData(imageData, angle);
    setImageData(rotated);
    originalImageDataRef.current = rotated;
    setProcessedImageData(null);
    setRotation((prev) => clampRotationValue(prev + angle));
  }, [imageData, pushHistory, clampRotationValue]);

  const applyCrop = useCallback(() => {
    if (!imageData || !cropRect) return;
    pushHistory();
    cropResetImageDataRef.current = imageData;
    const cropped = cropImageDataRect(imageData, cropRect);
    setImageData(cropped);
    originalImageDataRef.current = cropped;
    setProcessedImageData(null);
    setCropMode(false);
    setCropRect(null);
  }, [imageData, cropRect, pushHistory]);

  const onCropPointerDown = useCallback((type: CropDragType) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropRect || !canvasBounds) return;
    e.preventDefault();
    e.stopPropagation();
    cropDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect: cropRect,
      type,
    };
    setDraggingCrop(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [cropRect, canvasBounds]);

  const onCropPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingCrop || !cropRect || !cropDragRef.current || !canvasBounds) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = (e.clientX - cropDragRef.current.startX) / canvasBounds.width;
    const dy = (e.clientY - cropDragRef.current.startY) / canvasBounds.height;
    const start = cropDragRef.current.startRect;
    if (!start) return;

    const aspectRatio = getCropAspectRatio(cropRatio, start.w, start.h);

    let next = { ...start };
    const minSize = 0.05;
    const type = cropDragRef.current.type;

    if (type === 'move') {
      next.x = Math.min(Math.max(0, start.x + dx), 1 - start.w);
      next.y = Math.min(Math.max(0, start.y + dy), 1 - start.h);
    } else {
      let newX = start.x;
      let newY = start.y;
      let newW = start.w;
      let newH = start.h;

      if (type === 'nw' || type === 'sw') {
        newX = start.x + dx;
      }
      if (type === 'nw' || type === 'ne') {
        newY = start.y + dy;
      }
      if (type === 'ne' || type === 'se') {
        newW = start.w + dx;
      }
      if (type === 'sw' || type === 'se') {
        newH = start.h + dy;
      }

      if (cropRatio !== 'original') {
        const widthDelta = type === 'nw' || type === 'sw' ? -dx : dx;
        const heightDelta = type === 'nw' || type === 'ne' ? -dy : dy;
        const rawWidth = start.w + (type === 'nw' || type === 'sw' ? -dx : dx);
        const rawHeight = start.h + (type === 'nw' || type === 'ne' ? -dy : dy);

        if (Math.abs(widthDelta) > Math.abs(heightDelta * aspectRatio)) {
          newW = Math.max(minSize, rawWidth);
          newH = Math.max(minSize, newW / aspectRatio);
          if (type === 'nw' || type === 'sw') {
            newX = start.x + (start.w - newW);
          }
          if (type === 'nw' || type === 'ne') {
            newY = start.y + (start.h - newH);
          }
        } else {
          newH = Math.max(minSize, rawHeight);
          newW = Math.max(minSize, newH * aspectRatio);
          if (type === 'nw' || type === 'sw') {
            newX = start.x + (start.w - newW);
          }
          if (type === 'nw' || type === 'ne') {
            newY = start.y + (start.h - newH);
          }
        }
      }

      if (type === 'nw') {
        next = {
          x: newX,
          y: newY,
          w: start.x + start.w - newX,
          h: start.y + start.h - newY,
        };
      } else if (type === 'ne') {
        next = {
          x: start.x,
          y: newY,
          w: newW,
          h: start.y + start.h - newY,
        };
      } else if (type === 'sw') {
        next = {
          x: newX,
          y: start.y,
          w: start.x + start.w - newX,
          h: newH,
        };
      } else if (type === 'se') {
        next = {
          x: start.x,
          y: start.y,
          w: newW,
          h: newH,
        };
      }
    }

    setCropRect(clampCropRect(next, minSize, cropRatio !== 'original' ? aspectRatio : undefined));
  }, [draggingCrop, cropRatio, cropRect, canvasBounds]);

  const onCropPointerUp = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    if (e) {
      e.preventDefault();
    }
    setDraggingCrop(false);
    cropDragRef.current = null;
  }, []);

  const resetCrop = useCallback(() => {
    setCropMode(false);
    setCropRect(null);
    if (cropResetImageDataRef.current) {
      setImageData(cropResetImageDataRef.current);
      originalImageDataRef.current = cropResetImageDataRef.current;
      setProcessedImageData(null);
      cropResetImageDataRef.current = null;
    }
  }, []);

  const resetTransform = useCallback(() => {
    pushHistory();
    setProcessedImageData(null);
    setCropMode(false);
    setCropRect(null);
    setRotation(0);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [pushHistory]);

  useEffect(() => {
    const el = mainAreaRef.current;
    if (!el || !image) return;

    const clampZoom = (value: number) => Math.min(3, Math.max(0.5, value));
    const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const onWheel = (e: WheelEvent) => {
      if (!image) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((prev) => clampZoom(prev + delta));
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const targetElement = e.target as HTMLElement;
      if (targetElement.closest('[data-ignore-pan]')) return;
      e.preventDefault();
      const pointerTarget = e.currentTarget as HTMLElement;
      if (typeof pointerTarget?.setPointerCapture === 'function') {
        try {
          pointerTarget.setPointerCapture(e.pointerId);
        } catch {}
      } else if (typeof (e.target as HTMLElement)?.setPointerCapture === 'function') {
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
      pointerPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointerPositionsRef.current.size === 1) {
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startOffset: offsetRef.current,
        };
      }
      if (pointerPositionsRef.current.size === 2) {
        panRef.current = null;
        const positions = Array.from(pointerPositionsRef.current.values());
        pinchRef.current = {
          startDistance: getDistance(positions[0], positions[1]),
          startZoom: zoomRef.current,
        };
      }
    };

    const updateWrapperTransform = (nextOffset: { x: number; y: number }, zoomValue: number) => {
      const wrapper = imageWrapperRef.current;
      if (wrapper) {
        wrapper.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0) scale(${zoomValue})`;
      }
    };

    const scheduleOffsetUpdate = (nextOffset: { x: number; y: number }) => {
      offsetRef.current = nextOffset;
      pendingOffsetRef.current = nextOffset;
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          if (pendingOffsetRef.current) {
            updateWrapperTransform(pendingOffsetRef.current, zoomRef.current);
            pendingOffsetRef.current = null;
          }
        });
      }
    };

    const flushOffsetUpdate = () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (pendingOffsetRef.current) {
        updateWrapperTransform(pendingOffsetRef.current, zoomRef.current);
        setOffset(pendingOffsetRef.current);
        pendingOffsetRef.current = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if ((e.pointerType !== 'touch' && e.pointerType !== 'mouse') || !pointerPositionsRef.current.has(e.pointerId)) return;
      pointerPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointerPositionsRef.current.size === 2 && pinchRef.current) {
        e.preventDefault();
        const positions = Array.from(pointerPositionsRef.current.values());
        const distance = getDistance(positions[0], positions[1]);
        const nextZoom = clampZoom(pinchRef.current.startZoom * (distance / pinchRef.current.startDistance));
        setZoom(nextZoom);
        return;
      }
      if (pointerPositionsRef.current.size === 1 && panRef.current) {
        e.preventDefault();
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        scheduleOffsetUpdate({
          x: panRef.current.startOffset.x + dx / zoomRef.current,
          y: panRef.current.startOffset.y + dy / zoomRef.current,
        });
      }
    };

    const preventTouchScroll = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        event.preventDefault();
      }
    };

    const endPinch = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return;
      if (typeof (e.target as HTMLElement)?.releasePointerCapture === 'function') {
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
      }
      pointerPositionsRef.current.delete(e.pointerId);
      if (pointerPositionsRef.current.size < 2) {
        pinchRef.current = null;
      }
      if (pointerPositionsRef.current.size === 0) {
        panRef.current = null;
        flushOffsetUpdate();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('touchstart', preventTouchScroll, { passive: false });
    el.addEventListener('touchmove', preventTouchScroll, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', endPinch);
    window.addEventListener('pointercancel', endPinch);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('touchstart', preventTouchScroll);
      el.removeEventListener('touchmove', preventTouchScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPinch);
      window.removeEventListener('pointercancel', endPinch);
      pointerPositionsRef.current.clear();
      pinchRef.current = null;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [image]);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [image]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const handleDownload = useCallback(async () => {
    if (!imageData) return;
    setProcessing(true);

    try {
      const processed = await processImageInWorker(imageData, currentPreset, currentParams, grainSeed);
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = processed.width;
      sourceCanvas.height = processed.height;
      sourceCanvas.getContext('2d')!.putImageData(processed, 0, 0);

      const exportCanvas = await buildExportCanvas(sourceCanvas, getCurrentBatchEditState());

      const link = document.createElement('a');
      link.download = `${selectedPreset.brand}-${selectedPreset.name.replace(/\s+/g, '-')}.jpg`;
      link.href = exportCanvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (error) {
      console.error('Export failed', error);
    } finally {
      setProcessing(false);
    }
  }, [selectedPreset, currentParams, grainSeed, processImageInWorker, imageData, buildExportCanvas, getCurrentBatchEditState]);

  const resetOverrides = useCallback(() => {
    setGrainAmount(null);
    setGrainSize(null);
    setGrainRoughness(null);
    setVignetteAmount(null);
    setHalationAmount(null);
    setContrastAmount(null);
    setSaturationAmount(null);
    setBrightnessAmount(null);
    setFadedBlacks(null);
    setExposure(0);
    setPurpleFringing(null);
    setLensDistortion(null);
    setColorShiftX(null);
    setColorShiftY(null);
    setWhiteBalance(null);
    setWbMultipliers(null);
    setTintAmount(null);
    setCrossProcessAmount(null);
    setPushPullAmount(null);
    setLevelsInputBlack(null);
    setLevelsInputWhite(null);
    setLevelsGamma(null);
    setLevelsOutputBlack(null);
    setLevelsOutputWhite(null);
    setCurvePointsR(selectedPreset.curves.r.map(([x, y]) => [x, y]));
    setCurvePointsG(selectedPreset.curves.g.map(([x, y]) => [x, y]));
    setCurvePointsB(selectedPreset.curves.b.map(([x, y]) => [x, y]));
    setCurvePointsMaster(selectedPreset.curves.r.map(([x, y], index) => [
      x,
      (y + selectedPreset.curves.g[index][1] + selectedPreset.curves.b[index][1]) / 3,
    ] as [number, number]));
    setOverlayOpacityByCategory({
      lightleaks: 0.6,
      bokeh: 0.6,
      textures: 0.6,
      frames: 1,
      paper: 0.8,
    });
    setOverlayBlendByCategory({
      lightleaks: 'screen',
      bokeh: 'screen',
      textures: 'screen',
      frames: 'normal',
      paper: 'overlay',
    });
    setOverlayRotationByCategory({
      lightleaks: 0,
      bokeh: 0,
      textures: 0,
      frames: 0,
      paper: 0,
    });
    setOverlayZoomByCategory({
      lightleaks: 1,
      bokeh: 1,
      textures: 1,
      frames: 1,
      paper: 1,
    });
  }, [selectedPreset.curves]);

  const handleWbPickerClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!wbPickerActive || !imageData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / (rect.width / canvas.width);
    const y = (event.clientY - rect.top) / (rect.height / canvas.height);

    // Sample a region around the click to reduce noise
    const [r, g, b] = sampleRegion(imageData, x, y, 3);

    // Calculate WB multipliers from the sample
    const multipliers = calculateNeutralWB(r, g, b);
    setWbMultipliers(multipliers);

    // Estimate a slider position in kelvin and update the UI
    const kelvin = kelvinFromRGB(r, g, b);
    setWhiteBalance(kelvinToWhiteBalance(kelvin));

    // Exit picker mode
    setWbPickerActive(false);
  }, [wbPickerActive, imageData, setWhiteBalance, setWbMultipliers]);

  const customPresetItems = useMemo(() => customPresets.filter((preset) => {
    if (showFavoritesOnly && !favorites.includes(preset.id)) return false;
    return filterType === 'custom' || (filterType === 'all' && showFavoritesOnly);
  }), [customPresets, filterType, showFavoritesOnly, favorites]);

  // Detect if we're in negative mode (selected preset is a negative inversion preset)
  const isNegativeMode = selectedPreset.negativeInvertOnly === true;

  const filteredPresets = useMemo(() => filmPresets.filter((preset) => {
    if (showFavoritesOnly && !favorites.includes(preset.id)) return false;
    if (filterType === 'custom') return false;
    
    // In negative mode, show ONLY negative inversion presets
    if (isNegativeMode) {
      return preset.negativeInvertOnly === true;
    }
    
    // In regular mode, hide negative inversion presets
    if (preset.negativeInvertOnly) return false;
    
    return filterType === 'all' || preset.type === filterType;
  }), [filterType, showFavoritesOnly, favorites, isNegativeMode]);

  const displayedPresets = useMemo(() => [...customPresetItems, ...filteredPresets], [customPresetItems, filteredPresets]);

  const selectPreset = useCallback((preset: FilmPreset) => {
    if (imageData) pushHistory();
    setSelectedPreset(preset);
  }, [imageData, pushHistory]);

  const activeOverlayCategory = overlayCategories[0] ?? 'lightleaks';
  const activeOverlayBlend = selectedOverlays.length > 0 ? overlayBlendByCategory[activeOverlayCategory] : 'normal';

  const currentPresetIndex = displayedPresets.findIndex((p) => p.id === selectedPreset.id);

  const goToNextPreset = useCallback(() => {
    if (displayedPresets.length === 0) return;
    const nextIndex = (currentPresetIndex + 1) % displayedPresets.length;
    setSelectedPreset(displayedPresets[nextIndex]);
  }, [displayedPresets, currentPresetIndex]);

  const goToPrevPreset = useCallback(() => {
    if (displayedPresets.length === 0) return;
    const prevIndex = (currentPresetIndex - 1 + displayedPresets.length) % displayedPresets.length;
    setSelectedPreset(displayedPresets[prevIndex]);
  }, [displayedPresets, currentPresetIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!image) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPreset();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPreset();
      } else if (e.key === '[' || e.key === '{') {
        e.preventDefault();
        goToPrevPreset();
      } else if (e.key === ']' || e.key === '}') {
        e.preventDefault();
        goToNextPreset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, goToNextPreset, goToPrevPreset]);

  const eff = useMemo(() => ({
    grainAmount: grainAmount ?? selectedPreset.grainAmount,
    grainSize: grainSize ?? selectedPreset.grainSize,
    grainRoughness: grainRoughness ?? selectedPreset.grainRoughness,
    vignette: vignetteAmount ?? selectedPreset.vignette,
    halation: halationAmount ?? selectedPreset.halation,
    contrast: contrastAmount ?? selectedPreset.contrast,
    saturation: saturationAmount ?? selectedPreset.saturation,
    brightness: brightnessAmount ?? selectedPreset.brightness,
    fadedBlacks: fadedBlacks ?? selectedPreset.fadedBlacks,
    purpleFringing: purpleFringing ?? selectedPreset.purpleFringing,
    lensDistortion: lensDistortion ?? selectedPreset.lensDistortion,
    colorShiftX: colorShiftX ?? selectedPreset.colorShiftX,
    colorShiftY: colorShiftY ?? selectedPreset.colorShiftY,
    whiteBalance: whiteBalance ?? selectedPreset.whiteBalance,
    tint: tintAmount ?? selectedPreset.tint ?? 0,
    crossProcess: crossProcessAmount ?? selectedPreset.crossProcess ?? 0,
    pushPull: pushPullAmount ?? selectedPreset.pushPull ?? 0,
    levelsInputBlack: levelsInputBlack ?? selectedPreset.levelsInputBlack ?? 0,
    levelsInputWhite: levelsInputWhite ?? selectedPreset.levelsInputWhite ?? 1,
    levelsGamma: levelsGamma ?? selectedPreset.levelsGamma ?? 1,
    levelsOutputBlack: levelsOutputBlack ?? selectedPreset.levelsOutputBlack ?? 0,
    levelsOutputWhite: levelsOutputWhite ?? selectedPreset.levelsOutputWhite ?? 1,
  }), [grainAmount, grainSize, grainRoughness, vignetteAmount, halationAmount, contrastAmount, saturationAmount, brightnessAmount, fadedBlacks, purpleFringing, lensDistortion, colorShiftX, colorShiftY, whiteBalance, tintAmount, crossProcessAmount, pushPullAmount, levelsInputBlack, levelsInputWhite, levelsGamma, levelsOutputBlack, levelsOutputWhite, selectedPreset]);

  const levelsHistogram = useMemo(() => {
    if (!imageData) return null;
    // Use the histogram processed image (all effects except levels)
    const sourceImage = histogramProcessedImageData ?? imageData;
    const buffer = new Uint32Array(256);
    const data = sourceImage.data;
    const pixelCount = data.length / 4;
    const sampleStep = Math.max(1, Math.floor(pixelCount / 65536));
    const stepBytes = sampleStep * 4;
    for (let i = 0; i < data.length; i += stepBytes) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = Math.min(255, Math.max(0, Math.round((r * 0.299 + g * 0.587 + b * 0.114))));
      buffer[lum]++;
    }
    return buffer;
  }, [imageData, histogramProcessedImageData]);

  const handleSaveCustomPreset = useCallback(() => {
    const name = customPresetName.trim() || `${selectedPreset.name} Custom`;
    const description = customPresetDescription.trim() || `Custom preset based on ${selectedPreset.name}`;
    const newPreset: FilmPreset = {
      ...currentPreset,
      id: `custom-${Date.now()}`,
      name,
      brand: 'My Presets',
      description,
      contrast: eff.contrast,
      brightness: eff.brightness,
      saturation: eff.saturation,
      grainAmount: eff.grainAmount,
      grainSize: eff.grainSize,
      grainRoughness: eff.grainRoughness,
      vignette: eff.vignette,
      halation: eff.halation,
      fadedBlacks: eff.fadedBlacks,
      purpleFringing: eff.purpleFringing,
      lensDistortion: eff.lensDistortion,
      colorShiftX: eff.colorShiftX,
      colorShiftY: eff.colorShiftY,
      whiteBalance: eff.whiteBalance,
      levelsInputBlack: eff.levelsInputBlack,
      levelsInputWhite: eff.levelsInputWhite,
      levelsGamma: eff.levelsGamma,
      levelsOutputBlack: eff.levelsOutputBlack,
      levelsOutputWhite: eff.levelsOutputWhite,
    };
    setCustomPresets((prev) => [...prev, newPreset]);
    setSelectedPreset(newPreset);
    setCustomPresetName('');
    setCustomPresetDescription('');
  }, [customPresetDescription, customPresetName, eff, selectedPreset]);

  const deleteCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => prev.filter((preset) => preset.id !== id));
    if (selectedPreset.id === id) {
      setSelectedPreset(filmPresets[0]);
    }
  }, [selectedPreset.id]);

const curveOverridesExist = useMemo(() => {
    const comparePoints = (source: [number, number][], base: [number, number][]) =>
      source.length === base.length && source.some((point, index) => point[0] !== base[index][0] || point[1] !== base[index][1]);

    return (
      comparePoints(curvePointsR, selectedPreset.curves.r) ||
      comparePoints(curvePointsG, selectedPreset.curves.g) ||
      comparePoints(curvePointsB, selectedPreset.curves.b)
    );
  }, [curvePointsR, curvePointsG, curvePointsB, selectedPreset.curves]);

  const hasOverrides = useMemo(() => (
    grainAmount !== null || grainSize !== null || grainRoughness !== null ||
    vignetteAmount !== null || halationAmount !== null || contrastAmount !== null ||
    saturationAmount !== null || brightnessAmount !== null || fadedBlacks !== null || exposure !== 0 ||
    purpleFringing !== null || lensDistortion !== null || colorShiftX !== null || colorShiftY !== null || whiteBalance !== null || crossProcessAmount !== null || pushPullAmount !== null ||
    levelsInputBlack !== null || levelsInputWhite !== null || levelsGamma !== null || levelsOutputBlack !== null || levelsOutputWhite !== null ||
    curveOverridesExist
  ), [grainAmount, grainSize, grainRoughness, vignetteAmount, halationAmount, contrastAmount, saturationAmount, brightnessAmount, fadedBlacks, exposure, purpleFringing, lensDistortion, colorShiftX, colorShiftY, whiteBalance, crossProcessAmount, pushPullAmount, levelsInputBlack, levelsInputWhite, levelsGamma, levelsOutputBlack, levelsOutputWhite, curveOverridesExist]);

  const handleSplitMove = useCallback((clientX: number) => {
    if (!draggingSplit || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSplitPos(Math.max(2, Math.min(98, x)));
  }, [draggingSplit]);

  return {
    image,
    imageData,
    selectedPreset,
    customPresets,
    favorites,
    customPresetName,
    customPresetDescription,
    batchImages,
    activeBatchIndex,
    cropMode,
    cropRatio,
    cropRect,
    draggingCrop,
    canvasBounds,
    showFavoritesOnly,
    history,
    redoStack,
    filterType,
    processing,
    showOriginal,
    splitView,
    splitPos,
    draggingSplit,
    sidebarOpen,
    grainSeed,
    loadingDemo,
    isAboutOpen,
    zoom,
    offset,
    overlayCategories,
    selectedOverlays,
    overlayOpacityByCategory,
    overlayRotationByCategory,
    overlayZoomByCategory,
    overlayBlendByCategory,
    rotation,
    grainAmount,
    grainSize,
    grainRoughness,
    vignetteAmount,
    halationAmount,
    contrastAmount,
    saturationAmount,
    brightnessAmount,
    fadedBlacks,
    exposure,
    purpleFringing,
    lensDistortion,
    colorShiftX,
    colorShiftY,
    whiteBalance,
    wbPickerActive,
    setWbPickerActive,
    wbMultipliers,
    setWbMultipliers,
    handleWbPickerClick,
    handleWhiteBalanceChange,
    crossProcessAmount,
    pushPullAmount,
    levelsInputBlack,
    levelsInputWhite,
    levelsGamma,
    levelsOutputBlack,
    levelsOutputWhite,
    processedImageData,
    canvasRef,
    originalCanvasRef,
    imageWrapperRef,
    fileInputRef,
    splitContainerRef,
    mainAreaRef,
    handleBatchFiles,
    handleDrop,
    selectBatchImage,
    handleDemo,
    handleDownloadBatch,
    handleUndo,
    handleRedo,
    resetOverrides,
    handleDownload,
    applyCrop,
    applyRotation,
    resetTransform,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    handleSaveCustomPreset,
    deleteCustomPreset,
    toggleFavorite,
    goToNextPreset,
    goToPrevPreset,
    setSidebarOpen,
    setShowOriginal,
    setSplitView,
    setSplitPos,
    setDraggingSplit,
    setCropMode,
    setCropRatio,
    setFilterType,
    setShowFavoritesOnly,
    setOverlayCategories,
    setSelectedOverlays,
    setOverlayOpacityByCategory,
    setOverlayRotationByCategory,
    setOverlayZoomByCategory,
    setOverlayBlendByCategory,
    setGrainAmount,
    setGrainSize,
    setGrainRoughness,
    setVignetteAmount,
    setHalationAmount,
    setContrastAmount,
    setSaturationAmount,
    setBrightnessAmount,
    setFadedBlacks,
    setExposure,
    setPurpleFringing,
    setLensDistortion,
    setColorShiftX,
    setColorShiftY,
    setWhiteBalance,
    setTintAmount,
    setCrossProcessAmount,
    setPushPullAmount,
    setLevelsInputBlack,
    setLevelsInputWhite,
    setLevelsGamma,
    setLevelsOutputBlack,
    setLevelsOutputWhite,
    curveChannel,
    setCurveChannel,
    curvePointsR,
    setCurvePointsR,
    curvePointsG,
    setCurvePointsG,
    curvePointsB,
    setCurvePointsB,
    curvePointsMaster,
    setCurvePointsMaster,
    setCustomPresetName,
    setCustomPresetDescription,
    setCropRect,
    setZoom,
    setOffset,
    setRotation,
    setLoadingDemo,
    setIsAboutOpen,
    setGrainSeed,
    setImage,
    setImageData,
    setProcessedImageData,
    setActiveBatchIndex,
    setProcessing,
    setSelectedPreset,
    selectPreset,
    currentParams,
    currentPreset,
    originalImageData,
    resetCrop,
    getCurrentBatchEditState,
    displayedPresets,
    filteredPresets,
    customPresetItems,
    activeOverlayBlend,
    currentPresetIndex,
    hasOverrides,
    eff,
    levelsHistogram,
    handleSplitMove,
    setBatchImages,
  };
}
