import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useJsonStore } from '../stores/jsonStore_v2';

/**
 * 完全重構的 JSON 編輯器 - 簡化且可靠
 * 
 * 設計原則：
 * 1. 用戶編輯時完全本地化，不受外部干擾
 * 2. 只在失焦時同步到 store
 * 3. 避免複雜的狀態追蹤和循環檢查
 */
const JsonEditor = () => {
  const [jsonText, setJsonText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [parseStatus, setParseStatus] = useState('valid');
  
  const textareaRef = useRef(null);
  const isInitialized = useRef(false);
  const lastSyncedData = useRef(null); // 記錄最後同步的數據
  
  // 直接使用 store 的方法，避免複雜的 hook
  const jsonData = useJsonStore((state) => state.jsonData);
  const updateJsonData = useJsonStore((state) => state.updateJsonData);
  const activeEditor = useJsonStore((state) => state.activeEditor);
  
  // JSON 驗證和格式化
  const validateJson = useCallback((text) => {
    if (!text.trim()) {
      setParseStatus('empty');
      setLocalError('JSON 不能為空');
      return null;
    }
    
    try {
      const parsed = JSON.parse(text);
      setParseStatus('valid');
      setLocalError(null);
      return parsed;
    } catch (error) {
      setParseStatus('invalid');
      setLocalError(`JSON 語法錯誤: ${error.message}`);
      return null;
    }
  }, []);
  
  const formatJson = useCallback((data) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('[JsonEditor] 格式化失敗:', error);
      return '';
    }
  }, []);
  
  // 初始化 - 只執行一次
  useEffect(() => {
    if (!isInitialized.current && jsonData) {
      const initialText = formatJson(jsonData);
      setJsonText(initialText);
      lastSyncedData.current = jsonData;
      isInitialized.current = true;
      console.log('[JsonEditor] 初始化完成');
    }
  }, [jsonData, formatJson]);
  
  // 監聽外部數據變化 - 只在非編輯狀態時同步
  useEffect(() => {
    if (isInitialized.current && !isFocused && activeEditor !== 'json-editor') {
      // 檢查是否真的是外部變化
      if (lastSyncedData.current && jsonData !== lastSyncedData.current) {
        const newText = formatJson(jsonData);
        setJsonText(newText);
        lastSyncedData.current = jsonData;
        console.log('[JsonEditor] 外部數據變化，同步到編輯器');
      }
    }
  }, [jsonData, isFocused, activeEditor, formatJson]);
  
  // 文本輸入處理
  const handleTextChange = useCallback((e) => {
    const newText = e.target.value;
    setJsonText(newText);
    
    // 只進行語法檢查，不更新 store
    validateJson(newText);
  }, [validateJson]);
  
  // 焦點處理
  const handleFocus = useCallback(() => {
    console.log('[JsonEditor] 獲得焦點，進入編輯模式');
    setIsFocused(true);
    setLocalError(null);
  }, []);
  
  const handleBlur = useCallback(() => {
    console.log('[JsonEditor] 失去焦點，準備保存數據');
    setIsFocused(false);
    
    // 嘗試解析和保存數據
    const parsedData = validateJson(jsonText);
    if (parsedData !== null) {
      console.log('[JsonEditor] 數據有效，保存到 store');
      
      // 更新 store
      updateJsonData(parsedData, 'json-editor');
      lastSyncedData.current = parsedData;
      
      // 格式化文本
      const formattedText = formatJson(parsedData);
      if (formattedText !== jsonText) {
        setJsonText(formattedText);
        console.log('[JsonEditor] 文本已格式化');
      }
    } else {
      console.log('[JsonEditor] 數據無效，保持編輯狀態');
    }
  }, [jsonText, validateJson, updateJsonData, formatJson]);
  
  // 快捷鍵處理
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          // 手動保存
          handleBlur();
          break;
        case 'z':
          // 允許撤銷
          break;
        default:
          break;
      }
    }
  }, [handleBlur]);
  
  // 狀態指示
  const getStatusColor = () => {
    if (parseStatus === 'valid') return 'text-green-600';
    if (parseStatus === 'invalid') return 'text-red-600';
    return 'text-gray-600';
  };
  
  const getStatusText = () => {
    if (isFocused) {
      if (parseStatus === 'valid') return '編輯中 - 語法正確';
      if (parseStatus === 'invalid') return '編輯中 - 語法錯誤';
      return '編輯中';
    } else {
      if (parseStatus === 'valid') return '語法正確';
      if (parseStatus === 'invalid') return '語法錯誤';
      return '待機';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 狀態和工具欄 */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className={`text-xs ${getStatusColor()}`}>
              狀態: {getStatusText()} | {jsonText.length} 字符
            </div>
            {activeEditor === 'json-editor' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                活躍編輯中
              </span>
            )}
          </div>
          
          {/* 操作按鈕 */}
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (parseStatus === 'valid') {
                  const parsedData = JSON.parse(jsonText);
                  const formatted = formatJson(parsedData);
                  setJsonText(formatted);
                }
              }}
              disabled={parseStatus !== 'valid'}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              格式化
            </button>
            <button
              onClick={() => textareaRef.current?.select()}
              className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              全選
            </button>
          </div>
        </div>
        
        {/* 錯誤顯示 */}
        {localError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
            <div className="flex items-start">
              <span className="text-red-400 mr-2">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">錯誤信息</p>
                <p className="text-xs text-red-600 mt-1">{localError}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 編輯器主體 */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={jsonText}
          onChange={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`
            w-full h-full p-4 font-mono text-sm resize-none border-none outline-none
            transition-colors duration-200
            ${parseStatus === 'invalid' ? 'bg-red-50' : 'bg-white'}
            ${isFocused ? 'ring-2 ring-blue-200' : ''}
          `}
          placeholder="輸入 JSON 數據..."
          spellCheck={false}
          style={{
            tabSize: 2,
            lineHeight: '1.5'
          }}
        />
        
        {/* 狀態指示器 */}
        <div className="absolute bottom-4 right-4">
          <div className={`
            flex items-center space-x-2 px-2 py-1 rounded-full text-xs
            ${parseStatus === 'valid' ? 'bg-green-100 text-green-800' : 
              parseStatus === 'invalid' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}
            ${activeEditor === 'json-editor' ? 'animate-pulse' : ''}
          `}>
            <div className={`w-2 h-2 rounded-full ${
              parseStatus === 'valid' ? 'bg-green-400' : 
              parseStatus === 'invalid' ? 'bg-red-400' : 'bg-gray-400'
            }`} />
            <span>
              {parseStatus === 'valid' ? 'JSON 有效' : 
               parseStatus === 'invalid' ? 'JSON 無效' : '空白'}
            </span>
          </div>
        </div>
      </div>
      
      {/* 底部提示 */}
      <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
        💡 編輯時數據完全本地化，失去焦點時自動保存 | Ctrl+S 手動保存 | Ctrl+A 全選
      </div>
    </div>
  );
};

export default JsonEditor;