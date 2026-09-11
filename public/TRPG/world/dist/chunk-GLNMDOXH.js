import{a as V}from"./chunk-PYCIVUEY.js";import{a as m}from"./chunk-KWJ5FBPS.js";import{a as f,b as s}from"./chunk-5V4AXZBF.js";import{a as r,b as n,c as a,d,e as c}from"./chunk-C5BS2JNY.js";import{a as t,b as l}from"./chunk-PFHCAADH.js";import{a as e}from"./chunk-L5WUWJUF.js";var i="colorVertexShader",x=`attribute vec3 position;
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<clipPlaneVertexDeclaration>
#include<fogVertexDeclaration>
#ifdef FOG
uniform mat4 view;
#endif
#include<instancesDeclaration>
uniform mat4 viewProjection;
#ifdef MULTIVIEW
uniform mat4 viewProjectionR;
#endif
#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
varying vec4 vColor;
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
#ifdef VERTEXCOLOR
vec4 colorUpdated=color;
#endif
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(position,1.0);
#ifdef MULTIVIEW
if (gl_ViewID_OVR==0u) {gl_Position=viewProjection*worldPos;} else {gl_Position=viewProjectionR*worldPos;}
#else
gl_Position=viewProjection*worldPos;
#endif
#include<clipPlaneVertex>
#include<fogVertex>
#include<vertexColorMixing>
#define CUSTOM_VERTEX_MAIN_END
}`;e.ShadersStore[i]||(e.ShadersStore[i]=x);var p=[r,n,t,f,m,a,d,c,l,s,V];for(let o of p)e.IncludesShadersStore[o.name]||(e.IncludesShadersStore[o.name]=o.shader);var g={name:i,shader:x};export{g as colorVertexShader};
