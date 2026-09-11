import{a as e}from"./chunk-L5WUWJUF.js";var t="logDepthFragment",r=`#ifdef LOGARITHMICDEPTH
gl_FragDepthEXT=log2(vFragmentDepth)*logarithmicDepthConstant*0.5;
#endif
`;e.IncludesShadersStore[t]||(e.IncludesShadersStore[t]=r);var n={name:t,shader:r};export{n as a};
