import{m as l,Q as ce,K as de,d as ue,J as he,Z as fe,j as ye,h as ot,k as Tt,v as ke,x as me,y as pe,G as ge,z as be,A as Te,q as dt,t as wt,_ as ve,B as qt,D as Ut,E as xe,F as we,H as _e,N as $e,P as De,R as Ce,T as Se,Y as Zt,$ as Ht,a0 as Vt,a1 as Rt,a2 as Xt,a3 as Ee,b as Me,X as Ae,a4 as te,f as Le,U as Ie,a5 as Lt}from"./mermaid.esm.min-CWJsEOrV.js";import"./app-Bwsni2wZ.js";var Ye=Lt((e,s)=>{(function(i,r){typeof e=="object"&&typeof s<"u"?s.exports=r():typeof define=="function"&&define.amd?define(r):(i=typeof globalThis<"u"?globalThis:i||self).dayjs_plugin_isoWeek=r()})(e,function(){var i="day";return function(r,a,u){var y=l(function(D){return D.add(4-D.isoWeekday(),i)},"a"),$=a.prototype;$.isoWeekYear=function(){return y(this).year()},$.isoWeek=function(D){if(!this.$utils().u(D))return this.add(7*(D-this.isoWeek()),i);var x,E,W,j,B=y(this),C=(x=this.isoWeekYear(),E=this.$u,W=(E?u.utc:u)().year(x).startOf("year"),j=4-W.isoWeekday(),W.isoWeekday()>4&&(j+=7),W.add(j,i));return B.diff(C,"week")+1},$.isoWeekday=function(D){return this.$utils().u(D)?this.day()||7:this.day(this.day()%7?D:D-7)};var L=$.startOf;$.startOf=function(D,x){var E=this.$utils(),W=!!E.u(x)||x;return E.p(D)==="isoweek"?W?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):L.bind(this)(D,x)}}})}),We=Lt((e,s)=>{(function(i,r){typeof e=="object"&&typeof s<"u"?s.exports=r():typeof define=="function"&&define.amd?define(r):(i=typeof globalThis<"u"?globalThis:i||self).dayjs_plugin_customParseFormat=r()})(e,function(){var i={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},r=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,a=/\d/,u=/\d\d/,y=/\d\d?/,$=/\d*[^-_:/,()\s\d]+/,L={},D=l(function(p){return(p=+p)+(p>68?1900:2e3)},"a"),x=l(function(p){return function(S){this[p]=+S}},"f"),E=[/[+-]\d\d:?(\d\d)?|Z/,function(p){(this.zone||(this.zone={})).offset=(function(S){if(!S||S==="Z")return 0;var M=S.match(/([+-]|\d\d)/g),A=60*M[1]+(+M[2]||0);return A===0?0:M[0]==="+"?-A:A})(p)}],W=l(function(p){var S=L[p];return S&&(S.indexOf?S:S.s.concat(S.f))},"u"),j=l(function(p,S){var M,A=L.meridiem;if(A){for(var G=1;G<=24;G+=1)if(p.indexOf(A(G,0,S))>-1){M=G>12;break}}else M=p===(S?"pm":"PM");return M},"d"),B={A:[$,function(p){this.afternoon=j(p,!1)}],a:[$,function(p){this.afternoon=j(p,!0)}],Q:[a,function(p){this.month=3*(p-1)+1}],S:[a,function(p){this.milliseconds=100*+p}],SS:[u,function(p){this.milliseconds=10*+p}],SSS:[/\d{3}/,function(p){this.milliseconds=+p}],s:[y,x("seconds")],ss:[y,x("seconds")],m:[y,x("minutes")],mm:[y,x("minutes")],H:[y,x("hours")],h:[y,x("hours")],HH:[y,x("hours")],hh:[y,x("hours")],D:[y,x("day")],DD:[u,x("day")],Do:[$,function(p){var S=L.ordinal,M=p.match(/\d+/);if(this.day=M[0],S)for(var A=1;A<=31;A+=1)S(A).replace(/\[|\]/g,"")===p&&(this.day=A)}],w:[y,x("week")],ww:[u,x("week")],M:[y,x("month")],MM:[u,x("month")],MMM:[$,function(p){var S=W("months"),M=(W("monthsShort")||S.map(function(A){return A.slice(0,3)})).indexOf(p)+1;if(M<1)throw new Error;this.month=M%12||M}],MMMM:[$,function(p){var S=W("months").indexOf(p)+1;if(S<1)throw new Error;this.month=S%12||S}],Y:[/[+-]?\d+/,x("year")],YY:[u,function(p){this.year=D(p)}],YYYY:[/\d{4}/,x("year")],Z:E,ZZ:E};function C(p){var S,M;S=p,M=L&&L.formats;for(var A=(p=S.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,function(v,b,m){var g=m&&m.toUpperCase();return b||M[m]||i[m]||M[g].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,function(o,d,c){return d||c.slice(1)})})).match(r),G=A.length,N=0;N<G;N+=1){var H=A[N],q=B[H],k=q&&q[0],T=q&&q[1];A[N]=T?{regex:k,parser:T}:H.replace(/^\[|\]$/g,"")}return function(v){for(var b={},m=0,g=0;m<G;m+=1){var o=A[m];if(typeof o=="string")g+=o.length;else{var d=o.regex,c=o.parser,f=v.slice(g),t=d.exec(f)[0];c.call(b,t),v=v.replace(t,"")}}return(function(h){var n=h.afternoon;if(n!==void 0){var _=h.hours;n?_<12&&(h.hours+=12):_===12&&(h.hours=0),delete h.afternoon}})(b),b}}return l(C,"l"),function(p,S,M){M.p.customParseFormat=!0,p&&p.parseTwoDigitYear&&(D=p.parseTwoDigitYear);var A=S.prototype,G=A.parse;A.parse=function(N){var H=N.date,q=N.utc,k=N.args;this.$u=q;var T=k[1];if(typeof T=="string"){var v=k[2]===!0,b=k[3]===!0,m=v||b,g=k[2];b&&(g=k[2]),L=this.$locale(),!v&&g&&(L=M.Ls[g]),this.$d=(function(f,t,h,n){try{if(["x","X"].indexOf(t)>-1)return new Date((t==="X"?1e3:1)*f);var _=C(t)(f),w=_.year,I=_.month,Y=_.day,it=_.hours,ut=_.minutes,F=_.seconds,X=_.milliseconds,rt=_.zone,st=_.week,ht=new Date,ft=Y||(w||I?1:ht.getDate()),at=w||ht.getFullYear(),P=0;w&&!I||(P=I>0?I-1:ht.getMonth());var J,V=it||0,O=ut||0,pt=F||0,tt=X||0;return rt?new Date(Date.UTC(at,P,ft,V,O,pt,tt+60*rt.offset*1e3)):h?new Date(Date.UTC(at,P,ft,V,O,pt,tt)):(J=new Date(at,P,ft,V,O,pt,tt),st&&(J=n(J).week(st).toDate()),J)}catch{return new Date("")}})(H,T,q,M),this.init(),g&&g!==!0&&(this.$L=this.locale(g).$L),m&&H!=this.format(T)&&(this.$d=new Date("")),L={}}else if(T instanceof Array)for(var o=T.length,d=1;d<=o;d+=1){k[1]=T[d-1];var c=M.apply(this,k);if(c.isValid()){this.$d=c.$d,this.$L=c.$L,this.init();break}d===o&&(this.$d=new Date(""))}else G.call(this,N)}}})}),Fe=Lt((e,s)=>{(function(i,r){typeof e=="object"&&typeof s<"u"?s.exports=r():typeof define=="function"&&define.amd?define(r):(i=typeof globalThis<"u"?globalThis:i||self).dayjs_plugin_advancedFormat=r()})(e,function(){return function(i,r){var a=r.prototype,u=a.format;a.format=function(y){var $=this,L=this.$locale();if(!this.isValid())return u.bind(this)(y);var D=this.$utils(),x=(y||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,function(E){switch(E){case"Q":return Math.ceil(($.$M+1)/3);case"Do":return L.ordinal($.$D);case"gggg":return $.weekYear();case"GGGG":return $.isoWeekYear();case"wo":return L.ordinal($.week(),"W");case"w":case"ww":return D.s($.week(),E==="w"?1:2,"0");case"W":case"WW":return D.s($.isoWeek(),E==="W"?1:2,"0");case"k":case"kk":return D.s(String($.$H===0?24:$.$H),E==="k"?1:2,"0");case"X":return Math.floor($.$d.getTime()/1e3);case"x":return $.$d.getTime();case"z":return"["+$.offsetName()+"]";case"zzz":return"["+$.offsetName("long")+"]";default:return E}});return u.bind(this)(x)}}})}),St=(function(){var e=l(function(g,o,d,c){for(d=d||{},c=g.length;c--;d[g[c]]=o);return d},"o"),s=[6,8,10,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,33,35,36,38,40],i=[1,26],r=[1,27],a=[1,28],u=[1,29],y=[1,30],$=[1,31],L=[1,32],D=[1,33],x=[1,34],E=[1,9],W=[1,10],j=[1,11],B=[1,12],C=[1,13],p=[1,14],S=[1,15],M=[1,16],A=[1,19],G=[1,20],N=[1,21],H=[1,22],q=[1,23],k=[1,25],T=[1,35],v={trace:l(function(){},"trace"),yy:{},symbols_:{error:2,start:3,gantt:4,document:5,EOF:6,line:7,SPACE:8,statement:9,NL:10,weekday:11,weekday_monday:12,weekday_tuesday:13,weekday_wednesday:14,weekday_thursday:15,weekday_friday:16,weekday_saturday:17,weekday_sunday:18,weekend:19,weekend_friday:20,weekend_saturday:21,dateFormat:22,inclusiveEndDates:23,topAxis:24,axisFormat:25,tickInterval:26,excludes:27,includes:28,todayMarker:29,title:30,acc_title:31,acc_title_value:32,acc_descr:33,acc_descr_value:34,acc_descr_multiline_value:35,section:36,clickStatement:37,taskTxt:38,taskData:39,click:40,callbackname:41,callbackargs:42,href:43,clickStatementDebug:44,$accept:0,$end:1},terminals_:{2:"error",4:"gantt",6:"EOF",8:"SPACE",10:"NL",12:"weekday_monday",13:"weekday_tuesday",14:"weekday_wednesday",15:"weekday_thursday",16:"weekday_friday",17:"weekday_saturday",18:"weekday_sunday",20:"weekend_friday",21:"weekend_saturday",22:"dateFormat",23:"inclusiveEndDates",24:"topAxis",25:"axisFormat",26:"tickInterval",27:"excludes",28:"includes",29:"todayMarker",30:"title",31:"acc_title",32:"acc_title_value",33:"acc_descr",34:"acc_descr_value",35:"acc_descr_multiline_value",36:"section",38:"taskTxt",39:"taskData",40:"click",41:"callbackname",42:"callbackargs",43:"href"},productions_:[0,[3,3],[5,0],[5,2],[7,2],[7,1],[7,1],[7,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[11,1],[19,1],[19,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,1],[9,2],[9,2],[9,1],[9,1],[9,1],[9,2],[37,2],[37,3],[37,3],[37,4],[37,3],[37,4],[37,2],[44,2],[44,3],[44,3],[44,4],[44,3],[44,4],[44,2]],performAction:l(function(g,o,d,c,f,t,h){var n=t.length-1;switch(f){case 1:return t[n-1];case 2:this.$=[];break;case 3:t[n-1].push(t[n]),this.$=t[n-1];break;case 4:case 5:this.$=t[n];break;case 6:case 7:this.$=[];break;case 8:c.setWeekday("monday");break;case 9:c.setWeekday("tuesday");break;case 10:c.setWeekday("wednesday");break;case 11:c.setWeekday("thursday");break;case 12:c.setWeekday("friday");break;case 13:c.setWeekday("saturday");break;case 14:c.setWeekday("sunday");break;case 15:c.setWeekend("friday");break;case 16:c.setWeekend("saturday");break;case 17:c.setDateFormat(t[n].substr(11)),this.$=t[n].substr(11);break;case 18:c.enableInclusiveEndDates(),this.$=t[n].substr(18);break;case 19:c.TopAxis(),this.$=t[n].substr(8);break;case 20:c.setAxisFormat(t[n].substr(11)),this.$=t[n].substr(11);break;case 21:c.setTickInterval(t[n].substr(13)),this.$=t[n].substr(13);break;case 22:c.setExcludes(t[n].substr(9)),this.$=t[n].substr(9);break;case 23:c.setIncludes(t[n].substr(9)),this.$=t[n].substr(9);break;case 24:c.setTodayMarker(t[n].substr(12)),this.$=t[n].substr(12);break;case 27:c.setDiagramTitle(t[n].substr(6)),this.$=t[n].substr(6);break;case 28:this.$=t[n].trim(),c.setAccTitle(this.$);break;case 29:case 30:this.$=t[n].trim(),c.setAccDescription(this.$);break;case 31:c.addSection(t[n].substr(8)),this.$=t[n].substr(8);break;case 33:c.addTask(t[n-1],t[n]),this.$="task";break;case 34:this.$=t[n-1],c.setClickEvent(t[n-1],t[n],null);break;case 35:this.$=t[n-2],c.setClickEvent(t[n-2],t[n-1],t[n]);break;case 36:this.$=t[n-2],c.setClickEvent(t[n-2],t[n-1],null),c.setLink(t[n-2],t[n]);break;case 37:this.$=t[n-3],c.setClickEvent(t[n-3],t[n-2],t[n-1]),c.setLink(t[n-3],t[n]);break;case 38:this.$=t[n-2],c.setClickEvent(t[n-2],t[n],null),c.setLink(t[n-2],t[n-1]);break;case 39:this.$=t[n-3],c.setClickEvent(t[n-3],t[n-1],t[n]),c.setLink(t[n-3],t[n-2]);break;case 40:this.$=t[n-1],c.setLink(t[n-1],t[n]);break;case 41:case 47:this.$=t[n-1]+" "+t[n];break;case 42:case 43:case 45:this.$=t[n-2]+" "+t[n-1]+" "+t[n];break;case 44:case 46:this.$=t[n-3]+" "+t[n-2]+" "+t[n-1]+" "+t[n];break}},"anonymous"),table:[{3:1,4:[1,2]},{1:[3]},e(s,[2,2],{5:3}),{6:[1,4],7:5,8:[1,6],9:7,10:[1,8],11:17,12:i,13:r,14:a,15:u,16:y,17:$,18:L,19:18,20:D,21:x,22:E,23:W,24:j,25:B,26:C,27:p,28:S,29:M,30:A,31:G,33:N,35:H,36:q,37:24,38:k,40:T},e(s,[2,7],{1:[2,1]}),e(s,[2,3]),{9:36,11:17,12:i,13:r,14:a,15:u,16:y,17:$,18:L,19:18,20:D,21:x,22:E,23:W,24:j,25:B,26:C,27:p,28:S,29:M,30:A,31:G,33:N,35:H,36:q,37:24,38:k,40:T},e(s,[2,5]),e(s,[2,6]),e(s,[2,17]),e(s,[2,18]),e(s,[2,19]),e(s,[2,20]),e(s,[2,21]),e(s,[2,22]),e(s,[2,23]),e(s,[2,24]),e(s,[2,25]),e(s,[2,26]),e(s,[2,27]),{32:[1,37]},{34:[1,38]},e(s,[2,30]),e(s,[2,31]),e(s,[2,32]),{39:[1,39]},e(s,[2,8]),e(s,[2,9]),e(s,[2,10]),e(s,[2,11]),e(s,[2,12]),e(s,[2,13]),e(s,[2,14]),e(s,[2,15]),e(s,[2,16]),{41:[1,40],43:[1,41]},e(s,[2,4]),e(s,[2,28]),e(s,[2,29]),e(s,[2,33]),e(s,[2,34],{42:[1,42],43:[1,43]}),e(s,[2,40],{41:[1,44]}),e(s,[2,35],{43:[1,45]}),e(s,[2,36]),e(s,[2,38],{42:[1,46]}),e(s,[2,37]),e(s,[2,39])],defaultActions:{},parseError:l(function(g,o){if(o.recoverable)this.trace(g);else{var d=new Error(g);throw d.hash=o,d}},"parseError"),parse:l(function(g){var o=this,d=[0],c=[],f=[null],t=[],h=this.table,n="",_=0,w=0,I=0,Y=2,it=1,ut=t.slice.call(arguments,1),F=Object.create(this.lexer),X={yy:{}};for(var rt in this.yy)Object.prototype.hasOwnProperty.call(this.yy,rt)&&(X.yy[rt]=this.yy[rt]);F.setInput(g,X.yy),X.yy.lexer=F,X.yy.parser=this,typeof F.yylloc>"u"&&(F.yylloc={});var st=F.yylloc;t.push(st);var ht=F.options&&F.options.ranges;typeof X.yy.parseError=="function"?this.parseError=X.yy.parseError:this.parseError=Object.getPrototypeOf(this).parseError;function ft(U){d.length=d.length-2*U,f.length=f.length-U,t.length=t.length-U}l(ft,"popStack");function at(){var U;return U=c.pop()||F.lex()||it,typeof U!="number"&&(U instanceof Array&&(c=U,U=c.pop()),U=o.symbols_[U]||U),U}l(at,"lex");for(var P,J,V,O,pt,tt,nt={},gt,K,Nt,bt;;){if(V=d[d.length-1],this.defaultActions[V]?O=this.defaultActions[V]:((P===null||typeof P>"u")&&(P=at()),O=h[V]&&h[V][P]),typeof O>"u"||!O.length||!O[0]){var Dt="";bt=[];for(gt in h[V])this.terminals_[gt]&&gt>Y&&bt.push("'"+this.terminals_[gt]+"'");F.showPosition?Dt="Parse error on line "+(_+1)+`:
`+F.showPosition()+`
Expecting `+bt.join(", ")+", got '"+(this.terminals_[P]||P)+"'":Dt="Parse error on line "+(_+1)+": Unexpected "+(P==it?"end of input":"'"+(this.terminals_[P]||P)+"'"),this.parseError(Dt,{text:F.match,token:this.terminals_[P]||P,line:F.yylineno,loc:st,expected:bt})}if(O[0]instanceof Array&&O.length>1)throw new Error("Parse Error: multiple actions possible at state: "+V+", token: "+P);switch(O[0]){case 1:d.push(P),f.push(F.yytext),t.push(F.yylloc),d.push(O[1]),P=null,J?(P=J,J=null):(w=F.yyleng,n=F.yytext,_=F.yylineno,st=F.yylloc,I>0);break;case 2:if(K=this.productions_[O[1]][1],nt.$=f[f.length-K],nt._$={first_line:t[t.length-(K||1)].first_line,last_line:t[t.length-1].last_line,first_column:t[t.length-(K||1)].first_column,last_column:t[t.length-1].last_column},ht&&(nt._$.range=[t[t.length-(K||1)].range[0],t[t.length-1].range[1]]),tt=this.performAction.apply(nt,[n,w,_,X.yy,O[1],f,t].concat(ut)),typeof tt<"u")return tt;K&&(d=d.slice(0,-1*K*2),f=f.slice(0,-1*K),t=t.slice(0,-1*K)),d.push(this.productions_[O[1]][0]),f.push(nt.$),t.push(nt._$),Nt=h[d[d.length-2]][d[d.length-1]],d.push(Nt);break;case 3:return!0}}return!0},"parse")},b=(function(){var g={EOF:1,parseError:l(function(o,d){if(this.yy.parser)this.yy.parser.parseError(o,d);else throw new Error(o)},"parseError"),setInput:l(function(o,d){return this.yy=d||this.yy||{},this._input=o,this._more=this._backtrack=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},"setInput"),input:l(function(){var o=this._input[0];this.yytext+=o,this.yyleng++,this.offset++,this.match+=o,this.matched+=o;var d=o.match(/(?:\r\n?|\n).*/g);return d?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),o},"input"),unput:l(function(o){var d=o.length,c=o.split(/(?:\r\n?|\n)/g);this._input=o+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-d),this.offset-=d;var f=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),c.length-1&&(this.yylineno-=c.length-1);var t=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:c?(c.length===f.length?this.yylloc.first_column:0)+f[f.length-c.length].length-c[0].length:this.yylloc.first_column-d},this.options.ranges&&(this.yylloc.range=[t[0],t[0]+this.yyleng-d]),this.yyleng=this.yytext.length,this},"unput"),more:l(function(){return this._more=!0,this},"more"),reject:l(function(){if(this.options.backtrack_lexer)this._backtrack=!0;else return this.parseError("Lexical error on line "+(this.yylineno+1)+`. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).
`+this.showPosition(),{text:"",token:null,line:this.yylineno});return this},"reject"),less:l(function(o){this.unput(this.match.slice(o))},"less"),pastInput:l(function(){var o=this.matched.substr(0,this.matched.length-this.match.length);return(o.length>20?"...":"")+o.substr(-20).replace(/\n/g,"")},"pastInput"),upcomingInput:l(function(){var o=this.match;return o.length<20&&(o+=this._input.substr(0,20-o.length)),(o.substr(0,20)+(o.length>20?"...":"")).replace(/\n/g,"")},"upcomingInput"),showPosition:l(function(){var o=this.pastInput(),d=new Array(o.length+1).join("-");return o+this.upcomingInput()+`
`+d+"^"},"showPosition"),test_match:l(function(o,d){var c,f,t;if(this.options.backtrack_lexer&&(t={yylineno:this.yylineno,yylloc:{first_line:this.yylloc.first_line,last_line:this.last_line,first_column:this.yylloc.first_column,last_column:this.yylloc.last_column},yytext:this.yytext,match:this.match,matches:this.matches,matched:this.matched,yyleng:this.yyleng,offset:this.offset,_more:this._more,_input:this._input,yy:this.yy,conditionStack:this.conditionStack.slice(0),done:this.done},this.options.ranges&&(t.yylloc.range=this.yylloc.range.slice(0))),f=o[0].match(/(?:\r\n?|\n).*/g),f&&(this.yylineno+=f.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:f?f[f.length-1].length-f[f.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+o[0].length},this.yytext+=o[0],this.match+=o[0],this.matches=o,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._backtrack=!1,this._input=this._input.slice(o[0].length),this.matched+=o[0],c=this.performAction.call(this,this.yy,this,d,this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),c)return c;if(this._backtrack){for(var h in t)this[h]=t[h];return!1}return!1},"test_match"),next:l(function(){if(this.done)return this.EOF;this._input||(this.done=!0);var o,d,c,f;this._more||(this.yytext="",this.match="");for(var t=this._currentRules(),h=0;h<t.length;h++)if(c=this._input.match(this.rules[t[h]]),c&&(!d||c[0].length>d[0].length)){if(d=c,f=h,this.options.backtrack_lexer){if(o=this.test_match(c,t[h]),o!==!1)return o;if(this._backtrack){d=!1;continue}else return!1}else if(!this.options.flex)break}return d?(o=this.test_match(d,t[f]),o!==!1?o:!1):this._input===""?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+`. Unrecognized text.
`+this.showPosition(),{text:"",token:null,line:this.yylineno})},"next"),lex:l(function(){var o=this.next();return o||this.lex()},"lex"),begin:l(function(o){this.conditionStack.push(o)},"begin"),popState:l(function(){var o=this.conditionStack.length-1;return o>0?this.conditionStack.pop():this.conditionStack[0]},"popState"),_currentRules:l(function(){return this.conditionStack.length&&this.conditionStack[this.conditionStack.length-1]?this.conditions[this.conditionStack[this.conditionStack.length-1]].rules:this.conditions.INITIAL.rules},"_currentRules"),topState:l(function(o){return o=this.conditionStack.length-1-Math.abs(o||0),o>=0?this.conditionStack[o]:"INITIAL"},"topState"),pushState:l(function(o){this.begin(o)},"pushState"),stateStackSize:l(function(){return this.conditionStack.length},"stateStackSize"),options:{"case-insensitive":!0},performAction:l(function(o,d,c,f){switch(c){case 0:return this.begin("open_directive"),"open_directive";case 1:return this.begin("acc_title"),31;case 2:return this.popState(),"acc_title_value";case 3:return this.begin("acc_descr"),33;case 4:return this.popState(),"acc_descr_value";case 5:this.begin("acc_descr_multiline");break;case 6:this.popState();break;case 7:return"acc_descr_multiline_value";case 8:break;case 9:break;case 10:break;case 11:return 10;case 12:break;case 13:break;case 14:this.begin("href");break;case 15:this.popState();break;case 16:return 43;case 17:this.begin("callbackname");break;case 18:this.popState();break;case 19:this.popState(),this.begin("callbackargs");break;case 20:return 41;case 21:this.popState();break;case 22:return 42;case 23:this.begin("click");break;case 24:this.popState();break;case 25:return 40;case 26:return 4;case 27:return 22;case 28:return 23;case 29:return 24;case 30:return 25;case 31:return 26;case 32:return 28;case 33:return 27;case 34:return 29;case 35:return 12;case 36:return 13;case 37:return 14;case 38:return 15;case 39:return 16;case 40:return 17;case 41:return 18;case 42:return 20;case 43:return 21;case 44:return"date";case 45:return 30;case 46:return"accDescription";case 47:return 36;case 48:return 38;case 49:return 39;case 50:return":";case 51:return 6;case 52:return"INVALID"}},"anonymous"),rules:[/^(?:%%\{)/i,/^(?:accTitle\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*:\s*)/i,/^(?:(?!\n||)*[^\n]*)/i,/^(?:accDescr\s*\{\s*)/i,/^(?:[\}])/i,/^(?:[^\}]*)/i,/^(?:%%(?!\{)*[^\n]*)/i,/^(?:[^\}]%%*[^\n]*)/i,/^(?:%%*[^\n]*[\n]*)/i,/^(?:[\n]+)/i,/^(?:\s+)/i,/^(?:%[^\n]*)/i,/^(?:href[\s]+["])/i,/^(?:["])/i,/^(?:[^"]*)/i,/^(?:call[\s]+)/i,/^(?:\([\s]*\))/i,/^(?:\()/i,/^(?:[^(]*)/i,/^(?:\))/i,/^(?:[^)]*)/i,/^(?:click[\s]+)/i,/^(?:[\s\n])/i,/^(?:[^\s\n]*)/i,/^(?:gantt\b)/i,/^(?:dateFormat\s[^#\n;]+)/i,/^(?:inclusiveEndDates\b)/i,/^(?:topAxis\b)/i,/^(?:axisFormat\s[^#\n;]+)/i,/^(?:tickInterval\s[^#\n;]+)/i,/^(?:includes\s[^#\n;]+)/i,/^(?:excludes\s[^#\n;]+)/i,/^(?:todayMarker\s[^\n;]+)/i,/^(?:weekday\s+monday\b)/i,/^(?:weekday\s+tuesday\b)/i,/^(?:weekday\s+wednesday\b)/i,/^(?:weekday\s+thursday\b)/i,/^(?:weekday\s+friday\b)/i,/^(?:weekday\s+saturday\b)/i,/^(?:weekday\s+sunday\b)/i,/^(?:weekend\s+friday\b)/i,/^(?:weekend\s+saturday\b)/i,/^(?:\d\d\d\d-\d\d-\d\d\b)/i,/^(?:title\s[^\n]+)/i,/^(?:accDescription\s[^#\n;]+)/i,/^(?:section\s[^\n]+)/i,/^(?:[^:\n]+)/i,/^(?::[^#\n;]+)/i,/^(?::)/i,/^(?:$)/i,/^(?:.)/i],conditions:{acc_descr_multiline:{rules:[6,7],inclusive:!1},acc_descr:{rules:[4],inclusive:!1},acc_title:{rules:[2],inclusive:!1},callbackargs:{rules:[21,22],inclusive:!1},callbackname:{rules:[18,19,20],inclusive:!1},href:{rules:[15,16],inclusive:!1},click:{rules:[24,25],inclusive:!1},INITIAL:{rules:[0,1,3,5,8,9,10,11,12,13,14,17,23,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52],inclusive:!0}}};return g})();v.lexer=b;function m(){this.yy={}}return l(m,"Parser"),m.prototype=v,v.Parser=m,new m})();St.parser=St;var Pe=St,ze=dt(Le()),Z=dt(te()),Be=dt(Ye()),Oe=dt(We()),je=dt(Fe());Z.default.extend(Be.default);Z.default.extend(Oe.default);Z.default.extend(je.default);var Kt={friday:5,saturday:6},R="",It="",Yt,Wt="",yt=[],kt=[],Ft=new Map,Pt=[],_t=[],ct="",zt="",ee=["active","done","crit","milestone","vert"],Bt=[],mt=!1,Ot=!1,jt="sunday",$t="saturday",Et=0,Ge=l(function(){Pt=[],_t=[],ct="",Bt=[],vt=0,At=void 0,xt=void 0,z=[],R="",It="",zt="",Yt=void 0,Wt="",yt=[],kt=[],mt=!1,Ot=!1,Et=0,Ft=new Map,Ae(),jt="sunday",$t="saturday"},"clear"),Ne=l(function(e){It=e},"setAxisFormat"),qe=l(function(){return It},"getAxisFormat"),Ue=l(function(e){Yt=e},"setTickInterval"),Ze=l(function(){return Yt},"getTickInterval"),He=l(function(e){Wt=e},"setTodayMarker"),Ve=l(function(){return Wt},"getTodayMarker"),Re=l(function(e){R=e},"setDateFormat"),Xe=l(function(){mt=!0},"enableInclusiveEndDates"),Ke=l(function(){return mt},"endDatesAreInclusive"),Qe=l(function(){Ot=!0},"enableTopAxis"),Je=l(function(){return Ot},"topAxisEnabled"),ti=l(function(e){zt=e},"setDisplayMode"),ei=l(function(){return zt},"getDisplayMode"),ii=l(function(){return R},"getDateFormat"),ri=l(function(e){yt=e.toLowerCase().split(/[\s,]+/)},"setIncludes"),si=l(function(){return yt},"getIncludes"),ai=l(function(e){kt=e.toLowerCase().split(/[\s,]+/)},"setExcludes"),ni=l(function(){return kt},"getExcludes"),oi=l(function(){return Ft},"getLinks"),li=l(function(e){ct=e,Pt.push(e)},"addSection"),ci=l(function(){return Pt},"getSections"),di=l(function(){let e=Qt(),s=10,i=0;for(;!e&&i<s;)e=Qt(),i++;return _t=z,_t},"getTasks"),ie=l(function(e,s,i,r){let a=e.format(s.trim()),u=e.format("YYYY-MM-DD");return r.includes(a)||r.includes(u)?!1:i.includes("weekends")&&(e.isoWeekday()===Kt[$t]||e.isoWeekday()===Kt[$t]+1)||i.includes(e.format("dddd").toLowerCase())?!0:i.includes(a)||i.includes(u)},"isInvalidDate"),ui=l(function(e){jt=e},"setWeekday"),hi=l(function(){return jt},"getWeekday"),fi=l(function(e){$t=e},"setWeekend"),re=l(function(e,s,i,r){if(!i.length||e.manualEndTime)return;let a;e.startTime instanceof Date?a=(0,Z.default)(e.startTime):a=(0,Z.default)(e.startTime,s,!0),a=a.add(1,"d");let u;e.endTime instanceof Date?u=(0,Z.default)(e.endTime):u=(0,Z.default)(e.endTime,s,!0);let[y,$]=yi(a,u,s,i,r);e.endTime=y.toDate(),e.renderEndTime=$},"checkTaskDates"),yi=l(function(e,s,i,r,a){let u=!1,y=null;for(;e<=s;)u||(y=s.toDate()),u=ie(e,i,r,a),u&&(s=s.add(1,"d")),e=e.add(1,"d");return[s,y]},"fixTaskDates"),Mt=l(function(e,s,i){i=i.trim();let r=/^after\s+(?<ids>[\d\w- ]+)/.exec(i);if(r!==null){let u=null;for(let $ of r.groups.ids.split(" ")){let L=et($);L!==void 0&&(!u||L.endTime>u.endTime)&&(u=L)}if(u)return u.endTime;let y=new Date;return y.setHours(0,0,0,0),y}let a=(0,Z.default)(i,s.trim(),!0);if(a.isValid())return a.toDate();{wt.debug("Invalid date:"+i),wt.debug("With date format:"+s.trim());let u=new Date(i);if(u===void 0||isNaN(u.getTime())||u.getFullYear()<-1e4||u.getFullYear()>1e4)throw new Error("Invalid date:"+i);return u}},"getStartDate"),se=l(function(e){let s=/^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(e.trim());return s!==null?[Number.parseFloat(s[1]),s[2]]:[NaN,"ms"]},"parseDuration"),ae=l(function(e,s,i,r=!1){i=i.trim();let a=/^until\s+(?<ids>[\d\w- ]+)/.exec(i);if(a!==null){let D=null;for(let E of a.groups.ids.split(" ")){let W=et(E);W!==void 0&&(!D||W.startTime<D.startTime)&&(D=W)}if(D)return D.startTime;let x=new Date;return x.setHours(0,0,0,0),x}let u=(0,Z.default)(i,s.trim(),!0);if(u.isValid())return r&&(u=u.add(1,"d")),u.toDate();let y=(0,Z.default)(e),[$,L]=se(i);if(!Number.isNaN($)){let D=y.add($,L);D.isValid()&&(y=D)}return y.toDate()},"getEndDate"),vt=0,lt=l(function(e){return e===void 0?(vt=vt+1,"task"+vt):e},"parseId"),ki=l(function(e,s){let i;s.substr(0,1)===":"?i=s.substr(1,s.length):i=s;let r=i.split(","),a={};Gt(r,a,ee);for(let y=0;y<r.length;y++)r[y]=r[y].trim();let u="";switch(r.length){case 1:a.id=lt(),a.startTime=e.endTime,u=r[0];break;case 2:a.id=lt(),a.startTime=Mt(void 0,R,r[0]),u=r[1];break;case 3:a.id=lt(r[0]),a.startTime=Mt(void 0,R,r[1]),u=r[2];break}return u&&(a.endTime=ae(a.startTime,R,u,mt),a.manualEndTime=(0,Z.default)(u,"YYYY-MM-DD",!0).isValid(),re(a,R,kt,yt)),a},"compileData"),mi=l(function(e,s){let i;s.substr(0,1)===":"?i=s.substr(1,s.length):i=s;let r=i.split(","),a={};Gt(r,a,ee);for(let u=0;u<r.length;u++)r[u]=r[u].trim();switch(r.length){case 1:a.id=lt(),a.startTime={type:"prevTaskEnd",id:e},a.endTime={data:r[0]};break;case 2:a.id=lt(),a.startTime={type:"getStartDate",startData:r[0]},a.endTime={data:r[1]};break;case 3:a.id=lt(r[0]),a.startTime={type:"getStartDate",startData:r[1]},a.endTime={data:r[2]};break}return a},"parseData"),At,xt,z=[],ne={},pi=l(function(e,s){let i={section:ct,type:ct,processed:!1,manualEndTime:!1,renderEndTime:null,raw:{data:s},task:e,classes:[]},r=mi(xt,s);i.raw.startTime=r.startTime,i.raw.endTime=r.endTime,i.id=r.id,i.prevTaskId=xt,i.active=r.active,i.done=r.done,i.crit=r.crit,i.milestone=r.milestone,i.vert=r.vert,i.order=Et,Et++;let a=z.push(i);xt=i.id,ne[i.id]=a-1},"addTask"),et=l(function(e){let s=ne[e];return z[s]},"findTaskById"),gi=l(function(e,s){let i={section:ct,type:ct,description:e,task:e,classes:[]},r=ki(At,s);i.startTime=r.startTime,i.endTime=r.endTime,i.id=r.id,i.active=r.active,i.done=r.done,i.crit=r.crit,i.milestone=r.milestone,i.vert=r.vert,At=i,_t.push(i)},"addTaskOrg"),Qt=l(function(){let e=l(function(i){let r=z[i],a="";switch(z[i].raw.startTime.type){case"prevTaskEnd":{let u=et(r.prevTaskId);r.startTime=u.endTime;break}case"getStartDate":a=Mt(void 0,R,z[i].raw.startTime.startData),a&&(z[i].startTime=a);break}return z[i].startTime&&(z[i].endTime=ae(z[i].startTime,R,z[i].raw.endTime.data,mt),z[i].endTime&&(z[i].processed=!0,z[i].manualEndTime=(0,Z.default)(z[i].raw.endTime.data,"YYYY-MM-DD",!0).isValid(),re(z[i],R,kt,yt))),z[i].processed},"compileTask"),s=!0;for(let[i,r]of z.entries())e(i),s=s&&r.processed;return s},"compileTasks"),bi=l(function(e,s){let i=s;ot().securityLevel!=="loose"&&(i=(0,ze.sanitizeUrl)(s)),e.split(",").forEach(function(r){et(r)!==void 0&&(le(r,()=>{window.open(i,"_self")}),Ft.set(r,i))}),oe(e,"clickable")},"setLink"),oe=l(function(e,s){e.split(",").forEach(function(i){let r=et(i);r!==void 0&&r.classes.push(s)})},"setClass"),Ti=l(function(e,s,i){if(ot().securityLevel!=="loose"||s===void 0)return;let r=[];if(typeof i=="string"){r=i.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);for(let a=0;a<r.length;a++){let u=r[a].trim();u.startsWith('"')&&u.endsWith('"')&&(u=u.substr(1,u.length-2)),r[a]=u}}r.length===0&&r.push(e),et(e)!==void 0&&le(e,()=>{Ie.runFunc(s,...r)})},"setClickFun"),le=l(function(e,s){Bt.push(function(){let i=document.querySelector(`[id="${e}"]`);i!==null&&i.addEventListener("click",function(){s()})},function(){let i=document.querySelector(`[id="${e}-text"]`);i!==null&&i.addEventListener("click",function(){s()})})},"pushFun"),vi=l(function(e,s,i){e.split(",").forEach(function(r){Ti(r,s,i)}),oe(e,"clickable")},"setClickEvent"),xi=l(function(e){Bt.forEach(function(s){s(e)})},"bindFunctions"),wi={getConfig:l(()=>ot().gantt,"getConfig"),clear:Ge,setDateFormat:Re,getDateFormat:ii,enableInclusiveEndDates:Xe,endDatesAreInclusive:Ke,enableTopAxis:Qe,topAxisEnabled:Je,setAxisFormat:Ne,getAxisFormat:qe,setTickInterval:Ue,getTickInterval:Ze,setTodayMarker:He,getTodayMarker:Ve,setAccTitle:ye,getAccTitle:fe,setDiagramTitle:he,getDiagramTitle:ue,setDisplayMode:ti,getDisplayMode:ei,setAccDescription:de,getAccDescription:ce,addSection:li,getSections:ci,getTasks:di,addTask:pi,findTaskById:et,addTaskOrg:gi,setIncludes:ri,getIncludes:si,setExcludes:ai,getExcludes:ni,setClickEvent:vi,setLink:bi,getLinks:oi,bindFunctions:xi,parseDuration:se,isInvalidDate:ie,setWeekday:ui,getWeekday:hi,setWeekend:fi};function Gt(e,s,i){let r=!0;for(;r;)r=!1,i.forEach(function(a){let u="^\\s*"+a+"\\s*$",y=new RegExp(u);e[0].match(y)&&(s[a]=!0,e.shift(1),r=!0)})}l(Gt,"getTaskTags");var Ct=dt(te()),_i=l(function(){wt.debug("Something is calling, setConf, remove the call")},"setConf"),Jt={monday:Se,tuesday:Ce,wednesday:De,thursday:$e,friday:_e,saturday:we,sunday:xe},$i=l((e,s)=>{let i=[...e].map(()=>-1/0),r=[...e].sort((u,y)=>u.startTime-y.startTime||u.order-y.order),a=0;for(let u of r)for(let y=0;y<i.length;y++)if(u.startTime>=i[y]){i[y]=u.endTime,u.order=y+s,y>a&&(a=y);break}return a},"getMaxIntersections"),Q,Di=l(function(e,s,i,r){let a=ot().gantt,u=ot().securityLevel,y;u==="sandbox"&&(y=Tt("#i"+s));let $=u==="sandbox"?Tt(y.nodes()[0].contentDocument.body):Tt("body"),L=u==="sandbox"?y.nodes()[0].contentDocument:document,D=L.getElementById(s);Q=D.parentElement.offsetWidth,Q===void 0&&(Q=1200),a.useWidth!==void 0&&(Q=a.useWidth);let x=r.db.getTasks(),E=[];for(let k of x)E.push(k.type);E=q(E);let W={},j=2*a.topPadding;if(r.db.getDisplayMode()==="compact"||a.displayMode==="compact"){let k={};for(let v of x)k[v.section]===void 0?k[v.section]=[v]:k[v.section].push(v);let T=0;for(let v of Object.keys(k)){let b=$i(k[v],T)+1;T+=b,j+=b*(a.barHeight+a.barGap),W[v]=b}}else{j+=x.length*(a.barHeight+a.barGap);for(let k of E)W[k]=x.filter(T=>T.type===k).length}D.setAttribute("viewBox","0 0 "+Q+" "+j);let B=$.select(`[id="${s}"]`),C=ke().domain([me(x,function(k){return k.startTime}),pe(x,function(k){return k.endTime})]).rangeRound([0,Q-a.leftPadding-a.rightPadding]);function p(k,T){let v=k.startTime,b=T.startTime,m=0;return v>b?m=1:v<b&&(m=-1),m}l(p,"taskCompare"),x.sort(p),S(x,Q,j),ge(B,j,Q,a.useMaxWidth),B.append("text").text(r.db.getDiagramTitle()).attr("x",Q/2).attr("y",a.titleTopMargin).attr("class","titleText");function S(k,T,v){let b=a.barHeight,m=b+a.barGap,g=a.topPadding,o=a.leftPadding,d=be().domain([0,E.length]).range(["#00B9FA","#F95002"]).interpolate(Te);A(m,g,o,T,v,k,r.db.getExcludes(),r.db.getIncludes()),G(o,g,T,v),M(k,m,g,o,b,d,T),N(m,g),H(o,g,T,v)}l(S,"makeGantt");function M(k,T,v,b,m,g,o){k.sort((t,h)=>t.vert===h.vert?0:t.vert?1:-1);let d=[...new Set(k.map(t=>t.order))].map(t=>k.find(h=>h.order===t));B.append("g").selectAll("rect").data(d).enter().append("rect").attr("x",0).attr("y",function(t,h){return h=t.order,h*T+v-2}).attr("width",function(){return o-a.rightPadding/2}).attr("height",T).attr("class",function(t){for(let[h,n]of E.entries())if(t.type===n)return"section section"+h%a.numberSectionStyles;return"section section0"}).enter();let c=B.append("g").selectAll("rect").data(k).enter(),f=r.db.getLinks();if(c.append("rect").attr("id",function(t){return t.id}).attr("rx",3).attr("ry",3).attr("x",function(t){return t.milestone?C(t.startTime)+b+.5*(C(t.endTime)-C(t.startTime))-.5*m:C(t.startTime)+b}).attr("y",function(t,h){return h=t.order,t.vert?a.gridLineStartPadding:h*T+v}).attr("width",function(t){return t.milestone?m:t.vert?.08*m:C(t.renderEndTime||t.endTime)-C(t.startTime)}).attr("height",function(t){return t.vert?x.length*(a.barHeight+a.barGap)+a.barHeight*2:m}).attr("transform-origin",function(t,h){return h=t.order,(C(t.startTime)+b+.5*(C(t.endTime)-C(t.startTime))).toString()+"px "+(h*T+v+.5*m).toString()+"px"}).attr("class",function(t){let h="task",n="";t.classes.length>0&&(n=t.classes.join(" "));let _=0;for(let[I,Y]of E.entries())t.type===Y&&(_=I%a.numberSectionStyles);let w="";return t.active?t.crit?w+=" activeCrit":w=" active":t.done?t.crit?w=" doneCrit":w=" done":t.crit&&(w+=" crit"),w.length===0&&(w=" task"),t.milestone&&(w=" milestone "+w),t.vert&&(w=" vert "+w),w+=_,w+=" "+n,h+w}),c.append("text").attr("id",function(t){return t.id+"-text"}).text(function(t){return t.task}).attr("font-size",a.fontSize).attr("x",function(t){let h=C(t.startTime),n=C(t.renderEndTime||t.endTime);if(t.milestone&&(h+=.5*(C(t.endTime)-C(t.startTime))-.5*m,n=h+m),t.vert)return C(t.startTime)+b;let _=this.getBBox().width;return _>n-h?n+_+1.5*a.leftPadding>o?h+b-5:n+b+5:(n-h)/2+h+b}).attr("y",function(t,h){return t.vert?a.gridLineStartPadding+x.length*(a.barHeight+a.barGap)+60:(h=t.order,h*T+a.barHeight/2+(a.fontSize/2-2)+v)}).attr("text-height",m).attr("class",function(t){let h=C(t.startTime),n=C(t.endTime);t.milestone&&(n=h+m);let _=this.getBBox().width,w="";t.classes.length>0&&(w=t.classes.join(" "));let I=0;for(let[it,ut]of E.entries())t.type===ut&&(I=it%a.numberSectionStyles);let Y="";return t.active&&(t.crit?Y="activeCritText"+I:Y="activeText"+I),t.done?t.crit?Y=Y+" doneCritText"+I:Y=Y+" doneText"+I:t.crit&&(Y=Y+" critText"+I),t.milestone&&(Y+=" milestoneText"),t.vert&&(Y+=" vertText"),_>n-h?n+_+1.5*a.leftPadding>o?w+" taskTextOutsideLeft taskTextOutside"+I+" "+Y:w+" taskTextOutsideRight taskTextOutside"+I+" "+Y+" width-"+_:w+" taskText taskText"+I+" "+Y+" width-"+_}),ot().securityLevel==="sandbox"){let t;t=Tt("#i"+s);let h=t.nodes()[0].contentDocument;c.filter(function(n){return f.has(n.id)}).each(function(n){var _=h.querySelector("#"+n.id),w=h.querySelector("#"+n.id+"-text");let I=_.parentNode;var Y=h.createElement("a");Y.setAttribute("xlink:href",f.get(n.id)),Y.setAttribute("target","_top"),I.appendChild(Y),Y.appendChild(_),Y.appendChild(w)})}}l(M,"drawRects");function A(k,T,v,b,m,g,o,d){if(o.length===0&&d.length===0)return;let c,f;for(let{startTime:w,endTime:I}of g)(c===void 0||w<c)&&(c=w),(f===void 0||I>f)&&(f=I);if(!c||!f)return;if((0,Ct.default)(f).diff((0,Ct.default)(c),"year")>5){wt.warn("The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days.");return}let t=r.db.getDateFormat(),h=[],n=null,_=(0,Ct.default)(c);for(;_.valueOf()<=f;)r.db.isInvalidDate(_,t,o,d)?n?n.end=_:n={start:_,end:_}:n&&(h.push(n),n=null),_=_.add(1,"d");B.append("g").selectAll("rect").data(h).enter().append("rect").attr("id",w=>"exclude-"+w.start.format("YYYY-MM-DD")).attr("x",w=>C(w.start.startOf("day"))+v).attr("y",a.gridLineStartPadding).attr("width",w=>C(w.end.endOf("day"))-C(w.start.startOf("day"))).attr("height",m-T-a.gridLineStartPadding).attr("transform-origin",function(w,I){return(C(w.start)+v+.5*(C(w.end)-C(w.start))).toString()+"px "+(I*k+.5*m).toString()+"px"}).attr("class","exclude-range")}l(A,"drawExcludeDays");function G(k,T,v,b){let m=r.db.getDateFormat(),g=r.db.getAxisFormat(),o;g?o=g:m==="D"?o="%d":o=a.axisFormat??"%Y-%m-%d";let d=ve(C).tickSize(-b+T+a.gridLineStartPadding).tickFormat(qt(o)),c=/^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/.exec(r.db.getTickInterval()||a.tickInterval);if(c!==null){let f=c[1],t=c[2],h=r.db.getWeekday()||a.weekday;switch(t){case"millisecond":d.ticks(Xt.every(f));break;case"second":d.ticks(Rt.every(f));break;case"minute":d.ticks(Vt.every(f));break;case"hour":d.ticks(Ht.every(f));break;case"day":d.ticks(Zt.every(f));break;case"week":d.ticks(Jt[h].every(f));break;case"month":d.ticks(Ut.every(f));break}}if(B.append("g").attr("class","grid").attr("transform","translate("+k+", "+(b-50)+")").call(d).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10).attr("dy","1em"),r.db.topAxisEnabled()||a.topAxis){let f=Ee(C).tickSize(-b+T+a.gridLineStartPadding).tickFormat(qt(o));if(c!==null){let t=c[1],h=c[2],n=r.db.getWeekday()||a.weekday;switch(h){case"millisecond":f.ticks(Xt.every(t));break;case"second":f.ticks(Rt.every(t));break;case"minute":f.ticks(Vt.every(t));break;case"hour":f.ticks(Ht.every(t));break;case"day":f.ticks(Zt.every(t));break;case"week":f.ticks(Jt[n].every(t));break;case"month":f.ticks(Ut.every(t));break}}B.append("g").attr("class","grid").attr("transform","translate("+k+", "+T+")").call(f).selectAll("text").style("text-anchor","middle").attr("fill","#000").attr("stroke","none").attr("font-size",10)}}l(G,"makeGrid");function N(k,T){let v=0,b=Object.keys(W).map(m=>[m,W[m]]);B.append("g").selectAll("text").data(b).enter().append(function(m){let g=m[0].split(Me.lineBreakRegex),o=-(g.length-1)/2,d=L.createElementNS("http://www.w3.org/2000/svg","text");d.setAttribute("dy",o+"em");for(let[c,f]of g.entries()){let t=L.createElementNS("http://www.w3.org/2000/svg","tspan");t.setAttribute("alignment-baseline","central"),t.setAttribute("x","10"),c>0&&t.setAttribute("dy","1em"),t.textContent=f,d.appendChild(t)}return d}).attr("x",10).attr("y",function(m,g){if(g>0)for(let o=0;o<g;o++)return v+=b[g-1][1],m[1]*k/2+v*k+T;else return m[1]*k/2+T}).attr("font-size",a.sectionFontSize).attr("class",function(m){for(let[g,o]of E.entries())if(m[0]===o)return"sectionTitle sectionTitle"+g%a.numberSectionStyles;return"sectionTitle"})}l(N,"vertLabels");function H(k,T,v,b){let m=r.db.getTodayMarker();if(m==="off")return;let g=B.append("g").attr("class","today"),o=new Date,d=g.append("line");d.attr("x1",C(o)+k).attr("x2",C(o)+k).attr("y1",a.titleTopMargin).attr("y2",b-a.titleTopMargin).attr("class","today"),m!==""&&d.attr("style",m.replace(/,/g,";"))}l(H,"drawToday");function q(k){let T={},v=[];for(let b=0,m=k.length;b<m;++b)Object.prototype.hasOwnProperty.call(T,k[b])||(T[k[b]]=!0,v.push(k[b]));return v}l(q,"checkUnique")},"draw"),Ci={setConf:_i,draw:Di},Si=l(e=>`
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

  .vert {
    stroke: ${e.vertLineColor};
  }

  .vertText {
    font-size: 15px;
    text-anchor: middle;
    fill: ${e.vertLineColor} !important;
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
`,"getStyles"),Ei=Si,Li={parser:Pe,db:wi,renderer:Ci,styles:Ei};export{Li as diagram};
