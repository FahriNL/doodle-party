/**
 * Shared drawing utilities for Doodle Party
 * Handles aspect-ratio-aware rendering between portrait (phone) and landscape (PC)
 */

class DoodleCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Initial defaults
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Store current content before resize
        let tempImage = null;
        if (this.canvas.width > 0 && this.canvas.height > 0) {
            try {
                tempImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            } catch (e) { /* ignore */ }
        }

        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;

        if (tempImage) {
            this.ctx.putImageData(tempImage, 0, 0);
        }

        // Restore context settings
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    /**
     * Calculate the fitting rectangle to render strokes from a source aspect ratio
     * into this canvas without distortion.
     * 
     * @param {number} sourceAspectRatio - height/width of the source canvas
     * @returns {{ offsetX, offsetY, drawWidth, drawHeight }}
     */
    getFitRect(sourceAspectRatio) {
        if (!sourceAspectRatio || sourceAspectRatio <= 0) {
            // No aspect ratio info — fallback to full canvas (old behavior)
            return { offsetX: 0, offsetY: 0, drawWidth: this.canvas.width, drawHeight: this.canvas.height };
        }

        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;
        const canvasAR = canvasH / canvasW;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (sourceAspectRatio > canvasAR) {
            // Source is taller than canvas — fit by height
            drawHeight = canvasH;
            drawWidth = canvasH / sourceAspectRatio;
            offsetX = (canvasW - drawWidth) / 2;
            offsetY = 0;
        } else {
            // Source is wider or same — fit by width
            drawWidth = canvasW;
            drawHeight = canvasW * sourceAspectRatio;
            offsetX = 0;
            offsetY = (canvasH - drawHeight) / 2;
        }

        return { offsetX, offsetY, drawWidth, drawHeight };
    }

    drawStroke(data) {
        // Data format: { x1, y1, x2, y2, color, size, opacity?, aspectRatio? }
        // x, y are normalized (0 to 1) for cross-screen compatibility
        const { x1, y1, x2, y2, color, size, opacity, aspectRatio } = data;

        const fit = this.getFitRect(aspectRatio);
        
        const px1 = fit.offsetX + x1 * fit.drawWidth;
        const py1 = fit.offsetY + y1 * fit.drawHeight;
        const px2 = fit.offsetX + x2 * fit.drawWidth;
        const py2 = fit.offsetY + y2 * fit.drawHeight;

        // Save context state
        this.ctx.save();

        this.ctx.globalAlpha = (opacity !== undefined && opacity !== null) ? opacity : 1.0;
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = size * (fit.drawWidth / 1000); // Scale brush relative to draw area
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.moveTo(px1, py1);
        this.ctx.lineTo(px2, py2);
        this.ctx.stroke();
        this.ctx.closePath();

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Draw a faint guide area showing where the drawing region is
     * (used on host canvas to show the portrait drawing area)
     */
    drawFitGuide(sourceAspectRatio) {
        if (!sourceAspectRatio) return;
        const fit = this.getFitRect(sourceAspectRatio);
        
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 8]);
        this.ctx.strokeRect(fit.offsetX, fit.offsetY, fit.drawWidth, fit.drawHeight);
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    getImageData() {
        return this.canvas.toDataURL('image/png');
    }
}
