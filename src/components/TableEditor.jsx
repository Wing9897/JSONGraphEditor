import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useJsonStore } from '../stores/jsonStore_v2';

// 輔助函數
function setNestedValueInObject(obj, path, value) {
  const result = JSON.parse(JSON.stringify(obj)); // 深拷貝
  const keys = path.split('.');
  let current = result;
  
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  
  return result;
}

const TableEditor = () => {
  const [tableData, setTableData] = useState([]);
  const [editingCell, setEditingCell] = useState(null); // { row, col }
  const [cellValue, setCellValue] = useState('');
  const [localError, setLocalError] = useState(null);
  
  const editInputRef = useRef(null);
  const lastExternalUpdateRef = useRef(0);
  
  // 直接使用 store，避免複雜的 hook
  const selectedTable = useJsonStore((state) => state.selectedTable);
  const selectedTableData = useJsonStore((state) => state.selectedTableData);
  const updateJsonData = useJsonStore((state) => state.updateJsonData);
  const setActiveEditor = useJsonStore((state) => state.setActiveEditor);
  const activeEditor = useJsonStore((state) => state.activeEditor);
  const globalError = useJsonStore((state) => state.errors.tableEditor);
  
  // 同步選中的表格數據到本地狀態
  useEffect(() => {
    if (selectedTableData && Array.isArray(selectedTableData)) {
      // 檢查是否為外部更新（非編輯狀態下的更新）
      if (!editingCell || Date.now() - lastExternalUpdateRef.current > 1000) {
        setTableData(selectedTableData.map(row => 
          Array.isArray(row) ? [...row] : [row]
        ));
        lastExternalUpdateRef.current = Date.now();
      }
    } else {
      setTableData([]);
    }
  }, [selectedTableData, editingCell]);
  
  // 驗證表格數據
  const validateTableData = useCallback((data) => {
    if (!Array.isArray(data)) return false;
    
    // 檢查是否為有效的2D數組
    return data.every(row => Array.isArray(row) || typeof row !== 'object');
  }, []);
  
  // 更新單個儲存格
  const updateCell = useCallback((rowIndex, colIndex, value) => {
    if (!selectedTable) return;
    
    const newTableData = [...tableData];
    
    // 確保行存在
    while (newTableData.length <= rowIndex) {
      newTableData.push([]);
    }
    
    // 確保列存在
    while (newTableData[rowIndex].length <= colIndex) {
      newTableData[rowIndex].push('');
    }
    
    // 類型轉換處理
    let processedValue = value;
    if (typeof value === 'string') {
      // 嘗試轉換為適當的類型
      if (value === '') {
        processedValue = '';
      } else if (value === 'true') {
        processedValue = true;
      } else if (value === 'false') {
        processedValue = false;
      } else if (value === 'null') {
        processedValue = null;
      } else if (!isNaN(value) && !isNaN(parseFloat(value))) {
        processedValue = parseFloat(value);
      }
    }
    
    newTableData[rowIndex][colIndex] = processedValue;
    setTableData(newTableData);
    
    // 即時更新到全局狀態 - 簡化版本
    if (validateTableData(newTableData) && selectedTable) {
      // 構建完整的 JSON 數據
      const currentJsonData = useJsonStore.getState().jsonData;
      const updatedJsonData = setNestedValueInObject(currentJsonData, selectedTable, newTableData);
      
      setActiveEditor('table-editor');
      updateJsonData(updatedJsonData, 'table-editor');
      setActiveEditor(null);
      
      setLocalError(null);
    } else {
      setLocalError('無效的表格數據格式');
    }
  }, [tableData, selectedTable, updateJsonData, setActiveEditor, validateTableData]);
  
  // 開始編輯儲存格
  const startEdit = useCallback((rowIndex, colIndex) => {
    if (editingCell) {
      finishEdit();
    }
    
    const currentValue = tableData[rowIndex]?.[colIndex] ?? '';
    setEditingCell({ row: rowIndex, col: colIndex });
    setCellValue(String(currentValue));
    
    // 聚焦到輸入框
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
      }
    }, 0);
  }, [tableData, editingCell]);
  
  // 完成編輯
  const finishEdit = useCallback(() => {
    if (!editingCell) return;
    
    updateCell(editingCell.row, editingCell.col, cellValue);
    setEditingCell(null);
    setCellValue('');
  }, [editingCell, cellValue, updateCell]);
  
  // 取消編輯
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setCellValue('');
  }, []);
  
  // 添加新行
  const addRow = useCallback(() => {
    if (!selectedTable) return;
    
    const maxCols = Math.max(1, ...tableData.map(row => row.length));
    const newRow = Array(maxCols).fill('');
    const newTableData = [...tableData, newRow];
    
    setTableData(newTableData);
    
    // 更新到 store
    if (selectedTable) {
      const currentJsonData = useJsonStore.getState().jsonData;
      const updatedJsonData = setNestedValueInObject(currentJsonData, selectedTable, newTableData);
      updateJsonData(updatedJsonData, 'table-editor');
    }
  }, [selectedTable, tableData, updateJsonData]);
  
  // 添加新列
  const addColumn = useCallback(() => {
    if (!selectedTable) return;
    
    const newTableData = tableData.map(row => [...row, '']);
    if (newTableData.length === 0) {
      newTableData.push(['']);
    }
    
    setTableData(newTableData);
    
    // 更新到 store
    if (selectedTable) {
      const currentJsonData = useJsonStore.getState().jsonData;
      const updatedJsonData = setNestedValueInObject(currentJsonData, selectedTable, newTableData);
      updateJsonData(updatedJsonData, 'table-editor');
    }
  }, [selectedTable, tableData, updateJsonData]);
  
  // 刪除行
  const deleteRow = useCallback((rowIndex) => {
    if (!selectedTable || tableData.length <= 1) return;
    
    const newTableData = tableData.filter((_, index) => index !== rowIndex);
    setTableData(newTableData);
    
    // 更新到 store
    if (selectedTable) {
      const currentJsonData = useJsonStore.getState().jsonData;
      const updatedJsonData = setNestedValueInObject(currentJsonData, selectedTable, newTableData);
      updateJsonData(updatedJsonData, 'table-editor');
    }
    
    // 如果正在編輯被刪除的行，取消編輯
    if (editingCell && editingCell.row === rowIndex) {
      cancelEdit();
    }
  }, [selectedTable, tableData, updateJsonData, editingCell, cancelEdit]);
  
  // 刪除列
  const deleteColumn = useCallback((colIndex) => {
    if (!selectedTable) return;
    
    const newTableData = tableData.map(row => {
      const newRow = row.filter((_, index) => index !== colIndex);
      return newRow.length === 0 ? [''] : newRow;
    });
    
    setTableData(newTableData);
    
    // 更新到 store
    if (selectedTable) {
      const currentJsonData = useJsonStore.getState().jsonData;
      const updatedJsonData = setNestedValueInObject(currentJsonData, selectedTable, newTableData);
      updateJsonData(updatedJsonData, 'table-editor');
    }
    
    // 如果正在編輯被刪除的列，取消編輯
    if (editingCell && editingCell.col === colIndex) {
      cancelEdit();
    }
  }, [selectedTable, tableData, updateJsonData, editingCell, cancelEdit]);
  
  // 鍵盤事件處理
  const handleKeyDown = useCallback((e, rowIndex, colIndex) => {
    switch (e.key) {
      case 'Enter':
        if (editingCell) {
          e.preventDefault();
          finishEdit();
          // 移動到下一行
          if (rowIndex + 1 < tableData.length) {
            startEdit(rowIndex + 1, colIndex);
          }
        } else {
          e.preventDefault();
          startEdit(rowIndex, colIndex);
        }
        break;
      case 'Tab':
        if (editingCell) {
          e.preventDefault();
          finishEdit();
          // 移動到下一列
          const nextCol = colIndex + 1;
          const maxCols = Math.max(...tableData.map(row => row.length));
          if (nextCol < maxCols) {
            startEdit(rowIndex, nextCol);
          }
        }
        break;
      case 'Escape':
        if (editingCell) {
          e.preventDefault();
          cancelEdit();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (!editingCell) {
          e.preventDefault();
          updateCell(rowIndex, colIndex, '');
        }
        break;
      default:
        if (!editingCell && e.key.length === 1) {
          // 開始編輯並輸入字符
          startEdit(rowIndex, colIndex);
          setCellValue(e.key);
        }
        break;
    }
  }, [editingCell, finishEdit, cancelEdit, startEdit, updateCell, tableData]);
  
  // 計算表格統計信息
  const tableStats = useMemo(() => {
    if (!tableData.length) return { rows: 0, cols: 0, cells: 0, filled: 0 };
    
    const rows = tableData.length;
    const cols = Math.max(...tableData.map(row => row.length));
    const totalCells = rows * cols;
    const filledCells = tableData.reduce((sum, row) => {
      return sum + row.filter(cell => cell !== '' && cell != null).length;
    }, 0);
    
    return { rows, cols, cells: totalCells, filled: filledCells };
  }, [tableData]);
  
  // 渲染儲存格
  const renderCell = useCallback((cellData, rowIndex, colIndex) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
    const cellKey = `cell-${rowIndex}-${colIndex}`;
    
    if (isEditing) {
      return (
        <input
          ref={editInputRef}
          type="text"
          value={cellValue}
          onChange={(e) => setCellValue(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              finishEdit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
          className="w-full h-full px-2 py-1 border-2 border-blue-500 outline-none bg-white"
        />
      );
    }
    
    // 顯示模式
    let displayValue = cellData;
    let cellClass = "px-2 py-1 text-gray-900";
    
    if (cellData === null) {
      displayValue = 'null';
      cellClass += " text-gray-400 italic";
    } else if (cellData === '') {
      displayValue = '';
      cellClass += " bg-gray-50";
    } else if (typeof cellData === 'boolean') {
      displayValue = cellData ? 'true' : 'false';
      cellClass += " text-purple-600 font-medium";
    } else if (typeof cellData === 'number') {
      cellClass += " text-blue-600 font-mono";
    } else if (typeof cellData === 'string') {
      cellClass += " text-gray-800";
    }
    
    return (
      <div
        className={`${cellClass} cursor-text h-full flex items-center min-h-[32px]`}
        onClick={() => startEdit(rowIndex, colIndex)}
        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
        tabIndex={0}
      >
        {String(displayValue)}
      </div>
    );
  }, [editingCell, cellValue, finishEdit, cancelEdit, startEdit, handleKeyDown]);
  
  // 當前錯誤
  const currentError = localError || globalError;
  
  if (!selectedTable) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-600 text-lg mb-2">選擇一個2D數組節點開始編輯</p>
          <p className="text-gray-400 text-sm">點擊圖形視圖中的表格節點</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* 控制欄 */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="text-xs text-gray-600">
            <span className="font-medium">{selectedTable || '無選擇'}</span>
            {activeEditor === 'table-editor' && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                同步中
              </span>
            )}
            <div className="mt-1 text-gray-500">
              {tableStats.rows} 行 × {tableStats.cols} 列 | 
              {tableStats.filled}/{tableStats.cells} 儲存格已填充 |
              {editingCell ? '編輯中' : '查看模式'}
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={addRow}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
            >
              + 行
            </button>
            <button
              onClick={addColumn}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
            >
              + 列
            </button>
          </div>
        </div>
        
        {/* 錯誤顯示 */}
        {currentError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
            <div className="flex items-start">
              <span className="text-red-400 mr-2">⚠️</span>
              <p className="text-sm text-red-800">{currentError}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* 表格主體 */}
      <div className="flex-1 overflow-auto">
        {tableData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>沒有可編輯的數據</p>
          </div>
        ) : (
          <div className="p-4">
            <table className="border-collapse border border-gray-300 bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="w-8 border border-gray-300 px-2 py-1 text-xs text-gray-500">#</th>
                  {Array.from({ length: Math.max(...tableData.map(row => row.length)) }).map((_, colIndex) => (
                    <th 
                      key={colIndex} 
                      className="border border-gray-300 px-2 py-1 text-xs text-gray-500 min-w-[100px] relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span>列 {colIndex + 1}</span>
                        <button
                          onClick={() => deleteColumn(colIndex)}
                          className="opacity-0 group-hover:opacity-100 ml-1 text-red-500 hover:text-red-700 text-xs"
                          title="刪除列"
                        >
                          ×
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 group">
                    <td className="border border-gray-300 px-2 py-1 text-xs text-gray-500 bg-gray-100 relative">
                      <div className="flex items-center justify-between">
                        <span>{rowIndex + 1}</span>
                        {tableData.length > 1 && (
                          <button
                            onClick={() => deleteRow(rowIndex)}
                            className="opacity-0 group-hover:opacity-100 ml-1 text-red-500 hover:text-red-700 text-xs"
                            title="刪除行"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                    {Array.from({ length: Math.max(...tableData.map(r => r.length)) }).map((_, colIndex) => (
                      <td 
                        key={colIndex}
                        className={`
                          border border-gray-300 min-w-[100px] h-8
                          ${editingCell?.row === rowIndex && editingCell?.col === colIndex ? 'bg-blue-50' : ''}
                        `}
                      >
                        {renderCell(row[colIndex] ?? '', rowIndex, colIndex)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* 底部幫助信息 */}
      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
        操作提示: 點擊儲存格編輯 | Enter 確認並移至下一行 | Tab 移至下一列 | Esc 取消編輯
      </div>
    </div>
  );
};

export default TableEditor;