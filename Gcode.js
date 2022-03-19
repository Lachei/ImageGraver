let standardHeader = "G21\nG94\nG90\nG54\n";    //standard header for mm milling setup

//recieves an array of 3d points and returns a string containing grbl usable gcode
//assumes that the y axis is inverted
function getGcodeString(header, points, feedRate, safeHeight, width, height, vertStart, horiStart){
    let ret = new String(header);
    let offset = {};    //offset points according to start position
    switch(vertStart){
        case "top":
            offset.y = -height;
            break;
        case "mid":
            offset.y = -height / 2;
            break;
        case "bot":
            offset.y = 0;
            break;
    }
    switch(horiStart){
        case "left":
            offset.x = 0;
            break;
        case "mid":
            offset.x = -width / 2;
            break;
        case "right":
            offset.x = -width;
            break;
    }
    //set engrave speed once
    ret += "F" + feedRate.toFixed(2) + "\n";
    //add start point lifting
    ret += "G0 Z" + safeHeight.toFixed(2) + "\n";
    //going to first point
    ret += "G0 X" + (points[0].x + offset.x).toFixed(2) + " Y" + (-points[0].y - offset.y).toFixed(2) + "\n";
    //adding all other points
    for(point of points){
        if(point.z > 0) ret += "G0 ", point.z = safeHeight;
        else ret += "G1 ";
        ret += "X" + (point.x + offset.x).toFixed(2) + " Y" + (-point.y - offset.y).toFixed(2) + " Z" + point.z.toFixed(2) + "\n";// + " F" + feedRate.toFixed(2) + "\n";
    }
    //adding final lift
    ret += "G0 Z" + safeHeight.toFixed(2) + "\n";
    return ret;
}