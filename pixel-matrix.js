import {SvgPlus} from "./SvgPlus/4.js"

const BASE16 = "0123456789ABCDEF"

function hsl2rgb(h,s,l) 
{
   let a=s*Math.min(l,1-l);
   let f= (n,k=(n+h/30)%12) => l - a*Math.max(Math.min(k-3,9-k,1),-1);
   return [f(0),f(8),f(4)].map(x => Math.round(255*x));
}   


class Pixel extends SvgPlus {
    constructor(r, c, size, padding, radius, matrix){
        super('g');
        this.class = "pixel";
        this.row = r;
        this.col = c;

        // Click Box
        this.createChild("rect", {
            x: c * size, 
            y: r * size, 
            width: size, 
            height: size, 
            fill: "none"
        });

        // Led Icon
        this.led = this.createChild("rect", {
            x: c * size + padding, 
            y: r * size + padding, 
            rx: radius,
            width: (size - padding * 2),
            height: (size - padding * 2),
            class: "led"
         });

         this.on = false;

         this.events = {
            mousemove: (e) => {
                e.preventDefault();
            },
            mouseenter: (e) => {
                if (e.buttons == 1) matrix.pixelAction(this, "enter")
            },
            mousedown: (e) => {
                matrix.pixelAction(this, "enter")
                e.preventDefault();
            },
            click: (e) => {
                matrix.pixelAction(this, "click")
                e.preventDefault();
            },
            contextmenu: () => {
                matrix.pixelAction(this, "rightclick")
            }
         }
    }

    set isRGB(value) {
        this._isRGB = value;
        this.toggleAttribute("rgb", value);
    }


    set value(value) {
        this.isRGB = false;
        let valueStr = value;
        if (typeof value === "boolean") {
            valueStr = value ? 255 : 0;
        } else if (typeof value === "number") {
            value = value < 0 ? 0 : (value > 255 ? 255 : value);
            valueStr = value;
        } else if (Array.isArray(value) && value.length === 3) {
            this.isRGB = true;
            // valueStr = "#" + value.map(v => v.toString(16)).join(""); Not this has interesting color because of no leading zeros
            valueStr = `rgb(${value[0]}, ${value[1]}, ${value[2]})`;
        } else { 
            throw new Error("Invalid value for Pixel: " + value);
        }
        this._value = value;
        this._valueStr = valueStr;
        this.style.setProperty("--value", valueStr);
    }
    get value(){
        return Array.isArray(this._value) ? [...this._value] : this._value;
    }


    getForSave(hue, staturation) {
        let fillColor = this._valueStr;
        if (!this.isRGB) {
            let vn = this._valueStr / 255;
            let lr = 0.5 + 0.5 * (1 - staturation);
            let l = vn * lr;
            fillColor = `rgb(${hsl2rgb(hue, staturation, l).join(",")})`;
        }
        let led = this.led.cloneNode();
        led.removeAttribute("style");
        led.removeAttribute("class");
        led.setAttribute("fill", fillColor);
        return led;
    }

   
}
          
export class PixelMatrix extends SvgPlus {
    penMode = "pen";
    color = true;
    isRGB = false;
    editable = true;
    constructor(rows, cols, size, padding, radius = size / 3) {
        super("svg");
        this.class = "pixel-matrix";
        this.size = size;
        this.padding = padding;
        this.radius = radius;
        this.rows = rows;
        this.cols = cols;
        this.build();
    }


    set pixelSize(value) {
        this.cols = value.x;
        this.rows = value.y;
        this.build();
    }

    build() {
        this.innerHTML = "";
        const {rows, cols, size, padding, radius} = this;
        this.matrix = new Array(rows).fill(0).map((__, r) => 
            new Array(cols).fill(0).map((_, c) => 
                this.createChild(Pixel, {}, r, c, size, padding, radius, this)
            )
        )
        this.props = {
            viewBox: `0 0 ${cols * size} ${rows * size}`
        }
    }

    pixel2index(pixel) {
        return pixel.row * this.cols + pixel.col;
    }

    setAll(color) {
        this.matrix.forEach(r => r.forEach(c => c.value = color))
    }

    shiftHorizontal(x) {
        for (let i = x > 0 ? 0 : this.cols-1; x > 0 ? i < this.cols : i >= 0; i+= x > 0 ? 1 : -1) {
            for (let j = 0; j < this.rows; j++) {
                this.matrix[j][i].value = i+x >= 0 && i+x < this.cols ? this.matrix[j][i+x].value : 0;
            }
        }
        this.dispatchEvent(new Event("change"))
    }

    shiftVertical(x) {
        const {rows, cols} = this;
        for (let i = x > 0 ? 0 : rows-1; x > 0 ? i < rows : i >= 0; i+= x > 0 ? 1 : -1) {
            for (let j = 0; j < cols; j++) {
                this.matrix[i][j].value = i+x >= 0 && i+x < rows ? this.matrix[i+x][j].value : 0;
            }
        }
        this.dispatchEvent(new Event("change"))
    }

    pixelAction(pixel, actionType) {
        // if (this.editable) {
        //     switch (this.penMode) {
        //         case "pen":
        //             pixel.on = actionType !== "rightclick" ? this.color : 0;
        //             break; 

        //         case "fill":
        //             this.fill(pixel, this.color);
        //             break;
        //     }
        //     this.dispatchEvent(new Event("change"))
        // }
    }

    get copy(){
        let m = new PixelMatrix(this.rows, this.cols, this.size, this.padding, this.radius);
        m.value = this.value;
        return m;
    }

    set value(value) {
        if (value instanceof Uint8Array) {
            
            let nbites = this.cols * this.rows;
            let isRGB = value.length === 3 * nbites;
            this.isRGB = isRGB;
            
            for (let i = 0; i < nbites; i++) {
                if (isRGB) {
                    let r = Math.floor(i / this.cols);
                    let c = i % this.cols;
                    this.matrix[r][c].value = [value[3*i], value[3*i+1], value[3*i+2]];
                } else {
                    let r = Math.floor(i / this.cols);
                    let c = i % this.cols;
                    this.matrix[r][c].value = value[i];
                }
            }
        } else {
            this.isRGB = Array.isArray(value[0][0]);
            value.forEach((row, r) => row.forEach((pixel, c) => this.matrix[r][c].value = pixel))
        }
    }

    get value() {
        return this.matrix.map(row => row.map(pixel => pixel.value))
    }

    /** @return {Uint8Array} */
    get uint8() {
        let value = this.value;
        let n = (this.isRGB ? 3 : 1) * this.rows * this.cols;
        let data = new Uint8Array(n);
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.isRGB) {
                    for (let i = 0; i < 3; i++) {
                        data[3 * (r * this.cols + c) + i] = Array.isArray(value[r][c]) ? value[r][c][i] : value[r][c];
                    }
                } else {
                    data[r * this.cols + c] = value[r][c];
                }
            }
        }
        return data;
    }

    getSvgForSave(hue, staturation) {
        let compStyle = window.getComputedStyle(this);
        console.log(compStyle["--pixel-hue"]);
        
        let svg = new SvgPlus("svg");
        svg.props = {
            xmlns: "http://www.w3.org/2000/svg",
            viewBox: this.getAttribute("viewBox"),
        }
        this.matrix.flat().map(p => svg.appendChild(p.getForSave(hue, staturation)));
        return svg;
    }
}
