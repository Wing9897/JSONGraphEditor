import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
// Removed lodash isEqual to allow all data updates including duplicates

// 初始數據
const initialData = {
  users: [
    { id: 1, name: "Alice", age: 25, tags: ["developer", "react", "javascript"], profile: { city: "Tokyo", country: "Japan" } },
    { id: 2, name: "Bob", age: 30, tags: ["designer", "ui/ux", "figma"], profile: { city: "Seoul", country: "Korea" } }
  ],
  simpleArray: ["apple", "banana", "cherry"],
  numberArray: [1, 2, 3, 4, 5],
  mixedArray: ["text", 42, true, null],
  nestedArray: [["a", "b"], ["c", "d"], ["e", "f"]],
  products: [
    ["laptop", 1000, 5],
    ["mouse", 25, 100],
    ["keyboard", 75, 50]
  ],
  settings: {
    theme: "dark",
    notifications: true,
    features: ["chat", "video", "screen-share"],
    limits: {
      maxUsers: 100,
      maxFiles: 1000
    }
  },
  simpleValue: "Hello World",
  numberValue: 42,
  booleanValue: true
};

// 簡化的狀態管理器 - 移除複雜的同步邏輯
export const useJsonStore = create(
  subscribeWithSelector(
    immer((set, get) => ({
      // 核心數據狀態
      jsonData: initialData,
      selectedTable: '', // 保留向後兼容
      selectedTableData: [], // 保留向後兼容
      
      // 新的通用路徑選擇系統
      selectedPath: '',
      selectedData: null,
      selectedType: null, // 'array' | 'object' | 'primitive'
      
      // 簡化的編輯器狀態
      activeEditor: null, // 'json-editor' | 'table-editor' | 'graph-viewer' | null
      
      // 錯誤狀態
      errors: {
        jsonEditor: null,
        tableEditor: null,
        graphViewer: null
      },
      
      // 性能統計
      stats: {
        updateCount: 0,
        lastUpdate: null
      },
      
      // Actions
      
      /**
       * 更新JSON數據 - 簡化版本
       * @param {Object} newData - 新的JSON數據
       * @param {String} source - 更新來源標識
       */
      updateJsonData: (newData, source = 'unknown') => {
        console.log(`\n🔄 [JsonStore] === 開始數據更新 ===`);
        console.log(`[JsonStore] 來源: ${source}`);
        console.log(`[JsonStore] 當前時間: ${new Date().toLocaleTimeString()}`);
        
        set((state) => {
          const oldData = state.jsonData;
          
          // 允許所有數據更新，包含重複項目
          console.log(`[JsonStore] ✅ 接受數據更新（包含重複項目）`);
          console.log(`[JsonStore] 舊數據長度: ${JSON.stringify(oldData).length} 字符`);
          console.log(`[JsonStore] 新數據長度: ${JSON.stringify(newData).length} 字符`);
          
          // 更新數據
          state.jsonData = newData;
          state.stats.updateCount += 1;
          state.stats.lastUpdate = Date.now();
          
          console.log(`[JsonStore] ✅ 主數據已更新`);
          
          // 清除來源編輯器的錯誤
          if (source === 'json-editor') {
            state.errors.jsonEditor = null;
            console.log(`[JsonStore] 🧹 清除 JSON 編輯器錯誤`);
          } else if (source === 'table-editor') {
            state.errors.tableEditor = null;
            console.log(`[JsonStore] 🧹 清除表格編輯器錯誤`);
          }
          
          // ⚠️ 檢查表格數據更新邏輯 - 這可能是問題所在！
          if (state.selectedTable) {
            console.log(`[JsonStore] 🔍 檢查選中表格: ${state.selectedTable}`);
            const updatedTableData = getNestedValue(newData, state.selectedTable);
            
            if (updatedTableData && Array.isArray(updatedTableData)) {
              console.log(`[JsonStore] 📊 更新表格數據 (${updatedTableData.length} 項)`);
              state.selectedTableData = [...updatedTableData];
            } else {
              console.log(`[JsonStore] ⚠️ 表格路徑無效或不是數組`);
            }
          } else {
            console.log(`[JsonStore] 📊 無選中表格，跳過表格數據更新`);
          }
          
          console.log(`[JsonStore] === 更新完成 ===\n`);
        });
      },
      
      /**
       * 設置活躍編輯器
       */
      setActiveEditor: (editorId) => {
        set((state) => {
          if (state.activeEditor !== editorId) {
            console.log(`[JsonStore] 活躍編輯器變更: ${state.activeEditor} → ${editorId}`);
            state.activeEditor = editorId;
          }
        });
      },
      
      /**
       * 更新表格選擇和數據
       */
      updateTableSelection: (tableName, tableData) => {
        set((state) => {
          console.log(`[JsonStore] 選中表格: ${tableName}`);
          state.selectedTable = tableName;
          state.selectedTableData = Array.isArray(tableData) ? [...tableData] : [];
          
          // 同時更新新的通用路徑系統
          state.selectedPath = tableName;
          state.selectedData = Array.isArray(tableData) ? [...tableData] : null;
          state.selectedType = Array.isArray(tableData) ? 'array' : null;
        });
      },
      
      /**
       * 更新通用路徑選擇 - 支持所有數據類型
       */
      updatePathSelection: (path, data) => {
        set((state) => {
          console.log(`[JsonStore] 選中路徑: ${path}`);
          
          let dataType = null;
          let processedData = null;
          
          if (Array.isArray(data)) {
            dataType = 'array';
            processedData = [...data];
            // 為了向後兼容，也更新舊的表格狀態
            state.selectedTable = path;
            state.selectedTableData = processedData;
          } else if (data && typeof data === 'object') {
            dataType = 'object';
            processedData = { ...data };
          } else {
            dataType = 'primitive';
            processedData = data;
          }
          
          state.selectedPath = path;
          state.selectedData = processedData;
          state.selectedType = dataType;
          
          console.log(`[JsonStore] 路徑類型: ${dataType}, 數據:`, processedData);
        });
      },
      
      /**
       * 設置錯誤狀態
       */
      setError: (editorId, error) => {
        set((state) => {
          console.log(`[JsonStore] 設置錯誤 ${editorId}:`, error);
          state.errors[editorId] = error;
        });
      },
      
      /**
       * 清除錯誤
       */
      clearError: (editorId) => {
        set((state) => {
          if (state.errors[editorId]) {
            console.log(`[JsonStore] 清除錯誤: ${editorId}`);
            state.errors[editorId] = null;
          }
        });
      },
      
      /**
       * 重置所有狀態
       */
      reset: () => {
        console.log('[JsonStore] 重置所有狀態');
        set((state) => {
          state.jsonData = initialData;
          state.selectedTable = '';
          state.selectedTableData = [];
          state.activeEditor = null;
          state.errors = {
            jsonEditor: null,
            tableEditor: null,
            graphViewer: null
          };
          state.stats = {
            updateCount: 0,
            lastUpdate: null
          };
        });
      }
    }))
  )
);

/**
 * 輔助函數：根據路徑獲取嵌套對象的值
 */
function getNestedValue(obj, path) {
  if (!path) return obj;
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}


// 選擇器函數 - 用於組件訂閱特定狀態
export const selectJsonData = (state) => state.jsonData;
export const selectSelectedTable = (state) => state.selectedTable;
export const selectSelectedTableData = (state) => state.selectedTableData;
export const selectActiveEditor = (state) => state.activeEditor;
export const selectErrors = (state) => state.errors;
export const selectStats = (state) => state.stats;

// 新的通用路徑選擇器
export const selectSelectedPath = (state) => state.selectedPath;
export const selectSelectedData = (state) => state.selectedData;
export const selectSelectedType = (state) => state.selectedType;