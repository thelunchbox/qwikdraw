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
    
    const TEXT_ALIGN = {
        LEFT: 'left',
        CENTER: 'center',
        RIGHT: 'right',
    };
    
    const TEXT_BASELINE = {
        TOP: 'top',
        MIDDLE: 'middle',
        BOTTOM: 'bottom',
    };
    
    let fp = null;
    let storedText = null;
    const qd = {};
    const IMAGE_CACHE = {};
    const SPRITE_CACHE = {};
    
    const loadImage = ({name, path}) => new Promise(resolve => {
        const i = new Image();
        i.src = path;
        i.onload = () => {
            IMAGE_CACHE[name] = i;
            resolve(true);
        };
        i.onerror = () => {
            IMAGE_CACHE[name] = '[error]';
            resolve(false);
        };
    });
    
    const loadSpriteSheet = (name, w, h, map) => {
        // name is the name of the image from the IMAGE_CACHE
        // w and h are the dimensions of the sprite
        // map is an object like
        // { state_name: [[x, y, count], ...] }
        // x and y are the coordinates on the sprite sheet for this frame
        // count is the number of total frames for the entire state animation
        // if count is null, it's assumed to be 1
        // if count is 0, it means the animation does not loop (can only be the last frame)
        // if count is anything else, it's the number of frames to spend on this animation frame
        SPRITE_CACHE[name] = { w, h, map };
    };
    
    const __initialize = operation => {
        fp = null;
        storedText = null;
        canvas.save();
        try {
        	operation(qd);
        } catch (ex) {
            console.error('Error while drawing:', ex);
        }
        canvas.restore();
        
        // images is an array of objects like {name, path}
        this.loadImages = images => Promise.all(images.map(img => loadImage(img));
        this.TEXT_ALIGN = TEXT_ALIGN;
        this.TEXT_BASELINE = TEXT_BASELINE;
    };
                                                
    // await qd.loadImages([{ name: 'hi', path: 'hi.png' }]);
    
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
        if (fp) {
            const [x, y] = fp;
            context.lineTo(x, y);
        }
        return qd;
    };
    
    qd.start = () => {
        context.beginPath();
        return qd;
    };
    
    qd.stop = () => {
        context.closePath();
        return qd;
    };
    
    qd.image = (img, x, y, w, h) => {
        const i = IMAGE_CACHE[img];
        context.drawImage(i, x, y, w, h);
        return qd;
    };
    
    qd.sprite = (name, x, y, state, frame) => {
        const i = IMAGE_CACHE[name];
        const s = SPRITE_CACHE[name];
        // get the source coordinates for this frame of the sprite
        const stateConfig = s[state];
        // we could probably compute this when the state is loaded...
        const totalFrameCount = stateConfig.reduce((agg, [x, y, count = 1]) => agg + count, 0);
        // this too... or just let them define it...
        const loop = stateConfig.slice(-1)[2] != 0;
        let result;
        if (frame > totalFrameCount)
            // if we're looping
            if (loop) {
                // wrap around the end
                let f = frame % totalFrameCount;
                // find which frame of animation we're on based on each frame count
                result = stateConfig.find([x, y, count = 1] => {
                    f -= count;
                    // we found the frame when we go below 0
                    return f < 0;
                });
            } else {
                // if not looping, take the last frame
                result = stateConfig.slice(-1);
            }
        }
        const [sx, sy] = result;
        context.drawImage(i, sx, sy, s.w, s.h, x, y, s.w, s.h);
    };
    
    qd.vector = (x, y, r, angle) => {
        context.moveTo(x, y);
        const x1 = r * Math.cos(angle) + x;
        const y1 = r * Math.sin(angle) + y;
        context.lineTo(x1, y1);
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
    
    qd.stroke = (color, { width = 1, dashPattern = [] } = {}) => {
        context.strokeStyle = color;
        context.lineWidth = width;
        context.setLineDash(dashPattern);
        if (storedText) {
            context.strokeText(storedText.text, storedText.x, storedText.y);
            storedText = null;
        } else {
            context.stroke();
        }
        return qd;
    };
    
    qd.fill = (color) => {
        context.fillStyle = color;
        if (storedText) {
            context.fillText(storedText.text, storedText.x, storedText.y);
            storedText = null;
        } else {
            context.fill();
        }
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
    
    qd.text = (text, x, y) => {
        storedText = { text, x, y};
        return qd;
    };
    
    qd.font = (font, size = 16, { align = TEXT_ALIGN.CENTER, baseline = TEXT_BASELINE.MIDDLE }) {
        context.font = `${size}pt ${font}`;
        context.textAlign = align;
        context.textBaseline = baseline;
        return qd;
    };
    
    // usage:
    // qd(c => c.rect(0,0,10,10).fill('red'));
    // qd(c => c.text('hi', 100, 100).fill('blue'));
    
    window.qd = __initialize;
    
});
