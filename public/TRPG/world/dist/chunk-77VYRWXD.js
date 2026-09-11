import{a as c}from"./chunk-Q337VPSK.js";import{a as f,b as l}from"./chunk-I2IOV5CD.js";import{a as s}from"./chunk-MQ7DXXF5.js";import{a as o,b as i}from"./chunk-EACWKJ3F.js";import{a as r}from"./chunk-H3J74N5D.js";import{a as n}from"./chunk-L5WUWJUF.js";var t="gaussianSplattingFragmentDeclaration",g=`fn gaussianColor(inColor: vec4f,inPosition: vec2f)->vec4f
{var A : f32=-dot(inPosition,inPosition);if (A>-4.0)
{var B: f32=exp(A)*inColor.a;
#include<logDepthFragment>
var color: vec3f=inColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
return vec4f(color,B);} else {return vec4f(0.0);}}
`;n.IncludesShadersStoreWGSL[t]||(n.IncludesShadersStoreWGSL[t]=g);var m={name:t,shader:g};var a="gaussianSplattingPixelShader",p=`#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
#ifdef GPUPICKER_PACK_DEPTH
#include<packingFunctions>
#endif
varying vColor: vec4f;varying vPosition: vec2f;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
var finalColor: vec4f=gaussianColor(input.vColor,input.vPosition);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
#ifdef GPUPICKER_DEPTH
fragmentOutputs.fragData0=finalColor;
#ifdef GPUPICKER_PACK_DEPTH
fragmentOutputs.fragData1=pack(fragmentInputs.position.z);
#else
fragmentOutputs.fragData1=vec4f(fragmentInputs.position.z,0.0,0.0,1.0);
#endif
#else
fragmentOutputs.color=finalColor;
#endif
#define CUSTOM_FRAGMENT_MAIN_END
}
`;n.ShadersStoreWGSL[a]||(n.ShadersStoreWGSL[a]=p);var S=[o,s,f,r,c,l,m,i];for(let e of S)n.IncludesShadersStoreWGSL[e.name]||(n.IncludesShadersStoreWGSL[e.name]=e.shader);var E={name:a,shader:p};export{E as gaussianSplattingPixelShaderWGSL};
