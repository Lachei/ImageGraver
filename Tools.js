let toolsDiv = document.getElementById('toolsDiv');
let newToolName = document.getElementById('newToolName');
let newToolType = document.getElementById('newToolType');
let newToolWidth = document.getElementById('newToolWidth');
let newToolAngle = document.getElementById('newToolAngle');
let tools = [{}, {}, {}];

//adding default tools
tools[0].name = "Ball_3mm";
tools[0].type = "Ball";
tools[0].diameter = 3;
tools[1].name = "Endmill_4mm";
tools[1].type = "Endmill";
tools[1].diameter = 4;
tools[2].name = "V-Bit_30deg";
tools[2].type = "V-Bit";
tools[2].diameter = 4;
tools[2].angle = 30;

//loading stored tools
try{
    let list = JSON.parse(localStorage.Tools);
    if(list instanceof Array){
        tools.push(...list);
    }
}
catch(e){
    console.log(e);
}


updateToolsDiv();

function getToolDiv(tool){
    let htmlString = '<div class="wrap-collapsible"><input type = "checkbox" id="collapsible'+ tool.name + '" class = "toggle"><label for="collapsible'+ tool.name + '" class = "lbl-toggle">';
    htmlString += tool.name;
    htmlString += '</label><div class="collapsible-content">';
    switch(tool.type){
        case "Ball":
            htmlString += '<input type = "number" id="ballDiameter" name="ballDiameter" min = "0" value = "'+ tool.diameter +'"><label for="ballDiameter">mm (Diameter)</label>';
            break;
        case "Endmill":
            htmlString += '<input type = "number" id="endmillDiameter" name="endmillDiameter" min = "0" value = "'+ tool.diameter +'"><label for="endmillDiameter">mm (Diameter)</label>';
            break;
        case "V-Bit":
            htmlString += '<input type = "number" id="vDiameter" name="vDiameter" min = "0" value = "'+ tool.diameter +'"><label for="vDiameter">mm (Diameter)</label><br>';
            htmlString += '<input type = "number" id="vAngle" name="vAngle" min = "0" value = "'+ tool.angle +'"><label for="vAngle">° (Angle)</label>';
            break;
    }
    htmlString += '</div></div>';
    return htmlString;
}

function updateToolsDiv(){
    toolsDiv.innerHTML = '';
    for(const tool of tools){
        toolsDiv.innerHTML += getToolDiv(tool);
    }
}

function getToolSelector(label, selected){
    let returnString = '<select name = "tool" id = "tool">';
    for(const tool of tools){
        let selectedString = '';
        if(tool.name == selected) selectedString = ' selected="selected" ';
        returnString += '<option value = "' + tool.name + '"' + selectedString + '>' + tool.name + '</option>';
    }
    returnString += '</select>';
    returnString += '<label for="tool">' + label + '</label><br>';
    return returnString;
}

function addTool(){
    let newTool = {};
    newTool.name = newToolName.value;
    newTool.type = newToolType.value;
    newTool.diameter = +newToolWidth.value;
    if(newTool.type == "V-Bit")
        newTool.angle = +newToolAngle.value;
    tools.push(newTool);
    updateToolsDiv();
    saveTools();
}

function saveTools(){
    let t = [];
    for(let i = 3; i < tools.length; ++i)
        t.push(tools[i]);
    localStorage.Tools = JSON.stringify(t);
}

function clearTools(){
    tools = [tools[0], tools[1], tools[2]];
    updateToolsDiv();
    localStorage.Tools = JSON.stringify([]);
}
