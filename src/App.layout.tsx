import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import logo from './favicon/logo.png';
import SectionHeader from './components/SectionHeader';
import SliderControl from './components/SliderControl';
import LevelsHistogram from './components/LevelsHistogram';
import CurvesEditor from './components/CurvesEditor';
import DesktopDownloadBanner from './components/DesktopDownloadBanner';
import { useFilmLabState } from './App.state';
import { getImageAcceptAttribute } from './utils/imageDecoder';
import { whiteBalanceToKelvin } from './utils/whiteBalanceUtils';
import { filmPresets } from './filmPresets';

const MIN_KELVIN = 2000;
const MAX_KELVIN = 50000;
const NEUTRAL_KELVIN = 6500;

import {
  typeLabels,
  typeColors,
  typeBadge,
  DEMO_IMAGES,
  PlusIcon,
  UploadIcon,
  DownloadIcon,
  CompareIcon,
  DiceIcon,
  EyeIcon,
  ResetIcon,
  RotateIcon,
  ZoomIcon,
  LevelsIcon,
  ToneIcon,
  GrainIcon,
  EffectsIcon,
  OpticalIcon,
  OverlayIcon,
  FrameIcon,
  WhiteBalanceIcon,
  ExposureIcon,
  ContrastIcon,
  SaturationIcon,
  FadedBlacksIcon,
  GrainIconSmall,
  VignetteIcon,
  HalationIcon,
  PurpleFringingIcon,
  LensDistortionIcon,
  ColorShiftIcon,
  CropIcon,
  PresetIcon,
  StarIcon,
  MenuIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CurvesIcon,
  ZoomOutIcon,
  ZoomInIcon,
  OVERLAYS,
  BLEND_MODES,
} from './App.helpers';
import FramingTool from './FramingTool';
import NegativeConverterTool from './NegativeConverterTool';
import CollageMarkerTool from './CollageMarkerTool';

export default function AppLayout() {
  const state = useFilmLabState();
  const [openSections, setOpenSections] = useState({
    tone: false,
    levels: false,
    presets: false,
    curves: false,
    filmGrain: false,
    effects: false,
    opticalEffects: false,
    overlays: false,
    cropRotate: false,
    customPreset: false,
  });
  const [sidebarWidth, setSidebarWidth] = useState(310);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSheetHeight, setMobileSheetHeight] = useState(55);
  const [isTouchPinching, setIsTouchPinching] = useState(false);
  const [framingToolOpen, setFramingToolOpen] = useState(false);
  const [negativeConverterToolOpen, setNegativeConverterToolOpen] = useState(false);
  const [collageToolOpen, setCollageToolOpen] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(310);
  const startYRef = useRef(0);
  const startHeightRef = useRef(55);

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  const { sidebarOpen } = state;
  const sidebarStyle = sidebarOpen
    ? isMobile
      ? { width: '100%', height: `${mobileSheetHeight}vh` }
      : { width: sidebarWidth }
    : { width: 0 };

  const onResizeMove = useCallback((event: PointerEvent) => {
    const nextWidth = startWidthRef.current + (event.clientX - startXRef.current);
    setSidebarWidth(Math.min(520, Math.max(220, nextWidth)));
  }, []);

  const onMobileResizeMove = useCallback((event: PointerEvent) => {
    const deltaY = startYRef.current - event.clientY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    const nextHeight = startHeightRef.current + deltaVh;
    setMobileSheetHeight(Math.min(75, Math.max(35, nextHeight)));
  }, []);

  const stopResize = useCallback(() => {
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', stopResize);
    window.removeEventListener('pointermove', onMobileResizeMove);
    window.removeEventListener('pointerup', stopResize);
  }, [onResizeMove, onMobileResizeMove]);

  const handleNegativeFileSelected = useCallback((file: File, imageData: ImageData) => {
    // Create URL for preview
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d')!.putImageData(imageData, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.95);

    // Set as active image
    const img = new Image();
    img.src = url;
    state.setImage(img);
    state.setImageData(imageData);

    // Auto-apply the invert negative utility preset when importing through the negative dialog
    const invertPreset = filmPresets.find((preset) => preset.id === 'invert-negative');
    if (invertPreset) {
      state.selectPreset(invertPreset);
    }

    // Enter crop mode automatically for negative imports
    state.setCropMode(true);
  }, [state]);

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobile) return;
    event.preventDefault();
    startXRef.current = event.clientX;
    startWidthRef.current = sidebarWidth;
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', stopResize);
  };

  const handleMobileResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    event.preventDefault();
    startYRef.current = event.clientY;
    startHeightRef.current = mobileSheetHeight;
    window.addEventListener('pointermove', onMobileResizeMove);
    window.addEventListener('pointerup', stopResize);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', stopResize);
    };
  }, [onResizeMove, stopResize]);

  useEffect(() => {
    if (!state.draggingSplit) return;

    const stopSplitDrag = () => state.setDraggingSplit(false);
    window.addEventListener('pointerup', stopSplitDrag);
    window.addEventListener('pointercancel', stopSplitDrag);

    return () => {
      window.removeEventListener('pointerup', stopSplitDrag);
      window.removeEventListener('pointercancel', stopSplitDrag);
    };
  }, [state.draggingSplit, state.setDraggingSplit]);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const {
    image,
    selectedPreset,
    favorites,
    customPresetName,
    customPresetDescription,
    batchImages,
    activeBatchIndex,
    cropMode,
    cropRect,
    draggingCrop,
    showFavoritesOnly,
    history,
    redoStack,
    filterType,
    processing,
    showOriginal,
    splitView,
    splitPos,
    exposure,
    loadingDemo,
    isAboutOpen,
    zoom,
    offset,
    setZoom,
    overlayCategories,
    selectedOverlays,
    overlayOpacityByCategory,
    overlayRotationByCategory,
    overlayZoomByCategory,
    overlayBlendByCategory,
    rotation,
    canvasRef,
    originalCanvasRef,
    imageWrapperRef,
    fileInputRef,
    splitContainerRef,
    mainAreaRef,
    handleBatchFiles,
    setImage,
    setImageData,
    setProcessedImageData,
    handleDrop,
    selectBatchImage,
    handleDemo,
    handleDownloadBatch,
    handleUndo,
    handleRedo,
    resetOverrides,
    handleDownload,
    applyCrop,
    resetCrop,
    setRotation,
    handleSaveCustomPreset,
    deleteCustomPreset,
    toggleFavorite,
    goToNextPreset,
    goToPrevPreset,
    setSidebarOpen,
    setShowOriginal,
    setSplitView,
    setDraggingSplit,
    setCropMode,
    setFilterType,
    setShowFavoritesOnly,
    setOverlayCategories,
    setSelectedOverlays,
    setOverlayOpacityByCategory,
    setOverlayBlendByCategory,
    setOverlayRotationByCategory,
    setOverlayZoomByCategory,
    setGrainAmount,
    setGrainSize,
    setGrainRoughness,
    setVignetteAmount,
    setHalationAmount,
    setContrastAmount,
    setSaturationAmount,
    setBrightnessAmount,
    setCrossProcessAmount,
    setPushPullAmount,
    setFadedBlacks,
    setExposure,
    setPurpleFringing,
    setLensDistortion,
    setColorShiftX,
    setColorShiftY,
    setWhiteBalance,
    setTintAmount,
    wbPickerActive,
    setWbPickerActive,
    wbMultipliers,
    handleWbPickerClick,
    handleWhiteBalanceChange,
    setLevelsInputBlack,
    setLevelsInputWhite,
    setLevelsGamma,
    setLevelsOutputBlack,
    setLevelsOutputWhite,
    levelsInputBlack,
    levelsInputWhite,
    levelsGamma,
    levelsOutputBlack,
    levelsOutputWhite,
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
    setIsAboutOpen,
    setGrainSeed,
    setActiveBatchIndex,
    selectPreset,
    displayedPresets,
    currentPresetIndex,
    hasOverrides,
    eff,
    levelsHistogram,
    handleSplitMove,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    setBatchImages,
  } = state;


  const handleMultiTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      setShowOriginal(false);
      setIsTouchPinching(true);
    }
  };

  const handleMultiTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsTouchPinching(false);
    }
    setShowOriginal(false);
  };

  const presetCountLabel = useMemo(() => `${currentPresetIndex + 1}/${displayedPresets.length}`, [currentPresetIndex, displayedPresets.length]);

  const clampZoom = (value: number) => Math.min(3, Math.max(0.5, value));
  const changeZoom = (delta: number) => setZoom((prev) => clampZoom(prev + delta));

  const presetCategories = ['all', 'color-negative', 'bw-negative', 'slide', 'cinema', 'custom', 'favorites'] as const;
  const activeCategory = showFavoritesOnly ? 'favorites' : filterType;
  const bottomSheetHeight = sidebarOpen && isMobile ? `${mobileSheetHeight}vh` : '0px';
  const wrapperTransformStyle = (zoom !== 1 || offset.x !== 0 || offset.y !== 0)
    ? {
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }
    : undefined;

  const selectPresetCategory = (category: typeof presetCategories[number]) => {
    if (category === 'favorites') {
      setFilterType('all');
      setShowFavoritesOnly(true);
    } else if (category === 'custom') {
      setFilterType('custom');
      setShowFavoritesOnly(false);
    } else {
      setFilterType(category);
      setShowFavoritesOnly(false);
    }
  };

  const handleCurveChange = (channel: 'master' | 'r' | 'g' | 'b', points: [number, number][]) => {
    if (channel === 'master') {
      setCurvePointsMaster(points);
      setCurvePointsR(points);
      setCurvePointsG(points);
      setCurvePointsB(points);
    } else if (channel === 'r') setCurvePointsR(points);
    else if (channel === 'g') setCurvePointsG(points);
    else setCurvePointsB(points);
  };

  const overlayCategoryOptions = ['lightleaks', 'bokeh', 'textures', 'frames', 'paper'] as const;
  const overlayCategorySet = new Set(overlayCategories);
  const activeOverlayCategory = overlayCategories[0] ?? 'lightleaks';

  const toggleOverlayCategory = (category: typeof overlayCategoryOptions[number]) => {
    setOverlayCategories([category]);
  };

  const overlayItems = useMemo(() => overlayCategories.flatMap((category) => {
    const urls = OVERLAYS[category].urls;
    const thumbs = OVERLAYS[category].thumbs;
    return urls.map((url, i) => ({
      category,
      thumb: thumbs[i] ?? url,
      url,
    }));
  }), [overlayCategories]);

  return (
    <>
      <DesktopDownloadBanner />
      <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
        <header className="border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-xl z-50 shrink-0">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-zinc-400 hover:text-zinc-200"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
            </button>
            <img src={logo} alt="FilmLab logo" className="hidden md:block w-8 h-8 rounded-none object-contain" />
            <div>
              <h1 className="hidden md:block text-base font-bold tracking-tight leading-tight">FilmLab</h1>
              <p className="hidden md:block text-[9px] text-zinc-600 tracking-[0.2em] uppercase leading-tight">Analogue Film Emulation</p>
            </div>
          </div>

          <div
            className="flex items-center gap-3 overflow-x-auto max-w-full"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <button
              onClick={() => setFramingToolOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all border flex-shrink-0 bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50"
              title="Open framing tool"
              aria-label="Open framing tool"
            >
              <FrameIcon />
              <span className="ml-1">Framer</span>
            </button>
            <button
              onClick={() => setNegativeConverterToolOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all border flex-shrink-0 bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50"
              title="Open negative converter"
              aria-label="Open negative converter"
            >
              📽️
              <span className="ml-1">Negative</span>
            </button>
            <button
              onClick={() => setCollageToolOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all border flex-shrink-0 bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50"
              title="Open collage maker"
              aria-label="Open collage maker"
            >
              🎨
              <span className="ml-1">Collage</span>
            </button>
            <button
              onClick={() => setIsAboutOpen(true)}
              className="p-2 rounded-lg transition-all border flex-shrink-0 bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50"
              title="About the app"
              aria-label="About the app"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 19c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6z" />
              </svg>
            </button>
            {image && (
              <>
                <button
                  onClick={() => {
                    setSplitView((prev) => !prev);
                    setShowOriginal(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all border flex-shrink-0 ${
                    splitView
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                      : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50'
                  }`}
                >
                  <span className="inline-flex items-center justify-center">
                    <CompareIcon />
                  </span>
                  <span className="hidden md:inline ml-1.5">Compare</span>
                </button>
                <button
                  onMouseDown={() => setShowOriginal(true)}
                  onMouseUp={() => setShowOriginal(false)}
                  onMouseLeave={() => setShowOriginal(false)}
                  onTouchStart={(e) => {
                    if (e.touches.length === 1 && !isTouchPinching) {
                      setShowOriginal(true);
                    } else if (e.touches.length > 1) {
                      setShowOriginal(false);
                      setIsTouchPinching(true);
                    }
                  }}
                  onTouchMove={handleMultiTouchMove}
                  onTouchEnd={handleMultiTouchEnd}
                  onTouchCancel={handleMultiTouchEnd}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-all select-none flex items-center gap-1.5 flex-shrink-0 ${
                    showOriginal
                      ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                      : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50'
                  }`}
                >
                  <EyeIcon />
                  <span className="hidden md:inline">Hold: Original</span>
                </button>
                <div className="w-px h-5 bg-zinc-800 mx-1" />
                <button
                  onClick={() => changeZoom(-0.1)}
                  disabled={zoom <= 0.5}
                  title="Zoom out"
                  className="p-2 rounded-md bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 transition-all flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ZoomOutIcon />
                </button>
                <button
                  onClick={() => changeZoom(0.1)}
                  disabled={zoom >= 3}
                  title="Zoom in"
                  className="p-2 rounded-md bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 transition-all flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ZoomInIcon />
                </button>
                <div className="w-px h-5 bg-zinc-800 mx-1" />
                <button
                  onClick={goToPrevPreset}
                  className="p-1.5 rounded-md text-[10px] bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 transition-all flex items-center justify-center flex-shrink-0"
                  title="Previous preset (← or [)"
                >
                  <ChevronLeftIcon />
                </button>
                <div className="hidden sm:block text-[10px] text-zinc-600 px-1 tabular-nums font-medium min-w-[3ch] text-center">
                  {presetCountLabel}
                </div>
                <button
                  onClick={goToNextPreset}
                  className="p-1.5 rounded-md text-[10px] bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 transition-all flex items-center justify-center flex-shrink-0"
                  title="Next preset (→ or ])"
                >
                  <ChevronRightIcon />
                </button>
                <div className="w-px h-5 bg-zinc-800 mx-1" />
              </>
            )}
            {image && (
              <>
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  title="Undo"
                  aria-label="Undo"
                  className="p-2 rounded-lg border transition-all flex items-center justify-center flex-shrink-0 bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↶
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  title="Redo"
                  aria-label="Redo"
                  className="p-2 rounded-lg border transition-all flex items-center justify-center flex-shrink-0 bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↷
                </button>
                <button
                  onClick={resetOverrides}
                  disabled={!hasOverrides}
                  title="Reset all adjustments"
                  className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all border flex-shrink-0 bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 border-zinc-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ResetIcon />
                  <span className="hidden md:inline ml-1">Reset</span>
                </button>
              </>
            )}
            {image && (
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 rounded-lg text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20 flex-shrink-0 whitespace-nowrap"
              >
                <DownloadIcon />
                <span className="hidden md:inline ml-1">Export</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <aside
          style={sidebarStyle}
          className={`border-t md:border-t-0 md:border-r border-zinc-800/50 bg-zinc-900/40 backdrop-blur-sm flex flex-col min-h-0 overflow-y-auto transition-all duration-200 ${sidebarOpen ? 'fixed inset-x-0 bottom-0 h-[55vh] z-40 md:relative md:static md:top-16 md:left-0 md:right-auto md:h-auto' : 'w-0 min-w-0'}`}
        >
          <div
            className="md:hidden py-3 border-b border-zinc-800/40 bg-zinc-900/40 flex items-center justify-center touch-none"
            onPointerDown={handleMobileResizePointerDown}
          >
            <div className="h-1.5 w-16 rounded-full bg-zinc-700" />
          </div>

          <div className="md:sticky md:top-0 z-20 px-3 pt-3 pb-2 border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-xl shadow-sm">
            <div className="mt-3 px-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <span>Images ({batchImages.length})</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    aria-label="Add images"
                  >
                    <PlusIcon />
                    <span className="sr-only">Add images</span>
                  </button>
                  {batchImages.length > 0 && (
                    <button
                      onClick={handleDownloadBatch}
                      className="p-2 rounded-md bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                      aria-label="Export images"
                    >
                      <DownloadIcon />
                      <span className="sr-only">Export images</span>
                    </button>
                  )}
                </div>
              </div>
              {batchImages.length > 1 && (
                <>
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    <span>Current Images</span>
                    <button
                      onClick={() => {
                        setBatchImages([]);
                        setActiveBatchIndex(null);
                        setImage(null);
                        setImageData(null);
                        setProcessedImageData(null);
                      }}
                      className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {batchImages.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => selectBatchImage(index)}
                        className={`aspect-square rounded overflow-hidden border ${activeBatchIndex === index ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-zinc-700/40 hover:border-zinc-500'}`}
                      >
                        <img src={item.thumbUrl || item.url} className="w-full h-full object-cover" alt={item.name} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 pb-4 border-b border-zinc-800/30">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleSection('levels')}
                  className="flex items-center gap-3"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.levels ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Levels" icon={<LevelsIcon />} />
                </button>
                <button
                  type="button"
                  aria-label="Reset Levels"
                  onClick={() => {
                    setLevelsInputBlack(null);
                    setLevelsInputWhite(null);
                    setLevelsGamma(null);
                    setLevelsOutputBlack(null);
                    setLevelsOutputWhite(null);
                  }}
                  disabled={
                    levelsInputBlack === null &&
                    levelsInputWhite === null &&
                    levelsGamma === null &&
                    levelsOutputBlack === null &&
                    levelsOutputWhite === null
                  }
                  className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ResetIcon />
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.levels ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="mt-2">
                  <LevelsHistogram
                    histogram={levelsHistogram}
                    inputBlack={eff.levelsInputBlack}
                    inputWhite={eff.levelsInputWhite}
                    gamma={eff.levelsGamma}
                    onInputBlackChange={setLevelsInputBlack}
                    onInputWhiteChange={setLevelsInputWhite}
                    onGammaChange={setLevelsGamma}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 py-3 border-b border-zinc-800/40 space-y-2">
            <button
              type="button"
              onClick={() => toggleSection('presets')}
              className="flex items-center gap-3"
            >
              <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.presets ? 'rotate-90' : ''}`} />
              <SectionHeader title="Presets" icon={<PresetIcon />} />
            </button>
            <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.presets ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="flex flex-wrap gap-2">
                  {presetCategories.map((category) => {
                    const label = category === 'favorites' ? 'Favorites' : typeLabels[category];
                    const isActive = activeCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => selectPresetCategory(category)}
                        className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.18em] transition-colors border ${isActive ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <div className="px-2 py-1.5 space-y-0.5">
                    {displayedPresets.map((preset) => {
                const isSelected = selectedPreset.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectPreset(preset)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectPreset(preset);
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all group relative cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800/90 shadow-sm'
                        : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-amber-500 rounded-r-full" />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{preset.brand}</span>
                          {favorites.includes(preset.id) && (
                            <span className="text-amber-400 text-[10px]">★</span>
                          )}
                        </div>
                        <h3 className={`text-[13px] font-semibold leading-tight ${
                          isSelected ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}>
                          {preset.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(preset.id);
                          }}
                          className={`p-1 rounded-md transition-colors ${favorites.includes(preset.id) ? 'bg-amber-500 text-black' : 'bg-zinc-800/70 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}
                          aria-label={favorites.includes(preset.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <StarIcon filled={favorites.includes(preset.id)} />
                        </button>
                        {(preset.brand === 'My Presets' || preset.id.startsWith('custom-')) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete custom preset '${preset.name}'?`)) {
                                deleteCustomPreset(preset.id);
                              }
                            }}
                            className="p-1 rounded-md bg-zinc-800/70 text-zinc-400 hover:bg-red-500 hover:text-white transition-colors"
                            aria-label="Delete custom preset"
                          >
                            ×
                          </button>
                        )}
                        {preset.id !== 'none' && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${typeColors[preset.type]}`}>
                            {typeBadge[preset.type]}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">{preset.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
          <div className="border-t border-zinc-800/50">
              <div className="px-3 pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => toggleSection('tone')}
                  className="flex items-center gap-3"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.tone ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Tone" icon={<ToneIcon />} />
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.tone ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="px-3 pb-2 space-y-1.5">
                {image && (
                  <button
                    type="button"
                    onClick={() => setWbPickerActive(!wbPickerActive)}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                      wbPickerActive
                        ? 'bg-amber-500 text-zinc-950 border border-amber-400'
                        : 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/50 hover:border-amber-500/50 hover:bg-zinc-800'
                    }`}
                  >
                    {wbPickerActive ? '🎯 Click image to set WB' : '🎯 Pick White Balance'}
                  </button>
                )}
                <SliderControl label="White Balance" value={eff.whiteBalance} min={-1} max={1} step={0.01}
                  defaultValue={selectedPreset.whiteBalance ?? 0} onChange={handleWhiteBalanceChange} format={(v) => `${Math.round(whiteBalanceToKelvin(v))}K`} icon={<WhiteBalanceIcon />} />
                <SliderControl label="Tint" value={eff.tint} min={-150} max={150} step={1}
                  defaultValue={selectedPreset.tint ?? 0} onChange={setTintAmount} format={(v) => v > 0 ? `+${Math.round(v)} Magenta` : v < 0 ? `${Math.round(v)} Green` : 'Neutral'} icon={<ColorShiftIcon />} />
                <SliderControl label="Exposure" value={exposure} min={-3} max={3} step={0.025}
                  defaultValue={0} onChange={(v) => setExposure(v ?? 0)} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`} icon={<ExposureIcon />} />
                <SliderControl label="Contrast" value={eff.contrast} min={-0.5} max={0.5} step={0.01}
                  defaultValue={selectedPreset.contrast} onChange={setContrastAmount} format={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}`} icon={<ContrastIcon />} />
                <SliderControl label="Saturation" value={eff.saturation} min={0} max={2} step={0.01}
                  defaultValue={selectedPreset.saturation} onChange={setSaturationAmount} format={(v) => `${(v * 100).toFixed(0)}%`} icon={<SaturationIcon />} />
                <SliderControl label="Cross Process" value={eff.crossProcess} min={-1} max={1} step={0.05}
                  defaultValue={selectedPreset.crossProcess ?? 0} onChange={setCrossProcessAmount} format={(v) => v > 0 ? `+${(v * 100).toFixed(0)}% Magenta` : v < 0 ? `${(v * 100).toFixed(0)}% Green` : 'Neutral'} icon={<ColorShiftIcon />} />
                <SliderControl label="Push / Pull" value={eff.pushPull} min={-1} max={1} step={0.01}
                  defaultValue={selectedPreset.pushPull ?? 0} onChange={setPushPullAmount} format={(v) => v > 0 ? `Push +${(v * 100).toFixed(0)}%` : v < 0 ? `Pull ${Math.abs(Math.round(v * 100))}%` : 'Neutral'} icon={<ContrastIcon />} />
              </div>
              </div>
              <div className="px-3 pt-3 pb-2 border-t border-zinc-800/40 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleSection('curves')}
                  className="flex items-center gap-3"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.curves ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Curves" icon={<CurvesIcon />} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseR = selectedPreset.curves.r.map(([x, y]) => [x, y] as [number, number]);
                    const baseG = selectedPreset.curves.g.map(([x, y]) => [x, y] as [number, number]);
                    const baseB = selectedPreset.curves.b.map(([x, y]) => [x, y] as [number, number]);

                    setCurvePointsR(baseR);
                    setCurvePointsG(baseG);
                    setCurvePointsB(baseB);
                    setCurvePointsMaster(baseR.map(([x, y], index) => [
                      x,
                      (y + baseG[index][1] + baseB[index][1]) / 3,
                    ] as [number, number]));
                    setCurveChannel('master');
                  }}
                  className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-amber-400 transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.curves ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="px-3 pb-3">
                  <CurvesEditor
                    activeChannel={curveChannel}
                    setActiveChannel={setCurveChannel}
                    curves={{ r: curvePointsR, g: curvePointsG, b: curvePointsB, master: curvePointsMaster }}
                    histogram={levelsHistogram}
                    onCurveChange={handleCurveChange}
                  />
                </div>
              </div>

              <div className="px-3 pt-3 pb-2 border-t border-zinc-800/40 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleSection('filmGrain')}
                  className="flex items-center gap-3"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.filmGrain ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Film Grain" icon={<GrainIcon />} />
                </button>
                <button
                  onClick={() => setGrainSeed(Math.floor(Math.random() * 100000))}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800/60"
                  title="Randomize grain pattern"
                >
                  <DiceIcon /> New Pattern
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.filmGrain ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="px-3 pb-2 space-y-1.5">
                  <SliderControl label="Amount" value={eff.grainAmount} min={0} max={1} step={0.01}
                    defaultValue={selectedPreset.grainAmount} onChange={setGrainAmount} format={(v) => `${(v * 100).toFixed(0)}%`} icon={<GrainIconSmall />} />
                  <SliderControl label="Size" value={eff.grainSize} min={0.3} max={5} step={0.1}
                    defaultValue={selectedPreset.grainSize} onChange={setGrainSize} format={(v) => v.toFixed(1)} icon={<GrainIconSmall />} />
                  <SliderControl label="Roughness" value={eff.grainRoughness} min={0} max={1} step={0.01}
                    defaultValue={selectedPreset.grainRoughness} onChange={setGrainRoughness} format={(v) => `${(v * 100).toFixed(0)}%`} icon={<GrainIconSmall />} />
                </div>
              </div>

              <div className="px-3 pt-3 pb-2 border-t border-zinc-800/40">
                <button
                  type="button"
                  onClick={() => toggleSection('effects')}
                  className="flex items-center gap-3"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.effects ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Effects" icon={<EffectsIcon />} />
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.effects ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="px-3 pb-2 space-y-1.5">
                  <SliderControl label="Vignette" value={eff.vignette} min={0} max={0.6} step={0.01}
                    defaultValue={selectedPreset.vignette} onChange={setVignetteAmount} format={(v) => `${(v * 100).toFixed(0)}%`} icon={<VignetteIcon />} />
                  <SliderControl label="Halation" value={eff.halation} min={0} max={0.8} step={0.01}
                    defaultValue={selectedPreset.halation} onChange={setHalationAmount} format={(v) => `${(v * 100).toFixed(0)}%`} icon={<HalationIcon />} />
                  <SliderControl label="Faded Blacks" value={eff.fadedBlacks} min={0} max={0.25} step={0.005}
                    defaultValue={selectedPreset.fadedBlacks} onChange={setFadedBlacks} format={(v) => `${(v * 100).toFixed(0)}%`} icon={<FadedBlacksIcon />} />
                </div>
              </div>

              <div className="px-3 pt-3 pb-2 border-t border-zinc-800/40">
                <button
                  type="button"
                  onClick={() => toggleSection('opticalEffects')}
                  className="flex items-center gap-3"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.opticalEffects ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Optical Effects" icon={<OpticalIcon />} />
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.opticalEffects ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="px-3 pb-3 space-y-1.5">
                <SliderControl label="Purple Fringing" value={eff.purpleFringing} min={0} max={1} step={0.01}
                  defaultValue={selectedPreset.purpleFringing} onChange={setPurpleFringing} format={(v) => `${(v * 100).toFixed(0)}%`} icon={<PurpleFringingIcon />} />
                <SliderControl label="Lens Distortion" value={eff.lensDistortion} min={0} max={0.5} step={0.01}
                  defaultValue={selectedPreset.lensDistortion} onChange={setLensDistortion} format={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`} icon={<LensDistortionIcon />} />
                <SliderControl label="Color Shift X" value={eff.colorShiftX} min={-1} max={1} step={0.05}
                  defaultValue={selectedPreset.colorShiftX} onChange={setColorShiftX} format={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`} icon={<ColorShiftIcon />} />
                <SliderControl label="Color Shift Y" value={eff.colorShiftY} min={-1} max={1} step={0.05}
                  defaultValue={selectedPreset.colorShiftY} onChange={setColorShiftY} format={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`} icon={<ColorShiftIcon />} />
              </div>
              </div>


              <div className="px-3 pt-3 pb-2 border-t border-zinc-800/40">
                <button
                  type="button"
                  onClick={() => toggleSection('overlays')}
                  className="flex items-center gap-3 w-full"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.overlays ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Overlays" icon={<OverlayIcon />} />
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.overlays ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="px-3 pb-2 space-y-2">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {overlayCategoryOptions.map((cat) => {
                      const isActive = overlayCategorySet.has(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleOverlayCategory(cat)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                            isActive
                              ? 'bg-zinc-700 text-zinc-100'
                              : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60'
                          }`}
                        >
                          {OVERLAYS[cat].label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedOverlays([])}
                      className={`aspect-square rounded text-[9px] font-bold flex items-center justify-center transition-all border ${
                        selectedOverlays.length === 0
                          ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                          : 'bg-zinc-800/50 text-zinc-600 hover:text-zinc-300 border-zinc-700/50 hover:border-zinc-500'
                      }`}
                    >
                      None
                    </button>
                    {overlayItems.map(({ thumb, url, category }) => {
                      const isSelected = selectedOverlays.includes(url);
                      return (
                        <button
                          key={url}
                          type="button"
                          onClick={() => {
                            setSelectedOverlays((prev) => {
                              if (prev.includes(url)) {
                                return prev.filter((item) => item !== url);
                              }
                              return [...prev, url];
                            });
                            if (!isSelected) setOverlayBlendByCategory((prev) => ({
                              ...prev,
                              [category]: OVERLAYS[category].defaultBlend,
                            }));
                          }}
                          className={`aspect-square rounded overflow-hidden transition-all border ${
                            isSelected
                              ? 'border-2 border-amber-400 ring-2 ring-amber-400/70 shadow-[0_0_0_3px_rgba(251,191,36,0.24)]'
                              : 'border-zinc-700/50 hover:border-zinc-500'
                          }`}
                        >
                          <img src={thumb} className="w-full h-full object-cover" alt="" />
                        </button>
                      );
                    })}
                  </div>
                  {selectedOverlays.length > 0 && (
                    <div className="space-y-1.5">
                      <SliderControl
                        label="Opacity"
                        value={overlayOpacityByCategory[activeOverlayCategory]}
                        min={0} max={1} step={0.01}
                        defaultValue={OVERLAYS[activeOverlayCategory].defaultOpacity}
                        onChange={(v) => setOverlayOpacityByCategory((prev) => ({
                          ...prev,
                          [activeOverlayCategory]: v ?? OVERLAYS[activeOverlayCategory].defaultOpacity,
                        }))}
                        format={(v) => `${Math.round(v * 100)}%`}
                      />
                      <SliderControl
                        label="Rotation"
                        value={overlayRotationByCategory[activeOverlayCategory]}
                        min={-180} max={180} step={90}
                        defaultValue={0}
                        onChange={(v) => setOverlayRotationByCategory((prev) => ({
                          ...prev,
                          [activeOverlayCategory]: v ?? 0,
                        }))}
                        format={(v) => `${Math.round(v)}°`}
                        icon={<RotateIcon />}
                      />
                      <SliderControl
                        label="Zoom"
                        value={overlayZoomByCategory[activeOverlayCategory]}
                        min={0.5} max={2} step={0.01}
                        defaultValue={1}
                        onChange={(v) => setOverlayZoomByCategory((prev) => ({
                          ...prev,
                          [activeOverlayCategory]: v ?? 1,
                        }))}
                        format={(v) => `${Math.round(v * 100)}%`}
                        icon={<ZoomIcon />}
                      />
                      <div className="flex flex-wrap gap-1">
                        {BLEND_MODES.map((mode) => (
                          <button
                            key={mode.value}
                            type="button"
                            onClick={() => setOverlayBlendByCategory((prev) => ({
                              ...prev,
                              [activeOverlayCategory]: mode.value,
                            }))}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                              overlayBlendByCategory[activeOverlayCategory] === mode.value
                                ? 'bg-amber-500 text-black'
                                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 pt-3 pb-2 border-t border-zinc-800/40">
                <button
                  type="button"
                  onClick={() => toggleSection('cropRotate')}
                  className="flex items-center gap-3 w-full"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.cropRotate ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Crop & Rotate" icon={<CropIcon />} />
                </button>
              </div>
              <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.cropRotate ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                <div className="px-3 pb-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (cropMode && cropRect) {
                        applyCrop();
                      } else {
                        setCropMode(true);
                      }
                    }}
                    className={`flex-1 px-2 py-2 rounded-lg text-sm font-semibold transition-colors ${cropMode ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                  >
                    {cropMode && cropRect ? 'Apply' : cropMode ? 'Crop Mode Active' : 'Crop'}
                  </button>
                  <button
                    onClick={resetCrop}
                    className="flex-1 px-2 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex-1">
                    <SliderControl
                      label="Rotation"
                      value={rotation}
                      min={-45}
                      max={45}
                      step={1}
                      defaultValue={0}
                      format={(v) => `${v.toFixed(0)}°`}
                      onChange={(v) => setRotation(Math.min(45, Math.max(-45, v ?? 0)))}
                    />
                  </div>
                </div>
              </div>
              </div>

              <div className="border-t border-zinc-800/50 px-3 py-3 space-y-3">
                <button
                  type="button"
                  onClick={() => toggleSection('customPreset')}
                  className="flex items-center gap-3 w-full"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform ${openSections.customPreset ? 'rotate-90' : ''}`} />
                  <SectionHeader title="Custom Preset" icon={<PresetIcon />} />
                  {selectedPreset.id.startsWith('custom-') && (
                    <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-amber-400">Delete</span>
                  )}
                </button>
                <div className={`overflow-hidden transition-all duration-200 ease-out origin-top ${openSections.customPreset ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-95'}`}>
                  <div className="space-y-3 pt-3">
                    <input
                      value={customPresetName}
                      onChange={(e) => setCustomPresetName(e.target.value)}
                      placeholder="Preset name"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 outline-none"
                    />
                    <input
                      value={customPresetDescription}
                      onChange={(e) => setCustomPresetDescription(e.target.value)}
                      placeholder="Description"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 outline-none"
                    />
                    <button
                      onClick={handleSaveCustomPreset}
                      className="w-full py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
                    >
                      Save Preset
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </aside>

        <FramingTool isOpen={framingToolOpen} onClose={() => setFramingToolOpen(false)} />
        <NegativeConverterTool 
          isOpen={negativeConverterToolOpen} 
          onClose={() => setNegativeConverterToolOpen(false)}
          onFileSelected={handleNegativeFileSelected}
        />
        <CollageMarkerTool 
          isOpen={collageToolOpen} 
          onClose={() => setCollageToolOpen(false)}
        />

        {sidebarOpen && (
          <div
            className="hidden md:block w-6 touch-none cursor-col-resize bg-transparent hover:bg-zinc-600/20"
            onPointerDown={handleResizePointerDown}
            title="Resize sidebar"
          />
        )}

        <main
          ref={mainAreaRef}
          className="flex-1 flex items-center justify-center bg-zinc-950 relative overflow-visible"
          style={{
            touchAction: 'none',
            overscrollBehavior: 'none',
            ...(isMobile
              ? {
                  paddingTop: '48px',
                  height: sidebarOpen ? `calc(100vh - 64px - ${bottomSheetHeight})` : 'calc(100vh - 64px)',
                }
              : {}),
          }}
        >
          {!image ? (
            <div className="flex flex-col items-center gap-6 max-w-lg px-6">
              <div
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500/60', 'bg-amber-500/5'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-amber-500/60', 'bg-amber-500/5'); }}
                onDrop={(e) => { e.currentTarget.classList.remove('border-amber-500/60', 'bg-amber-500/5'); handleDrop(e); }}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer flex flex-col items-center gap-3 p-10 border-2 border-dashed border-zinc-800 rounded-2xl hover:border-amber-500/40 hover:bg-zinc-900/30 transition-all w-full group"
              >
                <div className="text-zinc-700 group-hover:text-amber-500/60 transition-colors">
                  <UploadIcon />
                </div>
                <div className="text-center">
                  <p className="text-zinc-300 font-medium text-sm">Drop an image or click to upload</p>
                  <p className="text-zinc-700 text-xs mt-1">JPG, PNG, WebP</p>
                </div>
              </div>

              <div className="w-full">
                <p className="text-[10px] text-zinc-700 uppercase tracking-widest text-center mb-2">or try a sample</p>
                <div className="grid grid-cols-4 gap-2">
                  {DEMO_IMAGES.map((demo) => (
                    <button
                      key={demo.label}
                      onClick={() => handleDemo(demo.url)}
                      disabled={loadingDemo}
                      className="aspect-[4/3] rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all overflow-hidden group relative"
                    >
                      <img
                        src={demo.url.replace('w=1200', 'w=200')}
                        alt={demo.label}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity"
                        crossOrigin="anonymous"
                      />
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-white/80 font-medium bg-black/50 px-1.5 py-0.5 rounded">
                        {demo.label}
                      </span>
                    </button>
                  ))}
                </div>
                {loadingDemo && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500">Loading image...</span>
                  </div>
                )}
              </div>
            </div>
          ) : splitView ? (
            <div
              ref={splitContainerRef}
              className="relative w-full h-full flex items-center justify-center select-none"
              style={{ touchAction: 'none' }}
              onPointerMove={(e) => handleSplitMove(e.clientX)}
              onPointerUp={() => setDraggingSplit(false)}
              onPointerCancel={() => setDraggingSplit(false)}
              onPointerLeave={() => setDraggingSplit(false)}
              onTouchMove={(e) => handleSplitMove(e.touches[0].clientX)}
              onTouchEnd={() => setDraggingSplit(false)}
            >
              <div className="relative inline-block w-auto max-w-full max-h-full overflow-visible" style={{ ...wrapperTransformStyle }}>
                <div className="relative inline-block w-auto max-w-full max-h-full overflow-visible">
                  <canvas
                    ref={originalCanvasRef}
                    className="w-full h-full block"
                    style={{
                      objectFit: isMobile ? 'contain' : 'contain',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      width: '100%',
                      height: '100%',
                    }}
                  />
                  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 0 0 ${splitPos}%)` }}>
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full block"
                      style={{
                        objectFit: isMobile ? 'contain' : 'contain',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: '100%',
                        height: '100%',
                      }}
                    />
                  </div>
                </div>
                <div
                  className="absolute top-0 bottom-0 cursor-col-resize z-10"
                  style={{ left: `${splitPos}%`, transform: 'translateX(-50%)', width: '32px', touchAction: 'none' }}
                  data-ignore-pan
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof e.currentTarget.setPointerCapture === 'function') {
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {}
                    }
                    setDraggingSplit(true);
                  }}
                >
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/60" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-xl flex items-center justify-center">
                    <span className="text-zinc-700 text-[10px] font-bold">⇔</span>
                  </div>
                </div>
                <div className="absolute top-2 left-2 bg-black/60 text-white/80 text-[10px] font-medium px-2 py-0.5 rounded-md backdrop-blur-sm">Original</div>
                <div className="absolute top-2 right-2 bg-black/60 text-white/80 text-[10px] font-medium px-2 py-0.5 rounded-md backdrop-blur-sm">{selectedPreset.name}</div>
              </div>
            </div>
          ) : (
            <div
              className="relative flex items-center justify-center w-full h-full"
              style={{ touchAction: 'none', overscrollBehavior: 'none' }}
            >
              <div className="relative flex items-center justify-center max-w-full" style={{ width: '100%', touchAction: 'none', overscrollBehavior: 'none' }}>
                <div ref={imageWrapperRef} className="relative inline-block w-auto max-w-full overflow-visible" style={{ ...wrapperTransformStyle, touchAction: 'none' }}>
                  <div className="relative inline-block w-auto max-w-full overflow-visible">
                    <canvas
                      ref={canvasRef}
                      onClick={handleWbPickerClick}
                      data-ignore-pan={wbPickerActive ? 'true' : undefined}
                      className="block shadow-2xl opacity-100"
                      style={{
                        imageRendering: 'auto',
                        objectFit: 'contain',
                        width: '100%',
                        height: '100%',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        display: 'block',
                        touchAction: 'none',
                        cursor: wbPickerActive ? 'crosshair' : 'auto',
                      }}
                    />
                    {cropMode && cropRect && (
                      <div className="absolute inset-0 pointer-events-auto" data-ignore-pan>
                        <div className="absolute left-0 top-0 right-0 pointer-events-none" style={{ height: `${cropRect.y * 100}%`, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                        <div className="absolute left-0 right-0 pointer-events-none" style={{ top: `${(cropRect.y + cropRect.h) * 100}%`, height: `${(1 - cropRect.y - cropRect.h) * 100}%`, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                        <div className="absolute left-0 pointer-events-none" style={{ top: `${cropRect.y * 100}%`, width: `${cropRect.x * 100}%`, height: `${cropRect.h * 100}%`, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                        <div className="absolute right-0 pointer-events-none" style={{ top: `${cropRect.y * 100}%`, width: `${(1 - cropRect.x - cropRect.w) * 100}%`, height: `${cropRect.h * 100}%`, backgroundColor: 'rgba(0,0,0,0.45)' }} />
                        <div
                          className="absolute border border-amber-400 bg-transparent cursor-move"
                          style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }}
                          onPointerDown={onCropPointerDown('move')}
                          onPointerMove={onCropPointerMove}
                          onPointerUp={onCropPointerUp}
                          onPointerLeave={onCropPointerUp}
                        >
                          <div className={`absolute inset-0 ${draggingCrop ? 'ring-2 ring-amber-400/70' : ''}`} />
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute left-1/3 top-0 h-full w-px bg-white/70" />
                            <div className="absolute left-2/3 top-0 h-full w-px bg-white/70" />
                            <div className="absolute top-1/3 left-0 w-full h-px bg-white/70" />
                            <div className="absolute top-2/3 left-0 w-full h-px bg-white/70" />
                          </div>
                          {['nw', 'ne', 'sw', 'se'].map((handle) => {
                            const positions: Record<string, string> = {
                              nw: 'top-0 left-0',
                              ne: 'top-0 left-full',
                              sw: 'top-full left-0',
                              se: 'top-full left-full',
                            };
                            const cursors: Record<string, string> = {
                              nw: 'cursor-nwse-resize',
                              ne: 'cursor-nesw-resize',
                              sw: 'cursor-nesw-resize',
                              se: 'cursor-nwse-resize',
                            };
                            return (
                              <div
                                key={handle}
                                data-ignore-pan
                                className={`${positions[handle]} absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 border border-white ${cursors[handle]}`}
                                onPointerDown={onCropPointerDown(handle as any)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={getImageAcceptAttribute()}
            multiple
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                handleBatchFiles(files);
              }
            }}
            className="hidden"
          />

          {processing && image && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-zinc-800/50">
              <div className="w-3 h-3 border-[1.5px] border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] text-zinc-500">Processing</span>
            </div>
          )}

          {image && !splitView && (
            <div
              className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-zinc-900/70 backdrop-blur-xl border border-zinc-800/50 rounded-xl px-3 py-1.5 text-[11px] whitespace-nowrap"
              style={{
                bottom: isMobile && sidebarOpen ? `calc(${mobileSheetHeight}vh + 0.75rem)` : '1rem',
              }}
            >
              {selectedPreset.id !== 'none' && (
                <span className={`px-1.5 py-0.5 rounded border font-medium text-[9px] ${typeColors[selectedPreset.type]}`}>
                  {typeBadge[selectedPreset.type]}
                </span>
              )}
              <span className="font-semibold text-zinc-200 truncate">{selectedPreset.brand} {selectedPreset.name}</span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-600">{Math.round(zoom * 100)}%</span>
              <span className="text-zinc-700">|</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-zinc-500 hover:text-amber-400 transition-colors font-medium"
              >
                Change
              </button>
            </div>
          )}
        </main>

        {isAboutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img src={logo} alt="FilmLab logo" className="w-10 h-10 rounded-md object-contain bg-zinc-900 p-1" />
                  <div>
                    <h2 className="text-lg font-bold">FilmLab</h2>
                    <p className="mt-1 text-sm text-zinc-400">Analogue Film Emulation</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAboutOpen(false)}
                  className="text-zinc-400 hover:text-zinc-100 text-sm font-semibold"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-relaxed">
                <p>FilmLab is an in-browser analogue film emulator. Upload a photo, pick a preset, and adjust tone, grain, and effects.</p>
                <p>All editing is done locally in your browser — no photo data is uploaded or sent to any server.</p>
                <ul className="list-disc list-inside space-y-1 text-zinc-300">
                  <li>Upload or drag & drop an image.</li>
                  <li>Select film stock on the left.</li>
                  <li>Use sliders to tweak exposure, contrast, grain, and more.</li>
                  <li>Use Compare for before/after preview.</li>
                  <li>Export as JPG when ready.</li>
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a
                    href="https://nefas.tv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-2 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-amber-500 hover:text-zinc-950 transition-all text-sm font-semibold"
                  >
                    Author Website
                  </a>
                  <a
                    href="https://github.com/neetfrog/TheFilmLab/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all text-sm font-semibold"
                  >
                    Download for Windows
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
