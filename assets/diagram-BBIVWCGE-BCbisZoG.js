import{c as B}from"./chunk-4KE642ED-KXCKUAR5.js";import{p as C}from"./treemap-KMMF4GRG-DK74C3S3-LFGq3W6O.js";import{m as g,L as u,a6 as P,G as z,t as w,j as F,Z as S,J as W,d as D,Q as E,K as T,O as L,I as A,X as R}from"./mermaid.esm.min-CWJsEOrV.js";import"./chunk-5ZJXQJOJ-BK3cwOWq.js";import"./app-Bwsni2wZ.js";var j=A.packet,m,y=(m=class{constructor(){this.packet=[],this.setAccTitle=F,this.getAccTitle=S,this.setDiagramTitle=W,this.getDiagramTitle=D,this.getAccDescription=E,this.setAccDescription=T}getConfig(){let t=u({...j,...L().packet});return t.showBits&&(t.paddingY+=10),t}getPacket(){return this.packet}pushWord(t){t.length>0&&this.packet.push(t)}clear(){R(),this.packet=[]}},g(m,"PacketDB"),m),G=1e4,I=g((e,t)=>{B(e,t);let r=-1,i=[],l=1,{bitsPerRow:n}=t.getConfig();for(let{start:a,end:o,bits:c,label:d}of e.blocks){if(a!==void 0&&o!==void 0&&o<a)throw new Error(`Packet block ${a} - ${o} is invalid. End must be greater than start.`);if(a??=r+1,a!==r+1)throw new Error(`Packet block ${a} - ${o??a} is not contiguous. It should start from ${r+1}.`);if(c===0)throw new Error(`Packet block ${a} is invalid. Cannot have a zero bit field.`);for(o??=a+(c??1)-1,c??=o-a+1,r=o,w.debug(`Packet block ${a} - ${r} with label ${d}`);i.length<=n+1&&t.getPacket().length<G;){let[p,s]=M({start:a,end:o,bits:c,label:d},l,n);if(i.push(p),p.end+1===l*n&&(t.pushWord(i),i=[],l++),!s)break;({start:a,end:o,bits:c,label:d}=s)}}t.pushWord(i)},"populate"),M=g((e,t,r)=>{if(e.start===void 0)throw new Error("start should have been set during first phase");if(e.end===void 0)throw new Error("end should have been set during first phase");if(e.start>e.end)throw new Error(`Block start ${e.start} is greater than block end ${e.end}.`);if(e.end+1<=t*r)return[e,void 0];let i=t*r-1,l=t*r;return[{start:e.start,end:i,label:e.label,bits:i-e.start},{start:l,end:e.end,label:e.label,bits:e.end-l}]},"getNextFittingBlock"),$={parser:{yy:void 0},parse:g(async e=>{let t=await C("packet",e),r=$.parser?.yy;if(!(r instanceof y))throw new Error("parser.parser?.yy was not a PacketDB. This is due to a bug within Mermaid, please report this issue at https://github.com/mermaid-js/mermaid/issues.");w.debug(t),I(t,r)},"parse")},O=g((e,t,r,i)=>{let l=i.db,n=l.getConfig(),{rowHeight:a,paddingY:o,bitWidth:c,bitsPerRow:d}=n,p=l.getPacket(),s=l.getDiagramTitle(),h=a+o,b=h*(p.length+1)-(s?0:a),k=c*d+2,f=P(t);f.attr("viewbox",`0 0 ${k} ${b}`),z(f,b,k,n.useMaxWidth);for(let[x,v]of p.entries())X(f,v,x,n);f.append("text").text(s).attr("x",k/2).attr("y",b-h/2).attr("dominant-baseline","middle").attr("text-anchor","middle").attr("class","packetTitle")},"draw"),X=g((e,t,r,{rowHeight:i,paddingX:l,paddingY:n,bitWidth:a,bitsPerRow:o,showBits:c})=>{let d=e.append("g"),p=r*(i+n)+n;for(let s of t){let h=s.start%o*a+1,b=(s.end-s.start+1)*a-l;if(d.append("rect").attr("x",h).attr("y",p).attr("width",b).attr("height",i).attr("class","packetBlock"),d.append("text").attr("x",h+b/2).attr("y",p+i/2).attr("class","packetLabel").attr("dominant-baseline","middle").attr("text-anchor","middle").text(s.label),!c)continue;let k=s.end===s.start,f=p-2;d.append("text").attr("x",h+(k?b/2:0)).attr("y",f).attr("class","packetByte start").attr("dominant-baseline","auto").attr("text-anchor",k?"middle":"start").text(s.start),k||d.append("text").attr("x",h+b).attr("y",f).attr("class","packetByte end").attr("dominant-baseline","auto").attr("text-anchor","end").text(s.end)}},"drawWord"),Y={draw:O},H={byteFontSize:"10px",startByteColor:"black",endByteColor:"black",labelColor:"black",labelFontSize:"12px",titleColor:"black",titleFontSize:"14px",blockStrokeColor:"black",blockStrokeWidth:"1",blockFillColor:"#efefef"},J=g(({packet:e}={})=>{let t=u(H,e);return`
	.packetByte {
		font-size: ${t.byteFontSize};
	}
	.packetByte.start {
		fill: ${t.startByteColor};
	}
	.packetByte.end {
		fill: ${t.endByteColor};
	}
	.packetLabel {
		fill: ${t.labelColor};
		font-size: ${t.labelFontSize};
	}
	.packetTitle {
		fill: ${t.titleColor};
		font-size: ${t.titleFontSize};
	}
	.packetBlock {
		stroke: ${t.blockStrokeColor};
		stroke-width: ${t.blockStrokeWidth};
		fill: ${t.blockFillColor};
	}
	`},"styles"),V={parser:$,get db(){return new y},renderer:Y,styles:J};export{V as diagram};
