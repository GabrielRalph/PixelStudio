import { SvgPlus, Vector } from "./SvgPlus/4.js";


function rectPath(x, y, width, height, radius = 0) {
    return `M${x + radius},${y}h${width - 2 * radius}a${radius},${radius} 0 0 1 ${radius},${radius}v${height - 2 * radius}a${radius},${radius} 0 0 1 -${radius},${radius}h-${width - 2 * radius}a${radius},${radius} 0 0 1 -${radius},-${radius}v-${height - 2 * radius}a${radius},${radius} 0 0 1 ${radius},-${radius}Z`;
}


class ContentPlacer extends SvgPlus {
    padding = 0.15;
    pixelWidth = 130;
    pixelHeight = 75;
    pixelBorderRadius = 0.5;

    maxScaleRatio = 3;
    minScaleRatio = 0.5;

    snapThreshold = 2; // Pixels to snap to center
    zoomScale = 150;

    scale = 1;
    offset = new Vector(0, 0);


    constructor(el = "content-placer") {
        super(el);
        if (typeof el === "string") {
            this.onconnect();
        }
    }

    onconnect() {
        this.svg = this.createChild("svg", {viewBox: "0 0 0 0"});
        this.backgroundG = this.svg.createChild("g");
        this.overlays = this.svg.createChild("g", {class: "overlays"}); 
        this.guides = this.svg.createChild("g", {class: "guides"});  
        this.boundingBox = this.svg.createChild("rect", {class: "bounding-box"});

        this.resizer = new ResizeObserver(entries => {
            let entry = entries[0];
            let { width, height } = entry.contentRect;
            window.requestAnimationFrame(() => this._updateSize(width, height))
        })
        this.resizer.observe(this);

        this.fo = this.backgroundG.createChild("foreignObject", {
            x: 0,
            y: 0,
        })

        this.video = this.fo.createChild("video", {
            width: "100%",
            height: "100%",
            autoplay: true,
            playsinline: true,
            muted: true,
            loop: true,
            events: {
                canplaythrough: this._updateVideoSize.bind(this),
            }
        });

        this.videoControls = this.createChild("div", {class: "video-controls"});
        this.playPauseButton = this.videoControls.createChild("button", {class: "pause-play", events: {
            click: (e) => {
                console.log("Play/Pause clicked");
                this.playPauseButton.toggleAttribute("playing", this.video.paused);
                if (this.video.paused) {
                    console.log("Playing video");
                    
                    this.video.play();
                } else {
                    console.log("Pause video");

                    this.video.pause();
                }
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }});


        let scrubbingVideo = false;
        this.videoScrubber = this.videoControls.createChild("div", {class: "video-scrubber"});
        this.videoScrubberHandle = this.videoScrubber.createChild("div", {class: "video-scrubber-handle", events: {
            mousedown: (e) => {
                scrubbingVideo = true;
                this.video.pause()
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }});

        this.events = {
            "mousedown": (e) => {
                e.preventDefault();
            },
            "mousemove": (e) => {
                if (e.buttons == 1) { // Left mouse button
                    if (scrubbingVideo) {
                        let progress = e.movementX / this.videoScrubber.offsetWidth;
                        let currentProgress = this.video.currentTime / this.video.duration;
                        progress += currentProgress;

                        if (progress < 0) {
                            progress = 0;
                        }
                        if (progress > 1) {
                            progress = 1;
                        }

                        this.video.currentTime = progress * this.video.duration;
                    } else {
                        const delta = new Vector(e.movementX, e.movementY);
                        this._pan(delta);
                    }
                }
                e.preventDefault();
            },
            "mouseup": (e) => {
                scrubbingVideo = false;
                e.preventDefault();
            },
            "wheel": (e) => {
                let {x, y, deltaY} = e;
                e.preventDefault();
                x -= this.offsetLeft;
                y -= this.offsetTop;

                this._zoomAtPoint(new Vector(x, y), -deltaY / this.zoomScale);
            }
        }

        this._updateScrubber();
    }

    _dragScrubber(deltapx) {
        this.deltap += deltapx / this.videoScrubber.offsetWidth;
        if (this.waitingOnFrameScrubber) return;
        this.waitingOnFrameScrubber = true;
        window.requestAnimationFrame(() => {
            let progress = this.video.currentTime / this.video.duration;
            progress += this.deltap;
            this.deltap = 0; // Reset delta after applying it
            if (progress < 0) {
                progress = 0;
            }
            if (progress > 1) {
                progress = 1;
            }
            this.video.currentTime = progress * this.video.duration;
            this.waitingOnFrameScrubber = false;
        });
    }

    async _updateScrubber(){
        while(true) {
            this.videoScrubber.styles = {
                "--progress": this.video.currentTime / this.video.duration,
            }
            await new Promise(requestAnimationFrame);
        }
    }

    _showBoundingBox() {
        this.boundingBox.props = {
            opacity: 1,
        }
        clearTimeout(this.boundingBoxTimeout);
        this.boundingBoxTimeout = setTimeout(() => {
            this.boundingBox.props = {
                opacity: 0,
            }
        }, 200);
    }

    _updateSize(width, height) {
        const {svg, padding, aspectRatio, overlays, pixelWidth, pixelBorderRadius, fo, videoSize} = this;
        
        if (width > 0 && height > 0) {
            svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    
            let ip = [new Vector(0, 0), new Vector(width, 0), new Vector(width, height), new Vector(0, height)];
            let op = ip.map(v => v.sub(width/2, height/2).mul(3).add(width/2, height/2)).reverse();
            let pad = padding * Math.min(width, height);
            let iWidth = width - 2 * pad;
            let iHeight = height - 2 * pad;

            let o = new Vector(pad, pad);
            
            if (iWidth / iHeight < aspectRatio) {
                o.y += (iHeight - iWidth / aspectRatio) / 2;
                iHeight = iWidth / aspectRatio;
            } else {
                o.x += (iWidth - iHeight * aspectRatio) / 2;
                iWidth = iHeight * aspectRatio;
            }


            this.size = new Vector(width, height);
            this.innerSize = new Vector(iWidth, iHeight);

            let props = {
                class: "overlay",
                d: `${rectPath(o.x,o.y,iWidth,iHeight, pixelBorderRadius * iWidth / pixelWidth)}M${op.join("L")}Z`,
            }
            overlays.innerHTML = "";
            overlays.createChild("path", props);
            overlays.createChild("path", props);

            this._updateForeignObject();
        } else {
            console.warn("Invalid size for video placer:", width, height);

        }
    }

    _updateVideoSize() {
        const { video } = this;
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width > 0 || height > 0) {
            const videoSize = new Vector(width, height);
            this.videoSize = videoSize;
            this._updateForeignObject();
        } else {
            // console.warn("Video not ready yet.");
        }
    }

    _updateForeignObject() {
        if (!this.waitingOnFrame) {
            this.waitingOnFrame = true;
            window.requestAnimationFrame(() => {
                const {isVideoLoaded, videoSize, size, innerSize} = this;
                if (videoSize instanceof Vector && size instanceof Vector) {
                    
                    if (!isVideoLoaded) {
                        
                        this.isVideoLoaded = true;
                        this.scale = Math.max(innerSize.x, innerSize.y) / Math.max(videoSize.x, videoSize.y);
                        this.offset = size.sub(videoSize.mul(this.scale)).div(2);

                        this.minScale = Math.min(innerSize.x, innerSize.y) / Math.max(videoSize.x, videoSize.y) * this.minScaleRatio;
                        this.maxScale = Math.max(innerSize.x, innerSize.y) / Math.min(videoSize.x, videoSize.y) * this.maxScaleRatio;
                    }
                    const scaled = videoSize.mul(this.scale);
                    const {offset} = this;
                    let props = {
                        x: offset.x,
                        y: offset.y,
                        width: scaled.x,
                        height: scaled.y,
                    }
                    this.fo.props = props
                    this.boundingBox.props = props
                    this._showBoundingBox();
                }
                this.waitingOnFrame = false;
            });
        }
    }

    _pan(delta) {
        const { size, innerSize, videoSize } = this;
        const offset = this.offset.add(delta);
        const adjusted = this._adjustOffset(offset);
        if (adjusted) {
            this.offset = adjusted;
            this._updateForeignObject();
        }
    }

    _zoomAtPoint(point, deltaScale) {
        const {offset} = this;

        const scale = this._adjustScale(this.scale * (1 + deltaScale));
        deltaScale = scale / this.scale - 1;

        let p2o = offset.sub(point);
        let sp2o = p2o.mul(1 + deltaScale);
        const newOffset = point.add(sp2o);
        const adjusted = this._adjustOffset(newOffset, scale);
        if (adjusted) {
            this.offset = adjusted
            this.scale = scale
            this._updateForeignObject();
        }
    }

    _adjustScale(scale) {
        const { snapThreshold,minScale, maxScale, size, innerSize, videoSize } = this;
        if (scale > maxScale) {
            scale = maxScale;
        } else if (scale < minScale) {
            scale = minScale;
        }

        if (size instanceof Vector && innerSize instanceof Vector && videoSize instanceof Vector) {
            const scaleLocked = innerSize.div(videoSize).div(scale).sub(1).div(snapThreshold/this.zoomScale);

            let offsetCentered = this.offset.sub(size.sub(videoSize.mul(this.scale)).div(2))

            
            if (Math.abs(scaleLocked.x) < 1 && Math.abs(offsetCentered.x) < snapThreshold) { 
                scale = innerSize.x / videoSize.x;
            }
            
            if (Math.abs(scaleLocked.y) < 1 && Math.abs(offsetCentered.y) < snapThreshold) {
                scale = innerSize.y / videoSize.y;
            }
        }

        return scale;
        
    }

    _adjustOffset(offset, scale = this.scale) {
        const { snapThreshold, size, innerSize, videoSize } = this;
        if (size instanceof Vector && innerSize instanceof Vector && videoSize instanceof Vector) {

            const maxOffsetX = (size.x + innerSize.x) / 2;
            const maxOffsetY = (size.y + innerSize.y) / 2;
            
            const scaledVideoSize = videoSize.mul(scale);
            const minOffsetX = (size.x - innerSize.x) / 2 - scaledVideoSize.x;
            const minOffsetY = (size.y - innerSize.y) / 2 - scaledVideoSize.y;


            if (offset.x < minOffsetX) {
                offset.x = minOffsetX;
            }
            if (offset.x > maxOffsetX) {
                offset.x = maxOffsetX;
            }
            if (offset.y < minOffsetY) {
                offset.y = minOffsetY;
            }
            if (offset.y > maxOffsetY) {
                offset.y = maxOffsetY;
            }

            const offsetCentered = size.sub(scaledVideoSize).div(2);
            const distNow = offset.sub(offsetCentered);

            // const cScaledVideoSize = this.videoSize.mul(this.scale);
            // const cOffsetCentered = size.sub(cScaledVideoSize).div(2);
            // const lastDist = this.offset.sub(cOffsetCentered);

            
            if (Math.abs(distNow.x) < snapThreshold) {
                offset.x = offsetCentered.x;
            }
            if (Math.abs(distNow.y) < snapThreshold) {
                offset.y = offsetCentered.y;
            }


            return offset
        }
        return null;
    }

    _clearStreams() {
        if (this.video.srcObject instanceof MediaStream) {
            let tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
    }

    openVideo(){
        this.toggleAttribute("video", true);
        let input = new SvgPlus("input");
        input.props = {
            type: "file",
            accept: "video/*",
            events: {
                change: (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const url = URL.createObjectURL(file);
                        this.src = url;
                    }
                }
            }
        }

        input.click();
    }

    async openImage() {
        this.toggleAttribute("video", false);
        let input = new SvgPlus("input");
        let url = await new Promise((resolve) => {
            input.props = {
                type: "file",
                accept: "image/*",
                events: {
                    change: (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const url = URL.createObjectURL(file);
                            resolve(url);
                        }
                    }
                }
            }
            input.click();
        });
        // Turn the image into a video
        let img = new Image();
        img.src = url;
        let loaded = await new Promise((resolve) => {
            img.onload = () => {
                resolve(true);
            };
            img.onerror = (e) => {
                resolve(false);
            };
        });
        if (loaded) {
            let canvas = new SvgPlus("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            let ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            let canvasStream = canvas.captureStream(1); // 30 FPS
            this.isVideoLoaded = false;
            this.video.srcObject = canvasStream;
        } else {
            console.error("Failed to load image.");
        }
    }

    async startWebcam() {
        this.toggleAttribute("video", false);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            let stream = await navigator.mediaDevices.getUserMedia({ video: true })
            this.isVideoLoaded = false;
            this.video.srcObject = stream;
        } else {
            console.error("getUserMedia not supported in this browser.");
        }
    }

    async startShareScreen() {
        this.toggleAttribute("video", false);
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            let stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            this.isVideoLoaded = false;
            this.video.srcObject = stream;
        } else {
            console.error("getDisplayMedia not supported in this browser.");
        }
    }

    captureCanvas(){
        if (!this.isVideoLoaded) {
            console.warn("Video not loaded yet.");
            return null;
        }
        let canvas = new SvgPlus("canvas");
        const { videoSize, innerSize, size, offset, scale, pixelHeight, pixelWidth } = this;
        canvas.width = innerSize.x;
        canvas.height = innerSize.y;
        let relOffset = offset.sub(size.sub(innerSize).div(2));
        
        let scaledVideoSize = videoSize.mul(scale);
        let ctx = canvas.getContext("2d");
        ctx.drawImage(this.video, 0, 0, videoSize.x, videoSize.y, relOffset.x, relOffset.y, scaledVideoSize.x, scaledVideoSize.y);

        let canvas2 = new SvgPlus("canvas");
        canvas2.width = pixelWidth;
        canvas2.height = pixelHeight;

        let ctx2 = canvas2.getContext("2d");
        ctx2.drawImage(canvas, 0, 0, innerSize.x, innerSize.y, 0, 0, pixelWidth, pixelHeight);
        return canvas2;
    }

    set pixelSize(size) {
        this.pixelHeight = size.y;
        this.pixelWidth = size.x;
        this._updateSize(this.size.x, this.size.y);
    }

    set src(string) {
        this.isVideoLoaded = false;
        this.video.srcObject = null;
        this.video.props = {
            src: string,
            crossorigin: "anonymous",
        }
        this.playPauseButton.toggleAttribute("playing", this.video.paused);
    }

    get aspectRatio() {
        return this.pixelWidth / this.pixelHeight
    }
}

// SvgPlus.defineHTMLElement(ContentPlacer);
export { ContentPlacer };