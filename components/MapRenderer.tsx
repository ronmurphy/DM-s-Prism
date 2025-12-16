import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { MapData, Token, Role } from '../types';

// Fix for missing R3F intrinsic types in current environment
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

declare module 'react' {
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

  return (
    <group 
      position={[token.x * gridSize + gridSize / 2, 0, token.y * gridSize + gridSize / 2]}
      onClick={(e: any) => { e.stopPropagation(); onClick?.(); }}
    >
      {/* Base */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[gridSize * 0.4, gridSize * 0.4, 4, 32]} />
        <meshStandardMaterial color={token.color} />
      </mesh>
      
      {/* Avatar on top */}
      {texture && (
          <mesh position={[0, 4.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[gridSize * 0.38, 32]} />
              <meshBasicMaterial map={texture} />
          </mesh>
      )}

      {/* Label */}
      <Billboard position={[0, 8, 0]}>
        <Text fontSize={gridSize * 0.3} color="white" outlineWidth={0.5} outlineColor="black">
          {token.name}
        </Text>
        {/* HP Bar in 3D */}
        <mesh position={[0, -gridSize * 0.4, 0]}>
            <planeGeometry args={[gridSize, gridSize * 0.15]} />
            <meshBasicMaterial color="#333" />
        </mesh>
        <mesh position={[(-gridSize + (gridSize * (token.hp / token.maxHp))) / 2, -gridSize * 0.4, 0.01]}>
             <planeGeometry args={[gridSize * (token.hp / token.maxHp), gridSize * 0.1]} />
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
    offsetX: number; // Mouse offset from token center
    offsetY: number;
    minPixelX: number;
    maxPixelX: number;
    minPixelY: number;
    maxPixelY: number;
}

const Scene2D: React.FC<MapRendererProps> = ({ 
  data, tokens, currentRole, activeTokenId,
  onTokenMove, onFogReveal, onTokenClick 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = data.imageUrl;
    
    let animationFrameId: number;

    const render = () => {
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Map Background
        if (img.complete) {
            ctx.drawImage(img, 0, 0, data.width, data.height);
        }

        // 2. Draw Movement Overlays (Underneath tokens)
        
        // Active Token Overlay (if turn based)
        if (activeTokenId) {
            const activeToken = tokens.find(t => t.id === activeTokenId);
            // Don't draw this static overlay if we are currently dragging the active token
            const isDraggingActive = dragRef.current?.id === activeTokenId;

            if (activeToken && activeToken.remainingMovement > 0 && !isDraggingActive) {
                const rangeCells = Math.floor(activeToken.remainingMovement / 5);
                
                ctx.fillStyle = hexToRgba(activeToken.color, 0.15);
                ctx.strokeStyle = activeToken.color;
                ctx.lineWidth = 1;

                const startX = Math.max(0, (activeToken.x - rangeCells) * data.gridSize);
                const startY = Math.max(0, (activeToken.y - rangeCells) * data.gridSize);
                const width = Math.min(data.width - startX, (rangeCells * 2 + 1) * data.gridSize);
                const height = Math.min(data.height - startY, (rangeCells * 2 + 1) * data.gridSize);
                
                ctx.fillRect(startX, startY, width, height);
                ctx.strokeRect(startX, startY, width, height);
            }
        }

        // Dragging Overlay (The dynamic one requested)
        if (dragRef.current) {
            const { token, startGridX, startGridY } = dragRef.current;
            const rangeCells = Math.floor(token.remainingMovement / 5);

            ctx.fillStyle = hexToRgba(token.color, 0.25);
            ctx.strokeStyle = token.color;
            ctx.lineWidth = 2;
            
            // Calculate overlay bounds based on START position
            const startX = Math.max(0, (startGridX - rangeCells) * data.gridSize);
            const startY = Math.max(0, (startGridY - rangeCells) * data.gridSize);
            const width = Math.min(data.width - startX, (rangeCells * 2 + 1) * data.gridSize);
            const height = Math.min(data.height - startY, (rangeCells * 2 + 1) * data.gridSize);

            ctx.fillRect(startX, startY, width, height);
            ctx.strokeRect(startX, startY, width, height);
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

        // 4. Draw Tokens
        tokens.forEach(token => {
            const isBeingDragged = dragRef.current?.id === token.id;
            
            let cx, cy;
            
            if (isBeingDragged && dragRef.current) {
                cx = dragRef.current.currentPixelX;
                cy = dragRef.current.currentPixelY;
            } else {
                cx = token.x * data.gridSize + data.gridSize / 2;
                cy = token.y * data.gridSize + data.gridSize / 2;
            }

            const radius = (data.gridSize / 2) * 0.8;
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
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor="black";
            ctx.shadowBlur=4;
            ctx.lineWidth = 3;
            ctx.strokeText(token.name, cx, cy - radius - 5);
            ctx.fillText(token.name, cx, cy - radius - 5);
            ctx.shadowBlur=0;

            // HP Bar
            const hpWidth = 40;
            const hpHeight = 5;
            const hpY = cy + radius + 10;
            const hpPct = Math.max(0, token.hp / token.maxHp);
            
            ctx.fillStyle = '#333';
            ctx.fillRect(cx - hpWidth/2, hpY, hpWidth, hpHeight);
            ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : '#ef4444';
            ctx.fillRect(cx - hpWidth/2, hpY, hpWidth * hpPct, hpHeight);
        });

        animationFrameId = requestAnimationFrame(render);
    }

    // Start loop
    if (img.complete) {
        render();
    } else {
        img.onload = render;
    }

    return () => cancelAnimationFrame(animationFrameId);

  }, [data, tokens, currentRole, activeTokenId, isDragging]); 

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridX = Math.floor(x / data.gridSize);
    const gridY = Math.floor(y / data.gridSize);

    // Find clicked token (reverse to get top-most)
    const clickedToken = [...tokens].reverse().find(t => t.x === gridX && t.y === gridY);
    
    if (clickedToken) {
      if (currentRole === 'DM' || clickedToken.type === 'pc') {
         // Setup Drag State
         const centerX = clickedToken.x * data.gridSize + data.gridSize / 2;
         const centerY = clickedToken.y * data.gridSize + data.gridSize / 2;
         
         // Calculate clamping bounds (Chebyshev distance / Square grid)
         const rangeCells = Math.floor(clickedToken.remainingMovement / 5);
         
         const minPixelX = (clickedToken.x - rangeCells) * data.gridSize + data.gridSize / 2;
         const maxPixelX = (clickedToken.x + rangeCells) * data.gridSize + data.gridSize / 2;
         const minPixelY = (clickedToken.y - rangeCells) * data.gridSize + data.gridSize / 2;
         const maxPixelY = (clickedToken.y + rangeCells) * data.gridSize + data.gridSize / 2;

         dragRef.current = {
             id: clickedToken.id,
             token: clickedToken,
             startGridX: clickedToken.x,
             startGridY: clickedToken.y,
             currentPixelX: centerX,
             currentPixelY: centerY,
             offsetX: x - centerX, 
             offsetY: y - centerY,
             minPixelX, maxPixelX, minPixelY, maxPixelY
         };
         setIsDragging(true);

         if (currentRole === 'DM') {
             onTokenClick?.(clickedToken);
         }
      }
    } else if (currentRole === 'DM') {
        onFogReveal(gridX, gridY, 2);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!dragRef.current) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const { offsetX, offsetY, minPixelX, maxPixelX, minPixelY, maxPixelY } = dragRef.current;

      // Desired position
      let rawX = mouseX - offsetX;
      let rawY = mouseY - offsetY;

      // Clamp to range
      const clampedX = Math.max(minPixelX, Math.min(rawX, maxPixelX));
      const clampedY = Math.max(minPixelY, Math.min(rawY, maxPixelY));

      // Update ref
      dragRef.current.currentPixelX = clampedX;
      dragRef.current.currentPixelY = clampedY;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    
    const finalPixelX = dragRef.current.currentPixelX;
    const finalPixelY = dragRef.current.currentPixelY;
    
    // Improved coordinate rounding:
    // (centerPixel - halfGrid) / gridSize -> round to nearest integer
    const gridX = Math.round((finalPixelX - data.gridSize/2) / data.gridSize);
    const gridY = Math.round((finalPixelY - data.gridSize/2) / data.gridSize);

    // Ensure within map bounds
    const safeX = Math.max(0, Math.min(gridX, Math.floor(data.width / data.gridSize) - 1));
    const safeY = Math.max(0, Math.min(gridY, Math.floor(data.height / data.gridSize) - 1));

    if (safeX !== dragRef.current.startGridX || safeY !== dragRef.current.startGridY) {
        onTokenMove(dragRef.current.id, safeX, safeY);
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

  return (
    <div className="relative overflow-auto bg-black shadow-inner border border-slate-700 rounded-lg" style={{width: '100%', height: '100%'}}>
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
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded pointer-events-none">
        {currentRole === 'DM' ? 'Click/Drag tokens. Click empty space to reveal fog.' : 'Drag your token to move. Range limited by Speed.'}
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