/**
 * Shared drawing utilities for Doodle Party
 */

class DoodleCanvas {
    constructor(canvasId, isStatic = false) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isStatic = isStatic;
        this.resize();
        
        // Initial defaults
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Store current content to redrawing after resize
        let tempImage = null;
        if (this.canvas.width > 0 && this.canvas.height > 0) {
            tempImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
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

    drawStroke(data) {
        // Data format: { x1, y1, x2, y2, color, size }
        // Note: x and y are normalized (0 to 1) for cross-screen compatibility
        const { x1, y1, x2, y2, color, size } = data;
        
        const px1 = x1 * this.canvas.width;
        const py1 = y1 * this.canvas.height;
        const px2 = x2 * this.canvas.width;
        const py2 = y2 * this.canvas.height;

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = size * (this.canvas.width / 1000); // Scale brush size to relative width
        this.ctx.moveTo(px1, py1);
        this.ctx.lineTo(px2, py2);
        this.ctx.stroke();
        this.ctx.closePath();
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    getImageData() {
        return this.canvas.toDataURL('image/png');
    }
}
