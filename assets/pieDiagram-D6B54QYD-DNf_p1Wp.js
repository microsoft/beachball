import{c as G}from"./chunk-4KE642ED-WASnn0-X.js";import{p as K}from"./gitGraph-WSSBKK6M-L23UEOVH-CdTAuad4.js";import{m as r,F as N,B as Q,w as X,v as Y,c as j,b as q,t as y,H as I,l as J,a6 as U,a8 as Z,a9 as O,aa as _,T as ee,h as te,ab as ae,p as ie}from"./mermaid.esm.min-B_ClbdgS.js";import"./chunk-5ZJXQJOJ-CoLSVVmx.js";import"./app-6mV1IZ1q.js";var re=ie.pie,T={sections:new Map,showData:!1},u=T.sections,D=T.showData,le=structuredClone(re),se=r(()=>structuredClone(le),"getConfig"),oe=r(()=>{u=new Map,D=T.showData,te()},"clear"),ne=r(({label:e,value:a})=>{u.has(e)||(u.set(e,a),y.debug(`added new section: ${e}, with value: ${a}`))},"addSection"),pe=r(()=>u,"getSections"),de=r(e=>{D=e},"setShowData"),ce=r(()=>D,"getShowData"),R={getConfig:se,clear:oe,setDiagramTitle:q,getDiagramTitle:j,setAccTitle:Y,getAccTitle:X,setAccDescription:Q,getAccDescription:N,addSection:ne,getSections:pe,setShowData:de,getShowData:ce},fe=r((e,a)=>{G(e,a),a.setShowData(e.showData),e.sections.map(a.addSection)},"populateDb"),ge={parse:r(async e=>{let a=await K("pie",e);y.debug(a),fe(a,R)},"parse")},me=r(e=>`
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
`,"getStyles"),ue=me,he=r(e=>{let a=[...e.entries()].map(l=>({label:l[0],value:l[1]})).sort((l,h)=>h.value-l.value);return ae().value(l=>l.value)(a)},"createPieArcs"),Se=r((e,a,l,h)=>{y.debug(`rendering pie chart
`+e);let d=h.db,v=I(),b=J(d.getConfig(),v.pie),C=40,s=18,c=4,n=450,S=n,x=U(a),o=x.append("g");o.attr("transform","translate("+S/2+","+n/2+")");let{themeVariables:i}=v,[k]=Z(i.pieOuterStrokeWidth);k??(k=2);let A=b.textPosition,f=Math.min(S,n)/2-C,B=O().innerRadius(0).outerRadius(f),L=O().innerRadius(f*A).outerRadius(f*A);o.append("circle").attr("cx",0).attr("cy",0).attr("r",f+k/2).attr("class","pieOuterCircle");let z=d.getSections(),w=he(z),W=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12],p=_(W);o.selectAll("mySlices").data(w).enter().append("path").attr("d",B).attr("fill",t=>p(t.data.label)).attr("class","pieCircle");let F=0;z.forEach(t=>{F+=t}),o.selectAll("mySlices").data(w).enter().append("text").text(t=>(t.data.value/F*100).toFixed(0)+"%").attr("transform",t=>"translate("+L.centroid(t)+")").style("text-anchor","middle").attr("class","slice"),o.append("text").text(d.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");let $=o.selectAll(".legend").data(p.domain()).enter().append("g").attr("class","legend").attr("transform",(t,g)=>{let m=s+c,E=m*p.domain().length/2,H=12*s,V=g*m-E;return"translate("+H+","+V+")"});$.append("rect").attr("width",s).attr("height",s).style("fill",p).style("stroke",p),$.data(w).append("text").attr("x",s+c).attr("y",s-c).text(t=>{let{label:g,value:m}=t.data;return d.getShowData()?`${g} [${m}]`:g});let P=Math.max(...$.selectAll("text").nodes().map(t=>(t==null?void 0:t.getBoundingClientRect().width)??0)),M=S+C+s+c+P;x.attr("viewBox",`0 0 ${M} ${n}`),ee(x,n,M,b.useMaxWidth)},"draw"),xe={draw:Se},ve={parser:ge,db:R,renderer:xe,styles:ue};export{ve as diagram};
