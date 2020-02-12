let canvasId
window.qdUseCanvas = id => {
  canvasId = id;
};

let readyCallback;
window.qdReady = cb => {
  readyCallback = cb;
};

window.addEventListener('load', e => {
  let canvas;
  if (canvasId) {
    canvas = document.querySelector(`#${canvasId}`);
  } else {
    const width = 1600;
    const height = 900;
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    document.body.appendChild(canvas);
    
    // styling stuff
    document.body.style.backgroundColor = '#000000';
    document.body.style.margin = '0px';
    document.body.style.overflow = 'hidden';
    document.body.style.padding = '0px';
    document.body.style.textAlign = 'center';
    
    canvas.style.backgroundColor = '#222222';
    canvas.style.left = '50%';
    canvas.style.position = 'absolute';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
  
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

    canvas.addEventListener('mousemove', event => {

    });

    setTimeout(resizeCanvas, 10);
  }

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
  let openPaths = 0;

  const qd = {
    get width() {
      return canvas.width;
    },
    get height() {
      return canvas.height;
    },
  };
  const IMAGE_CACHE = {};
  const SPRITE_CACHE = {};

  const loadImage = ({ name, path }) => new Promise(resolve => {
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
    context.save();
    context.beginPath();
    try {
      const paths = openPaths;
      operation(qd);
      if (paths != openPaths) {
        console.warn('Number of paths left open:', openPaths - paths);
      }
    } catch (ex) {
      console.error('Error while drawing:', ex);
    }
    context.closePath();
    context.restore();

    // images is an array of objects like {name, path}
    this.loadImages = images => Promise.all(images.map(img => loadImage(img)));
    this.loadSpriteSheet = loadSpriteSheet;
  };

  // await qd.loadImages([{ name: 'hi', path: 'hi.png' }]);

  // we want to allow draws to be nested inside other draws
  qd.nest = __initialize;

  // omg do this
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isPointInPath

  qd.path = points => {
    storedText = null;
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
      fp = null;
    }
    return qd;
  };

  qd.start = () => {
    openPaths += 1;
    context.beginPath();
    return qd;
  };

  qd.stop = () => {
    storedText = null;
    openPaths -= 1;
    context.closePath();
    return qd;
  };

  qd.clear = () => {
    storedText = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    return qd;
  }

  qd.image = (img, x, y, w, h) => {
    storedText = null;
    const i = IMAGE_CACHE[img];
    context.drawImage(i, x, y, w, h);
    return qd;
  };

  qd.sprite = (name, x, y, state, frame) => {
    storedText = null;
    const i = IMAGE_CACHE[name];
    const s = SPRITE_CACHE[name];
    // get the source coordinates for this frame of the sprite
    const stateConfig = s[state];
    // we could probably compute this when the state is loaded...
    const totalFrameCount = stateConfig.reduce((agg, [x, y, count = 1]) => agg + count, 0);
    // this too... or just let them define it...
    const loop = stateConfig.slice(-1)[2] != 0;
    let result;
    if (frame > totalFrameCount) {
      // if we're looping
      if (loop) {
        // wrap around the end
        let f = frame % totalFrameCount;
        // find which frame of animation we're on based on each frame count
        result = stateConfig.find(([x, y, count = 1]) => {
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
    storedText = null;
    context.moveTo(x, y);
    const x1 = r * Math.cos(angle) + x;
    const y1 = r * Math.sin(angle) + y;
    context.lineTo(x1, y1);
    return qd;
  };

  qd.rect = (x, y, w, h) => {
    storedText = null;
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
    storedText = null;
    context.arc(x, y, r, 0, Math.PI * 2);
    return qd;
  };

  qd.polygon = (x, y, r, sides) => {
    storedText = null;
    // draw a polygon by finding the center and then getting the number of points around it
    return qd;
  };

  qd.stroke = (color, {
    width = 1,
    dashPattern = [],
    lineCap = 'butt', // butt|round|square
    lineJoin = 'miter' // miter|bevel|round
  } = {}) => {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = lineCap;
    context.lineJoin = lineJoin;
    context.setLineDash(dashPattern);
    if (storedText) {
      context.strokeText(storedText.text, storedText.x, storedText.y);
    } else {
      context.stroke();
    }
    return qd;
  };

  qd.fill = (color) => {
    context.fillStyle = color;
    if (storedText) {
      context.fillText(storedText.text, storedText.x, storedText.y);
    } else {
      context.fill();
    }
    return qd;
  };

  qd.shadow = ({ color = '#000', width = 1, x = 0, y = 0 } = {}) => {
    context.shadowColor = color;
    context.shadowBlur = width;
    context.shadowOffsetX = x;
    context.shadowOffsetY = y;
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
    storedText = { text, x, y };
    return qd;
  };

  qd.font = (font, size = 16, {
    align = TEXT_ALIGN.LEFT,
    baseline = TEXT_BASELINE.TOP
  } = {}) => {
    context.font = `${size}pt ${font}`;
    context.textAlign = align;
    context.textBaseline = baseline;
    return qd;
  };

  qd.pixely = () => {
    context.imageSmoothingEnabled = false;
    return qd;
  };

  // globalCompositeOperations
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation

  qd.clip = () => {
    // The new shape is drawn only where both the new shape and the destination canvas overlap. Everything else is made transparent.
    context.globalCompositeOperation = 'source-in';
    return qd;
  };

  qd.subtract = () => {
    // The existing content is kept where it doesn't overlap the new shape.
    context.globalCompositeOperation = 'destination-out';
    return qd;
  };

  // usage:
  // qd(c => c.rect(0,0,10,10).fill('red'));
  // qd(c => c.text('hi', 100, 100).fill('blue'));

  window.qd = __initialize;
  if (readyCallback) {
    readyCallback();
  }

});