# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **modern React + Vite implementation** of the JSON Graph Editor - a professional web application that provides real-time coordinated editing across three synchronized views: interactive graph visualization, Excel-style table editor, and JSON code editor.

## Key Features

### ✅ Core Capabilities:
- **Real-time synchronization** - Changes instantly reflect across all three editors
- **Visual relationship mapping** - Complex JSON structures displayed as interactive graphs
- **Professional editing experience** - Excel-style table editing with type-aware validation
- **Smart graph layout** - Automatic positioning with manual override capabilities
- **Duplicate item display** - Shows all repeated objects/arrays as separate nodes
- **Zoom/pan state preservation** - Graph view maintains position across data updates

### ✅ User Experience Enhancements:
- **No visual flicker** - Removed "同步中" and "保存中" flash notifications
- **Focus-aware updates** - Won't interrupt active editing sessions  
- **Cursor position preservation** - JSON editor maintains editing context
- **Instant feedback** - All changes appear within 50ms across views

## Architecture

The application uses a **centralized store pattern** with Zustand:

```
UI Components (React) → Zustand Store → Real-time Updates → Component Sync
     ↑                                                            ↓
     └─────────── Immediate Feedback Loop ──────────────────────┘
```

## Current File Structure

```
src/
├── components/
│   ├── JsonEditor_v2.jsx          # Modern JSON code editor
│   ├── TableEditor.jsx            # Excel-style data editor  
│   └── GraphViewer.jsx            # D3.js relationship visualizer
├── stores/
│   └── jsonStore_v2.js            # Zustand state management
├── hooks/
│   └── useRealtimeSync.js         # Real-time synchronization logic
└── utils/
    └── graphUtils.js              # Graph data extraction and analysis
```

## Core Components

### 1. **JsonEditor_v2.jsx** - JSON Code Editor
- **Real-time syntax validation** with immediate visual feedback
- **Smart cursor preservation** during external updates
- **Auto-save on blur** with Ctrl+S manual save option
- **Focus-aware updates** - won't interrupt typing
- **Status indicators** - shows editing state without flash notifications

### 2. **TableEditor.jsx** - Excel-style Editor  
- **Direct cell editing** with keyboard navigation (Enter/Tab/Esc)
- **Type-aware conversion** - auto-detects numbers, booleans, null
- **Row/column operations** with visual feedback
- **Real-time sync** without losing edit focus
- **2D array support** - handles complex nested structures

### 3. **GraphViewer.jsx** - D3.js Visualization
- **Smart layout algorithm** - preserves node positions across updates
- **Structure change detection** - differentiates major vs minor changes
- **Differential rendering** - only updates changed nodes
- **Zoom/pan state preservation** - maintains view position during data updates
- **Color-coded node types**:
  - Array box: Blue theme (`#dbeafe` background, `#2563eb` border)
  - Object Array box: Green theme (`#f0fdf4` background, `#16a34a` border) 
  - 2D Array box: Purple theme (`#f3e8ff` background, `#8b5cf6` border)
- **Duplicate item display** - shows repeated objects/arrays as separate nodes
- **Connection line optimization** - attempts to minimize crossing (work in progress)

## State Management (stores/jsonStore_v2.js)

Uses **Zustand with Immer** for immutable state updates:

```javascript
// Core state management functions
updateJsonData(newData, sourceEditor)  // Prevents circular updates
setActiveEditor(editorId)              // Tracks current editing source
updateTableSelection(nodeId, data)     // Table-specific selection
updatePathSelection(nodeId, data)      // Universal path selection
```

Key features:
- **Conflict prevention** - Source tracking prevents update loops
- **Granular subscriptions** - Components only re-render on relevant changes
- **Error isolation** - Per-editor error states with recovery
- **Path selection system** - Universal node selection across all editors

## Graph System Design

### Node Types and Visual Coding
1. **Root Node** - Purple theme with "🌐 JSON" label
2. **Array Nodes** - Blue theme with "📋" icon
3. **Object Array Nodes** - Green theme with "📦" icon  
4. **2D Array Nodes** - Purple theme with "📊" icon (table display)
5. **Primitive Nodes** - Color-coded by type:
   - String: Green (`#dcfce7`)
   - Number: Red (`#fecaca`) 
   - Boolean: Purple (`#e0e7ff`)

### Graph Data Flow
```javascript
JSON Data → extractGraphData() → Graph Nodes & Links → D3 Rendering
```

### Connection Line System
- **Port-based connections** - Uses connection point optimization
- **Parent-child relationships** - Curved lines connecting related nodes
- **Slot connections** - Special connections for complex-box internal structure
- **Color coding** - Different colors for different relationship types

## Key Technical Features

### 1. **Real-time Synchronization**
- Changes appear in other views within 50ms
- No debouncing delays or visual jumping
- Smart conflict resolution prevents circular updates

### 2. **Smart Graph Updates**
- **Zoom state preservation** - View position maintained across data changes
- **Node position memory** - User-dragged positions remembered
- **Differential rendering** - Only changed elements re-render
- **Layout algorithms** - Hierarchical with anti-crossing optimization

### 3. **Focus-Aware Editing**
- JSON editor preserves cursor position and selection
- Table editor doesn't interrupt active cell editing  
- Graph view maintains zoom/pan state during updates

### 4. **Professional Error Handling**
- Per-component error isolation
- Non-blocking error states
- Graceful degradation when one editor fails

## Running the Application

### Development:
```bash
npm install
npm run dev
```
Open http://localhost:5173

### Production:
```bash
npm run build
npm run preview
```

## Development Guidelines

### Code Organization:
- **Components** - Single responsibility React functional components
- **Stores** - Zustand stores with Immer for immutable updates
- **Hooks** - Custom hooks for cross-cutting concerns
- **Utils** - Pure functions for data transformation

### Best Practices:
- All state changes go through the centralized store
- Components should be reactive, not imperative
- Use React.memo strategically for expensive components
- Test real-time sync across all three editors
- Maintain focus on instant user feedback

### Performance Optimization:
- Graph rendering optimized for 1000+ nodes
- D3 updates batched with requestAnimationFrame
- Zustand subscriptions are granular
- Smart diffing prevents unnecessary re-renders

## Recent Updates (Latest Session)

### ✅ Array Box Visualization Improvements:
- **Single-column array display** - One-dimensional arrays now show as single-column boxes with horizontal separators
- **Enhanced visual separators** - More prominent dividing lines between array elements
- **Optimized box width** - Removed index numbers (0,1,2) and narrowed box width for better content fit
- **Professional styling** - Improved array element styling with better spacing and visual hierarchy

### ✅ Graph Layout Enhancements:
- **JsonCrack-style divergent layout** - Restored clean divergent layout algorithm
- **Advanced collision detection** - Implemented intelligent node positioning to prevent overlapping
- **Adaptive spacing system** - Dynamic spacing calculations based on actual node heights
- **Line crossing prevention** - Enhanced vertical spacing algorithm to minimize connection line crossings

### ✅ User Interface Improvements:
- **Simplified right panel** - Removed text labels, using only green (active) / gray (inactive) indicator lights
- **Panel close buttons** - Added red ✕ close buttons to each panel header for quick access
- **Drag handle redesign** - Replaced text with professional 6-dot drag indicator (⋮⋮)
- **Title-only dragging** - Limited panel dragging to title bar only, preventing interference with data editing

### ✅ Connection Line Fixes:
- **Precise slot connection positioning** - Fixed slot connections to use actual node dimensions instead of hardcoded width
- **Aligned slot dots** - Positioned slot dots at exact right edge of boxes (boxWidth - 4)
- **Perfect connection alignment** - Connection lines now start from exact slot dot centers
- **Eliminated misaligned connections** - All connection lines properly connect between node edges

## Current System Status

### Graph Visualization:
- **✅ Line crossing issues resolved** - Implemented comprehensive collision detection and adaptive spacing
- **✅ JsonCrack-style layout active** - Clean divergent tree structure with optimized node positioning
- **✅ Array display optimized** - Professional single-column array boxes with enhanced separators
- **✅ Connection line alignment fixed** - All connection lines now properly connect to node edge points

### User Experience:
- **✅ Panel management streamlined** - Intuitive light-based status indicators
- **✅ Drag behavior optimized** - Title-bar only dragging prevents editing interference
- **✅ Quick panel closure** - Accessible ✕ buttons for immediate panel management

### Future Enhancements:
- Advanced graph layout options
- Export/import functionality
- Collaborative editing features

## Testing

### Manual Testing Approach:
1. **Cross-editor sync** - Edit in one view, verify updates in others
2. **Focus behavior** - Ensure no interruption during active editing
3. **Error resilience** - Test with invalid JSON, verify graceful handling
4. **Performance** - Test with large/complex JSON structures
5. **Graph interaction** - Verify drag, zoom, and selection behavior

## Important Reminders

- This is a **PROFESSIONAL application** with zero tolerance for visual flicker
- All updates must be **REAL-TIME** with smart conflict prevention
- Use **React best practices** throughout (hooks, functional components)
- **Test thoroughly** across all three synchronized views
- Focus on **instant user feedback** - editing should feel seamless and responsive