window.addEventListener('load', e => {
    const width = 1600;
    const height = 900;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    document.body.appendChild(canvas);

    const resizeCanvas = function () {
        const normalRatio = canvas.width / canvas.height;
        const newRatio = document.body.offsetWidth / document.body.offsetHeight;
        let scale = 1;
        if (newRatio < normalRatio) {
            // tall and skinny
            scale = document.body.offsetWidth / canvas.width;
        } else if (newRatio >= normalRatio) {
            // short and fat
            scale = document.body.offsetHeight / canvas.height;
        }
        canvas.style.transform = 'translate(-50%, -50%) scale(' + scale + ', ' + scale + ')';
    }

    window.addEventListener('resize', event => {
        resizeCanvas();
    });

    setTimeout(resizeCanvas, 10);
    const context = canvas.getContext('2d');
    
    let fp = null;
    
    const qd = {};
    
    const __initialize = operation => {
        fp = null;
        canvas.save();
        try {
        	operation(qd);
        } catch (ex) {
            console.error('Error while drawing:', ex);
        }
        canvas.restore();
    };
    
    // we want to allow draws to be nested inside other draws
    qd.nest = __initialize;
    
    qd.path = points => {
        const [first, ...others] = points;
        context.moveTo(first[0], first[1]);
        fp = first;
        others.forEach(p => context.lineTo(p[0], p[1]));
        return qd;
    };
    
    qd.close = () => {
        const [x, y] = fp;
        context.lineTo(x, y);
        return qd;
    };
    
    qd.rect = (x, y, w, h) => {
        const points = [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
        ];
        qd.path(points);
        qd.close();
        return qd;
    };
    
    qd.circle = (x, y, r) => {
        context.arc(x, y, r, 0, Math.PI * 2);
        return qd;
    };
    
    qd.polygon = (x, y, r, sides) => {
        // draw a polygon by finding the center and then getting the number of points around it
        return qd;
    };
    
    qd.stroke = (color, { width = 1 } = {}) => {
        context.strokeStyle = color;
        context.lineWidth = width;
        context.stroke();
        return qd;
    };
    
    qd.fill = (color) => {
        context.fillStyle = color;
        context.fill();
        return qd;
    };
    
    qd.translate = (x, y) => {
        context.translate(x, y);
        return qd;
    };
    
    qd.rotate = angle => {
        context.rotate(angle);
        return qd;
    };
    
    qd.opacity = alpha => {
        context.globalAlpha = alpha;
        return qd;
    };
    
    qd.text = (text, x, y, { stroke: false, fill: true } ) => {
        if (stroke) {
            context.strokeText(text, x, y);
        }
        if (fill) {
            context.fillText(text, x, y);
        }
        return qd;
    };
    
    // usage:
    // qd(c => c.rect(0,0,10,10).fill('red'));
    
    window.qd = __initialize;
    
});
