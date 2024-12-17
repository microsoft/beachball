import{w as De,$ as Ce}from"./chunk-4YMK7POB-DzcSq9nc.js";import{m as i,J as b,Q as D,S as Le,I as ve,d as H,b4 as Ie,v as Ae,B as we,w as Oe,M as Re,F as Ne,L as Be,A as Fe}from"./mermaid.esm.min-D97nAXxK.js";var wt=function(){var t=i(function(L,a,n,y){for(n=n||{},y=L.length;y--;n[L[y]]=a);return n},"o"),e=[1,2],c=[1,3],o=[1,4],r=[2,4],h=[1,9],p=[1,11],f=[1,16],l=[1,17],S=[1,18],v=[1,19],O=[1,32],P=[1,20],Y=[1,21],I=[1,22],d=[1,23],C=[1,24],A=[1,26],G=[1,27],j=[1,28],R=[1,29],N=[1,30],st=[1,31],it=[1,34],rt=[1,35],at=[1,36],nt=[1,37],Q=[1,33],g=[1,4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],ot=[1,4,5,14,15,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],jt=[4,5,16,17,19,21,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],xt={trace:i(function(){},"trace"),yy:{},symbols_:{error:2,start:3,SPACE:4,NL:5,SD:6,document:7,line:8,statement:9,classDefStatement:10,styleStatement:11,cssClassStatement:12,idStatement:13,DESCR:14,"-->":15,HIDE_EMPTY:16,scale:17,WIDTH:18,COMPOSIT_STATE:19,STRUCT_START:20,STRUCT_STOP:21,STATE_DESCR:22,AS:23,ID:24,FORK:25,JOIN:26,CHOICE:27,CONCURRENT:28,note:29,notePosition:30,NOTE_TEXT:31,direction:32,acc_title:33,acc_title_value:34,acc_descr:35,acc_descr_value:36,acc_descr_multiline_value:37,classDef:38,CLASSDEF_ID:39,CLASSDEF_STYLEOPTS:40,DEFAULT:41,style:42,STYLE_IDS:43,STYLEDEF_STYLEOPTS:44,class:45,CLASSENTITY_IDS:46,STYLECLASS:47,direction_tb:48,direction_bt:49,direction_rl:50,direction_lr:51,eol:52,";":53,EDGE_STATE:54,STYLE_SEPARATOR:55,left_of:56,right_of:57,$accept:0,$end:1},terminals_:{2:"error",4:"SPACE",5:"NL",6:"SD",14:"DESCR",15:"-->",16:"HIDE_EMPTY",17:"scale",18:"WIDTH",19:"COMPOSIT_STATE",20:"STRUCT_START",21:"STRUCT_STOP",22:"STATE_DESCR",23:"AS",24:"ID",25:"FORK",26:"JOIN",27:"CHOICE",28:"CONCURRENT",29:"note",31:"NOTE_TEXT",33:"acc_title",34:"acc_title_value",35:"acc_descr",36:"acc_descr_value",37:"acc_descr_multiline_value",38:"classDef",39:"CLASSDEF_ID",40:"CLASSDEF_STYLEOPTS",41:"DEFAULT",42:"style",43:"STYLE_IDS",44:"STYLEDEF_STYLEOPTS",45:"class",46:"CLASSENTITY_IDS",47:"STYLECLASS",48:"direction_tb",49:"direction_bt",50:"direction_rl",51:"direction_lr",53:";",54:"EDGE_STATE",55:"STYLE_SEPARATOR",56:"left_of",57:"right_of"},productions_:[0,[3,2],[3,2],[3,2],[7,0],[7,2],[8,2],[8,1],[8,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,3],[9,4],[9,1],[9,2],[9,1],[9,4],[9,3],[9,6],[9,1],[9,1],[9,1],[9,1],[9,4],[9,4],[9,1],[9,2],[9,2],[9,1],[10,3],[10,3],[11,3],[12,3],[32,1],[32,1],[32,1],[32,1],[52,1],[52,1],[13,1],[13,1],[13,3],[13,3],[30,1],[30,1]],performAction:i(function(L,a,n,y,m,s,T){var u=s.length-1;switch(m){case 3:return y.setRootDoc(s[u]),s[u];case 4:this.$=[];break;case 5:s[u]!="nl"&&(s[u-1].push(s[u]),this.$=s[u-1]);break;case 6:case 7:this.$=s[u];break;case 8:this.$="nl";break;case 12:this.$=s[u];break;case 13:let ht=s[u-1];ht.description=y.trimColon(s[u]),this.$=ht;break;case 14:this.$={stmt:"relation",state1:s[u-2],state2:s[u]};break;case 15:let ut=y.trimColon(s[u]);this.$={stmt:"relation",state1:s[u-3],state2:s[u-1],description:ut};break;case 19:this.$={stmt:"state",id:s[u-3],type:"default",description:"",doc:s[u-1]};break;case 20:var z=s[u],U=s[u-2].trim();if(s[u].match(":")){var ct=s[u].split(":");z=ct[0],U=[U,ct[1]]}this.$={stmt:"state",id:z,type:"default",description:U};break;case 21:this.$={stmt:"state",id:s[u-3],type:"default",description:s[u-5],doc:s[u-1]};break;case 22:this.$={stmt:"state",id:s[u],type:"fork"};break;case 23:this.$={stmt:"state",id:s[u],type:"join"};break;case 24:this.$={stmt:"state",id:s[u],type:"choice"};break;case 25:this.$={stmt:"state",id:y.getDividerId(),type:"divider"};break;case 26:this.$={stmt:"state",id:s[u-1].trim(),note:{position:s[u-2].trim(),text:s[u].trim()}};break;case 29:this.$=s[u].trim(),y.setAccTitle(this.$);break;case 30:case 31:this.$=s[u].trim(),y.setAccDescription(this.$);break;case 32:case 33:this.$={stmt:"classDef",id:s[u-1].trim(),classes:s[u].trim()};break;case 34:this.$={stmt:"style",id:s[u-1].trim(),styleClass:s[u].trim()};break;case 35:this.$={stmt:"applyClass",id:s[u-1].trim(),styleClass:s[u].trim()};break;case 36:y.setDirection("TB"),this.$={stmt:"dir",value:"TB"};break;case 37:y.setDirection("BT"),this.$={stmt:"dir",value:"BT"};break;case 38:y.setDirection("RL"),this.$={stmt:"dir",value:"RL"};break;case 39:y.setDirection("LR"),this.$={stmt:"dir",value:"LR"};break;case 42:case 43:this.$={stmt:"state",id:s[u].trim(),type:"default",description:""};break;case 44:this.$={stmt:"state",id:s[u-2].trim(),classes:[s[u].trim()],type:"default",description:""};break;case 45:this.$={stmt:"state",id:s[u-2].trim(),classes:[s[u].trim()],type:"default",description:""};break}},"anonymous"),table:[{3:1,4:e,5:c,6:o},{1:[3]},{3:5,4:e,5:c,6:o},{3:6,4:e,5:c,6:o},t([1,4,5,16,17,19,22,24,25,26,27,28,29,33,35,37,38,42,45,48,49,50,51,54],r,{7:7}),{1:[2,1]},{1:[2,2]},{1:[2,3],4:h,5:p,8:8,9:10,10:12,11:13,12:14,13:15,16:f,17:l,19:S,22:v,24:O,25:P,26:Y,27:I,28:d,29:C,32:25,33:A,35:G,37:j,38:R,42:N,45:st,48:it,49:rt,50:at,51:nt,54:Q},t(g,[2,5]),{9:38,10:12,11:13,12:14,13:15,16:f,17:l,19:S,22:v,24:O,25:P,26:Y,27:I,28:d,29:C,32:25,33:A,35:G,37:j,38:R,42:N,45:st,48:it,49:rt,50:at,51:nt,54:Q},t(g,[2,7]),t(g,[2,8]),t(g,[2,9]),t(g,[2,10]),t(g,[2,11]),t(g,[2,12],{14:[1,39],15:[1,40]}),t(g,[2,16]),{18:[1,41]},t(g,[2,18],{20:[1,42]}),{23:[1,43]},t(g,[2,22]),t(g,[2,23]),t(g,[2,24]),t(g,[2,25]),{30:44,31:[1,45],56:[1,46],57:[1,47]},t(g,[2,28]),{34:[1,48]},{36:[1,49]},t(g,[2,31]),{39:[1,50],41:[1,51]},{43:[1,52]},{46:[1,53]},t(ot,[2,42],{55:[1,54]}),t(ot,[2,43],{55:[1,55]}),t(g,[2,36]),t(g,[2,37]),t(g,[2,38]),t(g,[2,39]),t(g,[2,6]),t(g,[2,13]),{13:56,24:O,54:Q},t(g,[2,17]),t(jt,r,{7:57}),{24:[1,58]},{24:[1,59]},{23:[1,60]},{24:[2,46]},{24:[2,47]},t(g,[2,29]),t(g,[2,30]),{40:[1,61]},{40:[1,62]},{44:[1,63]},{47:[1,64]},{24:[1,65]},{24:[1,66]},t(g,[2,14],{14:[1,67]}),{4:h,5:p,8:8,9:10,10:12,11:13,12:14,13:15,16:f,17:l,19:S,21:[1,68],22:v,24:O,25:P,26:Y,27:I,28:d,29:C,32:25,33:A,35:G,37:j,38:R,42:N,45:st,48:it,49:rt,50:at,51:nt,54:Q},t(g,[2,20],{20:[1,69]}),{31:[1,70]},{24:[1,71]},t(g,[2,32]),t(g,[2,33]),t(g,[2,34]),t(g,[2,35]),t(ot,[2,44]),t(ot,[2,45]),t(g,[2,15]),t(g,[2,19]),t(jt,r,{7:72}),t(g,[2,26]),t(g,[2,27]),{4:h,5:p,8:8,9:10,10:12,11:13,12:14,13:15,16:f,17:l,19:S,21:[1,73],22:v,24:O,25:P,26:Y,27:I,28:d,29:C,32:25,33:A,35:G,37:j,38:R,42:N,45:st,48:it,49:rt,50:at,51:nt,54:Q},t(g,[2,21])],defaultActions:{5:[2,1],6:[2,2],46:[2,46],47:[2,47]},parseError:i(function(L,a){if(a.recoverable)this.trace(L);else{var n=new Error(L);throw n.hash=a,n}},"parseError"),parse:i(function(L){var a=this,n=[0],y=[],m=[null],s=[],T=this.table,u="",z=0,U=0,ct=0,ht=2,ut=1,Ee=s.slice.call(arguments,1),_=Object.create(this.lexer),M={yy:{}};for(var $t in this.yy)Object.prototype.hasOwnProperty.call(this.yy,$t)&&(M.yy[$t]=this.yy[$t]);_.setInput(L,M.yy),M.yy.lexer=_,M.yy.parser=this,typeof _.yylloc>"u"&&(_.yylloc={});var Dt=_.yylloc;s.push(Dt);var xe=_.options&&_.options.ranges;typeof M.yy.parseError=="function"?this.parseError=M.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function $e(x){n.length=n.length-2*x,m.length=m.length-x,s.length=s.length-x}i($e,"popStack");function zt(){var x;return x=y.pop()||_.lex()||ut,typeof x!="number"&&(x instanceof Array&&(y=x,x=y.pop()),x=a.symbols_[x]||x),x}i(zt,"lex");for(var k,Ct,X,$,Cs,Lt,V={},dt,w,Mt,pt;;){if(X=n[n.length-1],this.defaultActions[X]?$=this.defaultActions[X]:((k===null||typeof k>"u")&&(k=zt()),$=T[X]&&T[X][k]),typeof $>"u"||!$.length||!$[0]){var vt="";pt=[];for(dt in T[X])this.terminals_[dt]&&dt>ht&&pt.push("'"+this.terminals_[dt]+"'");_.showPosition?vt="Parse error on line "+(z+1)+`:
`+_.showPosition()+`
Expecting `+pt.join(", ")+", got '"+(this.terminals_[k]||k)+"'":vt="Parse error on line "+(z+1)+": Unexpected "+(k==ut?"end of input":"'"+(this.terminals_[k]||k)+"'"),this.parseError(vt,{text:_.match,token:this.terminals_[k]||k,line:_.yylineno,loc:Dt,expected:pt})}if($[0]instanceof Array&&$.length>1)throw new Error("Parse Error: multiple actions possible at state: "+X+", token: "+k);switch($[0]){case 1:n.push(k),m.push(_.yytext),s.push(_.yylloc),n.push($[1]),k=null,Ct?(k=Ct,Ct=null):(U=_.yyleng,u=_.yytext,z=_.yylineno,Dt=_.yylloc,ct>0);break;case 2:if(w=this.productions_[$[1]][1],V.$=m[m.length-w],V._$={first_line:s[s.length-(w||1)].first_line,last_line:s[s.length-1].last_line,first_column:s[s.length-(w||1)].first_column,last_column:s[s.length-1].last_column},xe&&(V._$.range=[s[s.length-(w||1)].range[0],s[s.length-1].range[1]]),Lt=this.performAction.apply(V,[u,U,z,M.yy,$[1],m,s].concat(Ee)),typeof Lt<"u")return Lt;w&&(n=n.slice(0,-1*w*2),m=m.slice(0,-1*w),s=s.slice(0,-1*w)),n.push(this.productions_[$[1]][0]),m.push(V.$),s.push(V._$),Mt=T[n[n.length-2]][n[n.length-1]],n.push(Mt);break;case 3:return!0}}return!0},"parse")},Te=function(){var L={EOF:1,parseError:i(function(a,n){if(this.yy.parser)this.yy.parser.parseError(a,n);else throw new Error(a)},"parseError"),setInput:i(function(a,n){return this.yy=n||this.yy||{},this._input=a,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:i(function(){var a=this._input[0];this.yytext+=a,this.yyleng++,this.offset++,this.match+=a,this.matched+=a;var n=a.match(/(?:\r\n?|\n).*/g);return n?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),a},"input"),unput:i(function(a){var n=a.length,y=a.split(/(?:\r\n?|\n)/g);this._input=a+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-n),this.offset-=n;var m=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),y.length-1&&(this.yylineno-=y.length-1);var s=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:y?(y.length===m.length?this.yylloc.first_column:0)+m[m.length-y.length].length-y[0].length:this.yylloc.first_column-n},this.options.ranges&&(this.yylloc.range=[s[0],s[0]+this.yyleng-n]),this.yyleng=this.yytext.length,this},"unput"),more:i(function(){return this._more=!0,this},"more"),reject:i(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:i(function(a){this.unput(this.match.slice(a))},"less"),pastInput:i(function(){var a=this.matched.substr(0,this.matched.length-this.match.length);return(a.length>20?"...":"")+a.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:i(function(){var a=this.match;return a.length<20&&(a+=this._input.substr(0,20-a.length)),(a.substr(0,20)+(a.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:i(function(){var a=this.pastInput(),n=new Array(a.length+1).join("-");return a+this.upcomingInput()+`
`+n+"^"},"showPosition"),test_match:i(function(a,n){var y,m,s;if(this.options.backtrack_lexer&&(s={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(s.yylloc.range=this.yylloc.range.slice(0))),m=a[0].match(/(?:\r\n?|\n).*/g),m&&(this.yylineno+=m.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:m?m[m.length-1].length-m[m.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+a[0].length},this.yytext+=a[0],this.match+=a[0],this.matches=a,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(a[0].length),this.matched+=a[0],y=this.performAction.call(this,this.yy,this,n,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),y)return y;if(this._backtrack){for(var T in s)this[T]=s[T];return!1}return!1},"test_match"),next:i(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var a,n,y,m;this._more||(this.yytext="",this.match="");for(var s=this._currentRules(),T=0;T<s.length;T++)if(y=this._input.match(this.rules[s[T]]),y&&(!n||y[0].length>n[0].length)){if(n=y,m=T,this.options.backtrack_lexer){if(a=this.test_match(y,s[T]),a!==!1)return a;if(this._backtrack){n=!1;continue}else return!1}else if(!this.options.flex)break}return n?(a=this.test_match(n,s[m]),a!==!1?a:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:i(function(){var a=this.next();return a||this.lex()},"lex"),begin:i(function(a){this.conditionStack.push(a)},"begin"),popState:i(function(){var a=this.conditionStack.length-1;return a>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:i(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:i(function(a){return a=this.conditionStack.length-1-Math.abs(a||0),a>=0?this.conditionStack[a]:"INITIAL"},"topState"),pushState:i(function(a){this.begin(a)},"pushState"),stateStackSize:i(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:i(function(a,n,y,m){switch(y){case 0:return 41;case 1:return 48;case 2:return 49;case 3:return 50;case 4:return 51;case 5:break;case 6:break;case 7:return 5;case 8:break;case 9:break;case 10:break;case 11:break;case 12:return this.pushState("SCALE"),17;case 13:return 18;case 14:this.popState();break;case 15:return this.begin("acc_title"),33;case 16:return this.popState(),"acc_title_value";case 17:return this.begin("acc_descr"),35;case 18:return this.popState(),"acc_descr_value";case 19:this.begin("acc_descr_multiline");break;case 20:this.popState();break;case 21:return"acc_descr_multiline_value";case 22:return this.pushState("CLASSDEF"),38;case 23:return this.popState(),this.pushState("CLASSDEFID"),"DEFAULT_CLASSDEF_ID";case 24:return this.popState(),this.pushState("CLASSDEFID"),39;case 25:return this.popState(),40;case 26:return this.pushState("CLASS"),45;case 27:return this.popState(),this.pushState("CLASS_STYLE"),46;case 28:return this.popState(),47;case 29:return this.pushState("STYLE"),42;case 30:return this.popState(),this.pushState("STYLEDEF_STYLES"),43;case 31:return this.popState(),44;case 32:return this.pushState("SCALE"),17;case 33:return 18;case 34:this.popState();break;case 35:this.pushState("STATE");break;case 36:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),25;case 37:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),26;case 38:return this.popState(),n.yytext=n.yytext.slice(0,-10).trim(),27;case 39:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),25;case 40:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),26;case 41:return this.popState(),n.yytext=n.yytext.slice(0,-10).trim(),27;case 42:return 48;case 43:return 49;case 44:return 50;case 45:return 51;case 46:this.pushState("STATE_STRING");break;case 47:return this.pushState("STATE_ID"),"AS";case 48:return this.popState(),"ID";case 49:this.popState();break;case 50:return"STATE_DESCR";case 51:return 19;case 52:this.popState();break;case 53:return this.popState(),this.pushState("struct"),20;case 54:break;case 55:return this.popState(),21;case 56:break;case 57:return this.begin("NOTE"),29;case 58:return this.popState(),this.pushState("NOTE_ID"),56;case 59:return this.popState(),this.pushState("NOTE_ID"),57;case 60:this.popState(),this.pushState("FLOATING_NOTE");break;case 61:return this.popState(),this.pushState("FLOATING_NOTE_ID"),"AS";case 62:break;case 63:return"NOTE_TEXT";case 64:return this.popState(),"ID";case 65:return this.popState(),this.pushState("NOTE_TEXT"),24;case 66:return this.popState(),n.yytext=n.yytext.substr(2).trim(),31;case 67:return this.popState(),n.yytext=n.yytext.slice(0,-8).trim(),31;case 68:return 6;case 69:return 6;case 70:return 16;case 71:return 54;case 72:return 24;case 73:return n.yytext=n.yytext.trim(),14;case 74:return 15;case 75:return 28;case 76:return 55;case 77:return 5;case 78:return"INVALID"}},"anonymous"),rules:[/^(?:default\b)/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:[^\}]%%[^\n]*)/i,/^(?:[\n]+)/i,/^(?:[\s]+)/i,/^(?:((?!\n)\s)+)/i,/^(?:#[^\n]*)/i,/^(?:%[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:classDef\s+)/i,/^(?:DEFAULT\s+)/i,/^(?:\w+\s+)/i,/^(?:[^\n]*)/i,/^(?:class\s+)/i,/^(?:(\w+)+((,\s*\w+)*))/i,/^(?:[^\n]*)/i,/^(?:style\s+)/i,/^(?:[\w,]+\s+)/i,/^(?:[^\n]*)/i,/^(?:scale\s+)/i,/^(?:\d+)/i,/^(?:\s+width\b)/i,/^(?:state\s+)/i,/^(?:.*<<fork>>)/i,/^(?:.*<<join>>)/i,/^(?:.*<<choice>>)/i,/^(?:.*\[\[fork\]\])/i,/^(?:.*\[\[join\]\])/i,/^(?:.*\[\[choice\]\])/i,/^(?:.*direction\s+TB[^\n]*)/i,/^(?:.*direction\s+BT[^\n]*)/i,/^(?:.*direction\s+RL[^\n]*)/i,/^(?:.*direction\s+LR[^\n]*)/i,/^(?:["])/i,/^(?:\s*as\s+)/i,/^(?:[^\n\{]*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n\s\{]+)/i,/^(?:\n)/i,/^(?:\{)/i,/^(?:%%(?!\{)[^\n]*)/i,/^(?:\})/i,/^(?:[\n])/i,/^(?:note\s+)/i,/^(?:left of\b)/i,/^(?:right of\b)/i,/^(?:")/i,/^(?:\s*as\s*)/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:[^\n]*)/i,/^(?:\s*[^:\n\s\-]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:[\s\S]*?end note\b)/i,/^(?:stateDiagram\s+)/i,/^(?:stateDiagram-v2\s+)/i,/^(?:hide empty description\b)/i,/^(?:\[\*\])/i,/^(?:[^:\n\s\-\{]+)/i,/^(?:\s*:[^:\n;]+)/i,/^(?:-->)/i,/^(?:--)/i,/^(?::::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{LINE:{rules:[9,10],inclusive:!1},struct:{rules:[9,10,22,26,29,35,42,43,44,45,54,55,56,57,71,72,73,74,75],inclusive:!1},FLOATING_NOTE_ID:{rules:[64],inclusive:!1},FLOATING_NOTE:{rules:[61,62,63],inclusive:!1},NOTE_TEXT:{rules:[66,67],inclusive:!1},NOTE_ID:{rules:[65],inclusive:!1},NOTE:{rules:[58,59,60],inclusive:!1},STYLEDEF_STYLEOPTS:{rules:[],inclusive:!1},STYLEDEF_STYLES:{rules:[31],inclusive:!1},STYLE_IDS:{rules:[],inclusive:!1},STYLE:{rules:[30],inclusive:!1},CLASS_STYLE:{rules:[28],inclusive:!1},CLASS:{rules:[27],inclusive:!1},CLASSDEFID:{rules:[25],inclusive:!1},CLASSDEF:{rules:[23,24],inclusive:!1},acc_descr_multiline:{rules:[20,21],inclusive:!1},acc_descr:{rules:[18],inclusive:!1},acc_title:{rules:[16],inclusive:!1},SCALE:{rules:[13,14,33,34],inclusive:!1},ALIAS:{rules:[],inclusive:!1},STATE_ID:{rules:[48],inclusive:!1},STATE_STRING:{rules:[49,50],inclusive:!1},FORK_STATE:{rules:[],inclusive:!1},STATE:{rules:[9,10,36,37,38,39,40,41,46,47,51,52,53],inclusive:!1},ID:{rules:[9,10],inclusive:!1},INITIAL:{rules:[0,1,2,3,4,5,6,7,8,10,11,12,15,17,19,22,26,29,32,35,53,57,68,69,70,71,72,73,74,76,77,78],inclusive:!0}}};return L}();xt.lexer=Te;function lt(){this.yy={}}return i(lt,"Parser"),lt.prototype=xt,xt.Parser=lt,new lt}();wt.parser=wt;var Is=wt,Pe="LR",Zt="TB",mt="state",Rt="relation",Ye="classDef",Ge="style",je="applyClass",tt="default",qt="divider",Wt="fill:none",te="fill: #333",ee="c",se="text",ie="normal",It="rect",At="rectWithTitle",ze="stateStart",Me="stateEnd",Xt="divider",Ht="roundedWithTitle",Xe="note",He="noteGroup",et="statediagram",Je="state",Ue=`${et}-${Je}`,re="transition",Ve="note",Ke="note-edge",Qe=`${re} ${Ke}`,Ze=`${et}-${Ve}`,qe="cluster",We=`${et}-${qe}`,ts="cluster-alt",es=`${et}-${ts}`,ae="parent",ne="note",ss="state",Nt="----",is=`${Nt}${ne}`,Jt=`${Nt}${ae}`,oe=i((t,e=Zt)=>{if(!t.doc)return e;let c=e;for(let o of t.doc)o.stmt==="dir"&&(c=o.value);return c},"getDir"),rs=i(function(t,e){return e.db.extract(e.db.getRootDocV2()),e.db.getClasses()},"getClasses"),as=i(async function(t,e,c,o){b.info("REF0:"),b.info("Drawing state diagram (v2)",e);let{securityLevel:r,state:h,layout:p}=D();o.db.extract(o.db.getRootDocV2());let f=o.db.getData(),l=De(e,r);f.type=o.type,f.layoutAlgorithm=p,f.nodeSpacing=(h==null?void 0:h.nodeSpacing)||50,f.rankSpacing=(h==null?void 0:h.rankSpacing)||50,f.markers=["barb"],f.diagramId=e,await Le(f,l),ve.insertTitle(l,"statediagramTitleText",(h==null?void 0:h.titleTopMargin)??25,o.db.getDiagramTitle()),Ce(l,8,et,(h==null?void 0:h.useMaxWidth)??!0)},"draw"),As={getClasses:rs,draw:as,getDir:oe},gt=new Map,B=0;function ft(t="",e=0,c="",o=Nt){let r=c!==null&&c.length>0?`${o}${c}`:"";return`${ss}-${t}${r}-${e}`}i(ft,"stateDomId");var ns=i((t,e,c,o,r,h,p,f)=>{b.trace("items",e),e.forEach(l=>{switch(l.stmt){case mt:q(t,l,c,o,r,h,p,f);break;case tt:q(t,l,c,o,r,h,p,f);break;case Rt:{q(t,l.state1,c,o,r,h,p,f),q(t,l.state2,c,o,r,h,p,f);let S={id:"edge"+B,start:l.state1.id,end:l.state2.id,arrowhead:"normal",arrowTypeEnd:"arrow_barb",style:Wt,labelStyle:"",label:H.sanitizeText(l.description,D()),arrowheadStyle:te,labelpos:ee,labelType:se,thickness:ie,classes:re,look:p};r.push(S),B++}break}})},"setupDoc"),Ut=i((t,e=Zt)=>{let c=e;if(t.doc)for(let o of t.doc)o.stmt==="dir"&&(c=o.value);return c},"getDir");function Z(t,e,c){if(!e.id||e.id==="</join></fork>"||e.id==="</choice>")return;e.cssClasses&&(Array.isArray(e.cssCompiledStyles)||(e.cssCompiledStyles=[]),e.cssClasses.split(" ").forEach(r=>{if(c.get(r)){let h=c.get(r);e.cssCompiledStyles=[...e.cssCompiledStyles,...h.styles]}}));let o=t.find(r=>r.id===e.id);o?Object.assign(o,e):t.push(e)}i(Z,"insertOrUpdateNode");function le(t){var e;return((e=t==null?void 0:t.classes)==null?void 0:e.join(" "))??""}i(le,"getClassesFromDbInfo");function ce(t){return(t==null?void 0:t.styles)??[]}i(ce,"getStylesFromDbInfo");var q=i((t,e,c,o,r,h,p,f)=>{var P,Y;let l=e.id,S=c.get(l),v=le(S),O=ce(S);if(b.info("dataFetcher parsedItem",e,S,O),l!=="root"){let I=It;e.start===!0?I=ze:e.start===!1&&(I=Me),e.type!==tt&&(I=e.type),gt.get(l)||gt.set(l,{id:l,shape:I,description:H.sanitizeText(l,D()),cssClasses:`${v} ${Ue}`,cssStyles:O});let d=gt.get(l);e.description&&(Array.isArray(d.description)?(d.shape=At,d.description.push(e.description)):((P=d.description)==null?void 0:P.length)>0?(d.shape=At,d.description===l?d.description=[e.description]:d.description=[d.description,e.description]):(d.shape=It,d.description=e.description),d.description=H.sanitizeTextOrArray(d.description,D())),((Y=d.description)==null?void 0:Y.length)===1&&d.shape===At&&(d.type==="group"?d.shape=Ht:d.shape=It),!d.type&&e.doc&&(b.info("Setting cluster for XCX",l,Ut(e)),d.type="group",d.isGroup=!0,d.dir=Ut(e),d.shape=e.type===qt?Xt:Ht,d.cssClasses=`${d.cssClasses} ${We} ${h?es:""}`);let C={labelStyle:"",shape:d.shape,label:d.description,cssClasses:d.cssClasses,cssCompiledStyles:[],cssStyles:d.cssStyles,id:l,dir:d.dir,domId:ft(l,B),type:d.type,isGroup:d.type==="group",padding:8,rx:10,ry:10,look:p};if(C.shape===Xt&&(C.label=""),t&&t.id!=="root"&&(b.trace("Setting node ",l," to be child of its parent ",t.id),C.parentId=t.id),C.centerLabel=!0,e.note){let A={labelStyle:"",shape:Xe,label:e.note.text,cssClasses:Ze,cssStyles:[],cssCompilesStyles:[],id:l+is+"-"+B,domId:ft(l,B,ne),type:d.type,isGroup:d.type==="group",padding:D().flowchart.padding,look:p,position:e.note.position},G=l+Jt,j={labelStyle:"",shape:He,label:e.note.text,cssClasses:d.cssClasses,cssStyles:[],id:l+Jt,domId:ft(l,B,ae),type:"group",isGroup:!0,padding:16,look:p,position:e.note.position};B++,j.id=G,A.parentId=G,Z(o,j,f),Z(o,A,f),Z(o,C,f);let R=l,N=A.id;e.note.position==="left of"&&(R=A.id,N=l),r.push({id:R+"-"+N,start:R,end:N,arrowhead:"none",arrowTypeEnd:"",style:Wt,labelStyle:"",classes:Qe,arrowheadStyle:te,labelpos:ee,labelType:se,thickness:ie,look:p})}else Z(o,C,f)}e.doc&&(b.trace("Adding nodes children "),ns(e,e.doc,c,o,r,!h,p,f))},"dataFetcher"),os=i(()=>{gt.clear(),B=0},"reset"),Bt="[*]",he="start",ue=Bt,de="end",Vt="color",Kt="fill",ls="bgFill",cs=",";function Ft(){return new Map}i(Ft,"newClassesList");var _t=[],Pt=[],pe=Pe,bt=[],K=Ft(),ye=i(()=>({relations:[],states:new Map,documents:{}}),"newDoc"),kt={root:ye()},E=kt.root,W=0,Qt=0,hs={LINE:0,DOTTED_LINE:1},us={AGGREGATION:0,EXTENSION:1,COMPOSITION:2,DEPENDENCY:3},yt=i(t=>JSON.parse(JSON.stringify(t)),"clone"),ds=i(t=>{b.info("Setting root doc",t),bt=t},"setRootDoc"),ps=i(()=>bt,"getRootDoc"),St=i((t,e,c)=>{if(e.stmt===Rt)St(t,e.state1,!0),St(t,e.state2,!1);else if(e.stmt===mt&&(e.id==="[*]"?(e.id=c?t.id+"_start":t.id+"_end",e.start=c):e.id=e.id.trim()),e.doc){let o=[],r=[],h;for(h=0;h<e.doc.length;h++)if(e.doc[h].type===qt){let p=yt(e.doc[h]);p.doc=yt(r),o.push(p),r=[]}else r.push(e.doc[h]);if(o.length>0&&r.length>0){let p={stmt:mt,id:Ie(),type:"divider",doc:yt(r)};o.push(yt(p)),e.doc=o}e.doc.forEach(p=>St(e,p,!0))}},"docTranslator"),Yt=i(()=>(St({id:"root"},{id:"root",doc:bt},!0),{id:"root",doc:bt}),"getRootDocV2"),ys=i(t=>{let e;t.doc?e=t.doc:e=t,b.info(e),ge(!0),b.info("Extract initial document:",e),e.forEach(r=>{switch(b.warn("Statement",r.stmt),r.stmt){case mt:F(r.id.trim(),r.type,r.doc,r.description,r.note,r.classes,r.styles,r.textStyles);break;case Rt:be(r.state1,r.state2,r.description);break;case Ye:ke(r.id.trim(),r.classes);break;case Ge:{let h=r.id.trim().split(","),p=r.styleClass.split(",");h.forEach(f=>{let l=J(f);if(l===void 0){let S=f.trim();F(S),l=J(S)}l.styles=p.map(S=>{var v;return(v=S.replace(/;/g,""))==null?void 0:v.trim()})})}break;case je:Gt(r.id.trim(),r.styleClass);break}});let c=fe(),o=D().look;os(),q(void 0,Yt(),c,_t,Pt,!0,o,K),_t.forEach(r=>{if(Array.isArray(r.label)){if(r.description=r.label.slice(1),r.isGroup&&r.description.length>0)throw new Error("Group nodes can only have label. Remove the additional description for node ["+r.id+"]");r.label=r.label[0]}})},"extract"),F=i(function(t,e=tt,c=null,o=null,r=null,h=null,p=null,f=null){let l=t==null?void 0:t.trim();if(E.states.has(l)?(E.states.get(l).doc||(E.states.get(l).doc=c),E.states.get(l).type||(E.states.get(l).type=e)):(b.info("Adding state ",l,o),E.states.set(l,{id:l,descriptions:[],type:e,doc:c,note:r,classes:[],styles:[],textStyles:[]})),o&&(b.info("Setting state description",l,o),typeof o=="string"&&Ot(l,o.trim()),typeof o=="object"&&o.forEach(S=>Ot(l,S.trim()))),r){let S=E.states.get(l);S.note=r,S.note.text=H.sanitizeText(S.note.text,D())}h&&(b.info("Setting state classes",l,h),(typeof h=="string"?[h]:h).forEach(S=>Gt(l,S.trim()))),p&&(b.info("Setting state styles",l,p),(typeof p=="string"?[p]:p).forEach(S=>bs(l,S.trim()))),f&&(b.info("Setting state styles",l,p),(typeof f=="string"?[f]:f).forEach(S=>ks(l,S.trim())))},"addState"),ge=i(function(t){_t=[],Pt=[],kt={root:ye()},E=kt.root,W=0,K=Ft(),t||Ae()},"clear"),J=i(function(t){return E.states.get(t)},"getState"),fe=i(function(){return E.states},"getStates"),gs=i(function(){b.info("Documents = ",kt)},"logDocuments"),fs=i(function(){return E.relations},"getRelations");function Tt(t=""){let e=t;return t===Bt&&(W++,e=`${he}${W}`),e}i(Tt,"startIdIfNeeded");function Et(t="",e=tt){return t===Bt?he:e}i(Et,"startTypeIfNeeded");function Se(t=""){let e=t;return t===ue&&(W++,e=`${de}${W}`),e}i(Se,"endIdIfNeeded");function me(t="",e=tt){return t===ue?de:e}i(me,"endTypeIfNeeded");function _e(t,e,c){let o=Tt(t.id.trim()),r=Et(t.id.trim(),t.type),h=Tt(e.id.trim()),p=Et(e.id.trim(),e.type);F(o,r,t.doc,t.description,t.note,t.classes,t.styles,t.textStyles),F(h,p,e.doc,e.description,e.note,e.classes,e.styles,e.textStyles),E.relations.push({id1:o,id2:h,relationTitle:H.sanitizeText(c,D())})}i(_e,"addRelationObjs");var be=i(function(t,e,c){if(typeof t=="object")_e(t,e,c);else{let o=Tt(t.trim()),r=Et(t),h=Se(e.trim()),p=me(e);F(o,r),F(h,p),E.relations.push({id1:o,id2:h,title:H.sanitizeText(c,D())})}},"addRelation"),Ot=i(function(t,e){let c=E.states.get(t),o=e.startsWith(":")?e.replace(":","").trim():e;c.descriptions.push(H.sanitizeText(o,D()))},"addDescription"),Ss=i(function(t){return t.substring(0,1)===":"?t.substr(2).trim():t.trim()},"cleanupLabel"),ms=i(()=>(Qt++,"divider-id-"+Qt),"getDividerId"),ke=i(function(t,e=""){K.has(t)||K.set(t,{id:t,styles:[],textStyles:[]});let c=K.get(t);e==null||e.split(cs).forEach(o=>{let r=o.replace(/([^;]*);/,"$1").trim();if(RegExp(Vt).exec(o)){let h=r.replace(Kt,ls).replace(Vt,Kt);c.textStyles.push(h)}c.styles.push(r)})},"addStyleClass"),_s=i(function(){return K},"getClasses"),Gt=i(function(t,e){t.split(",").forEach(function(c){let o=J(c);if(o===void 0){let r=c.trim();F(r),o=J(r)}o.classes.push(e)})},"setCssClass"),bs=i(function(t,e){let c=J(t);c!==void 0&&c.styles.push(e)},"setStyle"),ks=i(function(t,e){let c=J(t);c!==void 0&&c.textStyles.push(e)},"setTextStyle"),Ts=i(()=>pe,"getDirection"),Es=i(t=>{pe=t},"setDirection"),xs=i(t=>t&&t[0]===":"?t.substr(1).trim():t.trim(),"trimColon"),$s=i(()=>{let t=D();return{nodes:_t,edges:Pt,other:{},config:t,direction:oe(Yt())}},"getData"),ws={getConfig:i(()=>D().state,"getConfig"),getData:$s,addState:F,clear:ge,getState:J,getStates:fe,getRelations:fs,getClasses:_s,getDirection:Ts,addRelation:be,getDividerId:ms,setDirection:Es,cleanupLabel:Ss,lineType:hs,relationType:us,logDocuments:gs,getRootDoc:ps,setRootDoc:ds,getRootDocV2:Yt,extract:ys,trimColon:xs,getAccTitle:we,setAccTitle:Oe,getAccDescription:Re,setAccDescription:Ne,addStyleClass:ke,setCssClass:Gt,addDescription:Ot,setDiagramTitle:Be,getDiagramTitle:Fe},Ds=i(t=>`
defs #statediagram-barbEnd {
    fill: ${t.transitionColor};
    stroke: ${t.transitionColor};
  }
g.stateGroup text {
  fill: ${t.nodeBorder};
  stroke: none;
  font-size: 10px;
}
g.stateGroup text {
  fill: ${t.textColor};
  stroke: none;
  font-size: 10px;

}
g.stateGroup .state-title {
  font-weight: bolder;
  fill: ${t.stateLabelColor};
}

g.stateGroup rect {
  fill: ${t.mainBkg};
  stroke: ${t.nodeBorder};
}

g.stateGroup line {
  stroke: ${t.lineColor};
  stroke-width: 1;
}

.transition {
  stroke: ${t.transitionColor};
  stroke-width: 1;
  fill: none;
}

.stateGroup .composit {
  fill: ${t.background};
  border-bottom: 1px
}

.stateGroup .alt-composit {
  fill: #e0e0e0;
  border-bottom: 1px
}

.state-note {
  stroke: ${t.noteBorderColor};
  fill: ${t.noteBkgColor};

  text {
    fill: ${t.noteTextColor};
    stroke: none;
    font-size: 10px;
  }
}

.stateLabel .box {
  stroke: none;
  stroke-width: 0;
  fill: ${t.mainBkg};
  opacity: 0.5;
}

.edgeLabel .label rect {
  fill: ${t.labelBackgroundColor};
  opacity: 0.5;
}
.edgeLabel {
  background-color: ${t.edgeLabelBackground};
  p {
    background-color: ${t.edgeLabelBackground};
  }
  rect {
    opacity: 0.5;
    background-color: ${t.edgeLabelBackground};
    fill: ${t.edgeLabelBackground};
  }
  text-align: center;
}
.edgeLabel .label text {
  fill: ${t.transitionLabelColor||t.tertiaryTextColor};
}
.label div .edgeLabel {
  color: ${t.transitionLabelColor||t.tertiaryTextColor};
}

.stateLabel text {
  fill: ${t.stateLabelColor};
  font-size: 10px;
  font-weight: bold;
}

.node circle.state-start {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node .fork-join {
  fill: ${t.specialStateColor};
  stroke: ${t.specialStateColor};
}

.node circle.state-end {
  fill: ${t.innerEndBackground};
  stroke: ${t.background};
  stroke-width: 1.5
}
.end-state-inner {
  fill: ${t.compositeBackground||t.background};
  // stroke: ${t.background};
  stroke-width: 1.5
}

.node rect {
  fill: ${t.stateBkg||t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: 1px;
}
.node polygon {
  fill: ${t.mainBkg};
  stroke: ${t.stateBorder||t.nodeBorder};;
  stroke-width: 1px;
}
#statediagram-barbEnd {
  fill: ${t.lineColor};
}

.statediagram-cluster rect {
  fill: ${t.compositeTitleBackground};
  stroke: ${t.stateBorder||t.nodeBorder};
  stroke-width: 1px;
}

.cluster-label, .nodeLabel {
  color: ${t.stateLabelColor};
  // line-height: 1;
}

.statediagram-cluster rect.outer {
  rx: 5px;
  ry: 5px;
}
.statediagram-state .divider {
  stroke: ${t.stateBorder||t.nodeBorder};
}

.statediagram-state .title-state {
  rx: 5px;
  ry: 5px;
}
.statediagram-cluster.statediagram-cluster .inner {
  fill: ${t.compositeBackground||t.background};
}
.statediagram-cluster.statediagram-cluster-alt .inner {
  fill: ${t.altBackground?t.altBackground:"#efefef"};
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
  fill: ${t.altBackground?t.altBackground:"#efefef"};
}

.note-edge {
  stroke-dasharray: 5;
}

.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}
.statediagram-note rect {
  fill: ${t.noteBkgColor};
  stroke: ${t.noteBorderColor};
  stroke-width: 1px;
  rx: 0;
  ry: 0;
}

.statediagram-note text {
  fill: ${t.noteTextColor};
}

.statediagram-note .nodeLabel {
  color: ${t.noteTextColor};
}
.statediagram .edgeLabel {
  color: red; // ${t.noteTextColor};
}

#dependencyStart, #dependencyEnd {
  fill: ${t.lineColor};
  stroke: ${t.lineColor};
  stroke-width: 1;
}

.statediagramTitleText {
  text-anchor: middle;
  font-size: 18px;
  fill: ${t.textColor};
}
`,"getStyles"),Os=Ds;export{As as B,Is as I,Os as a,ws as r};
