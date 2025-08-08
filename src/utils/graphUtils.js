import { isEqual } from 'lodash-es';

/**
 * 圖形工具函數集合
 */

/**
 * 檢查是否為2D數組
 */
export const is2DArray = (arr) => {
  return Array.isArray(arr) && arr.length > 0 && 
         arr.every(item => Array.isArray(item));
};

/**
 * 檢查是否為複雜結構
 */
export const isComplexStructure = (obj) => {
  if (Array.isArray(obj)) {
    return !is2DArray(obj);
  }
  if (typeof obj === 'object' && obj !== null) {
    return true;
  }
  return false;
};

/**
 * 從JSON數據提取圖形節點和連接
 * @param {Object} data - JSON數據
 * @returns {Object} { nodes, links }
 */
export const extractGraphData = (data) => {
  const nodes = [];
  const links = [];
  
  const extractNodes = (obj, path = '', depth = 0, parentId = null) => {
    const currentId = path || 'JSON';
    
    if (path === '') {
      // 根節點
      nodes.push({
        id: 'JSON',
        name: 'JSON',
        data: obj,
        type: 'root',
        depth: 0,
        parentId: null,
        x: 0,
        y: 0
      });
      
      // 處理根對象的屬性
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        Object.keys(obj).forEach(key => {
          extractNodes(obj[key], key, 1, 'JSON');
          
          // 為根節點的每個屬性添加連接
          links.push({
            sourceId: 'JSON',
            targetId: key,
            type: 'root-child'
          });
        });
      }
    } else {
      // 子節點
      if (Array.isArray(obj)) {
        if (is2DArray(obj)) {
          // 2D數組 - 可編輯的表格
          nodes.push({
            id: currentId,
            name: path.split('.').pop(),
            data: obj,
            type: '2d-array',
            depth: depth,
            parentId: parentId,
            x: 0,
            y: 0
          });
        } else {
          // 其他數組 - complex-box
          const slots = [];
          const simpleProps = [];
          
          obj.forEach((item, index) => {
            const slotId = `${currentId}[${index}]`;
            
            if (typeof item !== 'object' || item === null) {
              // 基本類型元素
              simpleProps.push({
                key: `[${index}]`,
                value: String(item),
                type: typeof item
              });
            } else {
              // 複雜元素
              let itemType = 'object';
              if (Array.isArray(item)) {
                itemType = is2DArray(item) ? '2d-array' : 'array';
              }
              
              slots.push({
                key: `[${index}]`,
                slotId: slotId,
                type: itemType
              });
              
              // 遞歸處理複雜元素
              extractNodes(item, slotId, depth + 1, currentId);
              
              // 添加slot連接
              links.push({
                sourceId: currentId,
                targetId: slotId,
                slotKey: `[${index}]`,
                type: 'slot'
              });
            }
          });
          
          nodes.push({
            id: currentId,
            name: path.split('.').pop(),
            data: obj,
            type: 'complex-box',
            subtype: 'array',
            depth: depth,
            parentId: parentId,
            slots: slots,
            properties: simpleProps,
            x: 0,
            y: 0
          });
        }
      } else if (typeof obj === 'object' && obj !== null) {
        // 對象 - complex-box
        const slots = [];
        const simpleProps = [];
        
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          const slotId = `${currentId}.${key}`;
          
          if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            // 複雜屬性
            let valueType = 'object';
            if (Array.isArray(value)) {
              valueType = is2DArray(value) ? '2d-array' : 'array';
            }
            
            slots.push({
              key: key,
              slotId: slotId,
              type: valueType
            });
            
            extractNodes(value, slotId, depth + 1, currentId);
            
            links.push({
              sourceId: currentId,
              targetId: slotId,
              slotKey: key,
              type: 'slot'
            });
          } else {
            // 基本屬性
            simpleProps.push({
              key: key,
              value: String(value),
              type: typeof value
            });
          }
        });
        
        nodes.push({
          id: currentId,
          name: path.split('.').pop(),
          data: obj,
          type: 'complex-box',
          subtype: 'object',
          depth: depth,
          parentId: parentId,
          slots: slots,
          properties: simpleProps,
          x: 0,
          y: 0
        });
      } else {
        // 基本類型
        let nodeType = 'primitive';
        if (typeof obj === 'string') nodeType = 'string';
        else if (typeof obj === 'number') nodeType = 'number';
        else if (typeof obj === 'boolean') nodeType = 'boolean';
        
        nodes.push({
          id: currentId,
          name: path.split('.').pop(),
          data: obj,
          type: nodeType,
          depth: depth,
          parentId: parentId,
          x: 0,
          y: 0
        });
        
        // 為基本類型節點添加parent-child連接
        if (parentId) {
          const parentNode = nodes.find(n => n.id === parentId);
          if (parentNode && parentNode.type !== 'complex-box') {
            links.push({
              sourceId: parentId,
              targetId: currentId,
              type: 'parent-child'
            });
          }
        }
      }
    }
  };
  
  extractNodes(data);
  
  return { nodes, links };
};

/**
 * 檢測結構變化類型
 * @param {Object} newData - 新數據
 * @param {Object} oldData - 舊數據
 * @returns {String} 變化類型：'major' | 'minor' | 'none'
 */
export const detectStructureChange = (newData, oldData) => {
  if (!oldData) return 'major'; // 首次加載
  
  if (isEqual(newData, oldData)) return 'none';
  
  const checkStructure = (newObj, oldObj, depth = 0) => {
    if (depth > 3) return 'minor'; // 限制檢查深度
    
    if (typeof newObj !== typeof oldObj) return 'major';
    
    if (Array.isArray(newObj) && Array.isArray(oldObj)) {
      // 對於數組，檢查長度變化
      const lengthChange = Math.abs(newObj.length - oldObj.length);
      const maxLength = Math.max(newObj.length, oldObj.length);
      
      if (maxLength > 0 && lengthChange / maxLength > 0.3) {
        return 'major'; // 30%以上的長度變化算作重大變化
      }
      
      // 檢查數組元素的結構類型
      if (newObj.length > 0 && oldObj.length > 0) {
        const elementChange = checkStructure(newObj[0], oldObj[0], depth + 1);
        if (elementChange === 'major') return 'major';
      }
      
      return 'minor';
    }
    
    if (typeof newObj === 'object' && newObj !== null && oldObj !== null) {
      const newKeys = Object.keys(newObj).sort();
      const oldKeys = Object.keys(oldObj).sort();
      
      // 檢查鍵的變化
      if (newKeys.length !== oldKeys.length) return 'major';
      
      for (let i = 0; i < newKeys.length; i++) {
        if (newKeys[i] !== oldKeys[i]) return 'major';
      }
      
      // 檢查值的結構類型
      for (const key of newKeys) {
        const valueChange = checkStructure(newObj[key], oldObj[key], depth + 1);
        if (valueChange === 'major') return 'major';
      }
      
      return 'minor';
    }
    
    return 'minor'; // 基本類型的變化算作輕微變化
  };
  
  return checkStructure(newData, oldData);
};

/**
 * 計算圖形節點的差異
 * @param {Array} newNodes - 新節點數組
 * @param {Array} oldNodes - 舊節點數組
 * @returns {Object} { added, updated, removed }
 */
export const calculateNodeDiff = (newNodes, oldNodes) => {
  const oldNodeMap = new Map(oldNodes.map(node => [node.id, node]));
  const newNodeMap = new Map(newNodes.map(node => [node.id, node]));
  
  const added = [];
  const updated = [];
  const removed = [];
  
  // 找出新增和更新的節點
  newNodes.forEach(newNode => {
    const oldNode = oldNodeMap.get(newNode.id);
    
    if (!oldNode) {
      added.push(newNode);
    } else if (!isEqual(newNode.data, oldNode.data) || 
               !isEqual(newNode.properties, oldNode.properties) ||
               !isEqual(newNode.slots, oldNode.slots)) {
      updated.push({
        ...newNode,
        oldNode: oldNode
      });
    }
  });
  
  // 找出被刪除的節點
  oldNodes.forEach(oldNode => {
    if (!newNodeMap.has(oldNode.id)) {
      removed.push(oldNode);
    }
  });
  
  return { added, updated, removed };
};

/**
 * 獲取節點尺寸
 * @param {Object} node - 節點對象
 * @returns {Object} { width, height }
 */
export const getNodeDimensions = (node) => {
  let width = 160, height = 40;
  
  if (node.type === 'root') {
    width = 80; 
    height = 30;
  } else if (node.type === '2d-array') {
    const data = node.data;
    if (data && data.length > 0) {
      const maxCols = Math.max(...data.map(row => row.length));
      width = Math.max(200, maxCols * 80 + 40);
      height = Math.max(80, data.length * 25 + 40);
    }
  } else if (node.type === 'complex-box') {
    const properties = node.properties || [];
    const slots = node.slots || [];
    
    // 自適應尺寸計算 - 與GraphViewer渲染一致
    let maxContentWidth = 120;
    const baseHeight = 35;
    const rowHeight = 24;
    const slotHeight = 18;
    
    if (node.subtype === 'array') {
      // 一維陣列：根據最長值計算寬度
      properties.forEach(prop => {
        const valueLength = String(prop.value).length;
        const estimatedWidth = Math.max(100, valueLength * 7 + 50);
        maxContentWidth = Math.max(maxContentWidth, estimatedWidth);
      });
      width = Math.min(maxContentWidth, 200);
    } else {
      // 對象：根據key:value長度計算
      properties.forEach(prop => {
        const keyValueLength = prop.key.length + String(prop.value).length + 4;
        const estimatedWidth = Math.max(160, keyValueLength * 7 + 40);
        maxContentWidth = Math.max(maxContentWidth, estimatedWidth);
      });
      width = Math.min(maxContentWidth, 300);
    }
    
    height = baseHeight + properties.length * rowHeight + slots.length * slotHeight + 10;
  } else if (['string', 'number', 'boolean', 'primitive'].includes(node.type)) {
    width = 160; 
    height = 50;
  }
  
  return { width, height };
};

/**
 * 生成節點的唯一鍵（用於React key）
 * @param {Object} node - 節點對象
 * @returns {String} 唯一鍵
 */
export const generateNodeKey = (node) => {
  const dataHash = JSON.stringify(node.data).length; // 簡單的哈希
  return `${node.id}-${node.type}-${dataHash}`;
};