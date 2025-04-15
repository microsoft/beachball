var ae=Object.defineProperty;var ne=(e,t,s)=>t in e?ae(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s;var _=(e,t,s)=>ne(e,typeof t!="symbol"?t+"":t,s);import{w as oe,$ as le}from"./chunk-BOXWCURE-BzxLKhr8.js";import{m as d,t as k,H as C,S as ce,a as he,am as de,g as X,h as ue,w as pe,v as ye,F as fe,B as ge,b as me,c as Se}from"./mermaid.esm.min-BzVQkJ6v.js";var Et=function(){var e=d(function(L,a,n,f){for(n=n||{},f=L.length;f--;n[L[f]]=a);return n},"o"),t=[1,2],s=[1,3],o=[1,4],l=[2,4],r=[1,9],p=[1,11],u=[1,16],h=[1,17],m=[1,18],b=[1,19],v=[1,32],F=[1,20],P=[1,21],A=[1,22],y=[1,23],I=[1,24],w=[1,26],Y=[1,27],G=[1,28],N=[1,29],B=[1,30],Z=[1,31],tt=[1,34],et=[1,35],st=[1,36],it=[1,37],K=[1,33],g=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],rt=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],vt=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],ft={trace:d(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,classDef:38,CLASSDEF_ID:39,CLASSDEF_STYLEOPTS:40,DEFAULT:41,style:42,STYLE_IDS:43,STYLEDEF_STYLEOPTS:44,class:45,CLASSENTITY_IDS:46,STYLECLASS:47,direction_tb:48,direction_bt:49,direction_rl:50,direction_lr:51,eol:52,";":53,EDGE_STATE:54,STYLE_SEPARATOR:55,left_of:56,right_of:57,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"-->",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"classDef",39:"CLASSDEF_ID",40:"CLASSDEF_STYLEOPTS",41:"DEFAULT",42:"style",43:"STYLE_IDS",44:"STYLEDEF_STYLEOPTS",45:"class",46:"CLASSENTITY_IDS",47:"STYLECLASS",48:"direction_tb",49:"direction_bt",50:"direction_rl",51:"direction_lr",53:";",54:"EDGE_STATE",55:"STYLE_SEPARATOR",56:"left_of",57:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[52,1],[52,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:d(function(L,a,n,f,S,i,x){var c=i.length-1;switch(S){case 3:return f.setRootDoc(i[c]),i[c];case 4:this.$=[];break;case 5:i[c]!="nl"&&(i[c-1].push(i[c]),this.$=i[c-1]);break;case 6:case 7:this.$=i[c];break;case 8:this.$="nl";break;case 12:this.$=i[c];break;case 13:let ot=i[c-1];ot.description=f.trimColon(i[c]),this.$=ot;break;case 14:this.$={stmt:"relation",state1:i[c-2],state2:i[c]};break;case 15:let lt=f.trimColon(i[c]);this.$={stmt:"relation",state1:i[c-3],state2:i[c-1],description:lt};break;case 19:this.$={stmt:"state",id:i[c-3],type:"default",description:"",doc:i[c-1]};break;case 20:var j=i[c],V=i[c-2].trim();if(i[c].match(":")){var nt=i[c].split(":");j=nt[0],V=[V,nt[1]]}this.$={stmt:"state",id:j,type:"default",description:V};break;case 21:this.$={stmt:"state",id:i[c-3],type:"default",description:i[c-5],doc:i[c-1]};break;case 22:this.$={stmt:"state",id:i[c],type:"fork"};break;case 23:this.$={stmt:"state",id:i[c],type:"join"};break;case 24:this.$={stmt:"state",id:i[c],type:"choice"};break;case 25:this.$={stmt:"state",id:f.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:i[c-1].trim(),note:{position:i[c-2].trim(),text:i[c].trim()}};break;case 29:this.$=i[c].trim(),f.setAccTitle(this.$);break;case 30:case 31:this.$=i[c].trim(),f.setAccDescription(this.$);break;case 32:case 33:this.$={stmt:"classDef",id:i[c-1].trim(),classes:i[c].trim()};break;case 34:this.$={stmt:"style",id:i[c-1].trim(),styleClass:i[c].trim()};break;case 35:this.$={stmt:"applyClass",id:i[c-1].trim(),styleClass:i[c].trim()};break;case 36:f.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 37:f.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 38:f.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 39:f.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 42:case 43:this.$={stmt:"state",id:i[c].trim(),type:"default",description:""};break;case 44:this.$={stmt:"state",id:i[c-2].trim(),classes:[i[c].trim()],type:"default",description:""};break;case 45:this.$={stmt:"state",id:i[c-2].trim(),classes:[i[c].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:t,5:s,6:o},{1:[3]},{3:5,4:t,5:s,6:o},{3:6,4:t,5:s,6:o},e([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],l,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:r,5:p,8:8,9:10,10:12,11:13,12:14,13:15,16:u,17:h,19:m,22:b,24:v,25:F,26:P,27:A,28:y,29:I,32:25,33:w,35:Y,37:G,38:N,42:B,45:Z,48:tt,49:et,50:st,51:it,54:K},e(g,[2,5]),{9:38,10:12,11:13,12:14,13:15,16:u,17:h,19:m,22:b,24:v,25:F,26:P,27:A,28:y,29:I,32:25,33:w,35:Y,37:G,38:N,42:B,45:Z,48:tt,49:et,50:st,51:it,54:K},e(g,[2,7]),e(g,[2,8]),e(g,[2,9]),e(g,[2,10]),e(g,[2,11]),e(g,[2,12],{14:[1,39],15:[1,40]}),e(g,[2,16]),{18:[1,41]},e(g,[2,18],{20:[1,42]}),{23:[1,43]},e(g,[2,22]),e(g,[2,23]),e(g,[2,24]),e(g,[2,25]),{30:44,31:[1,45],56:[1,46],57:[1,47]},e(g,[2,28]),{34:[1,48]},{36:[1,49]},e(g,[2,31]),{39:[1,50],41:[1,51]},{43:[1,52]},{46:[1,53]},e(rt,[2,42],{55:[1,54]}),e(rt,[2,43],{55:[1,55]}),e(g,[2,36]),e(g,[2,37]),e(g,[2,38]),e(g,[2,39]),e(g,[2,6]),e(g,[2,13]),{13:56,24:v,54:K},e(g,[2,17]),e(vt,l,{7:57}),{24:[1,58]},{24:[1,59]},{23:[1,60]},{24:[2,46]},{24:[2,47]},e(g,[2,29]),e(g,[2,30]),{40:[1,61]},{40:[1,62]},{44:[1,63]},{47:[1,64]},{24:[1,65]},{24:[1,66]},e(g,[2,14],{14:[1,67]}),{4:r,5:p,8:8,9:10,10:12,11:13,12:14,13:15,16:u,17:h,19:m,21:[1,68],22:b,24:v,25:F,26:P,27:A,28:y,29:I,32:25,33:w,35:Y,37:G,38:N,42:B,45:Z,48:tt,49:et,50:st,51:it,54:K},e(g,[2,20],{20:[1,69]}),{31:[1,70]},{24:[1,71]},e(g,[2,32]),e(g,[2,33]),e(g,[2,34]),e(g,[2,35]),e(rt,[2,44]),e(rt,[2,45]),e(g,[2,15]),e(g,[2,19]),e(vt,l,{7:72}),e(g,[2,26]),e(g,[2,27]),{4:r,5:p,8:8,9:10,10:12,11:13,12:14,13:15,16:u,17:h,19:m,21:[1,73],22:b,24:v,25:F,26:P,27:A,28:y,29:I,32:25,33:w,35:Y,37:G,38:N,42:B,45:Z,48:tt,49:et,50:st,51:it,54:K},e(g,[2,21])],defaultActions:{5:[2,1],6:[2,2],46:[2,46],47:[2,47]},parseError:d(function(L,a){if(a.recoverable)this.trace(L);else{var n=new Error(L);throw n.hash=a,n}},"parseError"),parse:d(function(L){var a=this,n=[0],f=[],S=[null],i=[],x=this.table,c="",j=0,V=0,nt=0,ot=2,lt=1,se=i.slice.call(arguments,1),T=Object.create(this.lexer),z={yy:{}};for(var gt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,gt)&&(z.yy[gt]=this.yy[gt]);T.setInput(L,z.yy),z.yy.lexer=T,z.yy.parser=this,typeof T.yylloc>"u"&&(T.yylloc={});var mt=T.yylloc;i.push(mt);var ie=T.options&&T.options.ranges;typeof z.yy.parseError=="function"?this.parseError=z.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function re($){n.length=n.length-2*$,S.length=S.length-$,i.length=i.length-$}d(re,"popStack");function It(){var $;return $=f.pop()||T.lex()||lt,typeof $!="number"&&($ instanceof Array&&(f=$,$=f.pop()),$=a.symbols_[$]||$),$}d(It,"lex");for(var E,St,U,D,Ve,bt,W={},ct,O,Lt,ht;;){if(U=n[n.length-1],this.defaultActions[U]?D=this.defaultActions[U]:((E===null||typeof E>"u")&&(E=It()),D=x[U]&&x[U][E]),typeof D>"u"||!D.length||!D[0]){var Tt="";ht=[];for(ct in x[U])this.terminals_[ct]&&ct>ot&&ht.push("'"+this.terminals_[ct]+"'");T.showPosition?Tt="Parse error on line "+(j+1)+`:
`+T.showPosition()+`
Expecting `+ht.join(", ")+", got '"+(this.terminals_[E]||E)+"'":Tt="Parse error on line "+(j+1)+": Unexpected "+(E==lt?"end of input":"'"+(this.terminals_[E]||E)+"'"),this.parseError(Tt,{text:T.match,token:this.terminals_[E]||E,line:T.yylineno,loc:mt,expected:ht})}if(D[0]instanceof Array&&D.length>1)throw new Error("Parse Error: multiple actions possible at state: "+U+", token: "+E);switch(D[0]){case 1:n.push(E),S.push(T.yytext),i.push(T.yylloc),n.push(D[1]),E=null,St?(E=St,St=null):(V=T.yyleng,c=T.yytext,j=T.yylineno,mt=T.yylloc,nt>0);break;case 2:if(O=this.productions_[D[1]][1],W.$=S[S.length-O],W._$={first_line:i[i.length-(O||1)].first_line,last_line:i[i.length-1].last_line,first_column:i[i.length-(O||1)].first_column,last_column:i[i.length-1].last_column},ie&&(W._$.range=[i[i.length-(O||1)].range[0],i[i.length-1].range[1]]),bt=this.performAction.apply(W,[c,V,j,z.yy,D[1],S,i].concat(se)),typeof bt<"u")return bt;O&&(n=n.slice(0,-1*O*2),S=S.slice(0,-1*O),i=i.slice(0,-1*O)),n.push(this.productions_[D[1]][0]),S.push(W.$),i.push(W._$),Lt=x[n[n.length-2]][n[n.length-1]],n.push(Lt);break;case 3:return!0}}return!0},"parse")},ee=function(){var L={EOF:1,parseError:d(function(a,n){if(this.yy.parser)this.yy.parser.parseError(a,n);else throw new Error(a)},"parseError"),setInput:d(function(a,n){return this.yy=n||this.yy||{},this._input=a,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:d(function(){var a=this._input[0];this.yytext+=a,this.yyleng++,this.offset++,this.match+=a,this.matched+=a;var n=a.match(/(?:\r\n?|\n).*/g);return n?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),a},"input"),unput:d(function(a){var n=a.length,f=a.split(/(?:\r\n?|\n)/g);this._input=a+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-n),this.offset-=n;var S=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),f.length-1&&(this.yylineno-=f.length-1);var i=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:f?(f.length===S.length?this.yylloc.first_column:0)+S[S.length-f.length].length-f[0].length:this.yylloc.first_column-n},this.options.ranges&&(this.yylloc.range=[i[0],i[0]+this.yyleng-n]),this.yyleng=this.yytext.length,this},"unput"),more:d(function(){return this._more=!0,this},"more"),reject:d(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:d(function(a){this.unput(this.match.slice(a))},"less"),pastInput:d(function(){var a=this.matched.substr(0,this.matched.length-this.match.length);return(a.length>20?"...":"")+a.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:d(function(){var a=this.match;return a.length<20&&(a+=this._input.substr(0,20-a.length)),(a.substr(0,20)+(a.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:d(function(){var a=this.pastInput(),n=new Array(a.length+1).join("-");return a+this.upcomingInput()+`
`+n+"^"},"showPosition"),test_match:d(function(a,n){var f,S,i;if(this.options.backtrack_lexer&&(i={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(i.yylloc.range=this.yylloc.range.slice(0))),S=a[0].match(/(?:\r\n?|\n).*/g),S&&(this.yylineno+=S.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:S?S[S.length-1].length-S[S.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+a[0].length},this.yytext+=a[0],this.match+=a[0],this.matches=a,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(a[0].length),this.matched+=a[0],f=this.performAction.call(this,this.yy,this,n,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),f)return f;if(this._backtrack){for(var x in i)this[x]=i[x];return!1}return!1},"test_match"),next:d(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var a,n,f,S;this._more||(this.yytext="",this.match="");for(var i=this._currentRules(),x=0;x<i.length;x++)if(f=this._input.match(this.rules[i[x]]),f&&(!n||f[0].length>n[0].length)){if(n=f,S=x,this.options.backtrack_lexer){if(a=this.test_match(f,i[x]),a!==!1)return a;if(this._backtrack){n=!1;continue}else return!1}else if(!this.options.flex)break}return n?(a=this.test_match(n,i[S]),a!==!1?a:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:d(function(){var a=this.next();return a||this.lex()},"lex"),begin:d(function(a){this.conditionStack.push(a)},"begin"),popState:d(function(){var a=this.conditionStack.length-1;return a>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:d(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:d(function(a){return a=this.conditionStack.length-1-Math.abs(a||0),a>=0?this.conditionStack[a]:"INITIAL"},"topState"),pushState:d(function(a){this.begin(a)},"pushState"),stateStackSize:d(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:d(function(a,n,f,S){switch(f){case 0:return 41;case 1:return 48;case 2:return 49;case 3:return 50;case 4:return 51;case 5:break;case 6:break;case 7:return 5;case 8:break;case 9:break;case 10:break;case 11:break;case 12:return this.pushState("SCALE"),17;case 13:return 18;case 14:this.popState();break;case 15:return this.begin("acc_title"),33;case 16:return this.popState(),"acc_title_value";case 17:return this.begin("acc_descr"),35;case 18:return this.popState(),"acc_descr_value";case 19:this.begin("acc_descr_multiline");break;case 20:this.popState();break;case 21:return"acc_descr_multiline_value";case 22:return this.pushState("CLASSDEF"),38;case 23:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";case 24:return this.popState(),this.pushState("CLASSDEFID"),39;case 25:return this.popState(),40;case 26:return this.pushState("CLASS"),45;case 27:return this.popState(),this.pushState("CLASS_STYLE"),46;case 28:return this.popState(),47;case 29:return this.pushState("STYLE"),42;case 30:return this.popState(),this.pushState("STYLEDEF_STYLES"),43;case 31:return this.popState(),44;case 32:return this.pushState("SCALE"),17;case 33:return 18;case 34:this.popState();break;case 35:this.pushState("STATE");break;case 36:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),25;case 37:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),26;case 38:return this.popState(),n.yytext=n.yytext.slice(0,-10).trim(),27;case 39:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),25;case 40:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),26;case 41:return this.popState(),n.yytext=n.yytext.slice(0,-10).trim(),27;case 42:return 48;case 43:return 49;case 44:return 50;case 45:return 51;case 46:this.pushState("STATE_STRING");break;case 47:return this.pushState("STATE_ID"),"AS";case 48:return this.popState(),"ID";case 49:this.popState();break;case 50:return"STATE_DESCR";case 51:return 19;case 52:this.popState();break;case 53:return this.popState(),this.pushState("struct"),20;case 54:break;case 55:return this.popState(),21;case 56:break;case 57:return this.begin("NOTE"),29;case 58:return this.popState(),this.pushState("NOTE_ID"),56;case 59:return this.popState(),this.pushState("NOTE_ID"),57;case 60:this.popState(),this.pushState("FLOATING_NOTE");break;case 61:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";case 62:break;case 63:return"NOTE_TEXT";case 64:return this.popState(),"ID";case 65:return this.popState(),this.pushState("NOTE_TEXT"),24;case 66:return this.popState(),n.yytext=n.yytext.substr(2).trim(),31;case 67:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),31;case 68:return 6;case 69:return 6;case 70:return 16;case 71:return 54;case 72:return 24;case 73:return n.yytext=n.yytext.trim(),14;case 74:return 15;case 75:return 28;case 76:return 55;case 77:return 5;case 78:return"INVALID"}},"anonymous"),rules:[/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[9,10],inclusive:!1},struct:{rules:[9,10,22,26,29,35,42,43,44,45,54,55,56,57,71,72,73,74,75],inclusive:!1},FLOATING_NOTE_ID:{rules:[64],inclusive:!1},FLOATING_NOTE:{rules:[61,62,63],inclusive:!1},NOTE_TEXT:{rules:[66,67],inclusive:!1},NOTE_ID:{rules:[65],inclusive:!1},NOTE:{rules:[58,59,60],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[31],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[30],inclusive:!1},CLASS_STYLE:{rules:[28],inclusive:!1},CLASS:{rules:[27],inclusive:!1},CLASSDEFID:{rules:[25],inclusive:!1},CLASSDEF:{rules:[23,24],inclusive:!1},acc_descr_multiline:{rules:[20,21],inclusive:!1},acc_descr:{rules:[18],inclusive:!1},acc_title:{rules:[16],inclusive:!1},SCALE:{rules:[13,14,33,34],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[48],inclusive:!1},STATE_STRING:{rules:[49,50],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[9,10,36,37,38,39,40,41,46,47,51,52,53],inclusive:!1},ID:{rules:[9,10],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,10,11,12,15,17,19,22,26,29,32,35,53,57,68,69,70,71,72,73,74,76,77,78],inclusive:!0}}};return L}();ft.lexer=ee;function at(){this.yy={}}return d(at,"Parser"),at.prototype=ft,ft.Parser=at,new at}();Et.parser=Et;var Je=Et,be="TB",zt="TB",At="dir",ut="state",xt="relation",Te="classDef",_e="style",ke="applyClass",q="default",Ut="divider",Xt="fill:none",Mt="fill: #333",Vt="c",Wt="text",Kt="normal",_t="rect",kt="rectWithTitle",Ee="stateStart",xe="stateEnd",wt="divider",Ot="roundedWithTitle",$e="note",De="noteGroup",Q="statediagram",Ce="state",ve=`${Q}-${Ce}`,Ht="transition",Ie="note",Le="note-edge",Ae=`${Ht} ${Le}`,we=`${Q}-${Ie}`,Oe="cluster",Ne=`${Q}-${Oe}`,Be="cluster-alt",Re=`${Q}-${Be}`,Jt="parent",qt="note",Fe="state",Ct="----",Pe=`${Ct}${qt}`,Nt=`${Ct}${Jt}`,Qt=d((e,t=zt)=>{if(!e.doc)return t;let s=t;for(let o of e.doc)o.stmt==="dir"&&(s=o.value);return s},"getDir"),Ye=d(function(e,t){return t.db.getClasses()},"getClasses"),Ge=d(async function(e,t,s,o){k.info("REF0:"),k.info("Drawing state diagram (v2)",t);let{securityLevel:l,state:r,layout:p}=C();o.db.extract(o.db.getRootDocV2());let u=o.db.getData(),h=oe(t,l);u.type=o.type,u.layoutAlgorithm=p,u.nodeSpacing=(r==null?void 0:r.nodeSpacing)||50,u.rankSpacing=(r==null?void 0:r.rankSpacing)||50,u.markers=["barb"],u.diagramId=t,await ce(u,h),he.insertTitle(h,"statediagramTitleText",(r==null?void 0:r.titleTopMargin)??25,o.db.getDiagramTitle()),le(h,8,Q,(r==null?void 0:r.useMaxWidth)??!0)},"draw"),qe={getClasses:Ye,draw:Ge,getDir:Qt},pt=new Map,R=0;function yt(e="",t=0,s="",o=Ct){let l=s!==null&&s.length>0?`${o}${s}`:"";return`${Fe}-${e}${l}-${t}`}d(yt,"stateDomId");var je=d((e,t,s,o,l,r,p,u)=>{k.trace("items",t),t.forEach(h=>{switch(h.stmt){case ut:J(e,h,s,o,l,r,p,u);break;case q:J(e,h,s,o,l,r,p,u);break;case xt:{J(e,h.state1,s,o,l,r,p,u),J(e,h.state2,s,o,l,r,p,u);let m={id:"edge"+R,start:h.state1.id,end:h.state2.id,arrowhead:"normal",arrowTypeEnd:"arrow_barb",style:Xt,labelStyle:"",label:X.sanitizeText(h.description,C()),arrowheadStyle:Mt,labelpos:Vt,labelType:Wt,thickness:Kt,classes:Ht,look:p};l.push(m),R++}break}})},"setupDoc"),Bt=d((e,t=zt)=>{let s=t;if(e.doc)for(let o of e.doc)o.stmt==="dir"&&(s=o.value);return s},"getDir");function H(e,t,s){if(!t.id||t.id==="</join></fork>"||t.id==="</choice>")return;t.cssClasses&&(Array.isArray(t.cssCompiledStyles)||(t.cssCompiledStyles=[]),t.cssClasses.split(" ").forEach(l=>{if(s.get(l)){let r=s.get(l);t.cssCompiledStyles=[...t.cssCompiledStyles,...r.styles]}}));let o=e.find(l=>l.id===t.id);o?Object.assign(o,t):e.push(t)}d(H,"insertOrUpdateNode");function Zt(e){var t;return((t=e==null?void 0:e.classes)==null?void 0:t.join(" "))??""}d(Zt,"getClassesFromDbInfo");function te(e){return(e==null?void 0:e.styles)??[]}d(te,"getStylesFromDbInfo");var J=d((e,t,s,o,l,r,p,u)=>{var F,P;let h=t.id,m=s.get(h),b=Zt(m),v=te(m);if(k.info("dataFetcher parsedItem",t,m,v),h!=="root"){let A=_t;t.start===!0?A=Ee:t.start===!1&&(A=xe),t.type!==q&&(A=t.type),pt.get(h)||pt.set(h,{id:h,shape:A,description:X.sanitizeText(h,C()),cssClasses:`${b} ${ve}`,cssStyles:v});let y=pt.get(h);t.description&&(Array.isArray(y.description)?(y.shape=kt,y.description.push(t.description)):((F=y.description)==null?void 0:F.length)>0?(y.shape=kt,y.description===h?y.description=[t.description]:y.description=[y.description,t.description]):(y.shape=_t,y.description=t.description),y.description=X.sanitizeTextOrArray(y.description,C())),((P=y.description)==null?void 0:P.length)===1&&y.shape===kt&&(y.type==="group"?y.shape=Ot:y.shape=_t),!y.type&&t.doc&&(k.info("Setting cluster for XCX",h,Bt(t)),y.type="group",y.isGroup=!0,y.dir=Bt(t),y.shape=t.type===Ut?wt:Ot,y.cssClasses=`${y.cssClasses} ${Ne} ${r?Re:""}`);let I={labelStyle:"",shape:y.shape,label:y.description,cssClasses:y.cssClasses,cssCompiledStyles:[],cssStyles:y.cssStyles,id:h,dir:y.dir,domId:yt(h,R),type:y.type,isGroup:y.type==="group",padding:8,rx:10,ry:10,look:p};if(I.shape===wt&&(I.label=""),e&&e.id!=="root"&&(k.trace("Setting node ",h," to be child of its parent ",e.id),I.parentId=e.id),I.centerLabel=!0,t.note){let w={labelStyle:"",shape:$e,label:t.note.text,cssClasses:we,cssStyles:[],cssCompilesStyles:[],id:h+Pe+"-"+R,domId:yt(h,R,qt),type:y.type,isGroup:y.type==="group",padding:C().flowchart.padding,look:p,position:t.note.position},Y=h+Nt,G={labelStyle:"",shape:De,label:t.note.text,cssClasses:y.cssClasses,cssStyles:[],id:h+Nt,domId:yt(h,R,Jt),type:"group",isGroup:!0,padding:16,look:p,position:t.note.position};R++,G.id=Y,w.parentId=Y,H(o,G,u),H(o,w,u),H(o,I,u);let N=h,B=w.id;t.note.position==="left of"&&(N=w.id,B=h),l.push({id:N+"-"+B,start:N,end:B,arrowhead:"none",arrowTypeEnd:"",style:Xt,labelStyle:"",classes:Ae,arrowheadStyle:Mt,labelpos:Vt,labelType:Wt,thickness:Kt,look:p})}else H(o,I,u)}t.doc&&(k.trace("Adding nodes children "),je(t,t.doc,s,o,l,!r,p,u))},"dataFetcher"),ze=d(()=>{pt.clear(),R=0},"reset"),$t="[*]",Rt="start",Ft=$t,Pt="end",Yt="color",Gt="fill",Ue="bgFill",Xe=",";function Dt(){return new Map}d(Dt,"newClassesList");var jt=d(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),dt=d(e=>JSON.parse(JSON.stringify(e)),"clone"),M,Qe=(M=class{constructor(t){_(this,"version");_(this,"nodes",[]);_(this,"edges",[]);_(this,"rootDoc",[]);_(this,"classes",Dt());_(this,"documents",{root:jt()});_(this,"currentDocument",this.documents.root);_(this,"startEndCount",0);_(this,"dividerCnt",0);_(this,"getAccTitle",pe);_(this,"setAccTitle",ye);_(this,"getAccDescription",fe);_(this,"setAccDescription",ge);_(this,"setDiagramTitle",me);_(this,"getDiagramTitle",Se);this.clear(),this.version=t,this.setRootDoc=this.setRootDoc.bind(this),this.getDividerId=this.getDividerId.bind(this),this.setDirection=this.setDirection.bind(this),this.trimColon=this.trimColon.bind(this)}setRootDoc(t){k.info("Setting root doc",t),this.rootDoc=t,this.version===1?this.extract(t):this.extract(this.getRootDocV2())}getRootDoc(){return this.rootDoc}docTranslator(t,s,o){if(s.stmt===xt)this.docTranslator(t,s.state1,!0),this.docTranslator(t,s.state2,!1);else if(s.stmt===ut&&(s.id==="[*]"?(s.id=o?t.id+"_start":t.id+"_end",s.start=o):s.id=s.id.trim()),s.doc){let l=[],r=[],p;for(p=0;p<s.doc.length;p++)if(s.doc[p].type===Ut){let u=dt(s.doc[p]);u.doc=dt(r),l.push(u),r=[]}else r.push(s.doc[p]);if(l.length>0&&r.length>0){let u={stmt:ut,id:de(),type:"divider",doc:dt(r)};l.push(dt(u)),s.doc=l}s.doc.forEach(u=>this.docTranslator(s,u,!0))}}getRootDocV2(){return this.docTranslator({id:"root"},{id:"root",doc:this.rootDoc},!0),{id:"root",doc:this.rootDoc}}extract(t){let s;t.doc?s=t.doc:s=t,k.info(s),this.clear(!0),k.info("Extract initial document:",s),s.forEach(r=>{switch(k.warn("Statement",r.stmt),r.stmt){case ut:this.addState(r.id.trim(),r.type,r.doc,r.description,r.note,r.classes,r.styles,r.textStyles);break;case xt:this.addRelation(r.state1,r.state2,r.description);break;case Te:this.addStyleClass(r.id.trim(),r.classes);break;case _e:{let p=r.id.trim().split(","),u=r.styleClass.split(",");p.forEach(h=>{let m=this.getState(h);if(m===void 0){let b=h.trim();this.addState(b),m=this.getState(b)}m.styles=u.map(b=>{var v;return(v=b.replace(/;/g,""))==null?void 0:v.trim()})})}break;case ke:this.setCssClass(r.id.trim(),r.styleClass);break}});let o=this.getStates(),l=C().look;ze(),J(void 0,this.getRootDocV2(),o,this.nodes,this.edges,!0,l,this.classes),this.nodes.forEach(r=>{if(Array.isArray(r.label)){if(r.description=r.label.slice(1),r.isGroup&&r.description.length>0)throw new Error("Group nodes can only have label. Remove the additional description for node ["+r.id+"]");r.label=r.label[0]}})}addState(t,s=q,o=null,l=null,r=null,p=null,u=null,h=null){let m=t==null?void 0:t.trim();if(this.currentDocument.states.has(m)?(this.currentDocument.states.get(m).doc||(this.currentDocument.states.get(m).doc=o),this.currentDocument.states.get(m).type||(this.currentDocument.states.get(m).type=s)):(k.info("Adding state ",m,l),this.currentDocument.states.set(m,{id:m,descriptions:[],type:s,doc:o,note:r,classes:[],styles:[],textStyles:[]})),l&&(k.info("Setting state description",m,l),typeof l=="string"&&this.addDescription(m,l.trim()),typeof l=="object"&&l.forEach(b=>this.addDescription(m,b.trim()))),r){let b=this.currentDocument.states.get(m);b.note=r,b.note.text=X.sanitizeText(b.note.text,C())}p&&(k.info("Setting state classes",m,p),(typeof p=="string"?[p]:p).forEach(b=>this.setCssClass(m,b.trim()))),u&&(k.info("Setting state styles",m,u),(typeof u=="string"?[u]:u).forEach(b=>this.setStyle(m,b.trim()))),h&&(k.info("Setting state styles",m,u),(typeof h=="string"?[h]:h).forEach(b=>this.setTextStyle(m,b.trim())))}clear(t){this.nodes=[],this.edges=[],this.documents={root:jt()},this.currentDocument=this.documents.root,this.startEndCount=0,this.classes=Dt(),t||ue()}getState(t){return this.currentDocument.states.get(t)}getStates(){return this.currentDocument.states}logDocuments(){k.info("Documents = ",this.documents)}getRelations(){return this.currentDocument.relations}startIdIfNeeded(t=""){let s=t;return t===$t&&(this.startEndCount++,s=`${Rt}${this.startEndCount}`),s}startTypeIfNeeded(t="",s=q){return t===$t?Rt:s}endIdIfNeeded(t=""){let s=t;return t===Ft&&(this.startEndCount++,s=`${Pt}${this.startEndCount}`),s}endTypeIfNeeded(t="",s=q){return t===Ft?Pt:s}addRelationObjs(t,s,o){let l=this.startIdIfNeeded(t.id.trim()),r=this.startTypeIfNeeded(t.id.trim(),t.type),p=this.startIdIfNeeded(s.id.trim()),u=this.startTypeIfNeeded(s.id.trim(),s.type);this.addState(l,r,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),this.addState(p,u,s.doc,s.description,s.note,s.classes,s.styles,s.textStyles),this.currentDocument.relations.push({id1:l,id2:p,relationTitle:X.sanitizeText(o,C())})}addRelation(t,s,o){if(typeof t=="object")this.addRelationObjs(t,s,o);else{let l=this.startIdIfNeeded(t.trim()),r=this.startTypeIfNeeded(t),p=this.endIdIfNeeded(s.trim()),u=this.endTypeIfNeeded(s);this.addState(l,r),this.addState(p,u),this.currentDocument.relations.push({id1:l,id2:p,title:X.sanitizeText(o,C())})}}addDescription(t,s){let o=this.currentDocument.states.get(t),l=s.startsWith(":")?s.replace(":","").trim():s;o.descriptions.push(X.sanitizeText(l,C()))}cleanupLabel(t){return t.substring(0,1)===":"?t.substr(2).trim():t.trim()}getDividerId(){return this.dividerCnt++,"divider-id-"+this.dividerCnt}addStyleClass(t,s=""){this.classes.has(t)||this.classes.set(t,{id:t,styles:[],textStyles:[]});let o=this.classes.get(t);s==null||s.split(Xe).forEach(l=>{let r=l.replace(/([^;]*);/,"$1").trim();if(RegExp(Yt).exec(l)){let p=r.replace(Gt,Ue).replace(Yt,Gt);o.textStyles.push(p)}o.styles.push(r)})}getClasses(){return this.classes}setCssClass(t,s){t.split(",").forEach(o=>{let l=this.getState(o);if(l===void 0){let r=o.trim();this.addState(r),l=this.getState(r)}l.classes.push(s)})}setStyle(t,s){let o=this.getState(t);o!==void 0&&o.styles.push(s)}setTextStyle(t,s){let o=this.getState(t);o!==void 0&&o.textStyles.push(s)}getDirectionStatement(){return this.rootDoc.find(t=>t.stmt===At)}getDirection(){var t;return((t=this.getDirectionStatement())==null?void 0:t.value)??be}setDirection(t){let s=this.getDirectionStatement();s?s.value=t:this.rootDoc.unshift({stmt:At,value:t})}trimColon(t){return t&&t[0]===":"?t.substr(1).trim():t.trim()}getData(){let t=C();return{nodes:this.nodes,edges:this.edges,other:{},config:t,direction:Qt(this.getRootDocV2())}}getConfig(){return C().state}},d(M,"StateDB"),_(M,"relationType",{AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3}),M),Me=d(e=>`
defs #statediagram-barbEnd {
    fill: ${e.transitionColor};
    stroke: ${e.transitionColor};
  }
g.stateGroup text {
  fill: ${e.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${e.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${e.stateLabelColor};
}

g.stateGroup rect {
  fill: ${e.mainBkg};
  stroke: ${e.nodeBorder};
}

g.stateGroup line {
  stroke: ${e.lineColor};
  stroke-width: 1;
}

.transition {
  stroke: ${e.transitionColor};
  stroke-width: 1;
  fill: none;
}

.stateGroup .composit {
  fill: ${e.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${e.noteBorderColor};
  fill: ${e.noteBkgColor};

  text {
    fill: ${e.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${e.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${e.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${e.edgeLabelBackground};
  p {
    background-color: ${e.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${e.edgeLabelBackground};
    fill: ${e.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${e.transitionLabelColor||e.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${e.transitionLabelColor||e.tertiaryTextColor};
}

.stateLabel text {
  fill: ${e.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${e.specialStateColor};
  stroke: ${e.specialStateColor};
}

.node .fork-join {
  fill: ${e.specialStateColor};
  stroke: ${e.specialStateColor};
}

.node circle.state-end {
  fill: ${e.innerEndBackground};
  stroke: ${e.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${e.compositeBackground||e.background};
  // stroke: ${e.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${e.stateBkg||e.mainBkg};
  stroke: ${e.stateBorder||e.nodeBorder};
  stroke-width: 1px;
}
.node polygon {
  fill: ${e.mainBkg};
  stroke: ${e.stateBorder||e.nodeBorder};;
  stroke-width: 1px;
}
#statediagram-barbEnd {
  fill: ${e.lineColor};
}

.statediagram-cluster rect {
  fill: ${e.compositeTitleBackground};
  stroke: ${e.stateBorder||e.nodeBorder};
  stroke-width: 1px;
}

.cluster-label, .nodeLabel {
  color: ${e.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${e.stateBorder||e.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${e.compositeBackground||e.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${e.altBackground?e.altBackground:"#efefef"};
}

.statediagram-cluster .inner {
  rx:0;
  ry:0;
}

.statediagram-state rect.basic {
  rx: 5px;
  ry: 5px;
}
.statediagram-state rect.divider {
  stroke-dasharray: 10,10;
  fill: ${e.altBackground?e.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${e.noteBkgColor};
  stroke: ${e.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${e.noteBkgColor};
  stroke: ${e.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${e.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${e.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${e.noteTextColor};
}

#dependencyStart, #dependencyEnd {
  fill: ${e.lineColor};
  stroke: ${e.lineColor};
  stroke-width: 1;
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${e.textColor};
}
`,"getStyles"),Ze=Me;export{Je as j,Ze as m,qe as s,Qe as x};
