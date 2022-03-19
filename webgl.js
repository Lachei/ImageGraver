// file containing all webgl things
var gl;             //webgl context
var programInfo;    //shader infos image rendering
var programLineInfo;//shader infos for line rendering
var PMat;
var pitch = 45, yaw = 45;   //pitch is rotatioon around x followed by yaw rotation around y
var dist = 100;
var lineIndices;
var lineIndexLength;

function initGl(canvas){
    gl = canvas.getContext('webgl2') || canvas.getContext('experimental-webgl2');

    if(!gl){
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
        return;
    }

    const vsSource = `#version 300 es
        in float aHight;

        uniform uint uImWidth;
        uniform uint uImHight;
        uniform float uWidth;
        uniform float uHight;
        uniform float uDepth;
        uniform mat4 uMVMat;
        uniform mat4 uPMat;
        uniform vec4 uVPos;

        out vec4 vCol;
        out vec4 vPos;
        out vec4 vViewPos;
        out float shade;

        const vec3 groundCol = vec3(.2,0,0);
        const vec3 topCol = vec3(.8,.8,1);

        void main(void){
            float x = ((float(gl_VertexID % int(uImWidth)) - .5) / float(uImWidth - uint(1)) - .5) * uWidth;
            float y = ((float(gl_VertexID / int(uImWidth)) - .5) / float(uImHight - uint(1)) - .5) * uHight;
            vec4 vertPos = vec4(x, aHight * uDepth - uDepth, y, 1);
            vPos = vertPos;
            vViewPos =  uVPos;
            gl_Position = uPMat * uMVMat * vertPos;
            vec3 col = vec3(aHight);
            if(aHight == 0.)
                col = groundCol;
            if(aHight >= 1.)
                col = topCol;
            vCol = vec4(col, 1);
            shade = 1.;
        }
    `
    const fsSource = `#version 300 es
        precision highp float;
        out vec4 outCol;
        in vec4 vCol;
        in vec4 vPos;
        in vec4 vViewPos;
        in float shade;

        const vec3 lightDir = normalize(vec3(1,1,0));
        const float ks = .2;
        const float kd = 1.;
        const float ambient = .2;

        void main(void){
            if(shade > .5){
                vec3 X = dFdx(vPos).xyz;
                vec3 Y = dFdy(vPos).xyz;
                vec3 n = normalize(cross(X,Y));
                float diff = max(dot(n, lightDir), .0);  //diffuse
                vec3 v = normalize(vViewPos.xyz - vPos.xyz);
                vec3 h = normalize(v + lightDir);
                float spec = pow(max(dot(h, n), .0), 128.);
                outCol = vec4(kd * diff * vCol.xyz + ks * spec + ambient, 1);
            }
            else{
                outCol = vec4(vCol.xyz, 1);
            }
        }
    `

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    programInfo = {
        program: shaderProgram,
        attributeLocations:{
            heights : gl.getAttribLocation(shaderProgram, 'aHight')
        },
        uniformLocations:{
            ImWidth: gl.getUniformLocation(shaderProgram, 'uImWidth'),
            ImHeight: gl.getUniformLocation(shaderProgram, 'uImHight'),
            Width: gl.getUniformLocation(shaderProgram, 'uWidth'),
            Height: gl.getUniformLocation(shaderProgram, 'uHight'),
            Depth: gl.getUniformLocation(shaderProgram, 'uDepth'),
            MVMat: gl.getUniformLocation(shaderProgram, 'uMVMat'),
            PMat: gl.getUniformLocation(shaderProgram, 'uPMat'),
            VPos: gl.getUniformLocation(shaderProgram, 'uVPos')
        }
    }

    const vsLine = `#version 300 es
    in vec4 aPos;

    uniform mat4 uMVMat;
    uniform mat4 uPMat;
    uniform float uWidth;
    uniform float uHight;
    uniform vec4 uVPos;

    out vec4 vCol;
    out vec4 vPos;
    out vec4 vViewPos;
    out float shade;

    const vec4 lineCol = vec4(.8,.7,0,1);
    void main(void){
        vec4 p = aPos;
        p.w = 1.;
        p.x -= uWidth / 2.;
        p.z -= uHight / 2.;
        p.y += .1;
        vPos = p;
        vViewPos =  uVPos;
        gl_Position = uPMat * uMVMat * vPos;
        vCol = lineCol;
        shade = .0;
    }
    `

    const lineProgram = initShaderProgram(gl, vsLine, fsSource);
    programLineInfo = {
        program: lineProgram,
        attributeLocations:{
            pos: gl.getAttribLocation(lineProgram, 'aPos')
        },
        uniformLocations:{
            MVMat: gl.getUniformLocation(lineProgram, 'uMVMat'),
            PMat: gl.getUniformLocation(lineProgram, 'uPMat'),
            Width: gl.getUniformLocation(lineProgram, 'uWidth'),
            Height: gl.getUniformLocation(lineProgram, 'uHight'),
            VPos: gl.getUniformLocation(lineProgram, 'uVPos')
        }
    }
}

function getGlBuffersImage(image){
    if(!gl) return {};
    // position buffer
    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(image.data), gl.STATIC_DRAW);

    // index buffer
    let indices = new Uint32Array((image.cols - 1) * (image.rows - 1) * 6);
    let ip = 0;
    for(let i = 0; i < image.cols - 1; ++i){
        for(let j = 0; j < image.rows - 1; ++j){
            indices[ip++] = j * image.cols + i;
            indices[ip++] = (j + 1) * image.cols + i;
            indices[ip++] = j * image.cols + i + 1;
            indices[ip++] = (j + 1) * image.cols + i;
            indices[ip++] = j * image.cols + i + 1;
            indices[ip++] = (j + 1) * image.cols + i + 1;
        }
    }
    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return {position: positionBuffer, indices: indexBuffer, vertexCount: ip};
}

function getGlBuffersPath(path){
    p = new Float32Array(path.length * 3);
    let c = 0;
    for(let i = 0; i < path.length; ++i){
        p[c++] = path[i].x;
        p[c++] = path[i].z;
        p[c++] = path[i].y;
    }
    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, p, gl.STATIC_DRAW);
    if(!lineIndices || lineIndexLength < path.length){
        lineIndexLength = path.length;
        let ind = new Uint32Array(lineIndexLength);
        for(let i = 0; i < lineIndexLength; ++i)
            ind[i] = i;
        lineIndices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ind, gl.STATIC_DRAW);

    }
    return {position: positionBuffer, vertexCount: path.length};
}

//imageBuffers and lineBuffers contain gl buffers for image and line drawing
//mouse delta is an object with an x and y variable containing the deltas on the mouse axes and z mouse wheel input
function drawScene(imageBuffers, lineBuffers, mouseDelta, engraveInfo){
    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(1, 1, 1, 1.0);  // Clear to black, fully opaque
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

    // Clear the canvas before we start drawing on it.  
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = 45 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = .1;
    const zFar = 1e4;
    PMat = mat4.create();
    mat4.perspective(PMat,fieldOfView,aspect,zNear,zFar);
    
    //update yaw and pitch
    yaw -= mouseDelta.x * .1;
    if(yaw > 360 || yaw < 0) yaw = yaw % 360;
    pitch -= mouseDelta.y * .1;
    if(pitch > 90) pitch = 90;
    if(pitch < 0) pitch = 0;
    dist *= 1 + mouseDelta.z * 1e-3;
    //console.log("pitch", pitch, "yaw", yaw, "dist", dist);
    let MVMat = mat4.create();
    mat4.translate(MVMat, MVMat,[0,  0, -dist]);
    mat4.rotate(MVMat, MVMat, pitch * Math.PI / 180, [1, 0, 0]);
    mat4.rotate(MVMat, MVMat, yaw * Math.PI / 180, [0, 1, 0]);


    //image drawing
    //vertex buffer binding
    {
        const numComponents = 1;
        const type = gl.UNSIGNED_BYTE;
        const normalize = true;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, imageBuffers.position);
        gl.vertexAttribPointer(programInfo.attributeLocations.heights, numComponents, type, normalize, stride, offset);
        gl.enableVertexAttribArray(programInfo.attributeLocations.heights);
    }
    //index buffer binding
    {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, imageBuffers.indices);
    }
    //binding uniform infos and shader program
    let width, height;
    let imageAspect = engraveInfo.imHeight / engraveInfo.imWidth
    if(engraveInfo.widthSelected){
        width = engraveInfo.widthHeight;
        height = width * imageAspect;
    }
    else{
        height = engraveInfo.widthHeight;
        width = height / imageAspect;
    }
    let pos = [-Math.sin(yaw * Math.PI / 180) * Math.cos(pitch * Math.PI / 180) * dist, Math.sin(pitch * Math.PI / 180) * dist, Math.cos(yaw * Math.PI / 180) * Math.cos(pitch * Math.PI / 180) * dist, 1];
    {
        gl.useProgram(programInfo.program);
        gl.uniformMatrix4fv(programInfo.uniformLocations.PMat, false, PMat);
        gl.uniformMatrix4fv(programInfo.uniformLocations.MVMat, false, MVMat);
        gl.uniform1ui(programInfo.uniformLocations.ImWidth, engraveInfo.imWidth);
        gl.uniform1ui(programInfo.uniformLocations.ImHeight, engraveInfo.imHeight);
        gl.uniform1f(programInfo.uniformLocations.Width, width);
        gl.uniform1f(programInfo.uniformLocations.Height, height);
        gl.uniform1f(programInfo.uniformLocations.Depth, engraveInfo.depth);
        gl.uniform4fv(programInfo.uniformLocations.VPos, pos);
    }

    gl.drawElements(gl.TRIANGLES, imageBuffers.vertexCount, gl.UNSIGNED_INT, 0);

    //line drawing
    if(lineBuffers){
        const numComponents = 3;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffers.position);
        gl.vertexAttribPointer(programLineInfo.attributeLocations.pos, numComponents, type, normalize, stride, offset);
        gl.enableVertexAttribArray(programLineInfo.attributeLocations.pos);

        gl.useProgram(programLineInfo.program);
        gl.uniformMatrix4fv(programLineInfo.uniformLocations.PMat, false, PMat);
        gl.uniformMatrix4fv(programLineInfo.uniformLocations.MVMat, false, MVMat);
        gl.uniform1f(programLineInfo.uniformLocations.Width, width);
        gl.uniform1f(programLineInfo.uniformLocations.Height, height);
        gl.uniform4fv(programLineInfo.uniformLocations.VPos, pos);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndices);
        gl.drawElements(gl.LINE_STRIP, lineBuffers.vertexCount, gl.UNSIGNED_INT, 0);
    }
}

// ----------------------------------------------------------------------------------------
// teh follwoing two functions are from https://mdn.github.io/webgl-examples/tutorial/sample5/index.html
// ----------------------------------------------------------------------------------------

// init shader program.
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  
    // Create the shader program
  
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
  
    // If creating the shader program failed, alert
  
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
      return null;
    }
  
    return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
  
    // Send the source to the shader object
  
    gl.shaderSource(shader, source);
  
    // Compile the shader program
  
    gl.compileShader(shader);
  
    // See if it compiled successfully
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
  
    return shader;
}

function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
   
    // Check if the canvas is not the same size.
    const needResize = canvas.width  !== displayWidth ||
                       canvas.height !== displayHeight;
   
    if (needResize) {
      // Make the canvas the same size
      canvas.width  = displayWidth;
      canvas.height = displayHeight;
    }
   
    return needResize;
}
