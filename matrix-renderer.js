import { ContentPlacer } from "./content-placer.js";
import { PixelMatrix } from "./pixel-matrix.js";
import { SvgPlus, Vector } from "./SvgPlus/4.js";


const defualtOptions = {
    invert: false,
    constrain_min: 0,
    constrain_max: 255,
    normalise_min: null,
    normalise_max: null,
    binary: false,
    threshold: 128,
    normalise: true,
    transform: null,
}

function toGrayScale(imageData, options) {
    if (typeof options !== "object" || options === null) {
        options = {};
    }
    for (const key in defualtOptions) {
        if (options[key] === undefined) {
            options[key] = defualtOptions[key];
        }
    }

    const data = imageData.data;
    const grayscale = new Uint8Array(data.length/4);

    let minGray = 255;
    let maxGray = 0;
    for (let i = 0; i < data.length; i += 4) {
        // 0.299 ∙ Red + 0.587 ∙ Green + 0.114 ∙ Blue
        let gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        let isBlank = false;
        if (data[i + 3] === 0) {
            gray = options.invert ? 255 : 0; // Treat transparent pixels as white
            isBlank = true; // Mark as blank pixel
        } 
        gray = options.invert ? 255 - gray : gray; // Invert if needed

        if (!isBlank) {
            if (gray < minGray) {
                minGray = gray;
            }
    
            if (gray > maxGray) {
                maxGray = gray;
            }
        }
     
        grayscale[Math.floor(i/4)] = gray;   
    }
   
    minGray = options.normalise_min !== null ? options.normalise_min : minGray;
    maxGray = options.normalise_max !== null ? options.normalise_max : maxGray;

    for (let i = 0; i < grayscale.length; i++) {
        let gray = grayscale[i];

        // Normalize grayscale values to the range [0, 255]
        if (options.normalise) {
            gray = Math.round((gray - minGray) / (maxGray - minGray) * 255);
        }

        // Set values below min to 0
        if (gray < options.min) gray = 0; 

        // Set values above max to 255
        if (gray > options.max) gray = 255; 

        // Apply transformation if provided
        if (options.transform instanceof Function) {
            gray = options.transform(gray);
        }

        // Convert to binary if specified
        if (options.binary) {
            gray = gray >= options.threshold ? 255 : 0; // Convert to binary based on threshold
        } 

        grayscale[i] = gray;
    }

    grayscale.width = imageData.width;
    grayscale.height = imageData.height;
    return grayscale;
}
function toRGB(imageData) {
    const data = imageData.data;
    const rgbArray = new Uint8Array(3 * data.length / 4 ); // 3 bytes per pixel (R, G, B)
    for (let i = 0; i < data.length/4; i++) {
        rgbArray[i*3] = data[i*4];       // Red
        rgbArray[i*3+ 1] = data[i*4 + 1]; // Green
        rgbArray[i*3 + 2] = data[i*4 + 2]; // Blue
        // Alpha channel is ignored in RGB array
    }
    rgbArray.width = imageData.width;
    rgbArray.height = imageData.height;
    return rgbArray;
}
// function toRGB(imageData) {

class MatrixRenderer extends SvgPlus {
    pixelHeight = 40;
    pixelWidth = 30;
    grayScaleOptions = {
        invert: false,
        min: 0,
        binary: false,
        threshold: 128,
        max: 255,       
        normalise: true
    }
    isRGB = true
    _hue = 10;
    _saturation = 1;

    constructor(el) {
        super(el);
        window.MR = this;
    }


    set hue(value) {
        this._hue = value;
        this.styles = {"--pixel-hue": value};
    }

    set saturation(value) {
        this._saturation = value;
        this.styles = {"--pixel-saturation": value};
    }

    set width(value) {
        this.size = [value, this.pixelHeight];
    }

    set height(value) {
        this.size = [this.pixelWidth, value];
    }

    set size(value) {
        value = new Vector(value);
        this.content.pixelSize = value;
        this.pixelHeight = value.y;
        this.pixelWidth = value.x;
        this.matrix.pixelSize = value;
    }

    set pixelPadding(value) {
        if (typeof value !== "number") {
            value = parseFloat(value);
        }
        if (!Number.isNaN(value)) {
            if (value < 0) value = 0;
            if (value > 50) value = 50;
        } else {
            value = 5;
        }
        this.matrix.padding = value;
        this.matrix.build();
    }

    set pixelRadius(value) {
        if (typeof value !== "number") {
            value = parseFloat(value);
        }
        if (!Number.isNaN(value)) {
            if (value < 0) value = 0;
            if (value > 50) value = 50;
        } else {
            value = 15;
        } 
        this.matrix.radius = value;
        this.matrix.build();
        console.log("updated radius");
        
    }
    
    onconnect(){ 
        this.content = this.createChild(ContentPlacer);
        this.content.pixelHeight = this.pixelHeight;
        this.content.pixelWidth = this.pixelWidth;
        this.matrix = this.createChild(PixelMatrix, {}, this.pixelHeight, this.pixelWidth, 100, 5, 15);
        this.start();
    }

    saveSVG(title = "matrix") {
        let svg = this.matrix.getSvgForSave(this._hue || 0, this._saturation || 1);
        svg.saveSvg(title);
    }

    async start(){
        while (true) {
            try {
                let canvas = this.content.captureCanvas();
                this.toggleAttribute("matrix-ready", !!canvas);
                if (canvas) {
                    const {innerSize, size} = this.content;
                    this.matrix.styles = {
                        width: innerSize.x + "px",
                        height: innerSize.y + "px",
                        top: (size.y - innerSize.y) / 2 + "px",
                        left: (size.x - innerSize.x) / 2 + "px"
                    }
                    let imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
                    
                    if (this.isRGB) {
                        this.matrix.value = toRGB(imageData);
                    } else {
                        this.matrix.value = toGrayScale(imageData, this.grayScaleOptions);
                    }
                }
            } catch (e) {console.log(e);
            }
            await new Promise(requestAnimationFrame);
        }
    }

    oncontextmenu(e) {
        this.content.openImage();
        e.preventDefault();
    }

    async ondblclick(e) {
        this.toggleAttribute("matrix");
    }
}


SvgPlus.defineHTMLElement(MatrixRenderer);