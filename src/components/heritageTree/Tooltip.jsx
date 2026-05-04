import React, { useState, useRef } from 'react';

const Tooltip = ({ text, children, style }) => {
    const [show, setShow] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, alignX: '-50%' });
    const [placement, setPlacement] = useState('top');
    const wrapperRef = useRef(null);

    const handleMouseEnter = () => {
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            
            let alignX = '-50%';
            let leftPos = rect.left + (rect.width / 2);

            // Use the halfway point of the screen as a foolproof boundary
            if (rect.left > window.innerWidth / 2) {
                alignX = '-100%';
                leftPos = rect.right;
            } else if (rect.right < window.innerWidth / 2) {
                alignX = '0';
                leftPos = rect.left;
            }

            if (rect.top < 100) {
                setCoords({ top: rect.bottom + 8, left: leftPos, alignX });
                setPlacement('bottom');
            } else {
                setCoords({ top: rect.top - 8, left: leftPos, alignX });
                setPlacement('top');
            }
            setShow(true);
        }
    };

    return (
        <div 
            ref={wrapperRef}
            className="tooltip-wrapper"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setShow(false)}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}
        >
            {children}
            {show && text && (
                <div 
                    className="tooltip-popup" 
                    style={{ 
                        position: 'fixed', 
                        top: coords.top, 
                        left: coords.left, 
                        transform: `translate(${coords.alignX}, ${placement === 'top' ? '-100%' : '0'})`, 
                        margin: 0, 
                        bottom: 'auto', 
                        zIndex: 10000 
                    }}
                >
                    {text}
                </div>
            )}
        </div>
    );
};

export default Tooltip;
