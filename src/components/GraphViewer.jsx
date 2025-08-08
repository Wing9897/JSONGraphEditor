import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useJsonStore } from '../stores/jsonStore_v2';
import { 
  extractGraphData, 
  detectStructureChange, 
  calculateNodeDiff,
  getNodeDimensions,
  generateNodeKey
} from '../utils/graphUtils';

const GraphViewer = () => {
  const svgRef = useRef(null);
  const nodePositionsRef = useRef(new Map()); // 使用 Map 存儲節點位置
  const previousDataRef = useRef(null);
  const zoomStateRef = useRef(null); // 保存縮放狀態
  const [isLayouting, setIsLayouting] = useState(false);
  
  const jsonData = useJsonStore((state) => state.jsonData);
  const updateTableSelection = useJsonStore((state) => state.updateTableSelection);
  const updatePathSelection = useJsonStore((state) => state.updatePathSelection);
  const activeEditor = useJsonStore((state) => state.activeEditor);
  
  // 提取圖形數據 - 優化重新計算
  const graphData = useMemo(() => {
    if (!jsonData) return { nodes: [], links: [] };
    
    console.log('[GraphViewer] 計算圖形數據，當前JSON數據:', {
      dataKeys: Object.keys(jsonData),
      dataSize: JSON.stringify(jsonData).length
    });
    
    // 總是重新計算，確保數據同步
    const result = extractGraphData(jsonData);
    
    // 更新前一次的數據引用
    previousDataRef.current = jsonData;
    
    console.log('[GraphViewer] 圖形數據計算完成:', {
      nodesCount: result.nodes.length,
      linksCount: result.links.length
    });
    
    return result;
  }, [jsonData]);
  
  // 檢測變化類型 - 簡化邏輯
  const changeType = useMemo(() => {
    if (!previousDataRef.current) {
      console.log('[GraphViewer] 初次加載，設置為major變化');
      return 'major'; // 初次加載
    }
    
    const type = detectStructureChange(jsonData, previousDataRef.current);
    console.log(`[GraphViewer] 檢測到 ${type} 結構變化`);
    return type;
  }, [jsonData]);
  
  // JsonCrack風格發散布局算法
  const layoutNodes = useCallback((nodes, forceRelayout = false) => {
    const startX = 100;
    const centerY = 300;
    const levelGap = 300; // 增加層級間距
    const verticalSpacing = 120; // 增加垂直間距
    
    // 計算節點高度
    function getNodeHeight(node) {
      if (node.type === 'complex-box') {
        const properties = node.properties || [];
        const slots = node.slots || [];
        
        // 自適應高度計算 - 與新渲染系統一致
        const baseHeight = 35;
        const rowHeight = 24;
        const slotHeight = 18;
        return baseHeight + properties.length * rowHeight + slots.length * slotHeight + 10;
      } else if (node.type === '2d-array') {
        const data = node.data;
        if (data && data.length > 0) {
          return Math.max(80, data.length * 25 + 40);
        }
        return 80;
      } else if (node.type === 'root') {
        return 30;
      }
      return 50;
    }
    
    // 計算層級
    const calculateLevel = (nodeId, visited = new Set()) => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node || !node.parentId) return 0;
      
      return calculateLevel(node.parentId, visited) + 1;
    };
    
    // 如果不強制重新布局，保留現有位置
    if (!forceRelayout) {
      let hasNewNodes = false;
      
      nodes.forEach(node => {
        const savedPosition = nodePositionsRef.current.get(node.id);
        if (savedPosition) {
          node.x = savedPosition.x;
          node.y = savedPosition.y;
        } else {
          hasNewNodes = true;
        }
      });
      
      if (!hasNewNodes) {
        return nodes;
      }
    }
    
    console.log('[GraphViewer] 執行JsonCrack風格發散布局');
    setIsLayouting(true);
    
    // 計算所有節點層級
    nodes.forEach(node => {
      node.level = calculateLevel(node.id);
    });
    
    // 按層級分組
    const nodesByLevel = {};
    nodes.forEach(node => {
      if (!nodesByLevel[node.level]) {
        nodesByLevel[node.level] = [];
      }
      nodesByLevel[node.level].push(node);
    });
    
    const maxLevel = Math.max(...Object.keys(nodesByLevel).map(Number));
    
    // 布局根節點
    const rootNodes = nodesByLevel[0] || [];
    rootNodes.forEach(node => {
      node.x = startX;
      node.y = centerY - getNodeHeight(node) / 2;
    });
    
    // JsonCrack風格扇形發散布局 - 徹底避免交叉
    for (let level = 1; level <= maxLevel; level++) {
      const levelNodes = nodesByLevel[level] || [];
      const x = startX + level * levelGap;
      
      // 按父節點分組
      const nodesByParent = {};
      levelNodes.forEach(node => {
        const parentId = node.parentId;
        if (!nodesByParent[parentId]) {
          nodesByParent[parentId] = [];
        }
        nodesByParent[parentId].push(node);
      });
      
      // 收集所有父節點並按Y位置排序
      const parentInfos = [];
      Object.keys(nodesByParent).forEach(parentId => {
        const parent = nodes.find(n => n.id === parentId);
        if (parent) {
          parentInfos.push({
            id: parentId,
            node: parent,
            children: nodesByParent[parentId],
            centerY: parent.y + getNodeHeight(parent) / 2
          });
        }
      });
      
      parentInfos.sort((a, b) => a.centerY - b.centerY);
      
      // 為整層預分配垂直空間
      const totalParents = parentInfos.length;
      let currentSectionStart = centerY - 400; // 從更高的位置開始
      
      parentInfos.forEach((parentInfo, parentIndex) => {
        const children = parentInfo.children;
        
        // 按JSON順序排序子節點
        children.sort((a, b) => {
          const aKey = a.id.split('.').pop() || a.id.split('[').pop()?.replace(']', '') || '';
          const bKey = b.id.split('.').pop() || b.id.split('[').pop()?.replace(']', '') || '';
          
          const aIndex = parseInt(aKey);
          const bIndex = parseInt(bKey);
          if (!isNaN(aIndex) && !isNaN(bIndex)) {
            return aIndex - bIndex;
          }
          
          return aKey.localeCompare(bKey);
        });
        
        // 增強的碰撞檢測和間距計算
        const childrenWithHeights = children.map(child => ({
          node: child,
          height: getNodeHeight(child)
        }));
        
        // 計算實際所需的總高度
        const totalNodeHeight = childrenWithHeights.reduce((sum, item) => sum + item.height, 0);
        const minSpacing = 25; // 增加最小間距
        const idealSpacing = 80; // 增加理想間距
        
        // 更智能的間距計算 - 根據節點高度動態調整
        let adaptiveSpacing = idealSpacing;
        if (children.length > 1) {
          const avgHeight = totalNodeHeight / children.length;
          // 基於平均高度調整間距，高度大的節點需要更多間距
          const heightFactor = Math.max(1, avgHeight / 50);
          adaptiveSpacing = Math.max(minSpacing, idealSpacing / Math.sqrt(children.length) * heightFactor);
        }
        
        // 計算總高度（包含節點實際高度和間距）
        const totalSpacing = children.length > 1 ? (children.length - 1) * adaptiveSpacing : 0;
        const groupTotalHeight = totalNodeHeight + totalSpacing;
        
        const parentCenterY = parentInfo.centerY;
        
        // 增強的位置計算 - 考慮更大的安全邊距
        let groupCenterY = parentCenterY;
        
        // 如果不是第一個父節點，確保有足夠的垂直間隔
        if (parentIndex > 0) {
          const safeMargin = 50; // 增加安全邊距
          const minRequiredY = currentSectionStart + groupTotalHeight / 2 + safeMargin;
          groupCenterY = Math.max(groupCenterY, minRequiredY);
        }
        
        // 計算子節點的起始Y位置
        let currentY = groupCenterY - groupTotalHeight / 2;
        
        // 分配具體位置，並進行碰撞檢測
        childrenWithHeights.forEach((item, index) => {
          // 檢查是否與已存在的節點碰撞
          let proposedY = currentY;
          let collision = true;
          let attempts = 0;
          
          while (collision && attempts < 10) {
            collision = false;
            
            // 檢查與所有已佈局節點的碰撞
            for (const [nodeId, pos] of nodePositionsRef.current.entries()) {
              if (nodeId === item.node.id) continue;
              
              const existingHeight = getNodeHeight(nodes.find(n => n.id === nodeId) || { type: 'primitive' });
              const verticalDistance = Math.abs(proposedY - pos.y);
              const horizontalDistance = Math.abs(x - pos.x);
              
              // 如果在相近的水平位置且垂直距離不夠
              if (horizontalDistance < 300 && verticalDistance < (item.height + existingHeight) / 2 + minSpacing) {
                collision = true;
                proposedY += minSpacing + 10; // 向下調整位置
                break;
              }
            }
            
            attempts++;
          }
          
          item.node.x = x;
          item.node.y = proposedY;
          
          // 更新下一個節點的位置
          currentY = proposedY + item.height + adaptiveSpacing;
        });
        
        // 更新下一個可用的起始位置，確保足夠間隔
        const lastNodeY = childrenWithHeights.length > 0 ? 
          childrenWithHeights[childrenWithHeights.length - 1].node.y + 
          childrenWithHeights[childrenWithHeights.length - 1].height : groupCenterY;
        
        currentSectionStart = Math.max(currentSectionStart, lastNodeY + 60);
      });
    }
    
    // 保存位置
    nodes.forEach(node => {
      nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
    });
    
    setTimeout(() => setIsLayouting(false), 300);
    
    return nodes;
  }, []);
  
  // 清理已刪除節點的位置記錄
  const cleanupNodePositions = useCallback((currentNodes) => {
    const currentNodeIds = new Set(currentNodes.map(n => n.id));
    
    for (const nodeId of nodePositionsRef.current.keys()) {
      if (!currentNodeIds.has(nodeId)) {
        nodePositionsRef.current.delete(nodeId);
      }
    }
  }, []);
  
  // 主渲染函數
  const renderGraph = useCallback(() => {
    if (!svgRef.current || !graphData.nodes.length) return;
    
    const { nodes, links } = graphData;
    
    // 清理刪除的節點位置
    cleanupNodePositions(nodes);
    
    // 確定是否需要重新布局
    const needsRelayout = changeType === 'major';
    const layoutedNodes = layoutNodes(nodes, needsRelayout);
    
    // 更新上次數據引用
    previousDataRef.current = jsonData;
    
    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 600;
    
    // 保存當前的縮放狀態（如果存在）
    const currentTransform = zoomStateRef.current || d3.zoomIdentity;
    
    // 清理並重建容器
    svg.selectAll("*").remove();
    
    const container = svg.append('g');
    
    // 縮放和拖拽
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
        // 保存當前的變換狀態
        zoomStateRef.current = event.transform;
      });
    
    svg.call(zoom);
    
    // 恢復之前的縮放狀態
    if (currentTransform && currentTransform !== d3.zoomIdentity) {
      svg.call(zoom.transform, currentTransform);
      container.attr('transform', currentTransform);
    }
    
    // 渲染連接線
    const renderLinks = () => {
      container.selectAll('.connection-line').remove();
      
      // 計算每個父節點的子節點分佈
      const parentChildrenMap = new Map();
      links.forEach(link => {
        if (link.type !== 'slot') {
          if (!parentChildrenMap.has(link.sourceId)) {
            parentChildrenMap.set(link.sourceId, []);
          }
          parentChildrenMap.get(link.sourceId).push(link);
        }
      });
      
      // 專業的連接點分配算法：基於端點約束和分層連接
      const getOptimalConnectionPoints = (sourceNode, targetNodes) => {
        const sourceDim = getNodeDimensions(sourceNode);
        const connectionPoints = [];
        
        if (targetNodes.length === 0) return connectionPoints;
        if (targetNodes.length === 1) {
          // 單個子節點：從父節點中心連接
          const targetNode = targetNodes[0];
          const targetDim = getNodeDimensions(targetNode);
          return [{
            source: {
              x: sourceNode.x + sourceDim.width,
              y: sourceNode.y + sourceDim.height / 2
            },
            target: {
              x: targetNode.x,
              y: targetNode.y + targetDim.height / 2
            },
            targetNode: targetNode
          }];
        }
        
        // 多個子節點：使用專業的端點約束算法
        // 1. 按目標節點的Y座標排序
        const sortedTargets = [...targetNodes].sort((a, b) => a.y - b.y);
        
        // 2. 計算父節點的可用連接區域
        const minSourceY = sourceNode.y + 10; // 頂部邊距
        const maxSourceY = sourceNode.y + sourceDim.height - 10; // 底部邊距
        const availableHeight = maxSourceY - minSourceY;
        
        // 3. 為每個目標節點分配最佳連接點
        sortedTargets.forEach((targetNode, index) => {
          const targetDim = getNodeDimensions(targetNode);
          
          // 使用線性分佈但考慮目標節點的相對位置
          let sourceY;
          if (sortedTargets.length === 1) {
            sourceY = sourceNode.y + sourceDim.height / 2;
          } else {
            // 計算目標節點相對於所有兄弟節點的位置比例
            const targetCenterY = targetNode.y + targetDim.height / 2;
            const minTargetY = Math.min(...sortedTargets.map(t => t.y + getNodeDimensions(t).height / 2));
            const maxTargetY = Math.max(...sortedTargets.map(t => t.y + getNodeDimensions(t).height / 2));
            
            if (maxTargetY === minTargetY) {
              // 所有目標節點在同一高度
              sourceY = sourceNode.y + sourceDim.height / 2;
            } else {
              // 按目標節點的相對位置計算源連接點
              const ratio = (targetCenterY - minTargetY) / (maxTargetY - minTargetY);
              sourceY = minSourceY + (availableHeight * ratio);
            }
          }
          
          connectionPoints.push({
            source: {
              x: sourceNode.x + sourceDim.width,
              y: sourceY
            },
            target: {
              x: targetNode.x,
              y: targetNode.y + targetDim.height / 2
            },
            targetNode: targetNode
          });
        });
        
        return connectionPoints;
      };
      
      // 處理 slot 連接線（complex-box 的專用連接）
      links.forEach(link => {
        const sourceNode = layoutedNodes.find(n => n.id === link.sourceId);
        const targetNode = layoutedNodes.find(n => n.id === link.targetId);
        
        if (sourceNode && targetNode && link.type === 'slot') {
          const slots = sourceNode.slots || [];
          const properties = sourceNode.properties || [];
          const slotIndex = slots.findIndex(slot => slot.key === link.slotKey);
          
          if (slotIndex >= 0) {
            // 使用實際節點寬度計算slot連接點
            const sourceDim = getNodeDimensions(sourceNode);
            const targetDim = getNodeDimensions(targetNode);
            const sourceX = sourceNode.x + sourceDim.width - 4; // 對應slot dot的cx位置
            
            // 自適應slot連接點計算
            const rowHeight = 24;
            const baseY = sourceNode.y + 42 + properties.length * rowHeight; // contentStartY + properties
            const sourceY = baseY + slotIndex * 18; // 使用slotHeight
            const targetX = targetNode.x;
            const targetY = targetNode.y + targetDim.height / 2;
            
            const midX = sourceX + (targetX - sourceX) / 2;
            const path = `M ${sourceX},${sourceY} C ${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`;
            
            container.append('path')
              .attr('class', 'connection-line slot-connection')
              .attr('d', path)
              .style('stroke', '#8b5cf6')
              .style('stroke-width', 2.5)
              .style('fill', 'none')
              .style('opacity', 0.8);
          }
        }
      });
      
      // 處理父子連接線：使用新的最佳化算法
      const processedParents = new Set();
      parentChildrenMap.forEach((childLinks, parentId) => {
        if (processedParents.has(parentId)) return;
        processedParents.add(parentId);
        
        const sourceNode = layoutedNodes.find(n => n.id === parentId);
        if (!sourceNode) return;
        
        // 獲取所有子節點
        const targetNodes = childLinks
          .map(link => layoutedNodes.find(n => n.id === link.targetId))
          .filter(Boolean);
          
        if (targetNodes.length === 0) return;
        
        // 使用新的最佳化連接點算法
        const optimalConnections = getOptimalConnectionPoints(sourceNode, targetNodes);
        
        // 渲染所有連接線
        optimalConnections.forEach((connection, index) => {
          const sourceX = connection.source.x;
          const sourceY = connection.source.y;
          const targetX = connection.target.x;
          const targetY = connection.target.y;
          
          const midX = sourceX + (targetX - sourceX) / 2;
          const path = `M ${sourceX},${sourceY} C ${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`;
          
          // 判斷連接線類型
          const linkType = childLinks.find(l => l.targetId === connection.targetNode.id)?.type || 'parent-child';
          
          container.append('path')
            .attr('class', 'connection-line parent-child-connection')
            .attr('d', path)
            .style('stroke', linkType === 'root-child' ? '#8b5cf6' : '#6b7280')
            .style('stroke-width', linkType === 'root-child' ? 3 : 2)
            .style('fill', 'none')
            .style('opacity', linkType === 'root-child' ? 0.9 : 0.7);
        });
      });
    };
    
    renderLinks();
    
    // 渲染節點
    layoutedNodes.forEach(node => {
      const nodeGroup = container.append('g')
        .attr('transform', `translate(${node.x}, ${node.y})`)
        .datum(node);
      
      // 拖拽行為
      const drag = d3.drag()
        .on('drag', (event, d) => {
          d.x = event.x;
          d.y = event.y;
          nodeGroup.attr('transform', `translate(${d.x}, ${d.y})`);
          renderLinks();
        })
        .on('end', (event, d) => {
          nodePositionsRef.current.set(d.id, { x: d.x, y: d.y });
          renderLinks();
        });
      
      nodeGroup.call(drag);
      
      // 根據節點類型渲染
      renderNodeContent(nodeGroup, node);
    });
    
    console.log(`[GraphViewer] 渲染完成: ${layoutedNodes.length} 節點, ${links.length} 連接`);
  }, [graphData, changeType, layoutNodes, cleanupNodePositions, jsonData]);
  
  // 節點內容渲染函數
  const renderNodeContent = useCallback((nodeGroup, node) => {
    const dimensions = getNodeDimensions(node);
    
    if (node.type === '2d-array') {
      // 2D數組表格節點
      const data = node.data;
      const maxCols = data.length > 0 ? Math.max(...data.map(row => row.length)) : 0;
      const cellWidth = 80;
      const cellHeight = 25;
      
      // 主框架 - 使用紫色調來區分 2D array
      nodeGroup.append('rect')
        .attr('class', 'node-rect')
        .attr('width', dimensions.width)
        .attr('height', dimensions.height)
        .attr('fill', '#f3e8ff')
        .attr('stroke', '#8b5cf6')
        .attr('rx', 5)
        .style('cursor', 'pointer')
        .on('click', () => {
          console.log(`[GraphViewer] 選中節點: ${node.id}`);
          // 使用新的通用路徑選擇方法（支持所有數據類型）
          updatePathSelection(node.id, node.data);
          
          // 向後兼容：如果是陣列，也更新表格選擇
          if (Array.isArray(node.data)) {
            updateTableSelection(node.id, node.data);
          }
        });
      
      // 表格標題 - 使用紫色調
      nodeGroup.append('rect')
        .attr('width', dimensions.width)
        .attr('height', 25)
        .attr('fill', '#8b5cf6')
        .attr('rx', 5);
      
      nodeGroup.append('text')
        .attr('x', dimensions.width / 2)
        .attr('y', 15)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(`📊 ${node.name}`)
        .style('font-size', '12px')
        .style('fill', 'white')
        .style('font-weight', 'bold')
        .style('pointer-events', 'none');
      
      // 表格內容
      data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          const x = 20 + colIndex * cellWidth;
          const y = 30 + rowIndex * cellHeight;
          
          nodeGroup.append('rect')
            .attr('class', 'table-cell')
            .attr('x', x)
            .attr('y', y)
            .attr('width', cellWidth)
            .attr('height', cellHeight)
            .attr('fill', (rowIndex % 2 === 0) ? '#ffffff' : '#f9fafb')
            .attr('stroke', '#e5e7eb');
          
          let cellText = String(cell);
          if (cellText.length > 8) {
            cellText = cellText.substring(0, 6) + '...';
          }
          
          nodeGroup.append('text')
            .attr('x', x + cellWidth / 2)
            .attr('y', y + cellHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .text(cellText)
            .style('font-size', '10px')
            .style('pointer-events', 'none');
        });
      });
    } else if (node.type === 'complex-box') {
      // 自適應複雜箱渲染 - 全新實現
      const properties = node.properties || [];
      const slots = node.slots || [];
      
      // 自適應尺寸計算
      const calculateAdaptiveSize = () => {
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
          maxContentWidth = Math.min(maxContentWidth, 200);
        } else {
          // 對象：根據key:value長度計算
          properties.forEach(prop => {
            const keyValueLength = prop.key.length + String(prop.value).length + 4;
            const estimatedWidth = Math.max(160, keyValueLength * 7 + 40);
            maxContentWidth = Math.max(maxContentWidth, estimatedWidth);
          });
          maxContentWidth = Math.min(maxContentWidth, 300);
        }
        
        const totalHeight = baseHeight + properties.length * rowHeight + slots.length * slotHeight + 10;
        
        return {
          width: Math.round(maxContentWidth),
          height: Math.round(totalHeight)
        };
      };
      
      const adaptiveSize = calculateAdaptiveSize();
      const boxWidth = adaptiveSize.width;
      const boxHeight = adaptiveSize.height;
      
      // 主題
      const isArray = node.subtype === 'array';
      const theme = {
        bg: '#ffffff',
        border: isArray ? '#3b82f6' : '#10b981',
        headerBg: isArray ? '#3b82f6' : '#10b981',
        headerText: '#ffffff'
      };
      
      // 主容器帶陰影
      nodeGroup.append('rect')
        .attr('class', 'node-rect')
        .attr('width', boxWidth)
        .attr('height', boxHeight)
        .attr('fill', theme.bg)
        .attr('stroke', theme.border)
        .attr('stroke-width', 1.5)
        .attr('rx', 8)
        .style('cursor', 'pointer')
        .style('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))')
        .on('click', () => {
          updatePathSelection(node.id, node.data);
          if (Array.isArray(node.data)) {
            updateTableSelection(node.id, node.data);
          }
        });
      
      // 標題背景
      nodeGroup.append('rect')
        .attr('width', boxWidth)
        .attr('height', 32)
        .attr('fill', theme.headerBg)
        .attr('rx', 8);
        
      // 標題底部直角
      nodeGroup.append('rect')
        .attr('y', 16)
        .attr('width', boxWidth)
        .attr('height', 16)
        .attr('fill', theme.headerBg);
      
      // 標題文字
      const typeIcon = isArray ? '🔢' : '📦';
      nodeGroup.append('text')
        .attr('x', boxWidth / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text(`${typeIcon} ${node.name}`)
        .style('font-size', '13px')
        .style('fill', theme.headerText)
        .style('font-weight', '600');
      
      // 內容渲染
      const contentStartY = 42;
      const rowHeight = 24;
      const padding = 10;
      
      if (isArray) {
        // 陣列渲染
        properties.forEach((prop, index) => {
          const y = contentStartY + index * rowHeight;
          
          // 行分隔線
          if (index > 0) {
            nodeGroup.append('line')
              .attr('x1', padding)
              .attr('y1', y - rowHeight/2)
              .attr('x2', boxWidth - padding)
              .attr('y2', y - rowHeight/2)
              .attr('stroke', '#e5e7eb')
              .attr('stroke-width', 1)
              .attr('opacity', 0.7);
          }
          
          // 類型指示器
          const getTypeStyle = (type) => {
            switch(type) {
              case 'string': return { color: '#10b981' };
              case 'number': return { color: '#f59e0b' };
              case 'boolean': return { color: '#8b5cf6' };
              default: return { color: '#6b7280' };
            }
          };
          
          const typeStyle = getTypeStyle(prop.type);
          
          // 類型點
          nodeGroup.append('circle')
            .attr('cx', padding + 5)
            .attr('cy', y)
            .attr('r', 3)
            .attr('fill', typeStyle.color);
          
          // 自適應截斷的值顯示
          const availableWidth = boxWidth - padding - 25;
          const maxLength = Math.floor(availableWidth / 7);
          let displayValue = String(prop.value);
          if (displayValue.length > maxLength && maxLength > 0) {
            displayValue = displayValue.substring(0, maxLength - 3) + '...';
          }
          
          nodeGroup.append('text')
            .attr('x', padding + 15)
            .attr('y', y)
            .attr('dominant-baseline', 'middle')
            .text(displayValue)
            .style('font-size', '12px')
            .style('font-weight', '500')
            .style('fill', '#374151')
            .style('font-family', 'ui-monospace, monospace');
        });
      } else {
        // 對象渲染
        properties.forEach((prop, index) => {
          const y = contentStartY + index * rowHeight;
          
          // 行分隔線
          if (index > 0) {
            nodeGroup.append('line')
              .attr('x1', padding)
              .attr('y1', y - rowHeight/2)
              .attr('x2', boxWidth - padding)
              .attr('y2', y - rowHeight/2)
              .attr('stroke', '#e5e7eb')
              .attr('stroke-width', 1)
              .attr('opacity', 0.7);
          }
          
          // 類型指示器
          const getTypeStyle = (type) => {
            switch(type) {
              case 'string': return { color: '#10b981' };
              case 'number': return { color: '#f59e0b' };
              case 'boolean': return { color: '#8b5cf6' };
              default: return { color: '#6b7280' };
            }
          };
          
          const typeStyle = getTypeStyle(prop.type);
          
          // 類型點
          nodeGroup.append('circle')
            .attr('cx', padding + 5)
            .attr('cy', y)
            .attr('r', 3)
            .attr('fill', typeStyle.color);
          
          // JSON key:value 自適應顯示
          let displayValue = String(prop.value);
          const availableWidth = boxWidth - padding - 25;
          const keyLength = prop.key.length + 4; // "key": 
          const maxValueLength = Math.floor(availableWidth / 7) - keyLength;
          
          if (displayValue.length > maxValueLength && maxValueLength > 0) {
            displayValue = displayValue.substring(0, maxValueLength - 3) + '...';
          }
          
          // 字串類型加引號
          if (prop.type === 'string') {
            displayValue = `"${displayValue}"`;
          }
          
          const keyValueText = `"${prop.key}": ${displayValue}`;
          
          nodeGroup.append('text')
            .attr('x', padding + 15)
            .attr('y', y)
            .attr('dominant-baseline', 'middle')
            .text(keyValueText)
            .style('font-size', '12px')
            .style('font-weight', '500')
            .style('fill', '#374151')
            .style('font-family', 'ui-monospace, monospace');
        });
      }
      
      // 渲染slots
      slots.forEach((slot, index) => {
        const slotY = contentStartY + properties.length * rowHeight + index * 18;
        
        let dotColor = '#8b5cf6';
        if (slot.type === 'array') dotColor = '#3b82f6';
        else if (slot.type === '2d-array') dotColor = '#10b981';
        else if (slot.type === 'object') dotColor = '#f59e0b';
        
        nodeGroup.append('circle')
          .attr('class', 'slot-dot')
          .attr('cx', boxWidth - 4)
          .attr('cy', slotY)
          .attr('r', 4)
          .attr('fill', dotColor)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);
        
        nodeGroup.append('text')
          .attr('x', padding)
          .attr('y', slotY)
          .attr('dominant-baseline', 'middle')
          .text(slot.key)
          .style('font-size', '11px')
          .style('fill', '#6b7280');
      });
    } else if (node.type === 'root') {
      // 根節點
      nodeGroup.append('rect')
        .attr('class', 'node-rect')
        .attr('width', 80)
        .attr('height', 30)
        .attr('fill', '#ddd6fe')
        .attr('stroke', '#8b5cf6')
        .attr('rx', 5);
      
      nodeGroup.append('text')
        .attr('x', 40)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .text('🌐 JSON')
        .style('font-size', '12px')
        .style('font-weight', 'bold');
    } else {
      // 其他節點類型
      let color = '#f3f4f6';
      let borderColor = '#9ca3af';
      let icon = '📄';
      
      if (node.type === 'string') {
        color = '#dcfce7'; borderColor = '#16a34a'; icon = '📝';
      } else if (node.type === 'number') {
        color = '#fecaca'; borderColor = '#dc2626'; icon = '🔢';
      } else if (node.type === 'boolean') {
        color = '#e0e7ff'; borderColor = '#6366f1'; icon = '✅';
      } else if (node.type === 'array') {
        color = '#dbeafe'; borderColor = '#2563eb'; icon = '📋';
      } else if (node.type === 'object') {
        color = '#fed7aa'; borderColor = '#ea580c'; icon = '📦';
      }
      
      nodeGroup.append('rect')
        .attr('class', 'node-rect')
        .attr('width', 160)
        .attr('height', 50)
        .attr('fill', color)
        .attr('stroke', borderColor)
        .attr('rx', 5);
      
      if (['primitive', 'string', 'number', 'boolean'].includes(node.type)) {
        // 基本類型節點：顯示 key 和 value
        nodeGroup.append('text')
          .attr('x', 80)
          .attr('y', 18)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(`${icon} ${node.name}`)
          .style('font-size', '11px')
          .style('font-weight', 'bold')
          .style('pointer-events', 'none');
        
        let valueText = String(node.data);
        if (valueText.length > 20) {
          valueText = valueText.substring(0, 18) + '...';
        }
        
        nodeGroup.append('text')
          .attr('x', 80)
          .attr('y', 35)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(valueText)
          .style('font-size', '10px')
          .style('fill', '#666')
          .style('pointer-events', 'none');
      } else {
        nodeGroup.append('text')
          .attr('x', 80)
          .attr('y', 25)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .text(`${icon} ${node.name}`)
          .style('font-size', '11px')
          .style('pointer-events', 'none');
      }
    }
  }, [updateTableSelection, updatePathSelection]);
  
  // 主要副作用：響應數據變化
  useEffect(() => {
    console.log('[GraphViewer] 數據變化檢測:', {
      activeEditor,
      graphDataLength: graphData?.nodes?.length || 0,
      linksLength: graphData?.links?.length || 0
    });
    
    // 始終重新渲染圖形，無論是誰更新的數據
    // GraphViewer應該總是反映最新的數據狀態
    renderGraph();
  }, [graphData, renderGraph]);
  
  // 窗口大小變化時重新渲染
  useEffect(() => {
    const handleResize = () => {
      setTimeout(renderGraph, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderGraph]);
  
  return (
    <div className="h-full bg-white flex flex-col">
      <div className="p-2 bg-gray-50 border-b flex justify-between items-center">
        <div className="text-xs text-gray-600">
          節點: {graphData.nodes.length} | 連接: {graphData.links.length}
          {isLayouting && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              布局中...
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              // 強制重新布局
              nodePositionsRef.current.clear();
              zoomStateRef.current = null; // 重置縮放狀態
              renderGraph();
            }}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重新布局
          </button>
          <div className={`
            w-2 h-2 rounded-full
            ${changeType === 'major' ? 'bg-red-400' : 
              changeType === 'minor' ? 'bg-yellow-400' : 'bg-green-400'}
          `} title={`變化類型: ${changeType}`} />
        </div>
      </div>
      
      <div className="graph-container flex-1">
        <svg ref={svgRef} width="100%" height="100%" />
      </div>
    </div>
  );
};

export default GraphViewer;