async function readFile(file) {
    result = await fetch(file);
    return result.text();
}

var model = null;

function loadCfg() {
    readFile("model.cfg").then((text) => {
        model=JSON.parse(text)
        loadModels()
    })
}

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(2, 5, 10);
var renderer = new THREE.WebGLRenderer({
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var controls = new THREE.OrbitControls(camera, renderer.domElement);

camera.rotateX(-0.5);
camera.rotateY(0.5);
camera.rotateZ(0.5);
camera.position.set(27, 40, 20)

const loader = new THREE.TextureLoader();
const texture = loader.load ('texture.png', loadCfg)
texture.wrapS = THREE.Repeat;
texture.wrapT = THREE.Repeat;
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.LinearMipMapLinearFilter;
texture.repeat.set( 1, 1 );

var cubes = []
var t;

var skinParts = {
    "head": [8, 8, 8, -4, 12, -4],
    "body": [8, 12, 4, -4, 0, -2],
    "leftArm": [4, 12, 4, -8, 0, -2],
    "rightArm": [4, 12, 4, 4, 0, -2],
    "leftLeg": [4, 12, 4, 0, -12, -2],
    "rightLeg": [4, 12, 4, -4, -12, -2]
}

function loadPlayer() {
    Object.entries(skinParts).forEach((skinPart) => {
        skinPart = skinPart[1]
        const geometry = new THREE.BoxGeometry( skinPart[0], skinPart[1], skinPart[2] );

        cubes.push(geometry)
        
        const material = new THREE.MeshBasicMaterial({color:0x444444, transparent: true, opacity: 0.5});
        
        const cube = new THREE.Mesh( geometry, material );
        cube.position.set(skinPart[3] + skinPart[0]/2, skinPart[4] + skinPart[1]/2, skinPart[5] + skinPart[2]/2)

        scene.add(cube)
    })
}

function generateMapping(size, offset, textureSize) {
    var width = size[0];
    var height = size[1];
    var depth = size[2];

    sizeX = textureSize[0]
    sizeY = textureSize[1]

    offsetX = offset[0]
    offsetY = offset[1]
    /*
    [0, 1],
    [1, 1],
    [0, 0],
    [1, 0]
    */

    /* Mapping 
    Each face is made up of 4 coordinates (each is a value between 0 and 1) that determines the face's texture position.
    
    It goes in this order:
    [X, Y]
    - TL
    - TR
    - BL
    - BR
    */
    const mapping = [
        //Left
        [
            [0, (sizeX-depth)],
            [depth, (sizeX-depth)],
            [0, (sizeX-depth-height)],
            [depth, (sizeX-depth-height)]
        ],

        //Right
        [
            [(depth+width), (sizeX-depth)],
            [(depth*2+width), (sizeX-depth)],
            [(depth+width), (sizeX-depth-height)],
            [(depth*2+width), (sizeX-depth-height)]
        ],

        //Top
        [
            [depth, sizeY],
            [(depth+width), sizeY],
            [depth, (sizeX-depth)],
            [(depth+width), (sizeX-depth)]
        ],

        //Bottom
        [
            [(depth+width), sizeY],
            [(depth+width*2), sizeY],
            [(depth+width), (sizeX-depth)],
            [(depth+width*2), (sizeX-depth)]
        ],

        //Back
        [
            [(depth*2+width), (sizeX-depth)],
            [(depth*2+width*2), (sizeX-depth)],
            [(depth*2+width), (sizeX-depth-height)],
            [(depth*2+width*2), (sizeX-depth-height)]
        ],

        //Front
        [
            
            [depth, (sizeX-depth)],
            [(depth+width), (sizeX-depth)],
            [depth, (sizeX-depth-height)],
            [(depth+width), (sizeX-depth-height)]
        ]
    ]

    for (let i = 0; i < mapping.length; i++) {
        for (let j = 0; j < 4; j++) {
            mapping[i][j][0] += offsetX
            mapping[i][j][1] -= offsetY
            mapping[i][j][0] /= sizeX
            mapping[i][j][1] /= sizeY
        }
    }

    return mapping;
}

function loadCube(pos, size, offset, textureSize, group) {
    const geometry = new THREE.BoxGeometry( size[0], size[1], size[2] );

    const UVMap = generateMapping(size, offset, textureSize)

    var uvAttribute = geometry.attributes.uv;
	
    // The UV index we're editing
    var index = 0

    // For each plane
    for ( var i = 0; i < uvAttribute.count/4; i +=1 ) {

        // For each corner of plane
        for (var j = 0; j < 4; j++) {
            
            var u = uvAttribute.getX( index );
            var v = uvAttribute.getY( index );

            var newU = UVMap[i][j][0]///6
            var newV = UVMap[i][j][1]///6
                    
            uvAttribute.setXY( index, newU, newV );
            index++;
        }
            
    }

    cubes.push(geometry)
    
    const material = new THREE.MeshBasicMaterial({map:texture});
    
    const cube = new THREE.Mesh( geometry, material );
    cube.position.set(pos[0] + size[0]/2, pos[1] + size[1]/2, pos[2] + size[2]/2)

    group.add(cube)
}

function loadBox(box, group) {
    var c = box["coordinates"];
    var o = box["textureOffset"]
    loadCube([c[0], c[1], c[2]], [c[3], c[4], c[5]], o, t, group)
}

// The offsets we need to apply to different parts depending on where they're attached
var skinOffsets = {
    "head": [0, 12, 0],
    "body": [0, 12, 0],
    "leftArm": [-5, 10, 0],
    "rightArm": [5, 10, 0],
    "leftLeg": [-2, 0, 0],
    "rightLeg": [2, 0, 0]
}

function loadModel(model, parent) {
    var modelGroup = new THREE.Group();

    if (model.hasOwnProperty("attachTo")) {
        var offset = skinOffsets[model["attachTo"]];
        modelGroup.translateX(offset[0])
        modelGroup.translateY(offset[1])
        modelGroup.translateZ(offset[2])
    }
    
    translation = model["translate"]
    modelGroup.translateX(translation[0])
    modelGroup.translateY(translation[1])
    modelGroup.translateZ(translation[2])

    if (model.hasOwnProperty("rotate")) {
        rotation = model["rotate"]
        modelGroup.rotation.x = rotation[0] * (Math.PI/180);
        modelGroup.rotation.y = rotation[1] * (Math.PI/180);
        modelGroup.rotation.z = rotation[2] * (Math.PI/180);
        console.log(modelGroup.rotation.x)
    }

    if (model.hasOwnProperty("boxes")) {
        var boxes = model["boxes"]
            boxes.forEach(box => {
                loadBox(box, modelGroup)
        });
    }

    if (model.hasOwnProperty("submodels")) {
        var submodels = model["submodels"]
        submodels.forEach((submodel) => {
            loadModel(submodel, modelGroup);
        });
    }

    if (parent != undefined) {
        parent.add(modelGroup)
    } else {
        scene.add(modelGroup)
    }
}

function loadModels() {
    t = model["textureSize"]
    var models = model["models"]
    models.forEach(model => {
        loadModel(model)
    });

    loadPlayer()
}

render();

function render() {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}