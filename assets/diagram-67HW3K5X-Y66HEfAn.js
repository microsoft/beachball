import{c as I}from"./chunk-4KE642ED-KXCKUAR5.js";import{p as S}from"./treemap-KMMF4GRG-DK74C3S3-LFGq3W6O.js";import{m as o,K as E,Q as F,d as z,J as P,Z as R,j as D,a6 as j,X as B,L as v,O as w,I as G,t as W,ac as Z}from"./mermaid.esm.min-CWJsEOrV.js";import"./chunk-5ZJXQJOJ-BK3cwOWq.js";import"./app-Bwsni2wZ.js";var x={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},b={axes:[],curves:[],options:x},u=structuredClone(b),J=G.radar,K=o(()=>v({...J,...w().radar}),"getConfig"),C=o(()=>u.axes,"getAxes"),Q=o(()=>u.curves,"getCurves"),V=o(()=>u.options,"getOptions"),X=o(a=>{u.axes=a.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),_=o(a=>{u.curves=a.map(t=>({name:t.name,label:t.label??t.name,entries:H(t.entries)}))},"setCurves"),H=o(a=>{if(a[0].axis==null)return a.map(e=>e.value);let t=C();if(t.length===0)throw new Error("Axes must be populated before curves for reference entries");return t.map(e=>{let r=a.find(i=>i.axis?.$refText===e.name);if(r===void 0)throw new Error("Missing entry for axis "+e.label);return r.value})},"computeCurveEntries"),q=o(a=>{let t=a.reduce((e,r)=>(e[r.name]=r,e),{});u.options={showLegend:t.showLegend?.value??x.showLegend,ticks:t.ticks?.value??x.ticks,max:t.max?.value??x.max,min:t.min?.value??x.min,graticule:t.graticule?.value??x.graticule}},"setOptions"),N=o(()=>{B(),u=structuredClone(b)},"clear"),$={getAxes:C,getCurves:Q,getOptions:V,setAxes:X,setCurves:_,setOptions:q,getConfig:K,clear:N,setAccTitle:D,getAccTitle:R,setDiagramTitle:P,getDiagramTitle:z,getAccDescription:F,setAccDescription:E},U=o(a=>{I(a,$);let{axes:t,curves:e,options:r}=a;$.setAxes(t),$.setCurves(e),$.setOptions(r)},"populate"),Y={parse:o(async a=>{let t=await S("radar",a);W.debug(t),U(t)},"parse")},tt=o((a,t,e,r)=>{let i=r.db,n=i.getAxes(),l=i.getCurves(),s=i.getOptions(),c=i.getConfig(),d=i.getDiagramTitle(),p=j(t),g=et(p,c),h=s.max??Math.max(...l.map(y=>Math.max(...y.entries))),m=s.min,f=Math.min(c.width,c.height)/2;at(g,n,f,s.ticks,s.graticule),rt(g,n,f,c),L(g,n,l,m,h,s.graticule,c),k(g,l,s.showLegend,c),g.append("text").attr("class","radarTitle").text(d).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),et=o((a,t)=>{let e=t.width+t.marginLeft+t.marginRight,r=t.height+t.marginTop+t.marginBottom,i={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return a.attr("viewbox",`0 0 ${e} ${r}`).attr("width",e).attr("height",r),a.append("g").attr("transform",`translate(${i.x}, ${i.y})`)},"drawFrame"),at=o((a,t,e,r,i)=>{if(i==="circle")for(let n=0;n<r;n++){let l=e*(n+1)/r;a.append("circle").attr("r",l).attr("class","radarGraticule")}else if(i==="polygon"){let n=t.length;for(let l=0;l<r;l++){let s=e*(l+1)/r,c=t.map((d,p)=>{let g=2*p*Math.PI/n-Math.PI/2,h=s*Math.cos(g),m=s*Math.sin(g);return`${h},${m}`}).join(" ");a.append("polygon").attr("points",c).attr("class","radarGraticule")}}},"drawGraticule"),rt=o((a,t,e,r)=>{let i=t.length;for(let n=0;n<i;n++){let l=t[n].label,s=2*n*Math.PI/i-Math.PI/2;a.append("line").attr("x1",0).attr("y1",0).attr("x2",e*r.axisScaleFactor*Math.cos(s)).attr("y2",e*r.axisScaleFactor*Math.sin(s)).attr("class","radarAxisLine"),a.append("text").text(l).attr("x",e*r.axisLabelFactor*Math.cos(s)).attr("y",e*r.axisLabelFactor*Math.sin(s)).attr("class","radarAxisLabel")}},"drawAxes");function L(a,t,e,r,i,n,l){let s=t.length,c=Math.min(l.width,l.height)/2;e.forEach((d,p)=>{if(d.entries.length!==s)return;let g=d.entries.map((h,m)=>{let f=2*Math.PI*m/s-Math.PI/2,y=M(h,r,i,c),A=y*Math.cos(f),O=y*Math.sin(f);return{x:A,y:O}});n==="circle"?a.append("path").attr("d",T(g,l.curveTension)).attr("class",`radarCurve-${p}`):n==="polygon"&&a.append("polygon").attr("points",g.map(h=>`${h.x},${h.y}`).join(" ")).attr("class",`radarCurve-${p}`)})}o(L,"drawCurves");function M(a,t,e,r){let i=Math.min(Math.max(a,t),e);return r*(i-t)/(e-t)}o(M,"relativeRadius");function T(a,t){let e=a.length,r=`M${a[0].x},${a[0].y}`;for(let i=0;i<e;i++){let n=a[(i-1+e)%e],l=a[i],s=a[(i+1)%e],c=a[(i+2)%e],d={x:l.x+(s.x-n.x)*t,y:l.y+(s.y-n.y)*t},p={x:s.x-(c.x-l.x)*t,y:s.y-(c.y-l.y)*t};r+=` C${d.x},${d.y} ${p.x},${p.y} ${s.x},${s.y}`}return`${r} Z`}o(T,"closedRoundCurve");function k(a,t,e,r){if(!e)return;let i=(r.width/2+r.marginRight)*3/4,n=-(r.height/2+r.marginTop)*3/4,l=20;t.forEach((s,c)=>{let d=a.append("g").attr("transform",`translate(${i}, ${n+c*l})`);d.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${c}`),d.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(s.label)})}o(k,"drawLegend");var it={draw:tt},st=o((a,t)=>{let e="";for(let r=0;r<a.THEME_COLOR_LIMIT;r++){let i=a[`cScale${r}`];e+=`
		.radarCurve-${r} {
			color: ${i};
			fill: ${i};
			fill-opacity: ${t.curveOpacity};
			stroke: ${i};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${i};
			fill-opacity: ${t.curveOpacity};
			stroke: ${i};
		}
		`}return e},"genIndexStyles"),nt=o(a=>{let t=Z(),e=w(),r=v(t,e.themeVariables),i=v(r.radar,a);return{themeVariables:r,radarOptions:i}},"buildRadarStyleOptions"),lt=o(({radar:a}={})=>{let{themeVariables:t,radarOptions:e}=nt(a);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${e.axisColor};
		stroke-width: ${e.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${e.axisLabelFontSize}px;
		color: ${e.axisColor};
	}
	.radarGraticule {
		fill: ${e.graticuleColor};
		fill-opacity: ${e.graticuleOpacity};
		stroke: ${e.graticuleColor};
		stroke-width: ${e.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${e.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${st(t,e)}
	`},"styles"),ht={parser:Y,db:$,renderer:it,styles:lt};export{ht as diagram};
