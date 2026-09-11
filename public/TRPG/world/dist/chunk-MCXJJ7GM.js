import{a as d}from"./chunk-AM6Y2IBT.js";import{a as l,b as g}from"./chunk-GBVEXUQ4.js";import{a as c}from"./chunk-X55X5H5Z.js";import{a as i,b as t}from"./chunk-ATXQLUDH.js";import{a as n}from"./chunk-KW7SQOYV.js";import{a}from"./chunk-L5WUWJUF.js";var o="gaussianSplattingFragmentDeclaration",s=`vec4 gaussianColor(vec4 inColor)
{float A=-dot(vPosition,vPosition);if (A<-4.0) discard;float B=exp(A)*inColor.a;
#include<logDepthFragment>
vec3 color=inColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
return vec4(color,B);}
`;a.IncludesShadersStore[o]||(a.IncludesShadersStore[o]=s);var f={name:o,shader:s};var r="gaussianSplattingPixelShader",m=`#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
#ifdef GPUPICKER_DEPTH
layout(location=0) out highp vec4 glFragData[2];
#endif
#ifdef GPUPICKER_PACK_DEPTH
#include<packingFunctions>
#endif
varying vec4 vColor;varying vec2 vPosition;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
void main () {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec4 finalColor=gaussianColor(vColor);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
#ifdef GPUPICKER_DEPTH
glFragData[0]=finalColor;
#ifdef GPUPICKER_PACK_DEPTH
glFragData[1]=pack(gl_FragCoord.z);
#else
glFragData[1]=vec4(gl_FragCoord.z,0.0,0.0,1.0);
#endif
#else
gl_FragColor=finalColor;
#endif
#define CUSTOM_FRAGMENT_MAIN_END
}
`;a.ShadersStore[r]||(a.ShadersStore[r]=m);var p=[i,c,l,n,d,g,f,t];for(let e of p)a.IncludesShadersStore[e.name]||(a.IncludesShadersStore[e.name]=e.shader);var G={name:r,shader:m};export{G as gaussianSplattingPixelShader};
