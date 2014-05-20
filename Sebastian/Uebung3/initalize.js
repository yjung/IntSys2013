

var viewMat = mat4.create();
var projectionMat = mat4.create();
//var modelViewProjection = mat4.create();

var Renderer = function (canvas)
{
    //-------------------------------------------------------
    // private section, variables
    //-------------------------------------------------------

    // access to Renderer from inside other functions
    var that = this;
// Shader Initialisierung
    var preamble = "#ifdef GL_FRAGMENT_PRECISION_HIGH\n" +
            "  precision highp float;\n" +
            "#else\n" +
            "  precision mediump float;\n" +
            "#endif\n\n";

    // vertex shader string
    var vertexShader = "attribute vec3 position;\n" +
            "attribute vec2 texCoord;\n" +
            "attribute vec3 color;\n" +
            "uniform mat4 transMat;\n" +
            "varying vec3 vColor;\n" +
            "varying vec2 vTexCoord;\n" +
            "void main() {\n" +
            "    vColor = color;\n" +
            "    vTexCoord = texCoord;\n" +
            "    vec4 pos = transMat * vec4(position, 1.0);\n" +
            "    gl_Position = pos;\n" +
            "}\n";

    // fragment shader string
    var fragmentShader = preamble +
            "uniform sampler2D tex;\n" +
            "uniform float texLoaded;\n" +
            "varying vec3 vColor;\n" +
            "varying vec2 vTexCoord;\n" +
            "void main() {\n" +
            "    vec4 color = vec4(vColor, 1.0);\n" +
            "    if (texLoaded == 1.0)\n" +
            "        color = texture2D(tex, vTexCoord);\n" +
        //"        color.rgb = texture2D(tex, (vTexCoord+0.5) / 2.0).rgb;\n" +
        //"        color.rgb = texture2D(tex, 2.0*vTexCoord).rgb;\n" +
            "    gl_FragColor = color;\n" +
            "}\n";

    // shader program object
    var shaderProgram = null;

    // container for our first object
    var myFirstObject = {
        // the object's vertices
        vertices: [
            -0.5, -1, 0,
            0.5, -1, 0,
            0.5, 0, 0,
            0.75, 0, 0,
            0, 1, -1,
            -0.75, 0, 0,
            -0.5,0,0

        ],
        // the object's vertex colors
        colors: [
            1, 1, 1,
            1, 1, 1,
            1, 1, 1,
            1, 0, 0,
            1, 0, 0,
            1, 0, 0,
            1, 1, 1
        ],
        // the object's texture coordinates
        texCoords: [
            0, 0,
            0.5, 0,
            0.5, 0.5,
            0.5, 0.5,
            0.25, 1,
            0, 0.5,
            0, 0.5
        ],
        // index array for drawing a quad (consisting of two tris)
        indices: [
            0, 1, 2,
            0, 2, 6,
            3, 4, 5
            //0, 1, 2, 3, 4
        ],

        // for animation
        // matrix elements must be provided in column major order!
        transform: [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ],
        angle: 0,
        numSeconds: 2,
        animating: false,
        transMat: mat4.create(),
        // texture
        
        imgSrc: "Tex1.jpg",
        texture: null
    };

    var lastFrameTime = 0;
    var needRender = true;


    //-------------------------------------------------------
    // private section, functions
    //-------------------------------------------------------

    // get GL context
    var gl = (function (canvas) {
        var context = null;
        var validContextNames = ['webgl', 'experimental-webgl'];
        var ctxAttribs = { alpha: true, depth: true, antialias: true, premultipliedAlpha: false };

        for (var i = 0; i < validContextNames.length; i++) {
            try {
                // provide context name and context creation params
                if (context = canvas.getContext(validContextNames[i], ctxAttribs)) {
                    console.log("Found '" + validContextNames[i] + "' context");
                    break;
                }
            }
            catch (e) {
                console.warn(e);
            }  // shouldn't happen on modern browsers
        }

        return context;
    })(canvas);

    // create shader part
    function getShader(source, type) {
        var shader = null;

        switch (type) {
            case "vertex":
                shader = gl.createShader(gl.VERTEX_SHADER);
                break;
            case "fragment":
                shader = gl.createShader(gl.FRAGMENT_SHADER);
                break;
            default:
                return null;
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn(type + "Shader: " + gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }

    // create shader program
    function initShader(vertexShaderStr, fragmentShaderStr) {
        var vs = getShader(vertexShaderStr, "vertex");
        var fs = getShader(fragmentShaderStr, "fragment");

        if (vs && fs) {
            var program = gl.createProgram();

            gl.attachShader(program, vs);
            gl.attachShader(program, fs);

            //gl.bindAttribLocation(program, 0, "position");

            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.warn("Could not link program: " + gl.getProgramInfoLog(program));
                return null;
            }

            findShaderVariables(program);

            return program;
        }

        return null;
    }

    function findShaderVariables(program) {
        var obj = null;
        var loc = null;
        var i, n, glErr;

        // get number of uniforms
        n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

        for (i = 0; i < n; i++) {
            obj = gl.getActiveUniform(program, i);

            glErr = gl.getError();
            if (glErr || !obj) {
                console.error("GL error on searching uniforms: " + glErr);
                continue;
            }

            loc = gl.getUniformLocation(program, obj.name);
            // dynamically attach uniform reference to program object
            program[obj.name] = loc;
        }

        // get number of attributes
        n = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

        for (i = 0; i < n; i++) {
            obj = gl.getActiveAttrib(program, i);

            glErr = gl.getError();
            if (glErr || !obj) {
                console.error("GL error on searching attributes: " + glErr);
                continue;
            }

            loc = gl.getAttribLocation(program, obj.name);
            // dynamically attach attribute index to program object
            program[obj.name] = loc;
        }
    }

    function initTexture(url) {
        var texture = gl.createTexture();
        texture.ready = false;

        var image = new Image();
        image.crossOrigin = '';
        image.src = url;

        image.onload = function () {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.bindTexture(gl.TEXTURE_2D, null);

            // save image size and ready state
            texture.width = image.width;
            texture.height = image.height;
            texture.ready = true;

            // async image loader, trigger re-render
            needRender = true;
        };

        image.onerror = function () {
            console.error("Cannot load image '" + url + "'!");
        };

        return texture;
    }

    // init buffer objects (dynamically attach buffer reference to obj)
    function initBuffers(obj) {
        obj.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(obj.indices), gl.STATIC_DRAW);

        obj.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.vertices), gl.STATIC_DRAW);

        obj.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.colors), gl.STATIC_DRAW);

        obj.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.texCoords), gl.STATIC_DRAW);


        //initialisiere transform Buffer
        obj.transMatbuffer = gl.createBuffer();
        //bind Transform Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.transMatbuffer);
        //Send Data to Buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(obj.transMat), gl.STATIC_DRAW);
    }


    //-------------------------------------------------------
    // public section, methods
    //-------------------------------------------------------
    return {
        initialize: function () {
            if (!gl) {
                return false;
            }

            shaderProgram = initShader(vertexShader, fragmentShader);

            if (!shaderProgram) {
                return false;
            }

            myFirstObject.texture = initTexture(myFirstObject.imgSrc);

            initBuffers(myFirstObject);

            lastFrameTime = Date.now();

            return true;
        },

        cleanup: function () {
            var shaders = gl.getAttachedShaders(shaderProgram);

            for (var i = 0; i < shaders.length; ++i) {
                gl.detachShader(shaderProgram, shaders[i]);
                gl.deleteShader(shaders[i]);
            }

            gl.deleteProgram(shaderProgram);
            shaderProgram = null;

            if (myFirstObject.texture)
                gl.deleteTexture(myFirstObject.texture);

            // delete VBOs, too
            gl.deleteBuffer(myFirstObject.indexBuffer);
            gl.deleteBuffer(myFirstObject.positionBuffer);
            gl.deleteBuffer(myFirstObject.colorBuffer);
            gl.deleteBuffer(myFirstObject.texCoordBuffer);
        },

        drawScene: function () {
            gl.clearColor(0.2, 0.6, 0.3, 1.0);
            gl.clearDepth(1.0);

            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            gl.depthFunc(gl.LEQUAL);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);

            // activate shader
            gl.useProgram(shaderProgram);

            // set uniforms
           mat4.multiply(viewMat, viewMat, myFirstObject.transMat);
            gl.uniformMatrix4fv(shaderProgram.transMat, false, new Float32Array(viewMat));

            if (myFirstObject.texture && myFirstObject.texture.ready) {
                gl.uniform1f(shaderProgram.texLoaded, 1);
                gl.uniform1i(shaderProgram.tex, 0);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, myFirstObject.texture);

                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                //gl.generateMipmap(gl.TEXTURE_2D);
            }
            else {
                gl.uniform1f(shaderProgram.texLoaded, 0);
            }

            // render object indexed
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, myFirstObject.indexBuffer);

            gl.bindBuffer(gl.ARRAY_BUFFER, myFirstObject.positionBuffer);
            gl.vertexAttribPointer(shaderProgram.position,  // index of attribute
                    3,        // three position components (x,y,z)
                    gl.FLOAT, // provided data type is float
                    false,    // do not normalize values
                    0,        // stride (in bytes)
                    0);       // offset (in bytes)
            gl.enableVertexAttribArray(shaderProgram.position);

            gl.bindBuffer(gl.ARRAY_BUFFER, myFirstObject.colorBuffer);
            gl.vertexAttribPointer(shaderProgram.color,  // index of attribute
                    3,        // three color components (r,g,b)
                    gl.FLOAT, // provided data type
                    false,    // normalize values
                    0,        // stride (in bytes)
                    0);       // offset (in bytes)
            gl.enableVertexAttribArray(shaderProgram.color);

            gl.bindBuffer(gl.ARRAY_BUFFER, myFirstObject.texCoordBuffer);
            gl.vertexAttribPointer(shaderProgram.texCoord,  // index of attribute
                    2,        // two texCoord components (s,t)
                    gl.FLOAT, // provided data type is float
                    false,    // do not normalize values
                    0,        // stride (in bytes)
                    0);       // offset (in bytes)
            gl.enableVertexAttribArray(shaderProgram.texCoord);

            // draw call
            gl.drawElements(gl.TRIANGLES, myFirstObject.indices.length, gl.UNSIGNED_SHORT, 0);

            gl.disableVertexAttribArray(shaderProgram.position);
            gl.disableVertexAttribArray(shaderProgram.color);
            gl.disableVertexAttribArray(shaderProgram.texCoord);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, null);
        },

        animate: function (dT) {
           
            if (myFirstObject.animating) // If animation is aktive Rotation begins
            {
              //Zeiger Rotation
                myFirstObject.angle += (2 * Math.PI * dT) / myFirstObject.numSeconds;
                var tempMat = mat4.create();

                mat4.rotateZ(myFirstObject.transMat, myFirstObject.transMat, myFirstObject.angle);
               mat4.multiply(myFirstObject.transMat, myFirstObject.transMat, projectionMat); // wird manipuliert per tastatur
//                myFirstObject.transform[0] = Math.cos(myFirstObject.angle);
//                myFirstObject.transform[1] = -Math.sin(myFirstObject.angle);
//                myFirstObject.transform[4] = Math.sin(myFirstObject.angle);
//                myFirstObject.transform[5] = Math.cos(myFirstObject.angle);
                needRender = true;  // transform changed, need re-render
            }
        },

        setDuration: function (s) {
            // one loop per numSeconds
            myFirstObject.numSeconds = s;
        },

        toggleAnim: function () {
            myFirstObject.animating = !myFirstObject.animating;
            return myFirstObject.animating;
        },

        tick: function (stats) {
            // first, calc new deltaT
            var currTime = Date.now();
            var dT = currTime - lastFrameTime;

            var fpsStr = (1000 / dT).toFixed(2);
            dT /= 1000;

            // then, update and render scene
            this.animate(dT);

            if (needRender)
                this.drawScene();

            // finally, show some statistics
            if (stats && needRender) {
                fpsStr = (currTime / 1000).toFixed(3) + "<br>dT: " + dT + "<br>fps: " + fpsStr;
                stats.innerHTML = fpsStr;
            }

            needRender = false;
            lastFrameTime = currTime;
        }
    }
};