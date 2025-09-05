import{g as mt,h as ot,y as xt,x as kt}from"./chunk-SQHZINSB-B3UkMCA-.js";import{o as bt}from"./chunk-ZZTKAOFA-BfkHSDxl.js";import{m as a,Q as _t,K as vt,Z as wt,j as $t,d as St,J as Mt,h as L,k as Z,G as Et,X as Tt,a9 as et}from"./mermaid.esm.min-D65HMj23.js";import"./app-B4ncHSV0.js";var J=(function(){var t=a(function(y,i,r,u){for(r=r||{},u=y.length;u--;r[y[u]]=i);return r},"o"),e=[6,8,10,11,12,14,16,17,18],s=[1,9],l=[1,10],n=[1,11],d=[1,12],c=[1,13],h=[1,14],f={trace:a(function(){},"trace"),yy:{},symbols_:{error:2,start:3,journey:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NEWLINE:10,title:11,acc_title:12,acc_title_value:13,acc_descr:14,acc_descr_value:15,acc_descr_multiline_value:16,section:17,taskName:18,taskData:19,$accept:0,$end:1},terminals_:{2:"error",4:"journey",6:"EOF",8:"SPACE",10:"NEWLINE",11:"title",12:"acc_title",13:"acc_title_value",14:"acc_descr",15:"acc_descr_value",16:"acc_descr_multiline_value",17:"section",18:"taskName",19:"taskData"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,2]],performAction:a(function(y,i,r,u,p,o,x){var k=o.length-1;switch(p){case 1:return o[k-1];case 2:this.$=[];break;case 3:o[k-1].push(o[k]),this.$=o[k-1];break;case 4:case 5:this.$=o[k];break;case 6:case 7:this.$=[];break;case 8:u.setDiagramTitle(o[k].substr(6)),this.$=o[k].substr(6);break;case 9:this.$=o[k].trim(),u.setAccTitle(this.$);break;case 10:case 11:this.$=o[k].trim(),u.setAccDescription(this.$);break;case 12:u.addSection(o[k].substr(8)),this.$=o[k].substr(8);break;case 13:u.addTask(o[k-1],o[k]),this.$="task";break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:s,12:l,14:n,16:d,17:c,18:h},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:15,11:s,12:l,14:n,16:d,17:c,18:h},t(e,[2,5]),t(e,[2,6]),t(e,[2,8]),{13:[1,16]},{15:[1,17]},t(e,[2,11]),t(e,[2,12]),{19:[1,18]},t(e,[2,4]),t(e,[2,9]),t(e,[2,10]),t(e,[2,13])],defaultActions:{},parseError:a(function(y,i){if(i.recoverable)this.trace(y);else{var r=new Error(y);throw r.hash=i,r}},"parseError"),parse:a(function(y){var i=this,r=[0],u=[],p=[null],o=[],x=this.table,k="",C=0,P=0,pt=0,yt=2,W=1,dt=o.slice.call(arguments,1),b=Object.create(this.lexer),A={yy:{}};for(var z in this.yy)Object.prototype.hasOwnProperty.call(this.yy,z)&&(A.yy[z]=this.yy[z]);b.setInput(y,A.yy),A.yy.lexer=b,A.yy.parser=this,typeof b.yylloc>"u"&&(b.yylloc={});var q=b.yylloc;o.push(q);var ft=b.options&&b.options.ranges;typeof A.yy.parseError=="function"?this.parseError=A.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function gt(v){r.length=r.length-2*v,p.length=p.length-v,o.length=o.length-v}a(gt,"popStack");function H(){var v;return v=u.pop()||b.lex()||W,typeof v!="number"&&(v instanceof Array&&(u=v,v=u.pop()),v=i.symbols_[v]||v),v}a(H,"lex");for(var _,G,I,w,Jt,X,j={},V,M,tt,N;;){if(I=r[r.length-1],this.defaultActions[I]?w=this.defaultActions[I]:((_===null||typeof _>"u")&&(_=H()),w=x[I]&&x[I][_]),typeof w>"u"||!w.length||!w[0]){var Y="";N=[];for(V in x[I])this.terminals_[V]&&V>yt&&N.push("'"+this.terminals_[V]+"'");b.showPosition?Y="Parse error on line "+(C+1)+`:
`+b.showPosition()+`
Expecting `+N.join(", ")+", got '"+(this.terminals_[_]||_)+"'":Y="Parse error on line "+(C+1)+": Unexpected "+(_==W?"end of input":"'"+(this.terminals_[_]||_)+"'"),this.parseError(Y,{text:b.match,token:this.terminals_[_]||_,line:b.yylineno,loc:q,expected:N})}if(w[0]instanceof Array&&w.length>1)throw new Error("Parse Error: multiple actions possible at state: "+I+", token: "+_);switch(w[0]){case 1:r.push(_),p.push(b.yytext),o.push(b.yylloc),r.push(w[1]),_=null,G?(_=G,G=null):(P=b.yyleng,k=b.yytext,C=b.yylineno,q=b.yylloc,pt>0);break;case 2:if(M=this.productions_[w[1]][1],j.$=p[p.length-M],j._$={first_line:o[o.length-(M||1)].first_line,last_line:o[o.length-1].last_line,first_column:o[o.length-(M||1)].first_column,last_column:o[o.length-1].last_column},ft&&(j._$.range=[o[o.length-(M||1)].range[0],o[o.length-1].range[1]]),X=this.performAction.apply(j,[k,P,C,A.yy,w[1],p,o].concat(dt)),typeof X<"u")return X;M&&(r=r.slice(0,-1*M*2),p=p.slice(0,-1*M),o=o.slice(0,-1*M)),r.push(this.productions_[w[1]][0]),p.push(j.$),o.push(j._$),tt=x[r[r.length-2]][r[r.length-1]],r.push(tt);break;case 3:return!0}}return!0},"parse")},m=(function(){var y={EOF:1,parseError:a(function(i,r){if(this.yy.parser)this.yy.parser.parseError(i,r);else throw new Error(i)},"parseError"),setInput:a(function(i,r){return this.yy=r||this.yy||{},this._input=i,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:a(function(){var i=this._input[0];this.yytext+=i,this.yyleng++,this.offset++,this.match+=i,this.matched+=i;var r=i.match(/(?:\r\n?|\n).*/g);return r?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),i},"input"),unput:a(function(i){var r=i.length,u=i.split(/(?:\r\n?|\n)/g);this._input=i+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-r),this.offset-=r;var p=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),u.length-1&&(this.yylineno-=u.length-1);var o=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:u?(u.length===p.length?this.yylloc.first_column:0)+p[p.length-u.length].length-u[0].length:this.yylloc.first_column-r},this.options.ranges&&(this.yylloc.range=[o[0],o[0]+this.yyleng-r]),this.yyleng=this.yytext.length,this},"unput"),more:a(function(){return this._more=!0,this},"more"),reject:a(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:a(function(i){this.unput(this.match.slice(i))},"less"),pastInput:a(function(){var i=this.matched.substr(0,this.matched.length-this.match.length);return(i.length>20?"...":"")+i.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:a(function(){var i=this.match;return i.length<20&&(i+=this._input.substr(0,20-i.length)),(i.substr(0,20)+(i.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:a(function(){var i=this.pastInput(),r=new Array(i.length+1).join("-");return i+this.upcomingInput()+`
`+r+"^"},"showPosition"),test_match:a(function(i,r){var u,p,o;if(this.options.backtrack_lexer&&(o={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(o.yylloc.range=this.yylloc.range.slice(0))),p=i[0].match(/(?:\r\n?|\n).*/g),p&&(this.yylineno+=p.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:p?p[p.length-1].length-p[p.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+i[0].length},this.yytext+=i[0],this.match+=i[0],this.matches=i,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(i[0].length),this.matched+=i[0],u=this.performAction.call(this,this.yy,this,r,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),u)return u;if(this._backtrack){for(var x in o)this[x]=o[x];return!1}return!1},"test_match"),next:a(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var i,r,u,p;this._more||(this.yytext="",this.match="");for(var o=this._currentRules(),x=0;x<o.length;x++)if(u=this._input.match(this.rules[o[x]]),u&&(!r||u[0].length>r[0].length)){if(r=u,p=x,this.options.backtrack_lexer){if(i=this.test_match(u,o[x]),i!==!1)return i;if(this._backtrack){r=!1;continue}else return!1}else if(!this.options.flex)break}return r?(i=this.test_match(r,o[p]),i!==!1?i:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:a(function(){var i=this.next();return i||this.lex()},"lex"),begin:a(function(i){this.conditionStack.push(i)},"begin"),popState:a(function(){var i=this.conditionStack.length-1;return i>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:a(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:a(function(i){return i=this.conditionStack.length-1-Math.abs(i||0),i>=0?this.conditionStack[i]:"INITIAL"},"topState"),pushState:a(function(i){this.begin(i)},"pushState"),stateStackSize:a(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:a(function(i,r,u,p){switch(u){case 0:break;case 1:break;case 2:return 10;case 3:break;case 4:break;case 5:return 4;case 6:return 11;case 7:return this.begin("acc_title"),12;case 8:return this.popState(),"acc_title_value";case 9:return this.begin("acc_descr"),14;case 10:return this.popState(),"acc_descr_value";case 11:this.begin("acc_descr_multiline");break;case 12:this.popState();break;case 13:return"acc_descr_multiline_value";case 14:return 17;case 15:return 18;case 16:return 19;case 17:return":";case 18:return 6;case 19:return"INVALID"}},"anonymous"),rules:[/^(?:%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:#[^\n]*)/i,/^(?:journey\b)/i,/^(?:title\s[^#\n;]+)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:section\s[^#:\n;]+)/i,/^(?:[^#:\n;]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[12,13],inclusive:!1},acc_descr:{rules:[10],inclusive:!1},acc_title:{rules:[8],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,9,11,14,15,16,17,18,19],inclusive:!0}}};return y})();f.lexer=m;function g(){this.yy={}}return a(g,"Parser"),g.prototype=f,f.Parser=g,new g})();J.parser=J;var Ct=J,B="",K=[],R=[],O=[],At=a(function(){K.length=0,R.length=0,B="",O.length=0,Tt()},"clear"),It=a(function(t){B=t,K.push(t)},"addSection"),Pt=a(function(){return K},"getSections"),jt=a(function(){let t=it(),e=100,s=0;for(;!t&&s<e;)t=it(),s++;return R.push(...O),R},"getTasks"),Bt=a(function(){let t=[];return R.forEach(e=>{e.people&&t.push(...e.people)}),[...new Set(t)].sort()},"updateActors"),Lt=a(function(t,e){let s=e.substr(1).split(":"),l=0,n=[];s.length===1?(l=Number(s[0]),n=[]):(l=Number(s[0]),n=s[1].split(","));let d=n.map(h=>h.trim()),c={section:B,type:B,people:d,task:t,score:l};O.push(c)},"addTask"),Rt=a(function(t){let e={section:B,type:B,description:t,task:t,classes:[]};R.push(e)},"addTaskOrg"),it=a(function(){let t=a(function(s){return O[s].processed},"compileTask"),e=!0;for(let[s,l]of O.entries())t(s),e=e&&l.processed;return e},"compileTasks"),Ot=a(function(){return Bt()},"getActors"),nt={getConfig:a(()=>L().journey,"getConfig"),clear:At,setDiagramTitle:Mt,getDiagramTitle:St,setAccTitle:$t,getAccTitle:wt,setAccDescription:vt,getAccDescription:_t,addSection:It,getSections:Pt,getTasks:jt,addTask:Lt,addTaskOrg:Rt,getActors:Ot},Ft=a(t=>`.label {
    font-family: ${t.fontFamily};
    color: ${t.textColor};
  }
  .mouth {
    stroke: #666;
  }

  line {
    stroke: ${t.textColor}
  }

  .legend {
    fill: ${t.textColor};
    font-family: ${t.fontFamily};
  }

  .label text {
    fill: #333;
  }
  .label {
    color: ${t.textColor}
  }

  .face {
    ${t.faceColor?`fill: ${t.faceColor}`:"fill: #FFF8DC"};
    stroke: #999;
  }

  .node rect,
  .node circle,
  .node ellipse,
  .node polygon,
  .node path {
    fill: ${t.mainBkg};
    stroke: ${t.nodeBorder};
    stroke-width: 1px;
  }

  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  .arrowheadPath {
    fill: ${t.arrowheadColor};
  }

  .edgePath .path {
    stroke: ${t.lineColor};
    stroke-width: 1.5px;
  }

  .flowchart-link {
    stroke: ${t.lineColor};
    fill: none;
  }

  .edgeLabel {
    background-color: ${t.edgeLabelBackground};
    rect {
      opacity: 0.5;
    }
    text-align: center;
  }

  .cluster rect {
  }

  .cluster text {
    fill: ${t.titleColor};
  }

  div.mermaidTooltip {
    position: absolute;
    text-align: center;
    max-width: 200px;
    padding: 2px;
    font-family: ${t.fontFamily};
    font-size: 12px;
    background: ${t.tertiaryColor};
    border: 1px solid ${t.border2};
    border-radius: 2px;
    pointer-events: none;
    z-index: 100;
  }

  .task-type-0, .section-type-0  {
    ${t.fillType0?`fill: ${t.fillType0}`:""};
  }
  .task-type-1, .section-type-1  {
    ${t.fillType0?`fill: ${t.fillType1}`:""};
  }
  .task-type-2, .section-type-2  {
    ${t.fillType0?`fill: ${t.fillType2}`:""};
  }
  .task-type-3, .section-type-3  {
    ${t.fillType0?`fill: ${t.fillType3}`:""};
  }
  .task-type-4, .section-type-4  {
    ${t.fillType0?`fill: ${t.fillType4}`:""};
  }
  .task-type-5, .section-type-5  {
    ${t.fillType0?`fill: ${t.fillType5}`:""};
  }
  .task-type-6, .section-type-6  {
    ${t.fillType0?`fill: ${t.fillType6}`:""};
  }
  .task-type-7, .section-type-7  {
    ${t.fillType0?`fill: ${t.fillType7}`:""};
  }

  .actor-0 {
    ${t.actor0?`fill: ${t.actor0}`:""};
  }
  .actor-1 {
    ${t.actor1?`fill: ${t.actor1}`:""};
  }
  .actor-2 {
    ${t.actor2?`fill: ${t.actor2}`:""};
  }
  .actor-3 {
    ${t.actor3?`fill: ${t.actor3}`:""};
  }
  .actor-4 {
    ${t.actor4?`fill: ${t.actor4}`:""};
  }
  .actor-5 {
    ${t.actor5?`fill: ${t.actor5}`:""};
  }
  ${bt()}
`,"getStyles"),Vt=Ft,Q=a(function(t,e){return kt(t,e)},"drawRect"),Nt=a(function(t,e){let s=t.append("circle").attr("cx",e.cx).attr("cy",e.cy).attr("class","face").attr("r",15).attr("stroke-width",2).attr("overflow","visible"),l=t.append("g");l.append("circle").attr("cx",e.cx-15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),l.append("circle").attr("cx",e.cx+15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666");function n(h){let f=et().startAngle(Math.PI/2).endAngle(3*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);h.append("path").attr("class","mouth").attr("d",f).attr("transform","translate("+e.cx+","+(e.cy+2)+")")}a(n,"smile");function d(h){let f=et().startAngle(3*Math.PI/2).endAngle(5*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);h.append("path").attr("class","mouth").attr("d",f).attr("transform","translate("+e.cx+","+(e.cy+7)+")")}a(d,"sad");function c(h){h.append("line").attr("class","mouth").attr("stroke",2).attr("x1",e.cx-5).attr("y1",e.cy+7).attr("x2",e.cx+5).attr("y2",e.cy+7).attr("class","mouth").attr("stroke-width","1px").attr("stroke","#666")}return a(c,"ambivalent"),e.score>3?n(l):e.score<3?d(l):c(l),s},"drawFace"),lt=a(function(t,e){let s=t.append("circle");return s.attr("cx",e.cx),s.attr("cy",e.cy),s.attr("class","actor-"+e.pos),s.attr("fill",e.fill),s.attr("stroke",e.stroke),s.attr("r",e.r),s.class!==void 0&&s.attr("class",s.class),e.title!==void 0&&s.append("title").text(e.title),s},"drawCircle"),ct=a(function(t,e){return xt(t,e)},"drawText"),Dt=a(function(t,e){function s(n,d,c,h,f){return n+","+d+" "+(n+c)+","+d+" "+(n+c)+","+(d+h-f)+" "+(n+c-f*1.2)+","+(d+h)+" "+n+","+(d+h)}a(s,"genPoints");let l=t.append("polygon");l.attr("points",s(e.x,e.y,50,20,7)),l.attr("class","labelBox"),e.y=e.y+e.labelMargin,e.x=e.x+.5*e.labelMargin,ct(t,e)},"drawLabel"),zt=a(function(t,e,s){let l=t.append("g"),n=ot();n.x=e.x,n.y=e.y,n.fill=e.fill,n.width=s.width*e.taskCount+s.diagramMarginX*(e.taskCount-1),n.height=s.height,n.class="journey-section section-type-"+e.num,n.rx=3,n.ry=3,Q(l,n),ht(s)(e.text,l,n.x,n.y,n.width,n.height,{class:"journey-section section-type-"+e.num},s,e.colour)},"drawSection"),at=-1,qt=a(function(t,e,s){let l=e.x+s.width/2,n=t.append("g");at++,n.append("line").attr("id","task"+at).attr("x1",l).attr("y1",e.y).attr("x2",l).attr("y2",450).attr("class","task-line").attr("stroke-width","1px").attr("stroke-dasharray","4 2").attr("stroke","#666"),Nt(n,{cx:l,cy:300+(5-e.score)*30,score:e.score});let c=ot();c.x=e.x,c.y=e.y,c.fill=e.fill,c.width=s.width,c.height=s.height,c.class="task task-type-"+e.num,c.rx=3,c.ry=3,Q(n,c);let h=e.x+14;e.people.forEach(f=>{let m=e.actors[f].color,g={cx:h,cy:e.y,r:7,fill:m,stroke:"#000",title:f,pos:e.actors[f].position};lt(n,g),h+=10}),ht(s)(e.task,n,c.x,c.y,c.width,c.height,{class:"task"},s,e.colour)},"drawTask"),Gt=a(function(t,e){mt(t,e)},"drawBackgroundRect"),ht=(function(){function t(n,d,c,h,f,m,g,y){let i=d.append("text").attr("x",c+f/2).attr("y",h+m/2+5).style("font-color",y).style("text-anchor","middle").text(n);l(i,g)}a(t,"byText");function e(n,d,c,h,f,m,g,y,i){let{taskFontSize:r,taskFontFamily:u}=y,p=n.split(/<br\s*\/?>/gi);for(let o=0;o<p.length;o++){let x=o*r-r*(p.length-1)/2,k=d.append("text").attr("x",c+f/2).attr("y",h).attr("fill",i).style("text-anchor","middle").style("font-size",r).style("font-family",u);k.append("tspan").attr("x",c+f/2).attr("dy",x).text(p[o]),k.attr("y",h+m/2).attr("dominant-baseline","central").attr("alignment-baseline","central"),l(k,g)}}a(e,"byTspan");function s(n,d,c,h,f,m,g,y){let i=d.append("switch"),r=i.append("foreignObject").attr("x",c).attr("y",h).attr("width",f).attr("height",m).attr("position","fixed").append("xhtml:div").style("display","table").style("height","100%").style("width","100%");r.append("div").attr("class","label").style("display","table-cell").style("text-align","center").style("vertical-align","middle").text(n),e(n,i,c,h,f,m,g,y),l(r,g)}a(s,"byFo");function l(n,d){for(let c in d)c in d&&n.attr(c,d[c])}return a(l,"_setTextAttrs"),function(n){return n.textPlacement==="fo"?s:n.textPlacement==="old"?t:e}})(),Xt=a(function(t){t.append("defs").append("marker").attr("id","arrowhead").attr("refX",5).attr("refY",2).attr("markerWidth",6).attr("markerHeight",4).attr("orient","auto").append("path").attr("d","M 0,0 V 4 L6,2 Z")},"initGraphics"),F={drawRect:Q,drawCircle:lt,drawSection:zt,drawText:ct,drawLabel:Dt,drawTask:qt,drawBackgroundRect:Gt,initGraphics:Xt},Yt=a(function(t){Object.keys(t).forEach(function(e){S[e]=t[e]})},"setConf"),E={},D=0;function ut(t){let e=L().journey,s=e.maxLabelWidth;D=0;let l=60;Object.keys(E).forEach(n=>{let d=E[n].color,c={cx:20,cy:l,r:7,fill:d,stroke:"#000",pos:E[n].position};F.drawCircle(t,c);let h=t.append("text").attr("visibility","hidden").text(n),f=h.node().getBoundingClientRect().width;h.remove();let m=[];if(f<=s)m=[n];else{let g=n.split(" "),y="";h=t.append("text").attr("visibility","hidden"),g.forEach(i=>{let r=y?`${y} ${i}`:i;if(h.text(r),h.node().getBoundingClientRect().width>s){if(y&&m.push(y),y=i,h.text(i),h.node().getBoundingClientRect().width>s){let u="";for(let p of i)u+=p,h.text(u+"-"),h.node().getBoundingClientRect().width>s&&(m.push(u.slice(0,-1)+"-"),u=p);y=u}}else y=r}),y&&m.push(y),h.remove()}m.forEach((g,y)=>{let i={x:40,y:l+7+y*20,fill:"#666",text:g,textMargin:e.boxTextMargin??5},r=F.drawText(t,i).node().getBoundingClientRect().width;r>D&&r>e.leftMargin-r&&(D=r)}),l+=Math.max(20,m.length*20)})}a(ut,"drawActorLegend");var S=L().journey,T=0,Zt=a(function(t,e,s,l){let n=L(),d=n.journey.titleColor,c=n.journey.titleFontSize,h=n.journey.titleFontFamily,f=n.securityLevel,m;f==="sandbox"&&(m=Z("#i"+e));let g=f==="sandbox"?Z(m.nodes()[0].contentDocument.body):Z("body");$.init();let y=g.select("#"+e);F.initGraphics(y);let i=l.db.getTasks(),r=l.db.getDiagramTitle(),u=l.db.getActors();for(let P in E)delete E[P];let p=0;u.forEach(P=>{E[P]={color:S.actorColours[p%S.actorColours.length],position:p},p++}),ut(y),T=S.leftMargin+D,$.insert(0,0,T,Object.keys(E).length*50),Ut(y,i,0);let o=$.getBounds();r&&y.append("text").text(r).attr("x",T).attr("font-size",c).attr("font-weight","bold").attr("y",25).attr("fill",d).attr("font-family",h);let x=o.stopy-o.starty+2*S.diagramMarginY,k=T+o.stopx+2*S.diagramMarginX;Et(y,x,k,S.useMaxWidth),y.append("line").attr("x1",T).attr("y1",S.height*4).attr("x2",k-T-4).attr("y2",S.height*4).attr("stroke-width",4).attr("stroke","black").attr("marker-end","url(#arrowhead)");let C=r?70:0;y.attr("viewBox",`${o.startx} -25 ${k} ${x+C}`),y.attr("preserveAspectRatio","xMinYMin meet"),y.attr("height",x+C+25)},"draw"),$={data:{startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},verticalPos:0,sequenceItems:[],init:a(function(){this.sequenceItems=[],this.data={startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},this.verticalPos=0},"init"),updateVal:a(function(t,e,s,l){t[e]===void 0?t[e]=s:t[e]=l(s,t[e])},"updateVal"),updateBounds:a(function(t,e,s,l){let n=L().journey,d=this,c=0;function h(f){return a(function(m){c++;let g=d.sequenceItems.length-c+1;d.updateVal(m,"starty",e-g*n.boxMargin,Math.min),d.updateVal(m,"stopy",l+g*n.boxMargin,Math.max),d.updateVal($.data,"startx",t-g*n.boxMargin,Math.min),d.updateVal($.data,"stopx",s+g*n.boxMargin,Math.max),f!=="activation"&&(d.updateVal(m,"startx",t-g*n.boxMargin,Math.min),d.updateVal(m,"stopx",s+g*n.boxMargin,Math.max),d.updateVal($.data,"starty",e-g*n.boxMargin,Math.min),d.updateVal($.data,"stopy",l+g*n.boxMargin,Math.max))},"updateItemBounds")}a(h,"updateFn"),this.sequenceItems.forEach(h())},"updateBounds"),insert:a(function(t,e,s,l){let n=Math.min(t,s),d=Math.max(t,s),c=Math.min(e,l),h=Math.max(e,l);this.updateVal($.data,"startx",n,Math.min),this.updateVal($.data,"starty",c,Math.min),this.updateVal($.data,"stopx",d,Math.max),this.updateVal($.data,"stopy",h,Math.max),this.updateBounds(n,c,d,h)},"insert"),bumpVerticalPos:a(function(t){this.verticalPos=this.verticalPos+t,this.data.stopy=this.verticalPos},"bumpVerticalPos"),getVerticalPos:a(function(){return this.verticalPos},"getVerticalPos"),getBounds:a(function(){return this.data},"getBounds")},U=S.sectionFills,rt=S.sectionColours,Ut=a(function(t,e,s){let l=L().journey,n="",d=l.height*2+l.diagramMarginY,c=s+d,h=0,f="#CCC",m="black",g=0;for(let[y,i]of e.entries()){if(n!==i.section){f=U[h%U.length],g=h%U.length,m=rt[h%rt.length];let u=0,p=i.section;for(let x=y;x<e.length&&e[x].section==p;x++)u=u+1;let o={x:y*l.taskMargin+y*l.width+T,y:50,text:i.section,fill:f,num:g,colour:m,taskCount:u};F.drawSection(t,o,l),n=i.section,h++}let r=i.people.reduce((u,p)=>(E[p]&&(u[p]=E[p]),u),{});i.x=y*l.taskMargin+y*l.width+T,i.y=c,i.width=l.diagramMarginX,i.height=l.diagramMarginY,i.colour=m,i.fill=f,i.num=g,i.actors=r,F.drawTask(t,i,l),$.insert(i.x,i.y,i.x+i.width+l.taskMargin,450)}},"drawTasks"),st={setConf:Yt,draw:Zt},te={parser:Ct,db:nt,renderer:st,styles:Vt,init:a(t=>{st.setConf(t.journey),nt.clear()},"init")};export{te as diagram};
