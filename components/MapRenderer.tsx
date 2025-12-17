
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { MapData, Token, Role, Monster } from '../types';
import { Edit } from 'lucide-react';

// Fix for React Three Fiber JSX elements not being recognized in this environment
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      cylinderGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      circleGeometry: any;
      planeGeometry: any;
      ambientLight: any;
      pointLight: any;
      gridHelper: any;
    }
  }
}

interface MapRendererProps {
  mode: '2D' | '3D';
  data: MapData;
  tokens: Token[];
  currentRole: Role;
  activeTokenId: string | null;
  onTokenMove: (id: string, x: number, y: number) => void;
  onFogReveal: (x: number, y: number, radius: number) => void;
  onTokenClick?: (token: Token) => void;
  onTokenEdit?: (token: Token) => void; 
  onTokenDrop?: (monster: Monster, x: number, y: number) => void;
}

const hexToRgba = (hex: string, alpha: number) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
};

// ----------------------------------------------------------------------
// 3D Components
// ----------------------------------------------------------------------

const Token3D: React.FC<{ token: Token; gridSize: number; onClick?: () => void }> = ({ token, gridSize, onClick }) => {
  const texture = useMemo(() => {
     if (token.avatarUrl) {
         return new THREE.TextureLoader().load(token.avatarUrl);
     }
     return null;
  }, [token.avatarUrl]);

  // Adjust position for size (center of the multi-tile area)
  // Size 1: Offset 0.5
  // Size 2: Offset 1.0
  // Size 3: Offset 1.5
  const offset = (token.size * gridSize) / 2;

  return (
    <group 
      position={[token.x * gridSize + offset, 0, token.y * gridSize + offset]}
      onClick={(e: any) => { e.stopPropagation(); onClick?.(); }}
    >
      {/* Base */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[gridSize * 0.4 * token.size, gridSize * 0.4 * token.size, 4, 32]} />
        <meshStandardMaterial color={token.color} />
      </mesh>
      
      {/* Avatar on top */}
      {texture && (
          <mesh position={[0, 4.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[gridSize * 0.38 * token.size, 32]} />
              <meshBasicMaterial map={texture} />
          </mesh>
      )}

      {/* Label */}
      <Billboard position={[0, 8, 0]}>
        <Text fontSize={gridSize * 0.3} color="white" outlineWidth={0.5} outlineColor="black">
          {token.name}
        </Text>
        {/* HP Bar in 3D */}
        <mesh position={[0, -gridSize * 0.4 * token.size, 0]}>
            <planeGeometry args={[gridSize * token.size, gridSize * 0.15]} />
            <meshBasicMaterial color="#333" />
        </mesh>
        <mesh position={[(-gridSize * token.size + (gridSize * token.size * (token.hp / token.maxHp))) / 2, -gridSize * 0.4 * token.size, 0.01]}>
             <planeGeometry args={[gridSize * token.size * (token.hp / token.maxHp), gridSize * 0.1]} />
             <meshBasicMaterial color={token.hp < token.maxHp / 2 ? 'red' : 'green'} />
        </mesh>
      </Billboard>
    </group>
  );
};

const MapPlane: React.FC<{ imageUrl: string; width: number; height: number }> = ({ imageUrl, width, height }) => {
  const texture = useMemo(() => new THREE.TextureLoader().load(imageUrl), [imageUrl]);
  
  // Fix texture orientation
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.rotation = -Math.PI / 2;
  texture.center.set(0.5, 0.5);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, -0.1, height / 2]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

const Scene3D: React.FC<MapRendererProps> = ({ data, tokens, onTokenClick }) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[data.width / 2, 500, data.height / 2]} intensity={1.5} />
      <MapPlane imageUrl={data.imageUrl} width={data.width} height={data.height} />
      {tokens.map(token => (
        <Token3D key={token.id} token={token} gridSize={data.gridSize} onClick={() => onTokenClick?.(token)} />
      ))}
      <OrbitControls target={[data.width / 2, 0, data.height / 2]} />
      <gridHelper 
        args={[Math.max(data.width, data.height) * 2, Math.floor(Math.max(data.width, data.height) / data.gridSize) * 2, 0x000000, 0xcccccc]} 
        position={[data.width / 2, 0.1, data.height / 2]}
      />
    </>
  );
};


// ----------------------------------------------------------------------
// 2D Components
// ----------------------------------------------------------------------

interface DragState {
    id: string;
    token: Token;
    startGridX: number;
    startGridY: number;
    currentPixelX: number;
    currentPixelY: number;
    offsetX: number; 
    offsetY: number;
    minPixelX: number;
    maxPixelX: number;
    minPixelY: number;
    maxPixelY: number;
    hasMoved: boolean; 
}

const Scene2D: React.FC<MapRendererProps> = ({ 
  data, tokens, currentRole, activeTokenId,
  onTokenMove, onFogReveal, onTokenClick, onTokenDrop, onTokenEdit
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Helper to get pixel coords for the CENTER of a token
  // A 1x1 token at 0,0 center is 25,25 (if grid 50)
  // A 2x2 token at 0,0 center is 50,50
  const getTokenCenter = (token: Token) => {
    const sizeOffset = (token.size * data.gridSize) / 2;
    return {
       x: token.x * data.gridSize + sizeOffset,
       y: token.y * data.gridSize + sizeOffset
    };
  };

  // Helper to get Scaled Mouse Coordinates relative to the internal canvas resolution
  // This fixes offsets when the sidebar is open or window is resized
  const getScaledCoords = (e: React.MouseEvent | React.DragEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
      };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = data.imageUrl;
    
    let animationFrameId: number;

    const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Map Background
        if (img.complete) {
            ctx.drawImage(img, 0, 0, data.width, data.height);
        }

        // 2. Draw Movement Overlays
        if (activeTokenId) {
            const activeToken = tokens.find(t => t.id === activeTokenId);
            const isDraggingActive = dragRef.current?.id === activeTokenId;

            if (activeToken && activeToken.remainingMovement > 0 && !isDraggingActive) {
                const rangeCells = Math.floor(activeToken.remainingMovement / 5);
                
                ctx.fillStyle = hexToRgba(activeToken.color, 0.15);
                ctx.strokeStyle = activeToken.color;
                ctx.lineWidth = 1;

                // Range logic for larger tokens: The range expands from the edges
                const startX = Math.max(0, (activeToken.x - rangeCells) * data.gridSize);
                const startY = Math.max(0, (activeToken.y - rangeCells) * data.gridSize);
                
                // Width = (RangeLeft + TokenSize + RangeRight)
                const totalCellsW = rangeCells * 2 + activeToken.size;
                const totalCellsH = rangeCells * 2 + activeToken.size;

                const width = Math.min(data.width - startX, totalCellsW * data.gridSize);
                const height = Math.min(data.height - startY, totalCellsH * data.gridSize);
                
                ctx.fillRect(startX, startY, width, height);
                ctx.strokeRect(startX, startY, width, height);
            }
        }

        if (dragRef.current) {
            const { token, startGridX, startGridY } = dragRef.current;
            // For dragging overlay, if DM, draw a bigger box or none, but keeping consistent is fine.
            // Only players are restricted visually by range.
            const rangeCells = Math.floor(token.remainingMovement / 5);

            if (currentRole === 'PLAYER') {
                ctx.fillStyle = hexToRgba(token.color, 0.25);
                ctx.strokeStyle = token.color;
                ctx.lineWidth = 2;
                
                const startX = Math.max(0, (startGridX - rangeCells) * data.gridSize);
                const startY = Math.max(0, (startGridY - rangeCells) * data.gridSize);
                
                const totalCellsW = rangeCells * 2 + token.size;
                const totalCellsH = rangeCells * 2 + token.size;

                const width = Math.min(data.width - startX, totalCellsW * data.gridSize);
                const height = Math.min(data.height - startY, totalCellsH * data.gridSize);

                ctx.fillRect(startX, startY, width, height);
                ctx.strokeRect(startX, startY, width, height);
            }
        }

        // 3. Draw Grid
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= data.width; x += data.gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, data.height);
        }
        for (let y = 0; y <= data.height; y += data.gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(data.width, y);
        }
        ctx.stroke();

        // 3.5 Drop Zone
        if (isDragOver) {
             ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
             ctx.fillRect(0, 0, data.width, data.height);
             ctx.strokeStyle = '#6366f1';
             ctx.lineWidth = 4;
             ctx.strokeRect(0, 0, data.width, data.height);
             
             ctx.font = '30px sans-serif';
             ctx.fillStyle = '#fff';
             ctx.textAlign = 'center';
             ctx.fillText("DROP TO SPAWN MONSTER", data.width / 2, data.height / 2);
        }

        // 4. Draw Tokens
        tokens.forEach(token => {
            const isBeingDragged = dragRef.current?.id === token.id;
            const sizeOffset = (token.size * data.gridSize) / 2;
            
            let cx, cy;
            
            if (isBeingDragged && dragRef.current) {
                cx = dragRef.current.currentPixelX;
                cy = dragRef.current.currentPixelY;
            } else {
                cx = token.x * data.gridSize + sizeOffset;
                cy = token.y * data.gridSize + sizeOffset;
            }

            // Radius scales with token size, leaving a small gap padding
            const radius = sizeOffset * 0.9; 
            const isActive = token.id === activeTokenId;

            // Highlight Active
            if (isActive) {
                 ctx.beginPath();
                 ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
                 ctx.fillStyle = 'rgba(99, 102, 241, 0.5)';
                 ctx.fill();
            }

            // Token Circle
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = token.color;
            ctx.fill();
            
            // Avatar
            if (token.avatarUrl) {
                const tImg = new Image();
                tImg.src = token.avatarUrl;
                if (tImg.complete) {
                   ctx.save();
                   ctx.beginPath();
                   ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
                   ctx.clip();
                   // Draw image centered
                   ctx.drawImage(tImg, cx - radius + 2, cy - radius + 2, (radius - 2) * 2, (radius - 2) * 2);
                   ctx.restore();
                }
            }

            // Border
            ctx.lineWidth = 3;
            ctx.strokeStyle = token.statusEffects.length > 0 ? '#fbbf24' : (isActive ? '#6366f1' : '#fff'); 
            ctx.stroke();

            // Name
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${10 + token.size * 2}px sans-serif`; // Scale font slightly
            ctx.textAlign = 'center';
            ctx.shadowColor="black";
            ctx.shadowBlur=4;
            ctx.lineWidth = 3;
            ctx.strokeText(token.name, cx, cy - radius - 5);
            ctx.fillText(token.name, cx, cy - radius - 5);
            ctx.shadowBlur=0;

            // HP Bar
            const hpWidth = 40 * token.size;
            const hpHeight = 5 * token.size;
            const hpY = cy + radius + 10;
            const hpPct = Math.max(0, token.hp / token.maxHp);
            
            ctx.fillStyle = '#333';
            ctx.fillRect(cx - hpWidth/2, hpY, hpWidth, hpHeight);
            ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : '#ef4444';
            ctx.fillRect(cx - hpWidth/2, hpY, hpWidth * hpPct, hpHeight);
        });

        animationFrameId = requestAnimationFrame(render);
    }

    if (img.complete) {
        render();
    } else {
        img.onload = render;
    }

    return () => cancelAnimationFrame(animationFrameId);

  }, [data, tokens, currentRole, activeTokenId, isDragging, isDragOver]); 

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getScaledCoords(e);

    // Detection loop (reverse to hit top tokens first)
    // We check against bounding box of the token based on size
    const clickedToken = [...tokens].reverse().find(t => {
        const startX = t.x * data.gridSize;
        const startY = t.y * data.gridSize;
        const sizePx = t.size * data.gridSize;
        
        return x >= startX && x < startX + sizePx &&
               y >= startY && y < startY + sizePx;
    });
    
    if (clickedToken) {
      if (currentRole === 'DM' || clickedToken.type === 'pc') {
         // Setup Drag State
         const sizeOffset = (clickedToken.size * data.gridSize) / 2;
         const centerX = clickedToken.x * data.gridSize + sizeOffset;
         const centerY = clickedToken.y * data.gridSize + sizeOffset;
         
         // DM can move freely (infinite range), Players constrained
         const rangeCells = (currentRole === 'DM') 
            ? 9999 
            : Math.floor(clickedToken.remainingMovement / 5);
         
         const minPixelX = (clickedToken.x - rangeCells) * data.gridSize + sizeOffset;
         const maxPixelX = (clickedToken.x + rangeCells) * data.gridSize + sizeOffset;
         const minPixelY = (clickedToken.y - rangeCells) * data.gridSize + sizeOffset;
         const maxPixelY = (clickedToken.y + rangeCells) * data.gridSize + sizeOffset;

         dragRef.current = {
             id: clickedToken.id,
             token: clickedToken,
             startGridX: clickedToken.x,
             startGridY: clickedToken.y,
             currentPixelX: centerX,
             currentPixelY: centerY,
             offsetX: x - centerX, 
             offsetY: y - centerY,
             minPixelX, maxPixelX, minPixelY, maxPixelY,
             hasMoved: false 
         };
         setIsDragging(true);
      }
    } else if (currentRole === 'DM') {
        const gridX = Math.floor(x / data.gridSize);
        const gridY = Math.floor(y / data.gridSize);
        onFogReveal(gridX, gridY, 2);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragRef.current) return;

      const { x: mouseX, y: mouseY } = getScaledCoords(e);
      const { offsetX, offsetY, minPixelX, maxPixelX, minPixelY, maxPixelY, token } = dragRef.current;
      const sizeOffset = (token.size * data.gridSize) / 2;

      // Desired position
      let rawX = mouseX - offsetX;
      let rawY = mouseY - offsetY;

      // Clamp to range (Players only) or map bounds
      // If DM, the min/maxPixelX are very large, so this just clamps to map technically
      const clampedX = Math.max(minPixelX, Math.min(rawX, maxPixelX));
      const clampedY = Math.max(minPixelY, Math.min(rawY, maxPixelY));

      dragRef.current.currentPixelX = clampedX;
      dragRef.current.currentPixelY = clampedY;

      const startCenterX = dragRef.current.startGridX * data.gridSize + sizeOffset;
      const startCenterY = dragRef.current.startGridY * data.gridSize + sizeOffset;

      if (Math.abs(clampedX - startCenterX) > 5 || Math.abs(clampedY - startCenterY) > 5) {
          dragRef.current.hasMoved = true;
      }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    
    const { hasMoved, startGridX, startGridY, id, token } = dragRef.current;
    const sizeOffset = (token.size * data.gridSize) / 2;

    if (hasMoved) {
        const finalPixelX = dragRef.current.currentPixelX;
        const finalPixelY = dragRef.current.currentPixelY;
        
        // Calculate top-left grid coordinate from the center position
        const gridX = Math.round((finalPixelX - sizeOffset) / data.gridSize);
        const gridY = Math.round((finalPixelY - sizeOffset) / data.gridSize);

        const safeX = Math.max(0, Math.min(gridX, Math.floor(data.width / data.gridSize) - token.size));
        const safeY = Math.max(0, Math.min(gridY, Math.floor(data.height / data.gridSize) - token.size));

        if (safeX !== startGridX || safeY !== startGridY) {
            onTokenMove(id, safeX, safeY);
        }
    } else {
        onTokenClick?.(token);
    }
    
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
      if (dragRef.current) {
          dragRef.current = null;
          setIsDragging(false);
      }
  };

  // HTML5 Drop Handlers
  const onDragOverHandler = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
  };

  const onDragLeaveHandler = () => {
      setIsDragOver(false);
  };

  const onDropHandler = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      const monsterData = e.dataTransfer.getData('application/json');
      if (monsterData && onTokenDrop) {
          try {
             const monster = JSON.parse(monsterData) as Monster;
             const { x, y } = getScaledCoords(e);
             
             // Check if within bounds (scaling handled by getScaledCoords)
             if (x >= 0 && y >= 0 && x <= data.width && y <= data.height) {
                 const gridX = Math.floor(x / data.gridSize);
                 const gridY = Math.floor(y / data.gridSize);
                 onTokenDrop(monster, gridX, gridY);
             }
          } catch(e) {
              console.error("Failed to parse monster drop", e);
          }
      }
  };

  const activeToken = tokens.find(t => t.id === activeTokenId);

  return (
    <div 
        className="relative overflow-auto bg-black shadow-inner border border-slate-700 rounded-lg" 
        style={{width: '100%', height: '100%'}}
        onDragOver={onDragOverHandler}
        onDragLeave={onDragLeaveHandler}
        onDrop={onDropHandler}
    >
      <canvas
        ref={canvasRef}
        width={data.width}
        height={data.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="cursor-pointer mx-auto block"
        style={{ maxWidth: '100%' }}
      />
      
      {activeToken && currentRole === 'DM' && (
           <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-800/90 border border-slate-600 rounded p-2 flex gap-4 items-center shadow-xl animate-fade-in pointer-events-auto">
               <span className="text-sm font-bold text-white">{activeToken.name} Selected</span>
               <button 
                  onClick={() => onTokenEdit?.(activeToken)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1"
               >
                   <Edit size={12} /> Edit Stats
               </button>
           </div>
      )}

      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded pointer-events-none">
        {currentRole === 'DM' ? 'Drag to Move. Click to Select.' : 'Drag your token to move.'}
      </div>
    </div>
  );
};


const MapRenderer: React.FC<MapRendererProps> = (props) => {
  if (props.mode === '3D') {
    return (
      <div className="w-full h-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        <Canvas camera={{ position: [props.data.width/2, 500, props.data.height] }}>
           <Scene3D {...props} />
        </Canvas>
        <div className="absolute top-4 right-4 bg-black/50 text-white text-xs p-2 rounded pointer-events-none z-10">
            Right Click to Pan • Left Click to Rotate • Scroll to Zoom
        </div>
      </div>
    );
  }
  return <Scene2D {...props} />;
};

export default MapRenderer;
