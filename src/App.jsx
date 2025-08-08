import React, { useState, useCallback, useEffect } from 'react';
import { useJsonStore } from './stores/jsonStore_v2';
import JsonEditor from './components/JsonEditor_v2';
import TableEditor from './components/TableEditor';
import GraphViewer from './components/GraphViewer';

function App() {
  // 面板狀態：預設顯示3個面板
  const [visiblePanels, setVisiblePanels] = useState(['graph', 'table', 'json']);
  
  // 拖拽狀態
  const [dragState, setDragState] = useState({
    dragging: false,
    draggedIndex: null,
    dragOverIndex: null
  });
  
  // 連接Zustand store
  const jsonData = useJsonStore((state) => state.jsonData);
  const updateJsonData = useJsonStore((state) => state.updateJsonData);
  const selectedPath = useJsonStore((state) => state.selectedPath);
  const selectedData = useJsonStore((state) => state.selectedData);
  
  // 載入初始示例數據
  useEffect(() => {
    if (!jsonData || Object.keys(jsonData).length === 0) {
      const sampleData = {
        "users": [
          {"id": 1, "name": "張三", "email": "zhang@example.com", "age": 25},
          {"id": 2, "name": "李四", "email": "li@example.com", "age": 30}
        ],
        "products": [
          {"id": 1, "name": "筆記本電腦", "price": 15000, "category": "電子產品"},
          {"id": 2, "name": "辦公椅", "price": 3000, "category": "傢俱"}
        ],
        "settings": {
          "theme": "light",
          "language": "zh-TW",
          "notifications": true
        }
      };
      updateJsonData(sampleData, 'app-init');
    }
  }, [jsonData, updateJsonData]);

  // 面板配置
  const panels = {
    graph: { title: '關係圖', icon: '📊', component: GraphViewer },
    table: { title: '表格編輯器', icon: '📋', component: TableEditor },
    json: { title: 'JSON編輯器', icon: '📝', component: JsonEditor }
  };

  // 面板顯示/收起切換
  const togglePanel = useCallback((panelId) => {
    setVisiblePanels(prev => {
      if (prev.includes(panelId)) {
        return prev.filter(id => id !== panelId);
      } else {
        return [...prev, panelId];
      }
    });
  }, []);

  // 拖拽交換面板順序
  const swapPanels = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    
    setVisiblePanels(prev => {
      const newPanels = [...prev];
      [newPanels[fromIndex], newPanels[toIndex]] = [newPanels[toIndex], newPanels[fromIndex]];
      return newPanels;
    });
  }, []);

  // 面板拖拽處理函數
  const handlePanelDragStart = (e, panelIndex) => {
    setDragState({
      dragging: true,
      draggedIndex: panelIndex,
      dragOverIndex: null
    });
    e.dataTransfer.setData('text/plain', panelIndex.toString());
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.6';
  };

  const handlePanelDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '';
    setDragState({
      dragging: false,
      draggedIndex: null,
      dragOverIndex: null
    });
  };

  const handlePanelDragOver = (e, panelIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (dragState.draggedIndex !== panelIndex) {
      setDragState(prev => ({ ...prev, dragOverIndex: panelIndex }));
      e.currentTarget.style.transform = 'scale(1.02)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
    }
  };

  const handlePanelDragLeave = (e) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '';
    setDragState(prev => ({ ...prev, dragOverIndex: null }));
  };

  const handlePanelDrop = (e, panelIndex) => {
    e.preventDefault();
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '';
    
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (fromIndex !== panelIndex && !isNaN(fromIndex)) {
      swapPanels(fromIndex, panelIndex);
    }
  };

  // 渲染面板
  const renderPanel = (panelId, index) => {
    const panel = panels[panelId];
    const Component = panel.component;
    const isDragged = dragState.draggedIndex === index;
    const isDragOver = dragState.dragOverIndex === index;
    
    return (
      <div
        className={`h-full bg-white border-2 rounded-lg overflow-hidden shadow-sm transition-all duration-200 ${
          isDragged ? 'border-blue-400 opacity-60' : 
          isDragOver ? 'border-blue-400 shadow-lg transform scale-102' : 
          'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div 
          className={`h-10 px-4 border-b border-gray-300 flex items-center justify-between cursor-move ${
            isDragged ? 'bg-blue-100' : 'bg-gray-100'
          }`}
          draggable
          onDragStart={(e) => handlePanelDragStart(e, index)}
          onDragEnd={handlePanelDragEnd}
          onDragOver={(e) => handlePanelDragOver(e, index)}
          onDragLeave={handlePanelDragLeave}
          onDrop={(e) => handlePanelDrop(e, index)}
        >
          <div className="flex items-center">
            {/* 拖拽指示器 */}
            <div className="mr-2 flex items-center cursor-grab active:cursor-grabbing">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              </div>
            </div>
            <span className="mr-2">{panel.icon}</span>
            <span className="text-sm font-medium text-gray-700">{panel.title}</span>
          </div>
          <div className="flex items-center space-x-2">
            {/* 關閉按鈕 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePanel(panelId);
              }}
              className="w-4 h-4 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title={`關閉 ${panel.title}`}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="h-[calc(100%-2.5rem)] overflow-hidden">
          <Component />
        </div>
      </div>
    );
  };


  // 根據面板數量決定布局
  const renderMainContent = () => {
    const count = visiblePanels.length;
    
    if (count === 0) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-lg">請從右側選擇要顯示的面板</p>
          </div>
        </div>
      );
    }
    
    if (count === 1) {
      // 單面板：佔滿100%
      return (
        <div className="h-full">
          {renderPanel(visiblePanels[0], 0)}
        </div>
      );
    }
    
    if (count === 2) {
      // 雙面板：各佔50%
      return (
        <div className="h-full flex gap-4">
          <div className="flex-1">
            {renderPanel(visiblePanels[0], 0)}
          </div>
          <div className="flex-1">
            {renderPanel(visiblePanels[1], 1)}
          </div>
        </div>
      );
    }
    
    if (count === 3) {
      // 3面板：左邊50%，右邊50%分上下25%
      return (
        <div className="h-full flex gap-4">
          {/* 左側50% */}
          <div className="w-1/2">
            {renderPanel(visiblePanels[0], 0)}
          </div>
          
          {/* 右側50%，分上下 */}
          <div className="w-1/2 flex flex-col gap-4">
            <div className="flex-1">
              {renderPanel(visiblePanels[1], 1)}
            </div>
            <div className="flex-1">
              {renderPanel(visiblePanels[2], 2)}
            </div>
          </div>
        </div>
      );
    }
    
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Brand Header Bar */}
      <div className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center px-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">📊</div>
          <div>
            <h1 className="text-lg font-bold text-white">JSON Graph Studio</h1>
            <p className="text-xs text-blue-100">Professional JSON Editor & Visualizer</p>
          </div>
        </div>
      </div>
      
      {/* Windows風格路徑列 */}
      <div className="h-10 bg-white border-b border-gray-300 flex items-center px-3 text-sm">
        <div className="flex items-center space-x-1">
          {/* 根目錄圖標 */}
          <button className="flex items-center space-x-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors">
            <span>🗂️</span>
            <span className="text-gray-700">JSON根目錄</span>
          </button>
          
          {/* 路徑分段 */}
          {selectedPath && selectedPath.split('.').map((segment, index, array) => {
            const partialPath = array.slice(0, index + 1).join('.');
            const isLast = index === array.length - 1;
            
            return (
              <React.Fragment key={partialPath}>
                <span className="text-gray-400 text-xs">▶</span>
                <button
                  className={`px-2 py-1 rounded transition-colors ${
                    isLast 
                      ? 'bg-blue-100 text-blue-700 font-medium cursor-default' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    if (!isLast) {
                      // 點擊上級路徑進行導航（這裡可以添加導航邏輯）
                      console.log('Navigate to:', partialPath);
                    }
                  }}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
          
          {/* 當前選中項目信息 */}
          {selectedData && (
            <span className="text-xs text-gray-500 ml-4 px-2 py-1 bg-gray-50 rounded">
              {Array.isArray(selectedData) 
                ? `陣列 (${selectedData.length} 項)` 
                : typeof selectedData === 'object' 
                  ? `物件 (${Object.keys(selectedData).length} 屬性)` 
                  : `值: ${String(selectedData).length > 20 ? String(selectedData).substring(0, 20) + '...' : selectedData}`}
            </span>
          )}
        </div>
      </div>

      {/* 主內容區域 */}
      <div className="flex-1 flex">
        <div className="flex-1 p-4 pr-16">
          {renderMainContent()}
        </div>

        {/* 右側控制欄 - 簡化版本 */}
        <div className="w-12 bg-gray-100 border-l border-gray-300 flex flex-col py-4">
          {/* 簡化的面板控制 */}
          <div className="flex-1 flex flex-col items-center space-y-3">
            {Object.keys(panels).map((panelId, index) => {
              const isVisible = visiblePanels.includes(panelId);
              const visibleIndex = visiblePanels.indexOf(panelId);
              
              return (
                <div
                  key={panelId}
                  className={`w-8 h-8 rounded cursor-pointer flex items-center justify-center relative group transition-all duration-200 ${
                    isVisible 
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-md' 
                      : 'bg-gray-400 hover:bg-gray-500 text-gray-100'
                  }`}
                  draggable={isVisible}
                  onDragStart={isVisible ? (e) => handlePanelDragStart(e, visibleIndex) : undefined}
                  onDragEnd={isVisible ? handlePanelDragEnd : undefined}
                  onDragOver={isVisible ? (e) => handlePanelDragOver(e, visibleIndex) : undefined}
                  onDragLeave={isVisible ? handlePanelDragLeave : undefined}
                  onDrop={isVisible ? (e) => handlePanelDrop(e, visibleIndex) : undefined}
                  onClick={() => togglePanel(panelId)}
                  title={isVisible ? `收起 ${panels[panelId].title}` : `顯示 ${panels[panelId].title}`}
                >
                  {panels[panelId].icon}
                  
                  {/* 拖拽指示器 - 只在顯示狀態下出現 */}
                  {isVisible && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-white text-xs leading-3 text-center">⋮</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;