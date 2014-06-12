#ifdef GL_FRAGMENT_PRECISION_HIGH
	precision highp float;
#else
	precision mediump float;
#endif;

// texture
uniform sampler2D tex0;
// helpers to check if values are set
uniform float tex0Loaded;
uniform float vertexColors;
// some material properties for lighting
uniform vec3 diffuseColor;
uniform vec3 specularColor;
uniform vec3 lightDirection;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vTexcoord;

vec4 toonify(float value) {
    vec4 color = vec4(0.3, 0.3, 0.3, 1.0);

    if (abs(value) < 0.5)
        color.rgb = vec3(0.0);
    if (value > 0.8)
        color.rgb = vec3(0.5, 0.5, 0.5);

    return color;
}

void main() {
    vec3 color;
    vec4 finalCol = vec4(0.0, 0.0, 0.0, 1.0);

    vec3 lightColor = vec3(0.3, 0.3, 0.2);
    vec3 ambient = vec3(0.05);
    float shininess = 128.0;

    vec3 normal  = normalize(vNormal);
    vec3 light   = normalize(-lightDirection);
    vec3 view    = normalize(-vPosition);
    vec3 halfVec = normalize(light + view);


    if (tex0Loaded == 1.0)
    {
        color = texture2D(tex0, vTexcoord).rgb;
    }
    else if (vertexColors == 1.0)
    {
        color = vColor.rgb;
    }
    else                                            // Falls keine Textur und keine Vertex-Colors definiert
    {
        color = diffuseColor;
    }


//    color = (lightDirection + 1.0) / 2.0;           // Lichtrichtung in Farbe visualisieren
//    color = (normal + 1.0) / 2.0;                 // Normalen in Farbe visualisieren

    // headlight, light is at eye position
    // since l = v, half vector is viewing vector (or light vector respectively)
    float NdotL = max(dot(normal, view), 0.0);
    // very simple phong lighting with lightDir = viewDir and white light
    finalCol.rgb += ambient + NdotL * color + pow(NdotL, shininess) * specularColor;


    // then add contribution of directional light
    NdotL = max(dot(normal, light), 0.0);
    vec3 diffuse = color * NdotL * lightColor;

    float powNdotH = pow(max(dot(normal, halfVec), 0.0), shininess);
    vec3 specular = specularColor * powNdotH * lightColor;

    finalCol.rgb += ambient + diffuse + specular;
    //finalCol.rgb = color.rgb;


    //gl_FragColor = vec4(color, 1.0);
    gl_FragColor = finalCol;
    //gl_FragColor = toonify(NdotL);//normal.z);
}
