import{m as l,F as ce,B as de,c as ue,b as he,w as fe,v as ke,H as ot,i as Tt,r as ye,u as me,U as pe,T as ge,x as be,y as Te,q as dt,t as wt,Z as xe,z as Ut,A as Zt,C as ve,G as we,J as _e,K as $e,N as De,P as Se,O as Ce,X as qt,_ as Ht,a0 as Rt,a1 as Xt,a2 as Kt,a3 as Ee,g as Me,h as Ae,a4 as te,f as Ye,a as Le,a5 as Yt}from"./mermaid.esm.min-DbvczgL6.js";import"./app-CqsbHNKk.js";var Ie=Yt((e,i)=>{(function(s,r){typeof e=="object"&&typeof i<"u"?i.exports=r():typeof define=="function"&&define.amd?define(r):(s=typeof globalThis<"u"?globalThis:s||self).dayjs_plugin_isoWeek=r()})(e,function(){var s="day";return function(r,n,u){var k=l(function(D){return D.add(4-D.isoWeekday(),s)},"a"),$=n.prototype;$.isoWeekYear=function(){return k(this).year()},$.isoWeek=function(D){if(!this.$utils().u(D))return this.add(7*(D-this.isoWeek()),s);var v,E,W,j,z=k(this),C=(v=this.isoWeekYear(),E=this.$u,W=(E?u.utc:u)().year(v).startOf("year"),j=4-W.isoWeekday(),W.isoWeekday()>4&&(j+=7),W.add(j,s));return z.diff(C,"week")+1},$.isoWeekday=function(D){return this.$utils().u(D)?this.day()||7:this.day(this.day()%7?D:D-7)};var L=$.startOf;$.startOf=function(D,v){var E=this.$utils(),W=!!E.u(v)||v;return E.p(D)==="isoweek"?W?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):L.bind(this)(D,v)}}})}),We=Yt((e,i)=>{(function(s,r){typeof e=="object"&&typeof i<"u"?i.exports=r():typeof define=="function"&&define.amd?define(r):(s=typeof globalThis<"u"?globalThis:s||self).dayjs_plugin_customParseFormat=r()})(e,function(){var s={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},r=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,n=/\d/,u=/\d\d/,k=/\d\d?/,$=/\d*[^-_:/,()\s\d]+/,L={},D=l(function(g){return(g=+g)+(g>68?1900:2e3)},"a"),v=l(function(g){return function(S){this[g]=+S}},"f"),E=[/[+-]\d\d:?(\d\d)?|Z/,function(g){(this.zone||(this.zone={})).offset=function(S){if(!S||S==="Z")return 0;var M=S.match(/([+-]|\d\d)/g),A=60*M[1]+(+M[2]||0);return A===0?0:M[0]==="+"?-A:A}(g)}],W=l(function(g){var S=L[g];return S&&(S.indexOf?S:S.s.concat(S.f))},"u"),j=l(function(g,S){var M,A=L.meridiem;if(A){for(var G=1;G<=24;G+=1)if(g.indexOf(A(G,0,S))>-1){M=G>12;break}}else M=g===(S?"pm":"PM");return M},"d"),z={A:[$,function(g){this.afternoon=j(g,!1)}],a:[$,function(g){this.afternoon=j(g,!0)}],Q:[n,function(g){this.month=3*(g-1)+1}],S:[n,function(g){this.milliseconds=100*+g}],SS:[u,function(g){this.milliseconds=10*+g}],SSS:[/\d{3}/,function(g){this.milliseconds=+g}],s:[k,v("seconds")],ss:[k,v("seconds")],m:[k,v("minutes")],mm:[k,v("minutes")],H:[k,v("hours")],h:[k,v("hours")],HH:[k,v("hours")],hh:[k,v("hours")],D:[k,v("day")],DD:[u,v("day")],Do:[$,function(g){var S=L.ordinal,M=g.match(/\d+/);if(this.day=M[0],S)for(var A=1;A<=31;A+=1)S(A).replace(/\[|\]/g,"")===g&&(this.day=A)}],w:[k,v("week")],ww:[u,v("week")],M:[k,v("month")],MM:[u,v("month")],MMM:[$,function(g){var S=W("months"),M=(W("monthsShort")||S.map(function(A){return A.slice(0,3)})).indexOf(g)+1;if(M<1)throw new Error;this.month=M%12||M}],MMMM:[$,function(g){var S=W("months").indexOf(g)+1;if(S<1)throw new Error;this.month=S%12||S}],Y:[/[+-]?\d+/,v("year")],YY:[u,function(g){this.year=D(g)}],YYYY:[/\d{4}/,v("year")],Z:E,ZZ:E};function C(g){var S,M;S=g,M=L&&L.formats;for(var A=(g=S.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,function(T,x,h){var m=h&&h.toUpperCase();return x||M[h]||s[h]||M[m].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,function(a,d,c){return d||c.slice(1)})})).match(r),G=A.length,N=0;N<G;N+=1){var H=A[N],U=z[H],y=U&&U[0],b=U&&U[1];A[N]=b?{regex:y,parser:b}:H.replace(/^\[|\]$/g,"")}return function(T){for(var x={},h=0,m=0;h<G;h+=1){var a=A[h];if(typeof a=="string")m+=a.length;else{var d=a.regex,c=a.parser,p=T.slice(m),t=d.exec(p)[0];c.call(x,t),T=T.replace(t,"")}}return function(f){var o=f.afternoon;if(o!==void 0){var _=f.hours;o?_<12&&(f.hours+=12):_===12&&(f.hours=0),delete f.afternoon}}(x),x}}return l(C,"l"),function(g,S,M){M.p.customParseFormat=!0,g&&g.parseTwoDigitYear&&(D=g.parseTwoDigitYear);var A=S.prototype,G=A.parse;A.parse=function(N){var H=N.date,U=N.utc,y=N.args;this.$u=U;var b=y[1];if(typeof b=="string"){var T=y[2]===!0,x=y[3]===!0,h=T||x,m=y[2];x&&(m=y[2]),L=this.$locale(),!T&&m&&(L=M.Ls[m]),this.$d=function(p,t,f,o){try{if(["x","X"].indexOf(t)>-1)return new Date((t==="X"?1e3:1)*p);var _=C(t)(p),w=_.year,Y=_.month,I=_.day,it=_.hours,ut=_.minutes,F=_.seconds,K=_.milliseconds,st=_.zone,rt=_.week,ht=new Date,ft=I||(w||Y?1:ht.getDate()),at=w||ht.getFullYear(),O=0;w&&!Y||(O=Y>0?Y-1:ht.getMonth());var V,R=it||0,B=ut||0,pt=F||0,tt=K||0;return st?new Date(Date.UTC(at,O,ft,R,B,pt,tt+60*st.offset*1e3)):f?new Date(Date.UTC(at,O,ft,R,B,pt,tt)):(V=new Date(at,O,ft,R,B,pt,tt),rt&&(V=o(V).week(rt).toDate()),V)}catch{return new Date("")}}(H,b,U,M),this.init(),m&&m!==!0&&(this.$L=this.locale(m).$L),h&&H!=this.format(b)&&(this.$d=new Date("")),L={}}else if(b instanceof Array)for(var a=b.length,d=1;d<=a;d+=1){y[1]=b[d-1];var c=M.apply(this,y);if(c.isValid()){this.$d=c.$d,this.$L=c.$L,this.init();break}d===a&&(this.$d=new Date(""))}else G.call(this,N)}}})}),Fe=Yt((e,i)=>{(function(s,r){typeof e=="object"&&typeof i<"u"?i.exports=r():typeof define=="function"&&define.amd?define(r):(s=typeof globalThis<"u"?globalThis:s||self).dayjs_plugin_advancedFormat=r()})(e,function(){return function(s,r){var n=r.prototype,u=n.format;n.format=function(k){var $=this,L=this.$locale();if(!this.isValid())return u.bind(this)(k);var D=this.$utils(),v=(k||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,function(E){switch(E){case"Q":return Math.ceil(($.$M+1)/3);case"Do":return L.ordinal($.$D);case"gggg":return $.weekYear();case"GGGG":return $.isoWeekYear();case"wo":return L.ordinal($.week(),"W");case"w":case"ww":return D.s($.week(),E==="w"?1:2,"0");case"W":case"WW":return D.s($.isoWeek(),E==="W"?1:2,"0");case"k":case"kk":return D.s(String($.$H===0?24:$.$H),E==="k"?1:2,"0");case"X":return Math.floor($.$d.getTime()/1e3);case"x":return $.$d.getTime();case"z":return"["+$.offsetName()+"]";case"zzz":return"["+$.offsetName("long")+"]";default:return E}});return u.bind(this)(v)}}})}),Ct=function(){var e=l(function(m,a,d,c){for(d=d||{},c=m.length;c--;d[m[c]]=a);return d},"o"),i=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],s=[1,26],r=[1,27],n=[1,28],u=[1,29],k=[1,30],$=[1,31],L=[1,32],D=[1,33],v=[1,34],E=[1,9],W=[1,10],j=[1,11],z=[1,12],C=[1,13],g=[1,14],S=[1,15],M=[1,16],A=[1,19],G=[1,20],N=[1,21],H=[1,22],U=[1,23],y=[1,25],b=[1,35],T={trace:l(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:l(function(m,a,d,c,p,t,f){var o=t.length-1;switch(p){case 1:return t[o-1];case 2:this.$=[];break;case 3:t[o-1].push(t[o]),this.$=t[o-1];break;case 4:case 5:this.$=t[o];break;case 6:case 7:this.$=[];break;case 8:c.setWeekday("monday");break;case 9:c.setWeekday("tuesday");break;case 10:c.setWeekday("wednesday");break;case 11:c.setWeekday("thursday");break;case 12:c.setWeekday("friday");break;case 13:c.setWeekday("saturday");break;case 14:c.setWeekday("sunday");break;case 15:c.setWeekend("friday");break;case 16:c.setWeekend("saturday");break;case 17:c.setDateFormat(t[o].substr(11)),this.$=t[o].substr(11);break;case 18:c.enableInclusiveEndDates(),this.$=t[o].substr(18);break;case 19:c.TopAxis(),this.$=t[o].substr(8);break;case 20:c.setAxisFormat(t[o].substr(11)),this.$=t[o].substr(11);break;case 21:c.setTickInterval(t[o].substr(13)),this.$=t[o].substr(13);break;case 22:c.setExcludes(t[o].substr(9)),this.$=t[o].substr(9);break;case 23:c.setIncludes(t[o].substr(9)),this.$=t[o].substr(9);break;case 24:c.setTodayMarker(t[o].substr(12)),this.$=t[o].substr(12);break;case 27:c.setDiagramTitle(t[o].substr(6)),this.$=t[o].substr(6);break;case 28:this.$=t[o].trim(),c.setAccTitle(this.$);break;case 29:case 30:this.$=t[o].trim(),c.setAccDescription(this.$);break;case 31:c.addSection(t[o].substr(8)),this.$=t[o].substr(8);break;case 33:c.addTask(t[o-1],t[o]),this.$="task";break;case 34:this.$=t[o-1],c.setClickEvent(t[o-1],t[o],null);break;case 35:this.$=t[o-2],c.setClickEvent(t[o-2],t[o-1],t[o]);break;case 36:this.$=t[o-2],c.setClickEvent(t[o-2],t[o-1],null),c.setLink(t[o-2],t[o]);break;case 37:this.$=t[o-3],c.setClickEvent(t[o-3],t[o-2],t[o-1]),c.setLink(t[o-3],t[o]);break;case 38:this.$=t[o-2],c.setClickEvent(t[o-2],t[o],null),c.setLink(t[o-2],t[o-1]);break;case 39:this.$=t[o-3],c.setClickEvent(t[o-3],t[o-1],t[o]),c.setLink(t[o-3],t[o-2]);break;case 40:this.$=t[o-1],c.setLink(t[o-1],t[o]);break;case 41:case 47:this.$=t[o-1]+" "+t[o];break;case 42:case 43:case 45:this.$=t[o-2]+" "+t[o-1]+" "+t[o];break;case 44:case 46:this.$=t[o-3]+" "+t[o-2]+" "+t[o-1]+" "+t[o];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},e(i,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:s,13:r,14:n,15:u,16:k,17:$,18:L,19:18,20:D,21:v,22:E,23:W,24:j,25:z,26:C,27:g,28:S,29:M,30:A,31:G,33:N,35:H,36:U,37:24,38:y,40:b},e(i,[2,7],{1:[2,1]}),e(i,[2,3]),{9:36,11:17,12:s,13:r,14:n,15:u,16:k,17:$,18:L,19:18,20:D,21:v,22:E,23:W,24:j,25:z,26:C,27:g,28:S,29:M,30:A,31:G,33:N,35:H,36:U,37:24,38:y,40:b},e(i,[2,5]),e(i,[2,6]),e(i,[2,17]),e(i,[2,18]),e(i,[2,19]),e(i,[2,20]),e(i,[2,21]),e(i,[2,22]),e(i,[2,23]),e(i,[2,24]),e(i,[2,25]),e(i,[2,26]),e(i,[2,27]),{32:[1,37]},{34:[1,38]},e(i,[2,30]),e(i,[2,31]),e(i,[2,32]),{39:[1,39]},e(i,[2,8]),e(i,[2,9]),e(i,[2,10]),e(i,[2,11]),e(i,[2,12]),e(i,[2,13]),e(i,[2,14]),e(i,[2,15]),e(i,[2,16]),{41:[1,40],43:[1,41]},e(i,[2,4]),e(i,[2,28]),e(i,[2,29]),e(i,[2,33]),e(i,[2,34],{42:[1,42],43:[1,43]}),e(i,[2,40],{41:[1,44]}),e(i,[2,35],{43:[1,45]}),e(i,[2,36]),e(i,[2,38],{42:[1,46]}),e(i,[2,37]),e(i,[2,39])],defaultActions:{},parseError:l(function(m,a){if(a.recoverable)this.trace(m);else{var d=new Error(m);throw d.hash=a,d}},"parseError"),parse:l(function(m){var a=this,d=[0],c=[],p=[null],t=[],f=this.table,o="",_=0,w=0,Y=0,I=2,it=1,ut=t.slice.call(arguments,1),F=Object.create(this.lexer),K={yy:{}};for(var st in this.yy)Object.prototype.hasOwnProperty.call(this.yy,st)&&(K.yy[st]=this.yy[st]);F.setInput(m,K.yy),K.yy.lexer=F,K.yy.parser=this,typeof F.yylloc>"u"&&(F.yylloc={});var rt=F.yylloc;t.push(rt);var ht=F.options&&F.options.ranges;typeof K.yy.parseError=="function"?this.parseError=K.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function ft(Z){d.length=d.length-2*Z,p.length=p.length-Z,t.length=t.length-Z}l(ft,"popStack");function at(){var Z;return Z=c.pop()||F.lex()||it,typeof Z!="number"&&(Z instanceof Array&&(c=Z,Z=c.pop()),Z=a.symbols_[Z]||Z),Z}l(at,"lex");for(var O,V,R,B,pt,tt,nt={},gt,Q,Nt,bt;;){if(R=d[d.length-1],this.defaultActions[R]?B=this.defaultActions[R]:((O===null||typeof O>"u")&&(O=at()),B=f[R]&&f[R][O]),typeof B>"u"||!B.length||!B[0]){var Dt="";bt=[];for(gt in f[R])this.terminals_[gt]&&gt>I&&bt.push("'"+this.terminals_[gt]+"'");F.showPosition?Dt="Parse error on line "+(_+1)+`:
`+F.showPosition()+`
Expecting `+bt.join(", ")+", got '"+(this.terminals_[O]||O)+"'":Dt="Parse error on line "+(_+1)+": Unexpected "+(O==it?"end of input":"'"+(this.terminals_[O]||O)+"'"),this.parseError(Dt,{text:F.match,token:this.terminals_[O]||O,line:F.yylineno,loc:rt,expected:bt})}if(B[0]instanceof Array&&B.length>1)throw new Error("Parse Error: multiple actions possible at state: "+R+", token: "+O);switch(B[0]){case 1:d.push(O),p.push(F.yytext),t.push(F.yylloc),d.push(B[1]),O=null,V?(O=V,V=null):(w=F.yyleng,o=F.yytext,_=F.yylineno,rt=F.yylloc,Y>0);break;case 2:if(Q=this.productions_[B[1]][1],nt.$=p[p.length-Q],nt._$={first_line:t[t.length-(Q||1)].first_line,last_line:t[t.length-1].last_line,first_column:t[t.length-(Q||1)].first_column,last_column:t[t.length-1].last_column},ht&&(nt._$.range=[t[t.length-(Q||1)].range[0],t[t.length-1].range[1]]),tt=this.performAction.apply(nt,[o,w,_,K.yy,B[1],p,t].concat(ut)),typeof tt<"u")return tt;Q&&(d=d.slice(0,-1*Q*2),p=p.slice(0,-1*Q),t=t.slice(0,-1*Q)),d.push(this.productions_[B[1]][0]),p.push(nt.$),t.push(nt._$),Nt=f[d[d.length-2]][d[d.length-1]],d.push(Nt);break;case 3:return!0}}return!0},"parse")},x=function(){var m={EOF:1,parseError:l(function(a,d){if(this.yy.parser)this.yy.parser.parseError(a,d);else throw new Error(a)},"parseError"),setInput:l(function(a,d){return this.yy=d||this.yy||{},this._input=a,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:l(function(){var a=this._input[0];this.yytext+=a,this.yyleng++,this.offset++,this.match+=a,this.matched+=a;var d=a.match(/(?:\r\n?|\n).*/g);return d?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),a},"input"),unput:l(function(a){var d=a.length,c=a.split(/(?:\r\n?|\n)/g);this._input=a+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-d),this.offset-=d;var p=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),c.length-1&&(this.yylineno-=c.length-1);var t=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:c?(c.length===p.length?this.yylloc.first_column:0)+p[p.length-c.length].length-c[0].length:this.yylloc.first_column-d},this.options.ranges&&(this.yylloc.range=[t[0],t[0]+this.yyleng-d]),this.yyleng=this.yytext.length,this},"unput"),more:l(function(){return this._more=!0,this},"more"),reject:l(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:l(function(a){this.unput(this.match.slice(a))},"less"),pastInput:l(function(){var a=this.matched.substr(0,this.matched.length-this.match.length);return(a.length>20?"...":"")+a.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:l(function(){var a=this.match;return a.length<20&&(a+=this._input.substr(0,20-a.length)),(a.substr(0,20)+(a.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:l(function(){var a=this.pastInput(),d=new Array(a.length+1).join("-");return a+this.upcomingInput()+`
`+d+"^"},"showPosition"),test_match:l(function(a,d){var c,p,t;if(this.options.backtrack_lexer&&(t={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(t.yylloc.range=this.yylloc.range.slice(0))),p=a[0].match(/(?:\r\n?|\n).*/g),p&&(this.yylineno+=p.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:p?p[p.length-1].length-p[p.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+a[0].length},this.yytext+=a[0],this.match+=a[0],this.matches=a,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(a[0].length),this.matched+=a[0],c=this.performAction.call(this,this.yy,this,d,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),c)return c;if(this._backtrack){for(var f in t)this[f]=t[f];return!1}return!1},"test_match"),next:l(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var a,d,c,p;this._more||(this.yytext="",this.match="");for(var t=this._currentRules(),f=0;f<t.length;f++)if(c=this._input.match(this.rules[t[f]]),c&&(!d||c[0].length>d[0].length)){if(d=c,p=f,this.options.backtrack_lexer){if(a=this.test_match(c,t[f]),a!==!1)return a;if(this._backtrack){d=!1;continue}else return!1}else if(!this.options.flex)break}return d?(a=this.test_match(d,t[p]),a!==!1?a:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:l(function(){var a=this.next();return a||this.lex()},"lex"),begin:l(function(a){this.conditionStack.push(a)},"begin"),popState:l(function(){var a=this.conditionStack.length-1;return a>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:l(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:l(function(a){return a=this.conditionStack.length-1-Math.abs(a||0),a>=0?this.conditionStack[a]:"INITIAL"},"topState"),pushState:l(function(a){this.begin(a)},"pushState"),stateStackSize:l(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:l(function(a,d,c,p){switch(c){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return m}();T.lexer=x;function h(){this.yy={}}return l(h,"Parser"),h.prototype=T,T.Parser=h,new h}();Ct.parser=Ct;var Oe=Ct,Pe=dt(Ye()),q=dt(te()),ze=dt(Ie()),Be=dt(We()),je=dt(Fe());q.default.extend(ze.default);q.default.extend(Be.default);q.default.extend(je.default);var Qt={friday:5,saturday:6},X="",Lt="",It,Wt="",kt=[],yt=[],Ft=new Map,Ot=[],_t=[],ct="",Pt="",ee=["active","done","crit","milestone"],zt=[],mt=!1,Bt=!1,jt="sunday",$t="saturday",Et=0,Ge=l(function(){Ot=[],_t=[],ct="",zt=[],xt=0,At=void 0,vt=void 0,P=[],X="",Lt="",Pt="",It=void 0,Wt="",kt=[],yt=[],mt=!1,Bt=!1,Et=0,Ft=new Map,Ae(),jt="sunday",$t="saturday"},"clear"),Ne=l(function(e){Lt=e},"setAxisFormat"),Ue=l(function(){return Lt},"getAxisFormat"),Ze=l(function(e){It=e},"setTickInterval"),qe=l(function(){return It},"getTickInterval"),He=l(function(e){Wt=e},"setTodayMarker"),Re=l(function(){return Wt},"getTodayMarker"),Xe=l(function(e){X=e},"setDateFormat"),Ke=l(function(){mt=!0},"enableInclusiveEndDates"),Qe=l(function(){return mt},"endDatesAreInclusive"),Je=l(function(){Bt=!0},"enableTopAxis"),Ve=l(function(){return Bt},"topAxisEnabled"),ti=l(function(e){Pt=e},"setDisplayMode"),ei=l(function(){return Pt},"getDisplayMode"),ii=l(function(){return X},"getDateFormat"),si=l(function(e){kt=e.toLowerCase().split(/[\s,]+/)},"setIncludes"),ri=l(function(){return kt},"getIncludes"),ai=l(function(e){yt=e.toLowerCase().split(/[\s,]+/)},"setExcludes"),ni=l(function(){return yt},"getExcludes"),oi=l(function(){return Ft},"getLinks"),li=l(function(e){ct=e,Ot.push(e)},"addSection"),ci=l(function(){return Ot},"getSections"),di=l(function(){let e=Jt(),i=10,s=0;for(;!e&&s<i;)e=Jt(),s++;return _t=P,_t},"getTasks"),ie=l(function(e,i,s,r){return r.includes(e.format(i.trim()))?!1:s.includes("weekends")&&(e.isoWeekday()===Qt[$t]||e.isoWeekday()===Qt[$t]+1)||s.includes(e.format("dddd").toLowerCase())?!0:s.includes(e.format(i.trim()))},"isInvalidDate"),ui=l(function(e){jt=e},"setWeekday"),hi=l(function(){return jt},"getWeekday"),fi=l(function(e){$t=e},"setWeekend"),se=l(function(e,i,s,r){if(!s.length||e.manualEndTime)return;let n;e.startTime instanceof Date?n=(0,q.default)(e.startTime):n=(0,q.default)(e.startTime,i,!0),n=n.add(1,"d");let u;e.endTime instanceof Date?u=(0,q.default)(e.endTime):u=(0,q.default)(e.endTime,i,!0);let[k,$]=ki(n,u,i,s,r);e.endTime=k.toDate(),e.renderEndTime=$},"checkTaskDates"),ki=l(function(e,i,s,r,n){let u=!1,k=null;for(;e<=i;)u||(k=i.toDate()),u=ie(e,s,r,n),u&&(i=i.add(1,"d")),e=e.add(1,"d");return[i,k]},"fixTaskDates"),Mt=l(function(e,i,s){s=s.trim();let r=/^after\s+(?<ids>[\d\w- ]+)/.exec(s);if(r!==null){let u=null;for(let $ of r.groups.ids.split(" ")){let L=et($);L!==void 0&&(!u||L.endTime>u.endTime)&&(u=L)}if(u)return u.endTime;let k=new Date;return k.setHours(0,0,0,0),k}let n=(0,q.default)(s,i.trim(),!0);if(n.isValid())return n.toDate();{wt.debug("Invalid date:"+s),wt.debug("With date format:"+i.trim());let u=new Date(s);if(u===void 0||isNaN(u.getTime())||u.getFullYear()<-1e4||u.getFullYear()>1e4)throw new Error("Invalid date:"+s);return u}},"getStartDate"),re=l(function(e){let i=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(e.trim());return i!==null?[Number.parseFloat(i[1]),i[2]]:[NaN,"ms"]},"parseDuration"),ae=l(function(e,i,s,r=!1){s=s.trim();let n=/^until\s+(?<ids>[\d\w- ]+)/.exec(s);if(n!==null){let D=null;for(let E of n.groups.ids.split(" ")){let W=et(E);W!==void 0&&(!D||W.startTime<D.startTime)&&(D=W)}if(D)return D.startTime;let v=new Date;return v.setHours(0,0,0,0),v}let u=(0,q.default)(s,i.trim(),!0);if(u.isValid())return r&&(u=u.add(1,"d")),u.toDate();let k=(0,q.default)(e),[$,L]=re(s);if(!Number.isNaN($)){let D=k.add($,L);D.isValid()&&(k=D)}return k.toDate()},"getEndDate"),xt=0,lt=l(function(e){return e===void 0?(xt=xt+1,"task"+xt):e},"parseId"),yi=l(function(e,i){let s;i.substr(0,1)===":"?s=i.substr(1,i.length):s=i;let r=s.split(","),n={};Gt(r,n,ee);for(let k=0;k<r.length;k++)r[k]=r[k].trim();let u="";switch(r.length){case 1:n.id=lt(),n.startTime=e.endTime,u=r[0];break;case 2:n.id=lt(),n.startTime=Mt(void 0,X,r[0]),u=r[1];break;case 3:n.id=lt(r[0]),n.startTime=Mt(void 0,X,r[1]),u=r[2];break}return u&&(n.endTime=ae(n.startTime,X,u,mt),n.manualEndTime=(0,q.default)(u,"YYYY-MM-DD",!0).isValid(),se(n,X,yt,kt)),n},"compileData"),mi=l(function(e,i){let s;i.substr(0,1)===":"?s=i.substr(1,i.length):s=i;let r=s.split(","),n={};Gt(r,n,ee);for(let u=0;u<r.length;u++)r[u]=r[u].trim();switch(r.length){case 1:n.id=lt(),n.startTime={type:"prevTaskEnd",id:e},n.endTime={data:r[0]};break;case 2:n.id=lt(),n.startTime={type:"getStartDate",startData:r[0]},n.endTime={data:r[1]};break;case 3:n.id=lt(r[0]),n.startTime={type:"getStartDate",startData:r[1]},n.endTime={data:r[2]};break}return n},"parseData"),At,vt,P=[],ne={},pi=l(function(e,i){let s={section:ct,type:ct,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:i},task:e,classes:[]},r=mi(vt,i);s.raw.startTime=r.startTime,s.raw.endTime=r.endTime,s.id=r.id,s.prevTaskId=vt,s.active=r.active,s.done=r.done,s.crit=r.crit,s.milestone=r.milestone,s.order=Et,Et++;let n=P.push(s);vt=s.id,ne[s.id]=n-1},"addTask"),et=l(function(e){let i=ne[e];return P[i]},"findTaskById"),gi=l(function(e,i){let s={section:ct,type:ct,description:e,task:e,classes:[]},r=yi(At,i);s.startTime=r.startTime,s.endTime=r.endTime,s.id=r.id,s.active=r.active,s.done=r.done,s.crit=r.crit,s.milestone=r.milestone,At=s,_t.push(s)},"addTaskOrg"),Jt=l(function(){let e=l(function(s){let r=P[s],n="";switch(P[s].raw.startTime.type){case"prevTaskEnd":{let u=et(r.prevTaskId);r.startTime=u.endTime;break}case"getStartDate":n=Mt(void 0,X,P[s].raw.startTime.startData),n&&(P[s].startTime=n);break}return P[s].startTime&&(P[s].endTime=ae(P[s].startTime,X,P[s].raw.endTime.data,mt),P[s].endTime&&(P[s].processed=!0,P[s].manualEndTime=(0,q.default)(P[s].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),se(P[s],X,yt,kt))),P[s].processed},"compileTask"),i=!0;for(let[s,r]of P.entries())e(s),i=i&&r.processed;return i},"compileTasks"),bi=l(function(e,i){let s=i;ot().securityLevel!=="loose"&&(s=(0,Pe.sanitizeUrl)(i)),e.split(",").forEach(function(r){et(r)!==void 0&&(le(r,()=>{window.open(s,"_self")}),Ft.set(r,s))}),oe(e,"clickable")},"setLink"),oe=l(function(e,i){e.split(",").forEach(function(s){let r=et(s);r!==void 0&&r.classes.push(i)})},"setClass"),Ti=l(function(e,i,s){if(ot().securityLevel!=="loose"||i===void 0)return;let r=[];if(typeof s=="string"){r=s.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let n=0;n<r.length;n++){let u=r[n].trim();u.startsWith('"')&&u.endsWith('"')&&(u=u.substr(1,u.length-2)),r[n]=u}}r.length===0&&r.push(e),et(e)!==void 0&&le(e,()=>{Le.runFunc(i,...r)})},"setClickFun"),le=l(function(e,i){zt.push(function(){let s=document.querySelector(`[id="${e}"]`);s!==null&&s.addEventListener("click",function(){i()})},function(){let s=document.querySelector(`[id="${e}-text"]`);s!==null&&s.addEventListener("click",function(){i()})})},"pushFun"),xi=l(function(e,i,s){e.split(",").forEach(function(r){Ti(r,i,s)}),oe(e,"clickable")},"setClickEvent"),vi=l(function(e){zt.forEach(function(i){i(e)})},"bindFunctions"),wi={getConfig:l(()=>ot().gantt,"getConfig"),clear:Ge,setDateFormat:Xe,getDateFormat:ii,enableInclusiveEndDates:Ke,endDatesAreInclusive:Qe,enableTopAxis:Je,topAxisEnabled:Ve,setAxisFormat:Ne,getAxisFormat:Ue,setTickInterval:Ze,getTickInterval:qe,setTodayMarker:He,getTodayMarker:Re,setAccTitle:ke,getAccTitle:fe,setDiagramTitle:he,getDiagramTitle:ue,setDisplayMode:ti,getDisplayMode:ei,setAccDescription:de,getAccDescription:ce,addSection:li,getSections:ci,getTasks:di,addTask:pi,findTaskById:et,addTaskOrg:gi,setIncludes:si,getIncludes:ri,setExcludes:ai,getExcludes:ni,setClickEvent:xi,setLink:bi,getLinks:oi,bindFunctions:vi,parseDuration:re,isInvalidDate:ie,setWeekday:ui,getWeekday:hi,setWeekend:fi};function Gt(e,i,s){let r=!0;for(;r;)r=!1,s.forEach(function(n){let u="^\\s*"+n+"\\s*$",k=new RegExp(u);e[0].match(k)&&(i[n]=!0,e.shift(1),r=!0)})}l(Gt,"getTaskTags");var St=dt(te()),_i=l(function(){wt.debug("Something is calling, setConf, remove the call")},"setConf"),Vt={monday:Ce,tuesday:Se,wednesday:De,thursday:$e,friday:_e,saturday:we,sunday:ve},$i=l((e,i)=>{let s=[...e].map(()=>-1/0),r=[...e].sort((u,k)=>u.startTime-k.startTime||u.order-k.order),n=0;for(let u of r)for(let k=0;k<s.length;k++)if(u.startTime>=s[k]){s[k]=u.endTime,u.order=k+i,k>n&&(n=k);break}return n},"getMaxIntersections"),J,Di=l(function(e,i,s,r){let n=ot().gantt,u=ot().securityLevel,k;u==="sandbox"&&(k=Tt("#i"+i));let $=u==="sandbox"?Tt(k.nodes()[0].contentDocument.body):Tt("body"),L=u==="sandbox"?k.nodes()[0].contentDocument:document,D=L.getElementById(i);J=D.parentElement.offsetWidth,J===void 0&&(J=1200),n.useWidth!==void 0&&(J=n.useWidth);let v=r.db.getTasks(),E=[];for(let y of v)E.push(y.type);E=U(E);let W={},j=2*n.topPadding;if(r.db.getDisplayMode()==="compact"||n.displayMode==="compact"){let y={};for(let T of v)y[T.section]===void 0?y[T.section]=[T]:y[T.section].push(T);let b=0;for(let T of Object.keys(y)){let x=$i(y[T],b)+1;b+=x,j+=x*(n.barHeight+n.barGap),W[T]=x}}else{j+=v.length*(n.barHeight+n.barGap);for(let y of E)W[y]=v.filter(b=>b.type===y).length}D.setAttribute("viewBox","0 0 "+J+" "+j);let z=$.select(`[id="${i}"]`),C=ye().domain([me(v,function(y){return y.startTime}),pe(v,function(y){return y.endTime})]).rangeRound([0,J-n.leftPadding-n.rightPadding]);function g(y,b){let T=y.startTime,x=b.startTime,h=0;return T>x?h=1:T<x&&(h=-1),h}l(g,"taskCompare"),v.sort(g),S(v,J,j),ge(z,j,J,n.useMaxWidth),z.append("text").text(r.db.getDiagramTitle()).attr("x",J/2).attr("y",n.titleTopMargin).attr("class","titleText");function S(y,b,T){let x=n.barHeight,h=x+n.barGap,m=n.topPadding,a=n.leftPadding,d=be().domain([0,E.length]).range(["#00B9FA","#F95002"]).interpolate(Te);A(h,m,a,b,T,y,r.db.getExcludes(),r.db.getIncludes()),G(a,m,b,T),M(y,h,m,a,x,d,b),N(h,m),H(a,m,b,T)}l(S,"makeGantt");function M(y,b,T,x,h,m,a){let d=[...new Set(y.map(t=>t.order))].map(t=>y.find(f=>f.order===t));z.append("g").selectAll("rect").data(d).enter().append("rect").attr("x",0).attr("y",function(t,f){return f=t.order,f*b+T-2}).attr("width",function(){return a-n.rightPadding/2}).attr("height",b).attr("class",function(t){for(let[f,o]of E.entries())if(t.type===o)return"section section"+f%n.numberSectionStyles;return"section section0"});let c=z.append("g").selectAll("rect").data(y).enter(),p=r.db.getLinks();if(c.append("rect").attr("id",function(t){return t.id}).attr("rx",3).attr("ry",3).attr("x",function(t){return t.milestone?C(t.startTime)+x+.5*(C(t.endTime)-C(t.startTime))-.5*h:C(t.startTime)+x}).attr("y",function(t,f){return f=t.order,f*b+T}).attr("width",function(t){return t.milestone?h:C(t.renderEndTime||t.endTime)-C(t.startTime)}).attr("height",h).attr("transform-origin",function(t,f){return f=t.order,(C(t.startTime)+x+.5*(C(t.endTime)-C(t.startTime))).toString()+"px "+(f*b+T+.5*h).toString()+"px"}).attr("class",function(t){let f="task",o="";t.classes.length>0&&(o=t.classes.join(" "));let _=0;for(let[Y,I]of E.entries())t.type===I&&(_=Y%n.numberSectionStyles);let w="";return t.active?t.crit?w+=" activeCrit":w=" active":t.done?t.crit?w=" doneCrit":w=" done":t.crit&&(w+=" crit"),w.length===0&&(w=" task"),t.milestone&&(w=" milestone "+w),w+=_,w+=" "+o,f+w}),c.append("text").attr("id",function(t){return t.id+"-text"}).text(function(t){return t.task}).attr("font-size",n.fontSize).attr("x",function(t){let f=C(t.startTime),o=C(t.renderEndTime||t.endTime);t.milestone&&(f+=.5*(C(t.endTime)-C(t.startTime))-.5*h),t.milestone&&(o=f+h);let _=this.getBBox().width;return _>o-f?o+_+1.5*n.leftPadding>a?f+x-5:o+x+5:(o-f)/2+f+x}).attr("y",function(t,f){return f=t.order,f*b+n.barHeight/2+(n.fontSize/2-2)+T}).attr("text-height",h).attr("class",function(t){let f=C(t.startTime),o=C(t.endTime);t.milestone&&(o=f+h);let _=this.getBBox().width,w="";t.classes.length>0&&(w=t.classes.join(" "));let Y=0;for(let[it,ut]of E.entries())t.type===ut&&(Y=it%n.numberSectionStyles);let I="";return t.active&&(t.crit?I="activeCritText"+Y:I="activeText"+Y),t.done?t.crit?I=I+" doneCritText"+Y:I=I+" doneText"+Y:t.crit&&(I=I+" critText"+Y),t.milestone&&(I+=" milestoneText"),_>o-f?o+_+1.5*n.leftPadding>a?w+" taskTextOutsideLeft taskTextOutside"+Y+" "+I:w+" taskTextOutsideRight taskTextOutside"+Y+" "+I+" width-"+_:w+" taskText taskText"+Y+" "+I+" width-"+_}),ot().securityLevel==="sandbox"){let t;t=Tt("#i"+i);let f=t.nodes()[0].contentDocument;c.filter(function(o){return p.has(o.id)}).each(function(o){var _=f.querySelector("#"+o.id),w=f.querySelector("#"+o.id+"-text");let Y=_.parentNode;var I=f.createElement("a");I.setAttribute("xlink:href",p.get(o.id)),I.setAttribute("target","_top"),Y.appendChild(I),I.appendChild(_),I.appendChild(w)})}}l(M,"drawRects");function A(y,b,T,x,h,m,a,d){if(a.length===0&&d.length===0)return;let c,p;for(let{startTime:w,endTime:Y}of m)(c===void 0||w<c)&&(c=w),(p===void 0||Y>p)&&(p=Y);if(!c||!p)return;if((0,St.default)(p).diff((0,St.default)(c),"year")>5){wt.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}let t=r.db.getDateFormat(),f=[],o=null,_=(0,St.default)(c);for(;_.valueOf()<=p;)r.db.isInvalidDate(_,t,a,d)?o?o.end=_:o={start:_,end:_}:o&&(f.push(o),o=null),_=_.add(1,"d");z.append("g").selectAll("rect").data(f).enter().append("rect").attr("id",function(w){return"exclude-"+w.start.format("YYYY-MM-DD")}).attr("x",function(w){return C(w.start)+T}).attr("y",n.gridLineStartPadding).attr("width",function(w){let Y=w.end.add(1,"day");return C(Y)-C(w.start)}).attr("height",h-b-n.gridLineStartPadding).attr("transform-origin",function(w,Y){return(C(w.start)+T+.5*(C(w.end)-C(w.start))).toString()+"px "+(Y*y+.5*h).toString()+"px"}).attr("class","exclude-range")}l(A,"drawExcludeDays");function G(y,b,T,x){let h=xe(C).tickSize(-x+b+n.gridLineStartPadding).tickFormat(Ut(r.db.getAxisFormat()||n.axisFormat||"%Y-%m-%d")),m=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(r.db.getTickInterval()||n.tickInterval);if(m!==null){let a=m[1],d=m[2],c=r.db.getWeekday()||n.weekday;switch(d){case"millisecond":h.ticks(Kt.every(a));break;case"second":h.ticks(Xt.every(a));break;case"minute":h.ticks(Rt.every(a));break;case"hour":h.ticks(Ht.every(a));break;case"day":h.ticks(qt.every(a));break;case"week":h.ticks(Vt[c].every(a));break;case"month":h.ticks(Zt.every(a));break}}if(z.append("g").attr("class","grid").attr("transform","translate("+y+", "+(x-50)+")").call(h).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),r.db.topAxisEnabled()||n.topAxis){let a=Ee(C).tickSize(-x+b+n.gridLineStartPadding).tickFormat(Ut(r.db.getAxisFormat()||n.axisFormat||"%Y-%m-%d"));if(m!==null){let d=m[1],c=m[2],p=r.db.getWeekday()||n.weekday;switch(c){case"millisecond":a.ticks(Kt.every(d));break;case"second":a.ticks(Xt.every(d));break;case"minute":a.ticks(Rt.every(d));break;case"hour":a.ticks(Ht.every(d));break;case"day":a.ticks(qt.every(d));break;case"week":a.ticks(Vt[p].every(d));break;case"month":a.ticks(Zt.every(d));break}}z.append("g").attr("class","grid").attr("transform","translate("+y+", "+b+")").call(a).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}l(G,"makeGrid");function N(y,b){let T=0,x=Object.keys(W).map(h=>[h,W[h]]);z.append("g").selectAll("text").data(x).enter().append(function(h){let m=h[0].split(Me.lineBreakRegex),a=-(m.length-1)/2,d=L.createElementNS("http://www.w3.org/2000/svg","text");d.setAttribute("dy",a+"em");for(let[c,p]of m.entries()){let t=L.createElementNS("http://www.w3.org/2000/svg","tspan");t.setAttribute("alignment-baseline","central"),t.setAttribute("x","10"),c>0&&t.setAttribute("dy","1em"),t.textContent=p,d.appendChild(t)}return d}).attr("x",10).attr("y",function(h,m){if(m>0)for(let a=0;a<m;a++)return T+=x[m-1][1],h[1]*y/2+T*y+b;else return h[1]*y/2+b}).attr("font-size",n.sectionFontSize).attr("class",function(h){for(let[m,a]of E.entries())if(h[0]===a)return"sectionTitle sectionTitle"+m%n.numberSectionStyles;return"sectionTitle"})}l(N,"vertLabels");function H(y,b,T,x){let h=r.db.getTodayMarker();if(h==="off")return;let m=z.append("g").attr("class","today"),a=new Date,d=m.append("line");d.attr("x1",C(a)+y).attr("x2",C(a)+y).attr("y1",n.titleTopMargin).attr("y2",x-n.titleTopMargin).attr("class","today"),h!==""&&d.attr("style",h.replace(/,/g,";"))}l(H,"drawToday");function U(y){let b={},T=[];for(let x=0,h=y.length;x<h;++x)Object.prototype.hasOwnProperty.call(b,y[x])||(b[y[x]]=!0,T.push(y[x]));return T}l(U,"checkUnique")},"draw"),Si={setConf:_i,draw:Di},Ci=l(e=>`
  .mermaid-main-font {
        font-family: ${e.fontFamily};
  }

  .exclude-range {
    fill: ${e.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${e.sectionBkgColor};
  }

  .section2 {
    fill: ${e.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${e.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${e.titleColor};
  }

  .sectionTitle1 {
    fill: ${e.titleColor};
  }

  .sectionTitle2 {
    fill: ${e.titleColor};
  }

  .sectionTitle3 {
    fill: ${e.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: ${e.fontFamily};
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${e.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${e.fontFamily};
    fill: ${e.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${e.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: ${e.fontFamily};
  }

  .taskTextOutsideRight {
    fill: ${e.taskTextDarkColor};
    text-anchor: start;
    font-family: ${e.fontFamily};
  }

  .taskTextOutsideLeft {
    fill: ${e.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${e.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${e.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${e.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${e.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${e.taskBkgColor};
    stroke: ${e.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${e.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${e.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${e.activeTaskBkgColor};
    stroke: ${e.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${e.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${e.doneTaskBorderColor};
    fill: ${e.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${e.taskTextDarkColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${e.critBorderColor};
    fill: ${e.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${e.critBorderColor};
    fill: ${e.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${e.critBorderColor};
    fill: ${e.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${e.taskTextDarkColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${e.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${e.titleColor||e.textColor};
    font-family: ${e.fontFamily};
  }
`,"getStyles"),Ei=Ci,Yi={parser:Oe,db:wi,renderer:Si,styles:Ei};export{Yi as diagram};
