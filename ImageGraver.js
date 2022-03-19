//const cv = require("./opencv");

let editedImage = cv.Mat;
let imageLoaded = false;
let imageLoad = new Image();
let commandsQueue = [{ "type": "cmdIdentity", "id": 0, "error": "" , "_changed": true}];
let glBuffers = {};
let activeCommand = -1;
let commandIdCount = 1;
let stepHints = { "kernelSize": "2" };
let reservedCommandFields = ["type", "error", "id", "imageCache"];

let inputFile = document.getElementById('fileInput');
let outputCanvas = document.getElementById('mainCanvas');
let canvas3d = document.getElementById('canvas3d');
let plotlyDiv = document.getElementById('plotlyDiv');
let imagePanel = document.getElementById('imagePanel');
let commandsQueuePanel = document.getElementById('commandsQueuePanel');
let commandsLoadPanel = document.getElementById('commandsLoadPanel');
let inspectorDiv = document.getElementById('inspectorDiv');
let button3d = document.getElementById('View3dButton');
let button2d = document.getElementById('View2dButton');
let engraveDepth = document.getElementById('depthValue');
let engraveWH = document.getElementById('whValue');
let whValue = document.getElementById('whValue');
let widthSelector = document.getElementById('widthSelector');   // if width selector is not active height is selected
let heightSelector = document.getElementById('heightSelector');
let feedRate = document.getElementById('graveSpeed');
let safeHeight = document.getElementById('safeHeight');
let vertStart = document.getElementById('vertStart');
let horStart = document.getElementById('horStart');
let selectedImageView = "2D";
let commandsExecuted = false;
initGl(canvas3d);
let canvasDragStart = null;
canvas3d.addEventListener("mousedown", (e) => {if(e.buttons == 1 && selectedImageView == "3D") canvasDragStart = {x: e.clientX, y: e.clientY};});
canvas3d.addEventListener("mousemove", (event)=>{
    if(canvasDragStart){
        let xDel = canvasDragStart.x - event.clientX;
        let yDel = canvasDragStart.y - event.clientY;
        let curCommand = commandsQueue.find(c => c.id == activeCommand);
        if(curCommand && glBuffers[curCommand.id]){
            drawScene(glBuffers[curCommand.id].image, glBuffers[curCommand.id].path, {x:xDel, y: yDel, z: 0}, {imWidth: curCommand.imageCache.cols, imHeight: curCommand.imageCache.rows, widthHeight: +engraveWH.value, widthSelected: widthSelector.checked, depth: +engraveDepth.value});
        }
        canvasDragStart = {x: event.clientX, y: event.clientY};
    }
});
canvas3d.addEventListener("mouseup", (e) => {canvasDragStart = null;});
canvas3d.addEventListener("mouseleave", (e) => {canvasDragStart = null;});
canvas3d.addEventListener("wheel", (e) => {
    e.preventDefault();
    let curCommand = commandsQueue.find(c => c.id == activeCommand);
    if(curCommand){
        drawScene(glBuffers[curCommand.id].image, glBuffers[curCommand.id].path, {x:0, y: 0, z: e.deltaY}, {imWidth: curCommand.imageCache.cols, imHeight: curCommand.imageCache.rows, widthHeight: +engraveWH.value, widthSelected: widthSelector.checked, depth: +engraveDepth.value});
    }
});
updateCommandView();
outputCanvas.addEventListener('dragover', (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}, false);
outputCanvas.addEventListener('drop', (e) => {
    e.stopPropagation();
    e.preventDefault();
    //console.log(e.dataTransfer);
    imageLoad.src = URL.createObjectURL(e.dataTransfer.files[0]);
}, false);
inputFile.addEventListener('change', (e) => {
    imageLoad.src = URL.createObjectURL(e.target.files[0]);

}, false);

imageLoad.onload = () => {
    imageLoaded = true;
    commandsQueue[0]._changed = true;
    executeCommands();
};

engraveDepth.addEventListener("change", (e)=>{onEngraveSettingsChange();});
engraveWH.addEventListener("change", (e)=>{onEngraveSettingsChange();});
widthSelector.addEventListener("change", (e)=>{onEngraveSettingsChange();});
heightSelector.addEventListener("change", (e)=>{onEngraveSettingsChange();});

function onEngraveSettingsChange(){
    for(command of commandsQueue){
        if(command.type == 'cmdCreateGcode')
            command._changed = true;
    }
    updateImageCanvas();
    executeCommands();
}

function inputNumberString(id, value, step) {
    let str = '<input type = "number" id= "' + id + '" name = "' + id + '" value = "' + value + '" step = "' + step + '">';
    str += '<label for="' + id + '">' + id + '</label><br>';
    return str;
}

function inputTextString(id) {
    let str = '<input type = "number" id= "' + id + '" name = "' + id + '>';
    str += '<label for="' + id + '">' + id + '</label>';
    return str;
}

function inputBoolString(id) {
    let str = '<input type = "number" id= "' + id + '" name = "' + id + '>';
    str += '<label for="' + id + '">' + id + '</label>';
    return str;
}

function inputCombo(id, elements, selected){
    let str = '<select name = "' + id  +'" id = "' + id + '">';
    for(const e of elements){
        let selectedString = '';
        if(e == selected) selectedString = ' selected="selected" ';
        str += '<option value = "' + e + '"' + selectedString + '>' + e + '</option>';
    }
    str += '</select>';
    str += '<label for="'+ id + '">' + id + '</label><br>';
    return str;
}

function updateInspector() {
    let curCommand = commandsQueue.find(c => c.id == activeCommand);
    inspectorDiv.innerHTML = ''; //reset inner html
    if (!curCommand) return;
    inspectorDiv.innerHTML += '<h4>' + curCommand.type + '</h4>';
    inspectorDiv.innerHTML += '<p>Error log: ' + curCommand.error + '</p>';
    if (curCommand.imageCache)
        inspectorDiv.innerHTML += '<p>Image out info: ' + String(curCommand.imageCache.rows) + '|' + String(curCommand.imageCache.cols) + '</p>'

    let keys = Object.keys(curCommand);
    keys = keys.filter((v, i, a) => { return !reservedCommandFields.includes(v); });    //all keys are editable except type error and id
    for (k of keys) {
        if(k[0] == '_') continue;
        switch (typeof curCommand[k]) {
            case "boolean":
                break;
            case "number":
                let step = "1";
                if (stepHints[k]) step = stepHints[k];
                inspectorDiv.innerHTML += inputNumberString(k, String(curCommand[k]), step);
                break;
            case "string":
                if (k == "tool")
                    inspectorDiv.innerHTML += getToolSelector("Select tool", curCommand[k]);
                break;
            case "object":
                if(curCommand[k].selectable){
                    inspectorDiv.innerHTML += inputCombo(k, curCommand[k].items, curCommand[k].selected);
                }
                break;
            default:
                console.log("Unmappable key type: " + (typeof curCommand[k]) + ". Can not edit");
        }
    }
    if(curCommand.type == "cmdCreateGcode"){    //adding the safe gcode button
        inspectorDiv.innerHTML += '<hr class = "dashed"><p>Downlaod:</p><input type = "text" id = "filename" value = "filename.gcode"><button tpye = "button" id = "downloadGcodeButton">Download GCode</button>';
        let b = document.getElementById("downloadGcodeButton");
        b.addEventListener('click', (e) => {
            let c = commandsQueue.find(c => c.id == activeCommand);
            let curCache = c.imageCache;
            let width = 0, height = 0;
            if(widthSelector.checked){
                let ratio = curCache.rows / curCache.cols;
                width = +engraveWH.value;
                height = width * ratio;
            }
            else{
                let ratio = curCache.cols / curCache.rows;
                height = +engraveWH.value;
                width = height * ratio;
            }
            let gcode = getGcodeString(standardHeader, c._points3d, +feedRate.value, +safeHeight.value, width, height, vertStart.value, horStart.value);
            let filename = document.getElementById('filename').value;

            var el = document.createElement('a');
            el.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(gcode));
            el.setAttribute('download', filename);

            el.style.display = 'none';
            document.body.appendChild(el);
            el.click();
            document.body.removeChild(el);
        });
    }
    for (k of keys) {
        if(k[0] == '_') continue;
        let curElement = document.getElementById(k);
        if(typeof curCommand[k] == "object" && curCommand[k].selectable){
            curElement.addEventListener('change', (e) => {
                let comm = commandsQueue.findIndex(e => e.id == curCommand.id);
                commandsQueue[comm][e.target.id].selected = (curCommand[e.target.id].selected.constructor)(e.target.value);
                commandsQueue[comm]['_changed'] = true;
                executeCommands();
            });
        }
        else if(curElement){
            curElement.addEventListener('change', (e) => {
                let comm = commandsQueue.findIndex(e => e.id == curCommand.id);
                commandsQueue[comm][e.target.id] = (curCommand[e.target.id].constructor)(e.target.value);
                commandsQueue[comm]['_changed'] = true;
                executeCommands();
            });
        }   
    }
}

function deleteCommand(commandId) {
    if(commandsExecuted) return;
    let delIndex = commandsQueue.findIndex(e => e.id == commandId);
    commandsQueue = commandsQueue.filter((v, i, arr) => { return v.id != commandId; });
    activeCommand = commandsQueue.length;
    if(delIndex == commandsQueue.length){   //last element was deleted
        updateImageCanvas();
        updateCommandView();
    }
    else{
        commandsQueue[delIndex]._changed = true;
        executeCommands();
    }
}

function get2dHeight(im) {
    let ret = [];
    for (let i = 0; i < im.rows; ++i) {
        let row = []
        for (let j = 0; j < im.cols; ++j) {
            row.push((im.ucharAt(i, j * im.channels()) / 255 - 1.01) * engraveDepth.value);     //always parses the first channel -> either red or grey channel
        }
        ret.push(row);
    }
    return ret;
}

async function updateImageCanvas() {
    let curCommand = commandsQueue.find(c => c.id == activeCommand);
    if (!curCommand) curCommand = commandsQueue[commandsQueue.length - 1];
    if (curCommand.imageCache && !curCommand.imageCache.empty()) {
        if (selectedImageView == "3D") {
            outputCanvas.style.display = "none";
            plotlyDiv.style.display = "block";
            if(!glBuffers[curCommand.id]){
                //console.time('Gl buffer creation');
                glBuffers[curCommand.id] = {};
                glBuffers[curCommand.id].image = await getGlBuffersImage(curCommand.imageCache);
                //console.timeEnd('Gl buffer creation');
                if(curCommand._points3d){
                    //console.time('Gl path buffer creation');
                    glBuffers[curCommand.id].path = await getGlBuffersPath(curCommand._points3d);
                    //console.timeEnd('Gl path buffer creation');
                }
            }
            //console.time('rendering');
            drawScene(glBuffers[curCommand.id].image, glBuffers[curCommand.id].path, {x:0, y: 0, z: 0}, {imWidth: curCommand.imageCache.cols, imHeight: curCommand.imageCache.rows, widthHeight: +engraveWH.value, widthSelected: widthSelector.checked, depth: +engraveDepth.value});
            //console.timeEnd('rendering');
        }
        else if (selectedImageView == "2D") {
            plotlyDiv.style.display = "none";
            outputCanvas.style.display = "inline";
            if(curCommand.imageSliced)
                cv.imshow(outputCanvas, curCommand.imageSliced);
            else
                cv.imshow(outputCanvas, curCommand.imageCache);
        }
        else {
            console.log('Unknown image view type: ' + selectedImageView);
        }
    }
}

var workerCode = function (){
//self.importScripts('https://raw.githubusercontent.com/haoking/opencvjs/master/opencv.js');
let model;   //caching variable for the neural net model
async function importLocalScripts(baseUrl){
    scripts = [baseUrl + "Paths.js", baseUrl + "opencv.js", baseUrl + "tf.min.js", baseUrl + 'tfCustom.js'];
    for(script of scripts)
        importScripts(script);
    model = await tf.loadLayersModel('https://raw.githubusercontent.com/Lachei/DenseDepthJSModel/main/model.json');
}
function copyArrayBuffer(buffer, byteLength){
    let dst = new ArrayBuffer(byteLength);
    new Uint8Array(dst).set(new Uint8Array(buffer, 0, byteLength));
    return dst;
}
function executeCommands(commands, imageLoaded, imageInfo, imageData) {
    let commandsQueue = [...commands];  //getting a copy
    let success = true;
    let curCache = new cv.Mat(imageInfo.rows, imageInfo.cols, imageInfo.type);
    curCache.data.set(imageData);
    let i = imageInfo.startInd;
    for (;i < commandsQueue.length;) {
        command = commandsQueue[i];
        command.done = false;
        command.processing = false;
        main.updateCommand(i, command);
        ++i;
    }
    i = imageInfo.startInd;
    main.updateCommandView();
    for (;i<commandsQueue.length;) {
        command = commandsQueue[i];
        try {
            //if(i++ < activeCommand) continue;
            command.processing = true;
            main.updateCommand(i, command);
            main.updateCommandView();
            switch (command.type) {
                case "cmdIdentity":
                    if (imageLoaded){
                        command.imageCache = curCache;
                    }
                    //curCache = command.imageCache;
                    break;
                case "cmdResize":
                    command.imageCache = new cv.Mat();
                    let size = new cv.Size(curCache.cols * command.scaleFactor, curCache.rows * command.scaleFactor);
                    let interpolation = cv.INTER_AREA;
                    if(command.scaleFactor > 1) interpolation = cv.INTER_LINEAR;
                    cv.resize(curCache, command.imageCache, size, 0, 0, interpolation);
                    curCache = command.imageCache;
                    break;
                case "cmdConvertToGrey":
                    command.imageCache = new cv.Mat();
                    if(!model || command.conversionType.selected == "2Gray")
                        cv.cvtColor(curCache, command.imageCache, cv.COLOR_RGBA2GRAY);
                    else{
                        const mat3 = new cv.Mat(curCache.rows, curCache.rows, cv.CV_8UC3);
                        cv.cvtColor(curCache, mat3, cv.COLOR_RGBA2RGB);
                        tf.engine().startScope();
                        let tfImage = tf.tensor(mat3.data, [mat3.rows, mat3.cols, 3]);
                        //padding to guarantee downsampling and upsampling are working
                        let alignment = 32;
                        let align = (n)=>{return Math.ceil(n / alignment) * alignment;};
                        tfImage = tfImage.cast("float32").pad([[0, align(curCache.rows) - curCache.rows], [0, align(curCache.cols) - curCache.cols], [0, 0]]).div(255);
                        let newShape = [1, ...tfImage.shape];
                        tfImage = tfImage.reshape(newShape);
                        let prediction = model.predict(tfImage);
                        prediction = prediction.sub(prediction.min().dataSync()[0]);
                        prediction = prediction.div(prediction.max().dataSync()[0] / 255);
                        command.imageCache = new cv.Mat(prediction.shape[1], prediction.shape[2], cv.CV_8U);
                        command.imageCache.data.set(prediction.dataSync());
                        tf.engine().endScope();
                    }
                    curCache = command.imageCache;
                    break;
                case "cmdSmoothImage":
                    command.imageCache = new cv.Mat();
                    let kSize = new cv.Size(command.kernelSize * 2 + 1, command.kernelSize * 2 + 1);
                    cv.GaussianBlur(curCache, command.imageCache, kSize, 0, 0, cv.BORDER_DEFAULT);
                    curCache = command.imageCache;
                    break;
                case "cmdNormalizeImage":
                    command.imageCache = new cv.Mat();
                    cv.normalize(curCache, command.imageCache, 255, 0, cv.NORM_MINMAX);
                    curCache = command.imageCache;
                    break;
                case "cmdInvertImage":
                    command.imageCache = new cv.Mat();
                    cv.bitwise_not(curCache, command.imageCache);
                    curCache = command.imageCache;
                    break;
                case "cmdColorTransformImage":
                    command.imageCache = new cv.Mat();
                    curCache.convertTo(command.imageCache, cv.CV_32F);
                    let conv = new cv.Mat(curCache.rows, curCache.cols, cv.CV_32F, new cv.Scalar(255, 255, 255, 255));
                    cv.divide(command.imageCache, conv, command.imageCache);
                    let t = new cv.Mat(curCache.rows, curCache.cols, cv.CV_32F, new cv.Scalar(command.contrast));
                    cv.multiply(command.imageCache, t, command.imageCache);
                    t.delete();
                    t = new cv.Mat(curCache.rows, curCache.cols, cv.CV_32F, new cv.Scalar(command.brightness));
                    cv.add(command.imageCache, t, command.imageCache);
                    t.delete();
                    cv.pow(command.imageCache, command.gammaCorrection, command.imageCache);
                    cv.multiply(command.imageCache, conv, command.imageCache);
                    conv.delete();
                    curCache = new cv.Mat();
                    command.imageCache.convertTo(curCache, cv.CV_8U);
                    command.imageCache = curCache;
                    break;
                case "cmdHistEqualizationImage":
                    command.imageCache = new cv.Mat();
                    cv.equalizeHist(curCache, command.imageCache);
                    curCache = command.imageCache;
                case "cmdCreateLinearPath":
                    break;
                case "cmdCreateCircularPath":
                    break;
                case "cmdCreateContourPath":
                    break;
                case "cmdCreateGcode":
                    let width = 0, height = 0;
                    if(imageInfo.widthChecked){
                        let ratio = curCache.rows / curCache.cols;
                        width = +imageInfo.engraveWH;
                        height = width * ratio;
                    }
                    else{
                        let ratio = curCache.cols / curCache.rows;
                        height = +imageInfo.engraveWH;
                        width = height * ratio;
                    }
                    console.time('Path creation');
                    switch(command.pathType.selected){
                        case "Linear":
                            command._points3d = createLinearPaths(command, width, height, +imageInfo.engraveDepth, curCache, imageInfo.tools);
                            break;
                        case "Circular":
                            command._points3d = createCircularPath(command, width, height, +imageInfo.engraveDepth, curCache, imageInfo.tools);
                            break;
                        case "Contour":
                            command._points3d = createContourPath(command, width, height, +imageInfo.engraveDepth, curCache, imageInfo.tools);
                            break;
                        default:
                            throw new Error("Unkown path type " + command.pathType.selected);
                    }
                    console.timeEnd('Path creation');
                    command.imageCache = curCache;  //getting a clone of the current image cache. Possibly add 2d path to a copy of the image to have also a 2d preview
                    command.imageSliced = curCache.clone();
                    if(command._points3d){
                        let cols = command.imageSliced.cols, rows = command.imageSliced.rows;
                        for(let i = 0; i < command._points3d.length - 1; ++i){
                            if(command._points3d[i].z > 0 || command._points3d[i + 1] > 0) continue;    //ignoring travel paths
                            let p1 = new cv.Point(command._points3d[i].x, command._points3d[i].y);
                            let p2 = new cv.Point(command._points3d[i + 1].x, command._points3d[i + 1].y);
                            p1.x = p1.x / width * (cols - 1) + .5;
                            p1.y = p1.y / height * (rows - 1) + .5;
                            p2.x = p2.x / width * (cols - 1) + .5;
                            p2.y = p2.y / height * (rows - 1) + .5;
                            cv.line(command.imageSliced, p1, p2, [255,0,255, 255], 1, cv.LINE_AA);
                        }
                    }
                    break;
                default:
                    console.log("Unkown command: " + command);
                    break;
            }
            command.error = "";
        }
        catch (e) {
            console.log(e);
            if (e instanceof TypeError)
                command.error = "Previous command does not provide an image." + e.message;
            else
                command.error = cv.exceptionFromPtr(e).msg;
            console.log(command.error);
            success = false;
        }
        command.done = true;
        command.processing = false;
        command._changed = false;
        let imaInfo = {};
        if(command.imageCache)
            imaInfo = {rows: command.imageCache.rows, cols: command.imageCache.cols, type: command.imageCache.type()};
        let sl = new cv.Mat();
        if(command.imageSliced){
            imaInfo.sliceImage = true;
            sl.delete();
            sl = command.imageSliced
        }
        main.updateCommand(i, command);
        if(command.imageCache)
            main.setImageCache(i, imaInfo, command.imageCache.data, sl.data);
        main.updateCommandView();
        main.updateImageCanvas();
        ++i;
    }
    main.updateImageCanvas();
    main.updateInspector();
    main.workerFinished();
}
}

function updateCommand(i, command){
    //we have to keep image caches
    prevCommand = commandsQueue[i];
    commandsQueue[i] = command;
    commandsQueue[i].imageCache = prevCommand.imageCache;
    if(prevCommand.imageSliced)
        commandsQueue[i].imageSliced = prevCommand.imageSliced;
}

async function setImageCache(index, imageInfo, data, sliceData){
    if(commandsQueue[index].imageCache) commandsQueue[index].imageCache.delete();
    //commandsQueue[index].imageCache = new cv.matFromArray(imageInfo.rows, imageInfo.cols, imageInfo.type, data);
    commandsQueue[index].imageCache = new cv.Mat(imageInfo.rows, imageInfo.cols, imageInfo.type);
    commandsQueue[index].imageCache.data.set(data);
    if(glBuffers[commandsQueue[index].id]){
        glBuffers[commandsQueue[index].id].image = await getGlBuffersImage(commandsQueue[index].imageCache);
        if(commandsQueue[index]._points3d){
            glBuffers[commandsQueue[index].id].path = await getGlBuffersPath(commandsQueue[index]._points3d);
        }
    }
    if(imageInfo.sliceImage){
        if(commandsQueue[index].imageSliced.delete) 
            commandsQueue[index].imageSliced.delete();
        commandsQueue[index].imageSliced = new cv.Mat(imageInfo.rows, imageInfo.cols, imageInfo.type);
        commandsQueue[index].imageSliced.data.set(sliceData);
    }
}

function workerFinished(){
    commandsExecuted = false;
}

var theWorker = BuildBridgedWorker(workerCode, ["importLocalScripts", "executeCommands"], ["updateCommandView", "updateImageCanvas", "updateInspector", "updateCommand", "workerFinished", "setImageCache"], [updateCommandView, updateImageCanvas, updateInspector, updateCommand, workerFinished, setImageCache]);
let baseUri = window.location.href;
baseUri = baseUri.substring(0, baseUri.lastIndexOf("/") + 1);
theWorker.importLocalScripts(baseUri);

function copyArrayBuffer(buffer){
    let dst = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(dst).set(new Uint8Array(buffer));
    return dst;
}

function executeCommands(){
    let startInd = 0;
    for(command of commandsQueue){
        if(command._changed)
            break;
        ++startInd;
    }
    if(commandsExecuted || startInd == commandsQueue.length)
        return;
    commandsExecuted = true;
    let m = new cv.Mat();
    let imageInfo = {rows: 0, cols: 0, type: cv.CV_8U};
    if(commandsQueue.length != 1 && startInd < commandsQueue.length && startInd > 0){
       commandsQueue[Math.max(startInd - 1, 0)].imageCache.copyTo(m);
    }
    else if(imageLoaded){
        m = cv.imread(imageLoad); 
    }
    imageInfo.rows = m.rows;
    imageInfo.cols = m.cols;
    imageInfo.type = m.type();
    imageInfo.widthChecked = widthSelector.checked;
    imageInfo.engraveWH = engraveWH.value;
    imageInfo.engraveDepth = engraveDepth.value;
    imageInfo.tools = tools;
    imageInfo.startInd = startInd;
    theWorker.executeCommands(commandsQueue, imageLoaded, imageInfo, m.data);
    m.delete();
}

function getCommandDiv(command) {
    let additionalClasses = "";
    if (command.error && command.error.length)
        additionalClasses = " cmdError";
    if (command.id == activeCommand)
        additionalClasses += " cmdSelected"
    switch (command.type) {
        case "cmdIdentity":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement cmdIdentity ' + additionalClasses + '">Identity</div>';
        case "cmdResize":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">Resize</div>';
        case "cmdConvertToGrey":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">cvt2Gray</div>';
        case "cmdSmoothImage":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">Smooth</div>';
        case "cmdNormalizeImage":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">Normalize</div>';
        case "cmdInvertImage":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">Invert</div>';
        case "cmdColorTransformImage":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">ColTrans</div>';
        case "cmdHistEqualizationImage":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">HistEqual</div>';
        case "cmdCreateLinearPath":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">LinPath</div>';
        case "cmdCreateCircularPath":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">CircPath</div>';
        case "cmdCreateContourPath":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">ContPath</div>';
        case "cmdCreateGcode":
            return '<div id = "cmdDiv' + String(command.id) + '" class = "cmdElement ' + additionalClasses + '">Gcode</div>';
        default:
            console.log("Unkown command: " + command);
            break;
    }
    return '';
}

function getLoadDiv(command){
    let additionalClasses = "";
    if(command.done)
        additionalClasses += " progressDone";
    else if(command.processing)
        additionalClasses += " progressProcessing";
    else
        additionalClasses += " progressAwait";
    return '<div id = "progressDiv' + String(command.id) + '" class = "progressElement ' + additionalClasses + '"></div>';
}

function updateCommandView() {
    commandsQueuePanel.innerHTML = '';
    commandsLoadPanel.innerHTML = '';
    for (const command of commandsQueue) {
        commandsQueuePanel.innerHTML += getCommandDiv(command);
        commandsLoadPanel.innerHTML += getLoadDiv(command);
    }
    for (const command of commandsQueue) {
        let curElem = document.getElementById('cmdDiv' + String(command.id));
        curElem.onclick = () => { activeCommand = command.id; updateImageCanvas(); updateCommandView(); updateInspector(); };
        curElem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (command.id != 0) //the identity transform cannot be delted
                deleteCommand(command.id);
        });
    }
    //console.log(commandsQueue);
}

function addCommand(type) {
    if(commandsExecuted) return;
    let obj = new Object();
    obj.type = type;
    obj.id = commandIdCount++;
    activeCommand = obj.id;
    obj.error = "";
    obj._changed = true;
    switch(type){
        case "cmdConvertToGrey":
            obj.conversionType = new Selectable(["2Gray", "NN Depth"]);
            break;
        case "cmdSmoothImage":
            obj.kernelSize = 4;
            break;
        case "cmdResize":
            obj.scaleFactor = .5;
            break;
        case "cmdColorTransformImage":
            obj.brightness = 0;
            obj.contrast = 1;
            obj.gammaCorrection = 1;
            break;
        case "cmdCreateLinearPath":
            obj.pathAngle = 0;
            obj.tool = tools[0].name;
            break;
        case "cmdCreateGcode":
            obj.tool = "Ball_3mm";  //default tool is the 3mm ball end
            obj.pathType = new Selectable(["Linear", "Circular", "Contour"]);
            obj.angle = 0;
            obj.ellipsis = 0;
            obj.curveResolution = 100;
            obj.overlap = 80;
            obj.stepdown = +engraveDepth.value;
            break;
    }

    commandsQueue.push(obj);
    updateCommandView();
    updateInspector();
    executeCommands();
}

function setImageView(viewType) {
    selectedImageView = viewType;
    if (viewType == "2D")
        button2d.classList = ['selectedButton'], button3d.classList = ['deselectedButton'];
    else
        button2d.classList = ['deselectedButton'], button3d.classList = ['selectedButton'];
    updateImageCanvas();
}
