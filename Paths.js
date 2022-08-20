const SAFE_HEIGHT = 3;

class Point3D{
    constructor(x, y, z){
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

function length(vec){
    if(!vec instanceof cv.Point) return Infinity;
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
}

function distance2(a, b){
    x = a.x - b.x;
    y = a.y - b.y;
    return x * x + y * y;
}

function lerp(a, b, t){
    return new cv.Point((1- t) * a.x + t * b.x, (1 - t) * a.y + t * b.y);
}

function get3dDepths(workWidth, workHeight, workDepth, image, slicedLines, tool){
    //stepping along sliced lines according to the pixel density (approximateley 1 pixel per step) and adding the hight
    let pixelXDist = workWidth / image.cols;
    let pixelYDist = workHeight / image.rows;
    let pixelDist = (pixelXDist + pixelYDist) / 2; //using the average distance
    let toolWidth = tool.diameter;
    let finalPoints = new Array();
    for(let i = 0; i < slicedLines.length - 1; ++i){
        dir = new cv.Point(slicedLines[i + 1].x - slicedLines[i].x, slicedLines[i + 1].y - slicedLines[i].y)
        let l = length(dir);
        dir.x *= pixelDist / l;
        dir.y *= pixelDist / l;
        //let cur = structuredClone(slicedLines[i]);
        let segments = Math.ceil(l / pixelDist);
        //console.log("3dDepthIteration: " + i + " / "  + slicedLines.length + " -> " + segments);
        for(let j = 0; j < segments; ++j){
            let cur = lerp(slicedLines[i], slicedLines[i + 1], j / segments);
            let xXpansion = Math.ceil(toolWidth / pixelXDist / 2);
            let yXpansion = Math.ceil(toolWidth / pixelYDist / 2);
            let subPixelX = (cur.x / workWidth * (image.cols - 1) + .5);
            let subPixelY =  (cur.y / workHeight * (image.rows -1) + .5);
            let curPixelX = subPixelX | 0;    //bitwise or for int conversion
            let curPixelY = subPixelY | 0;
            let weightRight = subPixelX - curPixelX;
            let weightTop = subPixelY - curPixelY;
            let centerDepth = 0;
            let finalDepth = -workDepth;    // start at the very bottom
            for(let x = -xXpansion; x <= xXpansion; ++x){
                for(let y = -yXpansion; y <= yXpansion; ++y){
                    let curX = (curPixelX + x - .5) / (image.cols - 1) * workWidth;
                    let curY = (curPixelY + y - .5) / (image.rows - 1) * workHeight;
                    let dist = length(new cv.Point(cur.x - curX, cur.y - curY));
                    if((x != 0 && y != 0 && x != 1 && y != 1) && 
                        (dist > toolWidth / 2 || curPixelX + x < 0 || curPixelX + x >= image.cols || curPixelY + y < 0 || curPixelY + y >= image.rows)) continue;   // does not contribute
                    depth = image.ucharAt(curPixelY + y, curPixelX + x * image.channels()) / 255 - 1;
                    depth *= workDepth; //total depth
                    if(x == 0 && y == 0) centerDepth += (1 - weightRight) * (1 - weightTop) * depth;
                    if(x == 1 && y == 0) centerDepth += (weightRight) * (1 - weightTop) * depth;
                    if(x == 0 && y == 1) centerDepth += (1 - weightRight) * (weightTop) * depth;
                    if(x == 1 && y == 1) centerDepth += (weightRight) * (weightTop) * depth;
                    if(dist > toolWidth / 2 || curPixelX + x < 0 || curPixelX + x >= image.cols || curPixelY + y < 0 || curPixelY + y >= image.rows) continue;
                    switch(tool.type){
                        case "Ball":
                            depth -= dist;
                            break;
                        case "Endmill":
                            //nothing, dpeth stays the same
                            break;
                        case "V-Bit":
                            let toolAngel = tool.angle / 2; // halfing to be able to use trigonomitry
                            depth -= dist / Math.tan(tool.angle / 180 * Math.PI);
                            break;
                    }
                    finalDepth = Math.max(finalDepth, depth);
                }
            }
            finalDepth = Math.max(finalDepth, centerDepth);
            finalPoints.push(new Point3D(cur.x, cur.y, finalDepth));
            //cur.x += dir.x;
            //cur.y += dir.y;
        }
    }
    return finalPoints;
}

// applies post processing to the path. Currently only step down is done
function postProcessPath(path, postProcessParameters){
    let depth = postProcessParameters.depth;
    if(depth > 0) depth *= -1;
    let stepDown = postProcessParameters.stepdown;
    if(stepDown < 0) stepDown *= -1;
    let finalPoints = [];
    let anythingInLayer = true;
    let iterations = 0;
    for(let curDepth = 0; anythingInLayer && curDepth > depth; curDepth -= stepDown){
        const botDepth = curDepth - stepDown;
        anythingInLayer = false;
        finalPoints.push(new Point3D(path[0].x, path[0].y, SAFE_HEIGHT));
        for(let i = 0; i < path.length; ++i){
            // quick access
            let lastPoint = (i == 0) ? finalPoints[0]: path[i - 1];
            let curPoint = path[i];

            // handle top step in and out (drive down to intersection point with top plane)
            if(curPoint.z < curDepth && lastPoint.z >= curDepth ||  // step in
                curPoint.z >= curDepth && lastPoint.z < curDepth){
                let z = curDepth;
                let t = (z - curPoint.z) / (lastPoint.z - curPoint.z);
                let curX = t * lastPoint.x + (1 - t) * curPoint.x;
                let curY = t * lastPoint.y + (1 - t) * curPoint.y;
                
                if(curPoint.z < curDepth && lastPoint.z >= curDepth)
                    finalPoints.push(new Point3D(curX, curY, SAFE_HEIGHT));
                finalPoints.push(new Point3D(curX, curY, curDepth));
                if(curPoint.z >= curDepth && lastPoint.z < curDepth)
                    finalPoints.push(new Point3D(curX, curY, SAFE_HEIGHT));

                anythingInLayer = true;
            }
            // handle bot step out and step in (add point at bot depth plane intersection)
            if(curPoint.z < botDepth && lastPoint.z >= botDepth || // step out
                curPoint.z >= botDepth && lastPoint.z < botDepth){ // step in
                let z = botDepth;
                let t = (z - curPoint.z) / (lastPoint.z - curPoint.z);
                let curX = t * lastPoint.x + (1 - t) * curPoint.x;
                let curY = t * lastPoint.y + (1 - t) * curPoint.y;
                finalPoints.push(new Point3D(curX, curY, botDepth));

                anythingInLayer = true;
            }

            // add the current point if lower than the curDepth, clamp to bot depth
            if(curPoint.z <= curDepth){
                finalPoints.push(new Point3D(curPoint.x, curPoint.y, Math.max(curPoint.z, botDepth)));

                anythingInLayer = true;
            }
        }
        endPoint = path[path.length - 1];
        finalPoints.push(new Point3D(endPoint.x, endPoint.y, SAFE_HEIGHT));
        ++iterations;
    }
    console.log("Job uses " + iterations + " step downs");
    return finalPoints;
}

//returns an array of 3d points which are the 3d points which describe the 3d movement of the cnc
function createLinearPaths(createLinearPathCommand, workWidth, workHeight, workDepth, image, tools){   
    // the paths are always created in a box and start from front to back(y = 0 -> y = workHeight)
    let startPoint = new cv.Point(0, 0);
    let angle = Math.abs(createLinearPathCommand.angle);
    if(angle % 180 < 90)
        startPoint.y = workHeight;
    angle *= Math.PI / 180; //convet to radians
    let tool= tools.find(e => e.name == createLinearPathCommand.tool);
    if(!tool) throw new Error("Tool not found");
    let toolWidth = tool.diameter;
    let lineWidth = toolWidth * createLinearPathCommand.overlap / 100;  // Overlap is given in percent

    let dir = new cv.Point(Math.sin(angle), Math.cos(angle));
    let nor = new cv.Point(dir.y, -dir.x);
    if(nor.x < 0 || (startPoint.y == 0 && nor.y < 0)){
        nor.x *= -1;
        nor.y *= -1;
    }
    
    startPoint.x += nor.x * (lineWidth / 2);
    startPoint.y += nor.y * (lineWidth / 2);

    let intersectBox = (p, d, w, h) => {
        let checkIntersection = (int) => {return !isNaN(int.x) && isFinite(int.x) &&
            !isNaN(int.y) && isFinite(int.y) &&
            int.x >= -.1 && int.x <= workWidth + .1 &&
            int.y >= -.1 && int.y <= workHeight + 1;};
        let inters = new Array();
        let lambda = -p.x / d.x;
        let int = new cv.Point(p.x + lambda * d.x, p.y + lambda * d.y);
        if(checkIntersection(int))
            inters.push(int);
        lambda = (h - p.y) / d.y;
        int = new cv.Point(p.x + lambda * d.x, p.y + lambda * d.y);
        if(checkIntersection(int))
            inters.push(int);
        lambda = (w - p.x) / d.x;
        int = new cv.Point(p.x + lambda * d.x, p.y + lambda * d.y);
        if(checkIntersection(int))
            inters.push(int);
        lambda = -p.y / d.y;
        int = new cv.Point(p.x + lambda * d.x, p.y + lambda * d.y);
        if(checkIntersection(int))
            inters.push(int);
        return inters;
    };

    let intersected = true;
    let begin = true;
    let c = 0;
    let slicedLines = new Array();
    while(begin || intersected){
        let intersections = intersectBox(startPoint, dir, workWidth, workHeight);
        intersected = intersections.length > 0;
        begin &= !intersected;

        // sorting the points to get a continous line
        if(c & 1)
            intersections.sort((a, b) => (a.x - b.x) * workHeight + (a.y - b.y));
        else
            intersections.sort((a, b) => (b.x - a.x) * workHeight + (b.y - a.y));

        slicedLines.push(...intersections);
        startPoint.x += nor.x * lineWidth;
        startPoint.y += nor.y * lineWidth;
        ++c;
    }
    let postProcessParameters = {depth : workDepth, stepdown: createLinearPathCommand.stepdown};
    let depths = get3dDepths(workWidth, workHeight, workDepth, image, slicedLines, tool);
    return postProcessPath(depths, postProcessParameters);
}

//returns an array of 3d points which are the 3d points which describe the 3d movement of the cnc
function createCircularPath(createPathCommand, workWidth, workHeight, workDepth, image, tools){ 
    let angle = createPathCommand.angle;
    angle *= Math.PI / 180; //convet to radians
    let tool= tools.find(e => e.name == createPathCommand.tool);
    if(!tool) throw new Error("Tool not found");
    let toolWidth = tool.diameter;
    let lineWidth = toolWidth * createPathCommand.overlap / 100;  // Overlap is given in percent
    let midPoint = new cv.Point(workWidth / 2, workHeight / 2);
    let isInside = p => p.x >= -.1 && p.y >= -.1 && p.x < workWidth + .1 && p.y < workHeight + .1;
    //transforms the 0 centered point to align with the rotated centroid
    let transform = p => new cv.Point(Math.cos(angle) * p.x - Math.sin(angle) * p.y, Math.sin(angle) * p.x + Math.cos(angle) * p.y);
    let lerp = (a, b, t) => (1 - t) * a + t * b;

    let done = false;
    let slicedLines = new Array();
    let curRadius = lineWidth / 2;
    let curveResolution = createPathCommand.curveResolution;
    let ellipsis = Math.max(Math.min(1 - createPathCommand.ellipsis, 1), .1);
    while(!done){   //doing a single loop
        for(let i = 0; i < curveResolution; ++i){
            let r = lerp(curRadius, curRadius + lineWidth, i / curveResolution);    //geting the current radius
            let curAngle = i / curveResolution * 2 * Math.PI;
            //let rE = r * lerp(1, ellipsis, Math.abs(Math.sin(curAngle)));  //adding the ellipsis
            //let lerpFac = (i % (curveResolution / 2)) / (curveResolution / 4);
            //if(lerpFac > 1) lerpFac = 2 - lerpFac;
            //lerpFac = Math.sqrt(lerpFac);
            //let rE = lerp(1, ellipsis, lerpFac) * r;  //adding the ellipsis
            let p = new cv.Point(Math.sin(curAngle) * r * ellipsis, Math.cos(curAngle) * r);
            p = transform(p);       //accounting for rotated ellipsis
            p.x += midPoint.x;      //transforming curve to be centered around the midpoint
            p.y += midPoint.y; 
            //check if still inside
            if(isInside(p)){
                slicedLines.push(p);
            }
            else{
                //projecting point onto the border
                if(p.x < 0) p.x = 0;
                if(p.x > workWidth) p.x = workWidth;
                if(p.y < 0) p.y = 0;
                if(p.y > workHeight) p.y = workHeight;
                slicedLines.push(p);
                done = true;    //stopping line generation
                break;          //stopping current loop
            }
        }
        curRadius += lineWidth; //increasing the lineWidth for the next loop
    }
    let depths = get3dDepths(workWidth, workHeight, workDepth, image, slicedLines, tool);
    return postProcessPath(depths, postProcessParameters);
}

function createContourPath(createPathCommand, workWidth, workHeight, workDepth, image, tools){
    //first of all applying the difference of gaussians to get contour paths depending on tool size
    let tool= tools.find(e => e.name == createPathCommand.tool);
    if(!tool) throw new Error("Tool not found");
    let toolWidth = tool.diameter;
    let pixelXDist = workWidth / image.cols;
    let pixelYDist = workHeight / image.rows;
    let pixelDist = (pixelXDist + pixelYDist) / 2; //using the average distance
    let coverage = Math.ceil(toolWidth / pixelDist * 2);
    if((coverage & 1) == 0) ++coverage;    //ensuring we do have an uneven number
    let coverage2 = 2 * coverage + 1;
    let matS = new cv.Mat();
    image.convertTo(matS, cv.CV_32F);
    let matL = matS.clone();
    let kSize = new cv.Size(coverage, coverage);
    cv.GaussianBlur(matS, matS, kSize, 0, 0, cv.BORDER_DEFAULT);
    kSize = new cv.Size(coverage2, coverage2);
    cv.GaussianBlur(matL, matL, kSize, 0, 0, cv.BORDER_DEFAULT);

    cv.subtract(matL, matS, matS);  //matS = matL - matS
    let zero = cv.Mat.zeros(matS.rows, matS.cols, cv.CV_32F);
    cv.max(matS, zero, matS)        //matS = max(matS, 0)
    zero.delete();
    matS.convertTo(matL, cv.CV_8U); //matL = matS.8u;
    cv.Canny(matL, matS, 5, 15);  //matS = canny(matL)
    //getting lines via contour 
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(matS, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    //extracting contours
    let pixel2World = p => {p.x = (p.x - .5) / (image.cols - 1) * workWidth, p.y =  (p.y - .5) / (image.rows - 1) * workHeight;};
    let lines3d = new Array();
    for(let i = 0; i < contours.size(); ++i){
        let cnt = contours.get(i);
        //processing the contour (presumably a matrix of some sort)
        let slicedLines = new Array();
        for(let j = 0; j < cnt.data32S.length; j += 2){
            let p = new cv.Point(cnt.data32S[j], cnt.data32S[j + 1]);
            //convert to global location
            pixel2World(p);
            slicedLines.push(p);
        }
        // getting the 3d depth
        let curLines = get3dDepths(workWidth, workHeight, workDepth, image, slicedLines, tool);
        if(curLines.length == 0) continue;
        //bridging from last contour
        if(lines3d.length > 0){ //add connection line above the workpiece
            let lastPoint = lines3d[lines3d.length - 1];
            lines3d.push(new Point3D(lastPoint.x, lastPoint.y, 3)); //the connection line is always at higth 3, maybe change
            lines3d.push(new Point3D(curLines[0].x, curLines[0].y, 3));
        }
        lines3d.push(...curLines);
    }

    matS.delete();
    matL.delete();

    return lines3d;
}
