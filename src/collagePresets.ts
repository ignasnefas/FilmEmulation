export interface CollageLayout {
  id: string;
  name: string;
  description: string;
  grid: number[]; // array of photo indices showing the relative size/position
  cols: number;
  rows: number;
  photoCount: number;
  template: 'grid' | 'custom';
  positions?: Array<{ row: number; col: number; rowSpan?: number; colSpan?: number }>;
}

export const collageLayouts: CollageLayout[] = [
  {
    id: 'grid-2h',
    name: '2x1 Horizontal',
    description: 'Two photos side by side',
    grid: [1, 1],
    cols: 2,
    rows: 1,
    photoCount: 2,
    template: 'grid',
  },
  {
    id: 'grid-2v',
    name: '1x2 Vertical',
    description: 'Two photos stacked',
    grid: [1, 1],
    cols: 1,
    rows: 2,
    photoCount: 2,
    template: 'grid',
  },
  {
    id: 'grid-3',
    name: '3 Photos',
    description: 'One large top, two bottom',
    cols: 2,
    rows: 2,
    photoCount: 3,
    template: 'custom',
    positions: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 2 }, // Large top, spans 2 cols
      { row: 1, col: 0, rowSpan: 1, colSpan: 1 }, // Bottom left
      { row: 1, col: 1, rowSpan: 1, colSpan: 1 }, // Bottom right
    ],
    grid: [],
  },
  {
    id: 'grid-3alt',
    name: '3 Photos Alt',
    description: 'Two top, one large bottom',
    cols: 2,
    rows: 2,
    photoCount: 3,
    template: 'custom',
    positions: [
      { row: 0, col: 0, rowSpan: 1, colSpan: 1 }, // Top left
      { row: 0, col: 1, rowSpan: 1, colSpan: 1 }, // Top right
      { row: 1, col: 0, rowSpan: 1, colSpan: 2 }, // Large bottom, spans 2 cols
    ],
    grid: [],
  },
  {
    id: 'grid-4',
    name: '2x2 Grid',
    description: 'Four photos in grid',
    grid: [1, 1, 1, 1],
    cols: 2,
    rows: 2,
    photoCount: 4,
    template: 'grid',
  },
  {
    id: 'grid-6',
    name: '3x2 Grid',
    description: 'Six photos in grid',
    grid: [1, 1, 1, 1, 1, 1],
    cols: 3,
    rows: 2,
    photoCount: 6,
    template: 'grid',
  },
  {
    id: 'grid-9',
    name: '3x3 Grid',
    description: 'Nine photos in grid',
    grid: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    cols: 3,
    rows: 3,
    photoCount: 9,
    template: 'grid',
  },
  {
    id: 'grid-6v',
    name: '2x3 Grid',
    description: 'Six photos in grid (vertical)',
    grid: [1, 1, 1, 1, 1, 1],
    cols: 2,
    rows: 3,
    photoCount: 6,
    template: 'grid',
  },
];

export interface CollageSettings {
  gapSize: number; // 0-20px
  padding: number; // 0-20% padding around edges
  backgroundColor: string;
  backgroundOpacity: number; // 0-1
  photoFit: 'cover'; // only cover mode is supported
}

export const defaultCollageSettings: CollageSettings = {
  gapSize: 8,
  padding: 5,
  backgroundColor: '#FFFFFF',
  backgroundOpacity: 1,
  photoFit: 'cover',
};

export const collageBackgroundColors = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Gray', value: '#808080' },
  { name: 'Cream', value: '#FFFDD0' },
  { name: 'Navy', value: '#0A1628' },
  { name: 'Beige', value: '#F5F5DC' },
  { name: 'Light Gray', value: '#F0F0F0' },
  { name: 'Charcoal', value: '#36454F' },
];
