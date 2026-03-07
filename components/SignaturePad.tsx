import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, PenTool } from 'lucide-react';

interface SignaturePadProps {
    onSave: (blob: Blob) => void;
    onClear?: () => void;
    readOnly?: boolean;
    existingSignatureUrl?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
    onSave,
    onClear,
    readOnly = false,
    existingSignatureUrl
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize canvas context
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Set dimensions (responsive)
        const resizeCanvas = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (rect) {
                canvas.width = rect.width;
                canvas.height = rect.height;
                // Re-initialize context styles after resize as they reset
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (readOnly) return;
        setIsDrawing(true);
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
    };
    
    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || readOnly) return;
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            setHasSigned(true);
        }
    };

    const endDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        saveSignature();
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasSigned(false);
            if (onClear) onClear();
        }
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        if (canvas && hasSigned) {
            canvas.toBlob((blob) => {
                if (blob) onSave(blob);
            }, 'image/png');
        }
    };

    // If we have an existing signature, show it (even in edit mode)
    if (existingSignatureUrl) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <img src={existingSignatureUrl} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={endDrawing}
                style={{ cursor: 'crosshair', width: '100%', height: '100%' }}
            />

            {hasSigned && !readOnly && (
                <div style={{
                    position: 'absolute',
                    bottom: '1rem',
                    right: '1rem',
                    display: 'flex',
                    gap: '0.5rem',
                    zIndex: 10
                }}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            clear();
                        }}
                        style={{
                            background: 'white',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#64748b',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                    >
                        <RotateCcw size={14} />
                        Clear
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            saveSignature();
                        }}
                        style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.3)'
                        }}
                    >
                        Save Signature
                    </button>
                </div>
            )}

            {!hasSigned && !readOnly && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    textAlign: 'center',
                    color: '#94a3b8',
                    opacity: 0.5
                }}>
                    <PenTool size={32} style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Sign Here</div>
                </div>
            )}
        </div>
    );
};

export default SignaturePad;
