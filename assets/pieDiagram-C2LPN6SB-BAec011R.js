import{c as I}from"./chunk-4KE642ED-fqizLMlh.js";import{p as J}from"./treemap-KMMF4GRG-DK74C3S3-8Fwc5N2x.js";import{m as r,Q as K,K as Q,Z as U,j as N,d as V,J as Y,t as $,h as q,L as H,a6 as _,a8 as ee,a9 as M,aa as te,G as ae,X as ie,ab as le,I as re}from"./mermaid.esm.min-XezNNdTY.js";import"./chunk-5ZJXQJOJ-D9aqww7f.js";import"./app-DhfJDAKK.js";var se=re.pie,v={sections:new Map,showData:!1},u=v.sections,y=v.showData,oe=structuredClone(se),ne=r(()=>structuredClone(oe),"getConfig"),pe=r(()=>{u=new Map,y=v.showData,ie()},"clear"),de=r(({label:e,value:a})=>{if(a<0)throw new Error(`"${e}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);u.has(e)||(u.set(e,a),$.debug(`added new section: ${e}, with value: ${a}`))},"addSection"),ce=r(()=>u,"getSections"),ue=r(e=>{y=e},"setShowData"),fe=r(()=>y,"getShowData"),L={getConfig:ne,clear:pe,setDiagramTitle:Y,getDiagramTitle:V,setAccTitle:N,getAccTitle:U,setAccDescription:Q,getAccDescription:K,addSection:de,getSections:ce,setShowData:ue,getShowData:fe},he=r((e,a)=>{I(e,a),a.setShowData(e.showData),e.sections.map(a.addSection)},"populateDb"),ge={parse:r(async e=>{let a=await J("pie",e);$.debug(a),he(a,L)},"parse")},me=r(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,"getStyles"),xe=me,we=r(e=>{let a=[...e.values()].reduce((l,s)=>l+s,0),T=[...e.entries()].map(([l,s])=>({label:l,value:s})).filter(l=>l.value/a*100>=1).sort((l,s)=>s.value-l.value);return le().value(l=>l.value)(T)},"createPieArcs"),Se=r((e,a,T,l)=>{$.debug(`rendering pie chart
`+e);let s=l.db,b=q(),D=H(s.getConfig(),b.pie),C=40,o=18,d=4,p=450,f=p,h=_(a),n=h.append("g");n.attr("transform","translate("+f/2+","+p/2+")");let{themeVariables:i}=b,[k]=ee(i.pieOuterStrokeWidth);k??=2;let A=D.textPosition,c=Math.min(f,p)/2-C,P=M().innerRadius(0).outerRadius(c),W=M().innerRadius(c*A).outerRadius(c*A);n.append("circle").attr("cx",0).attr("cy",0).attr("r",c+k/2).attr("class","pieOuterCircle");let g=s.getSections(),j=we(g),E=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12],m=0;g.forEach(t=>{m+=t});let O=j.filter(t=>(t.data.value/m*100).toFixed(0)!=="0"),x=te(E);n.selectAll("mySlices").data(O).enter().append("path").attr("d",P).attr("fill",t=>x(t.data.label)).attr("class","pieCircle"),n.selectAll("mySlices").data(O).enter().append("text").text(t=>(t.data.value/m*100).toFixed(0)+"%").attr("transform",t=>"translate("+W.centroid(t)+")").style("text-anchor","middle").attr("class","slice"),n.append("text").text(s.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");let z=[...g.entries()].map(([t,S])=>({label:t,value:S})),w=n.selectAll(".legend").data(z).enter().append("g").attr("class","legend").attr("transform",(t,S)=>{let R=o+d,X=R*z.length/2,Z=12*o,B=S*R-X;return"translate("+Z+","+B+")"});w.append("rect").attr("width",o).attr("height",o).style("fill",t=>x(t.label)).style("stroke",t=>x(t.label)),w.append("text").attr("x",o+d).attr("y",o-d).text(t=>s.getShowData()?`${t.label} [${t.value}]`:t.label);let G=Math.max(...w.selectAll("text").nodes().map(t=>t?.getBoundingClientRect().width??0)),F=f+C+o+d+G;h.attr("viewBox",`0 0 ${F} ${p}`),ae(h,p,F,D.useMaxWidth)},"draw"),$e={draw:Se},Ce={parser:ge,db:L,renderer:$e,styles:xe};export{Ce as diagram};
