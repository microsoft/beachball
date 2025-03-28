import{g as gt,h as st,y as mt,x as xt}from"./chunk-IPFMBKT6-jAkTtzxl.js";import{m as r,F as kt,B as _t,w as bt,v as vt,c as $t,b as wt,H as C,i as G,T as Tt,h as St,a9 as tt}from"./mermaid.esm.min-CiJ8olVp.js";import"./app-qAg5d1FC.js";var U=function(){var t=r(function(g,i,s,u){for(s=s||{},u=g.length;u--;s[g[u]]=i);return s},"o"),e=[6,8,10,11,12,14,16,17,18],n=[1,9],l=[1,10],a=[1,11],h=[1,12],c=[1,13],y=[1,14],d={trace:r(function(){},"trace"),yy:{},symbols_:{error:2,start:3,journey:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NEWLINE:10,title:11,acc_title:12,acc_title_value:13,acc_descr:14,acc_descr_value:15,acc_descr_multiline_value:16,section:17,taskName:18,taskData:19,$accept:0,$end:1},terminals_:{2:"error",4:"journey",6:"EOF",8:"SPACE",10:"NEWLINE",11:"title",12:"acc_title",13:"acc_title_value",14:"acc_descr",15:"acc_descr_value",16:"acc_descr_multiline_value",17:"section",18:"taskName",19:"taskData"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,2]],performAction:r(function(g,i,s,u,p,o,m){var k=o.length-1;switch(p){case 1:return o[k-1];case 2:this.$=[];break;case 3:o[k-1].push(o[k]),this.$=o[k-1];break;case 4:case 5:this.$=o[k];break;case 6:case 7:this.$=[];break;case 8:u.setDiagramTitle(o[k].substr(6)),this.$=o[k].substr(6);break;case 9:this.$=o[k].trim(),u.setAccTitle(this.$);break;case 10:case 11:this.$=o[k].trim(),u.setAccDescription(this.$);break;case 12:u.addSection(o[k].substr(8)),this.$=o[k].substr(8);break;case 13:u.addTask(o[k-1],o[k]),this.$="task";break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},t(e,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:n,12:l,14:a,16:h,17:c,18:y},t(e,[2,7],{1:[2,1]}),t(e,[2,3]),{9:15,11:n,12:l,14:a,16:h,17:c,18:y},t(e,[2,5]),t(e,[2,6]),t(e,[2,8]),{13:[1,16]},{15:[1,17]},t(e,[2,11]),t(e,[2,12]),{19:[1,18]},t(e,[2,4]),t(e,[2,9]),t(e,[2,10]),t(e,[2,13])],defaultActions:{},parseError:r(function(g,i){if(i.recoverable)this.trace(g);else{var s=new Error(g);throw s.hash=i,s}},"parseError"),parse:r(function(g){var i=this,s=[0],u=[],p=[null],o=[],m=this.table,k="",L=0,Z=0,ut=0,pt=2,J=1,yt=o.slice.call(arguments,1),_=Object.create(this.lexer),M={yy:{}};for(var R in this.yy)Object.prototype.hasOwnProperty.call(this.yy,R)&&(M.yy[R]=this.yy[R]);_.setInput(g,M.yy),M.yy.lexer=_,M.yy.parser=this,typeof _.yylloc>"u"&&(_.yylloc={});var D=_.yylloc;o.push(D);var dt=_.options&&_.options.ranges;typeof M.yy.parseError=="function"?this.parseError=M.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function ft(v){s.length=s.length-2*v,p.length=p.length-v,o.length=o.length-v}r(ft,"popStack");function K(){var v;return v=u.pop()||_.lex()||J,typeof v!="number"&&(v instanceof Array&&(u=v,v=u.pop()),v=i.symbols_[v]||v),v}r(K,"lex");for(var b,z,E,$,Ut,Y,A={},N,T,Q,O;;){if(E=s[s.length-1],this.defaultActions[E]?$=this.defaultActions[E]:((b===null||typeof b>"u")&&(b=K()),$=m[E]&&m[E][b]),typeof $>"u"||!$.length||!$[0]){var q="";O=[];for(N in m[E])this.terminals_[N]&&N>pt&&O.push("'"+this.terminals_[N]+"'");_.showPosition?q="Parse error on line "+(L+1)+`:
`+_.showPosition()+`
Expecting `+O.join(", ")+", got '"+(this.terminals_[b]||b)+"'":q="Parse error on line "+(L+1)+": Unexpected "+(b==J?"end of input":"'"+(this.terminals_[b]||b)+"'"),this.parseError(q,{text:_.match,token:this.terminals_[b]||b,line:_.yylineno,loc:D,expected:O})}if($[0]instanceof Array&&$.length>1)throw new Error("Parse Error: multiple actions possible at state: "+E+", token: "+b);switch($[0]){case 1:s.push(b),p.push(_.yytext),o.push(_.yylloc),s.push($[1]),b=null,z?(b=z,z=null):(Z=_.yyleng,k=_.yytext,L=_.yylineno,D=_.yylloc,ut>0);break;case 2:if(T=this.productions_[$[1]][1],A.$=p[p.length-T],A._$={first_line:o[o.length-(T||1)].first_line,last_line:o[o.length-1].last_line,first_column:o[o.length-(T||1)].first_column,last_column:o[o.length-1].last_column},dt&&(A._$.range=[o[o.length-(T||1)].range[0],o[o.length-1].range[1]]),Y=this.performAction.apply(A,[k,Z,L,M.yy,$[1],p,o].concat(yt)),typeof Y<"u")return Y;T&&(s=s.slice(0,-1*T*2),p=p.slice(0,-1*T),o=o.slice(0,-1*T)),s.push(this.productions_[$[1]][0]),p.push(A.$),o.push(A._$),Q=m[s[s.length-2]][s[s.length-1]],s.push(Q);break;case 3:return!0}}return!0},"parse")},x=function(){var g={EOF:1,parseError:r(function(i,s){if(this.yy.parser)this.yy.parser.parseError(i,s);else throw new Error(i)},"parseError"),setInput:r(function(i,s){return this.yy=s||this.yy||{},this._input=i,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:r(function(){var i=this._input[0];this.yytext+=i,this.yyleng++,this.offset++,this.match+=i,this.matched+=i;var s=i.match(/(?:\r\n?|\n).*/g);return s?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),i},"input"),unput:r(function(i){var s=i.length,u=i.split(/(?:\r\n?|\n)/g);this._input=i+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-s),this.offset-=s;var p=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),u.length-1&&(this.yylineno-=u.length-1);var o=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:u?(u.length===p.length?this.yylloc.first_column:0)+p[p.length-u.length].length-u[0].length:this.yylloc.first_column-s},this.options.ranges&&(this.yylloc.range=[o[0],o[0]+this.yyleng-s]),this.yyleng=this.yytext.length,this},"unput"),more:r(function(){return this._more=!0,this},"more"),reject:r(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:r(function(i){this.unput(this.match.slice(i))},"less"),pastInput:r(function(){var i=this.matched.substr(0,this.matched.length-this.match.length);return(i.length>20?"...":"")+i.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:r(function(){var i=this.match;return i.length<20&&(i+=this._input.substr(0,20-i.length)),(i.substr(0,20)+(i.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:r(function(){var i=this.pastInput(),s=new Array(i.length+1).join("-");return i+this.upcomingInput()+`
`+s+"^"},"showPosition"),test_match:r(function(i,s){var u,p,o;if(this.options.backtrack_lexer&&(o={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(o.yylloc.range=this.yylloc.range.slice(0))),p=i[0].match(/(?:\r\n?|\n).*/g),p&&(this.yylineno+=p.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:p?p[p.length-1].length-p[p.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+i[0].length},this.yytext+=i[0],this.match+=i[0],this.matches=i,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(i[0].length),this.matched+=i[0],u=this.performAction.call(this,this.yy,this,s,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),u)return u;if(this._backtrack){for(var m in o)this[m]=o[m];return!1}return!1},"test_match"),next:r(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var i,s,u,p;this._more||(this.yytext="",this.match="");for(var o=this._currentRules(),m=0;m<o.length;m++)if(u=this._input.match(this.rules[o[m]]),u&&(!s||u[0].length>s[0].length)){if(s=u,p=m,this.options.backtrack_lexer){if(i=this.test_match(u,o[m]),i!==!1)return i;if(this._backtrack){s=!1;continue}else return!1}else if(!this.options.flex)break}return s?(i=this.test_match(s,o[p]),i!==!1?i:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:r(function(){var i=this.next();return i||this.lex()},"lex"),begin:r(function(i){this.conditionStack.push(i)},"begin"),popState:r(function(){var i=this.conditionStack.length-1;return i>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:r(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:r(function(i){return i=this.conditionStack.length-1-Math.abs(i||0),i>=0?this.conditionStack[i]:"INITIAL"},"topState"),pushState:r(function(i){this.begin(i)},"pushState"),stateStackSize:r(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:r(function(i,s,u,p){switch(u){case 0:break;case 1:break;case 2:return 10;case 3:break;case 4:break;case 5:return 4;case 6:return 11;case 7:return this.begin("acc_title"),12;case 8:return this.popState(),"acc_title_value";case 9:return this.begin("acc_descr"),14;case 10:return this.popState(),"acc_descr_value";case 11:this.begin("acc_descr_multiline");break;case 12:this.popState();break;case 13:return"acc_descr_multiline_value";case 14:return 17;case 15:return 18;case 16:return 19;case 17:return":";case 18:return 6;case 19:return"INVALID"}},"anonymous"),rules:[/^(?:%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:#[^\n]*)/i,/^(?:journey\b)/i,/^(?:title\s[^#\n;]+)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:section\s[^#:\n;]+)/i,/^(?:[^#:\n;]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[12,13],inclusive:!1},acc_descr:{rules:[10],inclusive:!1},acc_title:{rules:[8],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,9,11,14,15,16,17,18,19],inclusive:!0}}};return g}();d.lexer=x;function f(){this.yy={}}return r(f,"Parser"),f.prototype=d,d.Parser=f,new f}();U.parser=U;var Mt=U,P="",W=[],j=[],F=[],Et=r(function(){W.length=0,j.length=0,P="",F.length=0,St()},"clear"),It=r(function(t){P=t,W.push(t)},"addSection"),Ct=r(function(){return W},"getSections"),At=r(function(){let t=et(),e=100,n=0;for(;!t&&n<e;)t=et(),n++;return j.push(...F),j},"getTasks"),Pt=r(function(){let t=[];return j.forEach(e=>{e.people&&t.push(...e.people)}),[...new Set(t)].sort()},"updateActors"),jt=r(function(t,e){let n=e.substr(1).split(":"),l=0,a=[];n.length===1?(l=Number(n[0]),a=[]):(l=Number(n[0]),a=n[1].split(","));let h=a.map(y=>y.trim()),c={section:P,type:P,people:h,task:t,score:l};F.push(c)},"addTask"),Ft=r(function(t){let e={section:P,type:P,description:t,task:t,classes:[]};j.push(e)},"addTaskOrg"),et=r(function(){let t=r(function(n){return F[n].processed},"compileTask"),e=!0;for(let[n,l]of F.entries())t(n),e=e&&l.processed;return e},"compileTasks"),Vt=r(function(){return Pt()},"getActors"),it={getConfig:r(()=>C().journey,"getConfig"),clear:Et,setDiagramTitle:wt,getDiagramTitle:$t,setAccTitle:vt,getAccTitle:bt,setAccDescription:_t,getAccDescription:kt,addSection:It,getSections:Ct,getTasks:At,addTask:jt,addTaskOrg:Ft,getActors:Vt},Lt=r(t=>`.label {
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
`,"getStyles"),Nt=Lt,X=r(function(t,e){return xt(t,e)},"drawRect"),Ot=r(function(t,e){let n=t.append("circle").attr("cx",e.cx).attr("cy",e.cy).attr("class","face").attr("r",15).attr("stroke-width",2).attr("overflow","visible"),l=t.append("g");l.append("circle").attr("cx",e.cx-15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666"),l.append("circle").attr("cx",e.cx+15/3).attr("cy",e.cy-15/3).attr("r",1.5).attr("stroke-width",2).attr("fill","#666").attr("stroke","#666");function a(y){let d=tt().startAngle(Math.PI/2).endAngle(3*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);y.append("path").attr("class","mouth").attr("d",d).attr("transform","translate("+e.cx+","+(e.cy+2)+")")}r(a,"smile");function h(y){let d=tt().startAngle(3*Math.PI/2).endAngle(5*(Math.PI/2)).innerRadius(7.5).outerRadius(6.8181818181818175);y.append("path").attr("class","mouth").attr("d",d).attr("transform","translate("+e.cx+","+(e.cy+7)+")")}r(h,"sad");function c(y){y.append("line").attr("class","mouth").attr("stroke",2).attr("x1",e.cx-5).attr("y1",e.cy+7).attr("x2",e.cx+5).attr("y2",e.cy+7).attr("class","mouth").attr("stroke-width","1px").attr("stroke","#666")}return r(c,"ambivalent"),e.score>3?a(l):e.score<3?h(l):c(l),n},"drawFace"),ot=r(function(t,e){let n=t.append("circle");return n.attr("cx",e.cx),n.attr("cy",e.cy),n.attr("class","actor-"+e.pos),n.attr("fill",e.fill),n.attr("stroke",e.stroke),n.attr("r",e.r),n.class!==void 0&&n.attr("class",n.class),e.title!==void 0&&n.append("title").text(e.title),n},"drawCircle"),lt=r(function(t,e){return mt(t,e)},"drawText"),Bt=r(function(t,e){function n(a,h,c,y,d){return a+","+h+" "+(a+c)+","+h+" "+(a+c)+","+(h+y-d)+" "+(a+c-d*1.2)+","+(h+y)+" "+a+","+(h+y)}r(n,"genPoints");let l=t.append("polygon");l.attr("points",n(e.x,e.y,50,20,7)),l.attr("class","labelBox"),e.y=e.y+e.labelMargin,e.x=e.x+.5*e.labelMargin,lt(t,e)},"drawLabel"),Rt=r(function(t,e,n){let l=t.append("g"),a=st();a.x=e.x,a.y=e.y,a.fill=e.fill,a.width=n.width*e.taskCount+n.diagramMarginX*(e.taskCount-1),a.height=n.height,a.class="journey-section section-type-"+e.num,a.rx=3,a.ry=3,X(l,a),ct(n)(e.text,l,a.x,a.y,a.width,a.height,{class:"journey-section section-type-"+e.num},n,e.colour)},"drawSection"),at=-1,Dt=r(function(t,e,n){let l=e.x+n.width/2,a=t.append("g");at++;let h=300+5*30;a.append("line").attr("id","task"+at).attr("x1",l).attr("y1",e.y).attr("x2",l).attr("y2",h).attr("class","task-line").attr("stroke-width","1px").attr("stroke-dasharray","4 2").attr("stroke","#666"),Ot(a,{cx:l,cy:300+(5-e.score)*30,score:e.score});let c=st();c.x=e.x,c.y=e.y,c.fill=e.fill,c.width=n.width,c.height=n.height,c.class="task task-type-"+e.num,c.rx=3,c.ry=3,X(a,c);let y=e.x+14;e.people.forEach(d=>{let x=e.actors[d].color,f={cx:y,cy:e.y,r:7,fill:x,stroke:"#000",title:d,pos:e.actors[d].position};ot(a,f),y+=10}),ct(n)(e.task,a,c.x,c.y,c.width,c.height,{class:"task"},n,e.colour)},"drawTask"),zt=r(function(t,e){gt(t,e)},"drawBackgroundRect"),ct=function(){function t(a,h,c,y,d,x,f,g){let i=h.append("text").attr("x",c+d/2).attr("y",y+x/2+5).style("font-color",g).style("text-anchor","middle").text(a);l(i,f)}r(t,"byText");function e(a,h,c,y,d,x,f,g,i){let{taskFontSize:s,taskFontFamily:u}=g,p=a.split(/<br\s*\/?>/gi);for(let o=0;o<p.length;o++){let m=o*s-s*(p.length-1)/2,k=h.append("text").attr("x",c+d/2).attr("y",y).attr("fill",i).style("text-anchor","middle").style("font-size",s).style("font-family",u);k.append("tspan").attr("x",c+d/2).attr("dy",m).text(p[o]),k.attr("y",y+x/2).attr("dominant-baseline","central").attr("alignment-baseline","central"),l(k,f)}}r(e,"byTspan");function n(a,h,c,y,d,x,f,g){let i=h.append("switch"),s=i.append("foreignObject").attr("x",c).attr("y",y).attr("width",d).attr("height",x).attr("position","fixed").append("xhtml:div").style("display","table").style("height","100%").style("width","100%");s.append("div").attr("class","label").style("display","table-cell").style("text-align","center").style("vertical-align","middle").text(a),e(a,i,c,y,d,x,f,g),l(s,f)}r(n,"byFo");function l(a,h){for(let c in h)c in h&&a.attr(c,h[c])}return r(l,"_setTextAttrs"),function(a){return a.textPlacement==="fo"?n:a.textPlacement==="old"?t:e}}(),Yt=r(function(t){t.append("defs").append("marker").attr("id","arrowhead").attr("refX",5).attr("refY",2).attr("markerWidth",6).attr("markerHeight",4).attr("orient","auto").append("path").attr("d","M 0,0 V 4 L6,2 Z")},"initGraphics"),V={drawRect:X,drawCircle:ot,drawSection:Rt,drawText:lt,drawLabel:Bt,drawTask:Dt,drawBackgroundRect:zt,initGraphics:Yt},qt=r(function(t){Object.keys(t).forEach(function(e){B[e]=t[e]})},"setConf"),S={};function ht(t){let e=C().journey,n=60;Object.keys(S).forEach(l=>{let a=S[l].color,h={cx:20,cy:n,r:7,fill:a,stroke:"#000",pos:S[l].position};V.drawCircle(t,h);let c={x:40,y:n+7,fill:"#666",text:l,textMargin:e.boxTextMargin|5};V.drawText(t,c),n+=20})}r(ht,"drawActorLegend");var B=C().journey,I=B.leftMargin,Gt=r(function(t,e,n,l){let a=C().journey,h=C().securityLevel,c;h==="sandbox"&&(c=G("#i"+e));let y=h==="sandbox"?G(c.nodes()[0].contentDocument.body):G("body");w.init();let d=y.select("#"+e);V.initGraphics(d);let x=l.db.getTasks(),f=l.db.getDiagramTitle(),g=l.db.getActors();for(let m in S)delete S[m];let i=0;g.forEach(m=>{S[m]={color:a.actorColours[i%a.actorColours.length],position:i},i++}),ht(d),w.insert(0,0,I,Object.keys(S).length*50),Ht(d,x,0);let s=w.getBounds();f&&d.append("text").text(f).attr("x",I).attr("font-size","4ex").attr("font-weight","bold").attr("y",25);let u=s.stopy-s.starty+2*a.diagramMarginY,p=I+s.stopx+2*a.diagramMarginX;Tt(d,u,p,a.useMaxWidth),d.append("line").attr("x1",I).attr("y1",a.height*4).attr("x2",p-I-4).attr("y2",a.height*4).attr("stroke-width",4).attr("stroke","black").attr("marker-end","url(#arrowhead)");let o=f?70:0;d.attr("viewBox",`${s.startx} -25 ${p} ${u+o}`),d.attr("preserveAspectRatio","xMinYMin meet"),d.attr("height",u+o+25)},"draw"),w={data:{startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},verticalPos:0,sequenceItems:[],init:r(function(){this.sequenceItems=[],this.data={startx:void 0,stopx:void 0,starty:void 0,stopy:void 0},this.verticalPos=0},"init"),updateVal:r(function(t,e,n,l){t[e]===void 0?t[e]=n:t[e]=l(n,t[e])},"updateVal"),updateBounds:r(function(t,e,n,l){let a=C().journey,h=this,c=0;function y(d){return r(function(x){c++;let f=h.sequenceItems.length-c+1;h.updateVal(x,"starty",e-f*a.boxMargin,Math.min),h.updateVal(x,"stopy",l+f*a.boxMargin,Math.max),h.updateVal(w.data,"startx",t-f*a.boxMargin,Math.min),h.updateVal(w.data,"stopx",n+f*a.boxMargin,Math.max),d!=="activation"&&(h.updateVal(x,"startx",t-f*a.boxMargin,Math.min),h.updateVal(x,"stopx",n+f*a.boxMargin,Math.max),h.updateVal(w.data,"starty",e-f*a.boxMargin,Math.min),h.updateVal(w.data,"stopy",l+f*a.boxMargin,Math.max))},"updateItemBounds")}r(y,"updateFn"),this.sequenceItems.forEach(y())},"updateBounds"),insert:r(function(t,e,n,l){let a=Math.min(t,n),h=Math.max(t,n),c=Math.min(e,l),y=Math.max(e,l);this.updateVal(w.data,"startx",a,Math.min),this.updateVal(w.data,"starty",c,Math.min),this.updateVal(w.data,"stopx",h,Math.max),this.updateVal(w.data,"stopy",y,Math.max),this.updateBounds(a,c,h,y)},"insert"),bumpVerticalPos:r(function(t){this.verticalPos=this.verticalPos+t,this.data.stopy=this.verticalPos},"bumpVerticalPos"),getVerticalPos:r(function(){return this.verticalPos},"getVerticalPos"),getBounds:r(function(){return this.data},"getBounds")},H=B.sectionFills,rt=B.sectionColours,Ht=r(function(t,e,n){let l=C().journey,a="",h=l.height*2+l.diagramMarginY,c=n+h,y=0,d="#CCC",x="black",f=0;for(let[g,i]of e.entries()){if(a!==i.section){d=H[y%H.length],f=y%H.length,x=rt[y%rt.length];let u=0,p=i.section;for(let m=g;m<e.length&&e[m].section==p;m++)u=u+1;let o={x:g*l.taskMargin+g*l.width+I,y:50,text:i.section,fill:d,num:f,colour:x,taskCount:u};V.drawSection(t,o,l),a=i.section,y++}let s=i.people.reduce((u,p)=>(S[p]&&(u[p]=S[p]),u),{});i.x=g*l.taskMargin+g*l.width+I,i.y=c,i.width=l.diagramMarginX,i.height=l.diagramMarginY,i.colour=x,i.fill=d,i.num=f,i.actors=s,V.drawTask(t,i,l),w.insert(i.x,i.y,i.x+i.width+l.taskMargin,300+5*30)}},"drawTasks"),nt={setConf:qt,draw:Gt},Jt={parser:Mt,db:it,renderer:nt,styles:Nt,init:r(t=>{nt.setConf(t.journey),it.clear()},"init")};export{Jt as diagram};
