/* eslint-disable */
//prettier-ignore
module.exports = {
name: "@yarnpkg/plugin-npmrc",
factory: function (require) {
"use strict";
var plugin = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/ini/lib/ini.js
  var require_ini = __commonJS({
    "node_modules/ini/lib/ini.js"(exports, module) {
      var { hasOwnProperty } = Object.prototype;
      var encode = (obj, opt = {}) => {
        if (typeof opt === "string") {
          opt = { section: opt };
        }
        opt.align = opt.align === true;
        opt.newline = opt.newline === true;
        opt.sort = opt.sort === true;
        opt.whitespace = opt.whitespace === true || opt.align === true;
        opt.platform = opt.platform || typeof process !== "undefined" && process.platform;
        opt.bracketedArray = opt.bracketedArray !== false;
        const eol = opt.platform === "win32" ? "\r\n" : "\n";
        const separator = opt.whitespace ? " = " : "=";
        const children = [];
        const keys = opt.sort ? Object.keys(obj).sort() : Object.keys(obj);
        let padToChars = 0;
        if (opt.align) {
          padToChars = safe(
            keys.filter((k) => obj[k] === null || Array.isArray(obj[k]) || typeof obj[k] !== "object").map((k) => Array.isArray(obj[k]) ? `${k}[]` : k).concat([""]).reduce((a, b) => safe(a).length >= safe(b).length ? a : b)
          ).length;
        }
        let out = "";
        const arraySuffix = opt.bracketedArray ? "[]" : "";
        for (const k of keys) {
          const val = obj[k];
          if (val && Array.isArray(val)) {
            for (const item of val) {
              out += safe(`${k}${arraySuffix}`).padEnd(padToChars, " ") + separator + safe(item) + eol;
            }
          } else if (val && typeof val === "object") {
            children.push(k);
          } else {
            out += safe(k).padEnd(padToChars, " ") + separator + safe(val) + eol;
          }
        }
        if (opt.section && out.length) {
          out = "[" + safe(opt.section) + "]" + (opt.newline ? eol + eol : eol) + out;
        }
        for (const k of children) {
          const nk = splitSections(k, ".").join("\\.");
          const section = (opt.section ? opt.section + "." : "") + nk;
          const child = encode(obj[k], {
            ...opt,
            section
          });
          if (out.length && child.length) {
            out += eol;
          }
          out += child;
        }
        return out;
      };
      function splitSections(str, separator) {
        var lastMatchIndex = 0;
        var lastSeparatorIndex = 0;
        var nextIndex = 0;
        var sections = [];
        do {
          nextIndex = str.indexOf(separator, lastMatchIndex);
          if (nextIndex !== -1) {
            lastMatchIndex = nextIndex + separator.length;
            if (nextIndex > 0 && str[nextIndex - 1] === "\\") {
              continue;
            }
            sections.push(str.slice(lastSeparatorIndex, nextIndex));
            lastSeparatorIndex = nextIndex + separator.length;
          }
        } while (nextIndex !== -1);
        sections.push(str.slice(lastSeparatorIndex));
        return sections;
      }
      var decode = (str, opt = {}) => {
        opt.bracketedArray = opt.bracketedArray !== false;
        const out = /* @__PURE__ */ Object.create(null);
        let p = out;
        let section = null;
        const re = /^\[([^\]]*)\]\s*$|^([^=]+)(=(.*))?$/i;
        const lines = str.split(/[\r\n]+/g);
        const duplicates = {};
        for (const line of lines) {
          if (!line || line.match(/^\s*[;#]/) || line.match(/^\s*$/)) {
            continue;
          }
          const match = line.match(re);
          if (!match) {
            continue;
          }
          if (match[1] !== void 0) {
            section = unsafe(match[1]);
            if (section === "__proto__") {
              p = /* @__PURE__ */ Object.create(null);
              continue;
            }
            p = out[section] = out[section] || /* @__PURE__ */ Object.create(null);
            continue;
          }
          const keyRaw = unsafe(match[2]);
          let isArray;
          if (opt.bracketedArray) {
            isArray = keyRaw.length > 2 && keyRaw.slice(-2) === "[]";
          } else {
            duplicates[keyRaw] = (duplicates?.[keyRaw] || 0) + 1;
            isArray = duplicates[keyRaw] > 1;
          }
          const key = isArray && keyRaw.endsWith("[]") ? keyRaw.slice(0, -2) : keyRaw;
          if (key === "__proto__") {
            continue;
          }
          const valueRaw = match[3] ? unsafe(match[4]) : true;
          const value = valueRaw === "true" || valueRaw === "false" || valueRaw === "null" ? JSON.parse(valueRaw) : valueRaw;
          if (isArray) {
            if (!hasOwnProperty.call(p, key)) {
              p[key] = [];
            } else if (!Array.isArray(p[key])) {
              p[key] = [p[key]];
            }
          }
          if (Array.isArray(p[key])) {
            p[key].push(value);
          } else {
            p[key] = value;
          }
        }
        const remove = [];
        for (const k of Object.keys(out)) {
          if (!hasOwnProperty.call(out, k) || typeof out[k] !== "object" || Array.isArray(out[k])) {
            continue;
          }
          const parts = splitSections(k, ".");
          p = out;
          const l = parts.pop();
          const nl = l.replace(/\\\./g, ".");
          for (const part of parts) {
            if (part === "__proto__") {
              continue;
            }
            if (!hasOwnProperty.call(p, part) || typeof p[part] !== "object") {
              p[part] = /* @__PURE__ */ Object.create(null);
            }
            p = p[part];
          }
          if (p === out && nl === l) {
            continue;
          }
          p[nl] = out[k];
          remove.push(k);
        }
        for (const del of remove) {
          delete out[del];
        }
        return out;
      };
      var isQuoted = (val) => {
        return val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'");
      };
      var safe = (val) => {
        if (typeof val !== "string" || val.match(/[=\r\n]/) || val.match(/^\[/) || val.length > 1 && isQuoted(val) || val !== val.trim()) {
          return JSON.stringify(val);
        }
        return val.split(";").join("\\;").split("#").join("\\#");
      };
      var unsafe = (val) => {
        val = (val || "").trim();
        if (isQuoted(val)) {
          if (val.charAt(0) === "'") {
            val = val.slice(1, -1);
          }
          try {
            val = JSON.parse(val);
          } catch {
          }
        } else {
          let esc = false;
          let unesc = "";
          for (let i = 0, l = val.length; i < l; i++) {
            const c = val.charAt(i);
            if (esc) {
              if ("\\;#".indexOf(c) !== -1) {
                unesc += c;
              } else {
                unesc += "\\" + c;
              }
              esc = false;
            } else if (";#".indexOf(c) !== -1) {
              break;
            } else if (c === "\\") {
              esc = true;
            } else {
              unesc += c;
            }
          }
          if (esc) {
            unesc += "\\";
          }
          return unesc.trim();
        }
        return val;
      };
      module.exports = {
        parse: decode,
        decode,
        stringify: encode,
        encode,
        safe,
        unsafe
      };
    }
  });

  // node_modules/abbrev/lib/index.js
  var require_lib = __commonJS({
    "node_modules/abbrev/lib/index.js"(exports, module) {
      module.exports = abbrev;
      function abbrev(...args) {
        let list = args;
        if (args.length === 1 && (Array.isArray(args[0]) || typeof args[0] === "string")) {
          list = [].concat(args[0]);
        }
        for (let i = 0, l = list.length; i < l; i++) {
          list[i] = typeof list[i] === "string" ? list[i] : String(list[i]);
        }
        list = list.sort(lexSort);
        const abbrevs = {};
        let prev = "";
        for (let ii = 0, ll = list.length; ii < ll; ii++) {
          const current = list[ii];
          const next = list[ii + 1] || "";
          let nextMatches = true;
          let prevMatches = true;
          if (current === next) {
            continue;
          }
          let j = 0;
          const cl = current.length;
          for (; j < cl; j++) {
            const curChar = current.charAt(j);
            nextMatches = nextMatches && curChar === next.charAt(j);
            prevMatches = prevMatches && curChar === prev.charAt(j);
            if (!nextMatches && !prevMatches) {
              j++;
              break;
            }
          }
          prev = current;
          if (j === cl) {
            abbrevs[current] = current;
            continue;
          }
          for (let a = current.slice(0, j); j <= cl; j++) {
            abbrevs[a] = current;
            a += current.charAt(j);
          }
        }
        return abbrevs;
      }
      function lexSort(a, b) {
        return a === b ? 0 : a > b ? 1 : -1;
      }
    }
  });

  // node_modules/nopt/lib/debug.js
  var require_debug = __commonJS({
    "node_modules/nopt/lib/debug.js"(exports, module) {
      module.exports = process.env.DEBUG_NOPT || process.env.NOPT_DEBUG ? (...a) => console.error(...a) : () => {
      };
    }
  });

  // node_modules/nopt/lib/type-defs.js
  var require_type_defs = __commonJS({
    "node_modules/nopt/lib/type-defs.js"(exports, module) {
      var url = __require("url");
      var path = __require("path");
      var Stream = __require("stream").Stream;
      var os = __require("os");
      var debug = require_debug();
      function validateString(data, k, val) {
        data[k] = String(val);
      }
      function validatePath(data, k, val) {
        if (val === true) {
          return false;
        }
        if (val === null) {
          return true;
        }
        val = String(val);
        const isWin = process.platform === "win32";
        const homePattern = isWin ? /^~(\/|\\)/ : /^~\//;
        const home = os.homedir();
        if (home && val.match(homePattern)) {
          data[k] = path.resolve(home, val.slice(2));
        } else {
          data[k] = path.resolve(val);
        }
        return true;
      }
      function validateNumber(data, k, val) {
        debug("validate Number %j %j %j", k, val, isNaN(val));
        if (isNaN(val)) {
          return false;
        }
        data[k] = +val;
      }
      function validateDate(data, k, val) {
        const s = Date.parse(val);
        debug("validate Date %j %j %j", k, val, s);
        if (isNaN(s)) {
          return false;
        }
        data[k] = new Date(val);
      }
      function validateBoolean(data, k, val) {
        if (typeof val === "string") {
          if (!isNaN(val)) {
            val = !!+val;
          } else if (val === "null" || val === "false") {
            val = false;
          } else {
            val = true;
          }
        } else {
          val = !!val;
        }
        data[k] = val;
      }
      function validateUrl(data, k, val) {
        val = url.parse(String(val));
        if (!val.host) {
          return false;
        }
        data[k] = val.href;
      }
      function validateStream(data, k, val) {
        if (!(val instanceof Stream)) {
          return false;
        }
        data[k] = val;
      }
      module.exports = {
        String: { type: String, validate: validateString },
        Boolean: { type: Boolean, validate: validateBoolean },
        url: { type: url, validate: validateUrl },
        Number: { type: Number, validate: validateNumber },
        path: { type: path, validate: validatePath },
        Stream: { type: Stream, validate: validateStream },
        Date: { type: Date, validate: validateDate },
        Array: { type: Array }
      };
    }
  });

  // node_modules/nopt/lib/nopt-lib.js
  var require_nopt_lib = __commonJS({
    "node_modules/nopt/lib/nopt-lib.js"(exports, module) {
      var abbrev = require_lib();
      var debug = require_debug();
      var defaultTypeDefs = require_type_defs();
      var hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
      var getType = (k, { types, dynamicTypes }) => {
        let hasType = hasOwn(types, k);
        let type = types[k];
        if (!hasType && typeof dynamicTypes === "function") {
          const matchedType = dynamicTypes(k);
          if (matchedType !== void 0) {
            type = matchedType;
            hasType = true;
          }
        }
        return [hasType, type];
      };
      var isTypeDef = (type, def) => def && type === def;
      var hasTypeDef = (type, def) => def && type.indexOf(def) !== -1;
      var doesNotHaveTypeDef = (type, def) => def && !hasTypeDef(type, def);
      function nopt(args, {
        types,
        shorthands,
        typeDefs,
        invalidHandler,
        // opt is configured but its value does not validate against given type
        unknownHandler,
        // opt is not configured
        abbrevHandler,
        // opt is being expanded via abbrev
        typeDefault,
        dynamicTypes
      } = {}) {
        debug(types, shorthands, args, typeDefs);
        const data = {};
        const argv = {
          remain: [],
          cooked: args,
          original: args.slice(0)
        };
        parse(args, data, argv.remain, {
          typeDefs,
          types,
          dynamicTypes,
          shorthands,
          unknownHandler,
          abbrevHandler
        });
        clean(data, { types, dynamicTypes, typeDefs, invalidHandler, typeDefault });
        data.argv = argv;
        Object.defineProperty(data.argv, "toString", {
          value: function() {
            return this.original.map(JSON.stringify).join(" ");
          },
          enumerable: false
        });
        return data;
      }
      function clean(data, {
        types = {},
        typeDefs = {},
        dynamicTypes,
        invalidHandler,
        typeDefault
      } = {}) {
        const StringType = typeDefs.String?.type;
        const NumberType = typeDefs.Number?.type;
        const ArrayType = typeDefs.Array?.type;
        const BooleanType = typeDefs.Boolean?.type;
        const DateType = typeDefs.Date?.type;
        const hasTypeDefault = typeof typeDefault !== "undefined";
        if (!hasTypeDefault) {
          typeDefault = [false, true, null];
          if (StringType) {
            typeDefault.push(StringType);
          }
          if (ArrayType) {
            typeDefault.push(ArrayType);
          }
        }
        const remove = {};
        Object.keys(data).forEach((k) => {
          if (k === "argv") {
            return;
          }
          let val = data[k];
          debug("val=%j", val);
          const isArray = Array.isArray(val);
          let [hasType, rawType] = getType(k, { types, dynamicTypes });
          let type = rawType;
          if (!isArray) {
            val = [val];
          }
          if (!type) {
            type = typeDefault;
          }
          if (isTypeDef(type, ArrayType)) {
            type = typeDefault.concat(ArrayType);
          }
          if (!Array.isArray(type)) {
            type = [type];
          }
          debug("val=%j", val);
          debug("types=", type);
          val = val.map((v) => {
            if (typeof v === "string") {
              debug("string %j", v);
              v = v.trim();
              if (v === "null" && ~type.indexOf(null) || v === "true" && (~type.indexOf(true) || hasTypeDef(type, BooleanType)) || v === "false" && (~type.indexOf(false) || hasTypeDef(type, BooleanType))) {
                v = JSON.parse(v);
                debug("jsonable %j", v);
              } else if (hasTypeDef(type, NumberType) && !isNaN(v)) {
                debug("convert to number", v);
                v = +v;
              } else if (hasTypeDef(type, DateType) && !isNaN(Date.parse(v))) {
                debug("convert to date", v);
                v = new Date(v);
              }
            }
            if (!hasType) {
              if (!hasTypeDefault) {
                return v;
              }
              rawType = typeDefault;
            }
            if (v === false && ~type.indexOf(null) && !(~type.indexOf(false) || hasTypeDef(type, BooleanType))) {
              v = null;
            }
            const d = {};
            d[k] = v;
            debug("prevalidated val", d, v, rawType);
            if (!validate(d, k, v, rawType, { typeDefs })) {
              if (invalidHandler) {
                invalidHandler(k, v, rawType, data);
              } else if (invalidHandler !== false) {
                debug("invalid: " + k + "=" + v, rawType);
              }
              return remove;
            }
            debug("validated v", d, v, rawType);
            return d[k];
          }).filter((v) => v !== remove);
          if (!val.length && doesNotHaveTypeDef(type, ArrayType)) {
            debug("VAL HAS NO LENGTH, DELETE IT", val, k, type.indexOf(ArrayType));
            delete data[k];
          } else if (isArray) {
            debug(isArray, data[k], val);
            data[k] = val;
          } else {
            data[k] = val[0];
          }
          debug("k=%s val=%j", k, val, data[k]);
        });
      }
      function validate(data, k, val, type, { typeDefs } = {}) {
        const ArrayType = typeDefs?.Array?.type;
        if (Array.isArray(type)) {
          for (let i = 0, l = type.length; i < l; i++) {
            if (isTypeDef(type[i], ArrayType)) {
              continue;
            }
            if (validate(data, k, val, type[i], { typeDefs })) {
              return true;
            }
          }
          delete data[k];
          return false;
        }
        if (isTypeDef(type, ArrayType)) {
          return true;
        }
        if (type !== type) {
          debug("Poison NaN", k, val, type);
          delete data[k];
          return false;
        }
        if (val === type) {
          debug("Explicitly allowed %j", val);
          data[k] = val;
          return true;
        }
        let ok = false;
        const types = Object.keys(typeDefs);
        for (let i = 0, l = types.length; i < l; i++) {
          debug("test type %j %j %j", k, val, types[i]);
          const t = typeDefs[types[i]];
          if (t && (type && type.name && t.type && t.type.name ? type.name === t.type.name : type === t.type)) {
            const d = {};
            ok = t.validate(d, k, val) !== false;
            val = d[k];
            if (ok) {
              data[k] = val;
              break;
            }
          }
        }
        debug("OK? %j (%j %j %j)", ok, k, val, types[types.length - 1]);
        if (!ok) {
          delete data[k];
        }
        return ok;
      }
      function parse(args, data, remain, {
        types = {},
        typeDefs = {},
        shorthands = {},
        dynamicTypes,
        unknownHandler,
        abbrevHandler
      } = {}) {
        const StringType = typeDefs.String?.type;
        const NumberType = typeDefs.Number?.type;
        const ArrayType = typeDefs.Array?.type;
        const BooleanType = typeDefs.Boolean?.type;
        debug("parse", args, data, remain);
        const abbrevs = abbrev(Object.keys(types));
        debug("abbrevs=%j", abbrevs);
        const shortAbbr = abbrev(Object.keys(shorthands));
        for (let i = 0; i < args.length; i++) {
          let arg = args[i];
          debug("arg", arg);
          if (arg.match(/^-{2,}$/)) {
            remain.push.apply(remain, args.slice(i + 1));
            args[i] = "--";
            break;
          }
          let hadEq = false;
          if (arg.charAt(0) === "-" && arg.length > 1) {
            const at = arg.indexOf("=");
            if (at > -1) {
              hadEq = true;
              const v = arg.slice(at + 1);
              arg = arg.slice(0, at);
              args.splice(i, 1, arg, v);
            }
            const shRes = resolveShort(arg, shortAbbr, abbrevs, { shorthands, abbrevHandler });
            debug("arg=%j shRes=%j", arg, shRes);
            if (shRes) {
              args.splice.apply(args, [i, 1].concat(shRes));
              if (arg !== shRes[0]) {
                i--;
                continue;
              }
            }
            arg = arg.replace(/^-+/, "");
            let no = null;
            while (arg.toLowerCase().indexOf("no-") === 0) {
              no = !no;
              arg = arg.slice(3);
            }
            if (abbrevs[arg] && abbrevs[arg] !== arg) {
              if (abbrevHandler) {
                abbrevHandler(arg, abbrevs[arg]);
              } else if (abbrevHandler !== false) {
                debug(`abbrev: ${arg} -> ${abbrevs[arg]}`);
              }
              arg = abbrevs[arg];
            }
            let [hasType, argType] = getType(arg, { types, dynamicTypes });
            let isTypeArray = Array.isArray(argType);
            if (isTypeArray && argType.length === 1) {
              isTypeArray = false;
              argType = argType[0];
            }
            let isArray = isTypeDef(argType, ArrayType) || isTypeArray && hasTypeDef(argType, ArrayType);
            if (!hasType && hasOwn(data, arg)) {
              if (!Array.isArray(data[arg])) {
                data[arg] = [data[arg]];
              }
              isArray = true;
            }
            let val;
            let la = args[i + 1];
            const isBool = typeof no === "boolean" || isTypeDef(argType, BooleanType) || isTypeArray && hasTypeDef(argType, BooleanType) || typeof argType === "undefined" && !hadEq || la === "false" && (argType === null || isTypeArray && ~argType.indexOf(null));
            if (typeof argType === "undefined") {
              const hangingLa = !hadEq && la && !la?.startsWith("-") && !["true", "false"].includes(la);
              if (unknownHandler) {
                if (hangingLa) {
                  unknownHandler(arg, la);
                } else {
                  unknownHandler(arg);
                }
              } else if (unknownHandler !== false) {
                debug(`unknown: ${arg}`);
                if (hangingLa) {
                  debug(`unknown: ${la} parsed as normal opt`);
                }
              }
            }
            if (isBool) {
              val = !no;
              if (la === "true" || la === "false") {
                val = JSON.parse(la);
                la = null;
                if (no) {
                  val = !val;
                }
                i++;
              }
              if (isTypeArray && la) {
                if (~argType.indexOf(la)) {
                  val = la;
                  i++;
                } else if (la === "null" && ~argType.indexOf(null)) {
                  val = null;
                  i++;
                } else if (!la.match(/^-{2,}[^-]/) && !isNaN(la) && hasTypeDef(argType, NumberType)) {
                  val = +la;
                  i++;
                } else if (!la.match(/^-[^-]/) && hasTypeDef(argType, StringType)) {
                  val = la;
                  i++;
                }
              }
              if (isArray) {
                (data[arg] = data[arg] || []).push(val);
              } else {
                data[arg] = val;
              }
              continue;
            }
            if (isTypeDef(argType, StringType)) {
              if (la === void 0) {
                la = "";
              } else if (la.match(/^-{1,2}[^-]+/)) {
                la = "";
                i--;
              }
            }
            if (la && la.match(/^-{2,}$/)) {
              la = void 0;
              i--;
            }
            val = la === void 0 ? true : la;
            if (isArray) {
              (data[arg] = data[arg] || []).push(val);
            } else {
              data[arg] = val;
            }
            i++;
            continue;
          }
          remain.push(arg);
        }
      }
      var SINGLES = /* @__PURE__ */ Symbol("singles");
      var singleCharacters = (arg, shorthands) => {
        let singles = shorthands[SINGLES];
        if (!singles) {
          singles = Object.keys(shorthands).filter((s) => s.length === 1).reduce((l, r) => {
            l[r] = true;
            return l;
          }, {});
          shorthands[SINGLES] = singles;
          debug("shorthand singles", singles);
        }
        const chrs = arg.split("").filter((c) => singles[c]);
        return chrs.join("") === arg ? chrs : null;
      };
      function resolveShort(arg, ...rest) {
        const { abbrevHandler, types = {}, shorthands = {} } = rest.length ? rest.pop() : {};
        const shortAbbr = rest[0] ?? abbrev(Object.keys(shorthands));
        const abbrevs = rest[1] ?? abbrev(Object.keys(types));
        arg = arg.replace(/^-+/, "");
        if (abbrevs[arg] === arg) {
          return null;
        }
        if (shorthands[arg]) {
          if (shorthands[arg] && !Array.isArray(shorthands[arg])) {
            shorthands[arg] = shorthands[arg].split(/\s+/);
          }
          return shorthands[arg];
        }
        const chrs = singleCharacters(arg, shorthands);
        if (chrs) {
          return chrs.map((c) => shorthands[c]).reduce((l, r) => l.concat(r), []);
        }
        if (abbrevs[arg] && !shorthands[arg]) {
          return null;
        }
        if (shortAbbr[arg]) {
          if (abbrevHandler) {
            abbrevHandler(arg, shortAbbr[arg]);
          } else if (abbrevHandler !== false) {
            debug(`abbrev: ${arg} -> ${shortAbbr[arg]}`);
          }
          arg = shortAbbr[arg];
        }
        if (shorthands[arg] && !Array.isArray(shorthands[arg])) {
          shorthands[arg] = shorthands[arg].split(/\s+/);
        }
        return shorthands[arg];
      }
      module.exports = {
        nopt,
        clean,
        parse,
        validate,
        resolveShort,
        typeDefs: defaultTypeDefs
      };
    }
  });

  // node_modules/nopt/lib/nopt.js
  var require_nopt = __commonJS({
    "node_modules/nopt/lib/nopt.js"(exports, module) {
      var lib = require_nopt_lib();
      var defaultTypeDefs = require_type_defs();
      module.exports = exports = nopt;
      exports.clean = clean;
      exports.typeDefs = defaultTypeDefs;
      exports.lib = lib;
      function nopt(types, shorthands, args = process.argv, slice = 2) {
        return lib.nopt(args.slice(slice), {
          types: types || {},
          shorthands: shorthands || {},
          typeDefs: exports.typeDefs,
          invalidHandler: exports.invalidHandler,
          unknownHandler: exports.unknownHandler,
          abbrevHandler: exports.abbrevHandler
        });
      }
      function clean(data, types, typeDefs = exports.typeDefs) {
        return lib.clean(data, {
          types: types || {},
          typeDefs,
          invalidHandler: exports.invalidHandler,
          unknownHandler: exports.unknownHandler,
          abbrevHandler: exports.abbrevHandler
        });
      }
    }
  });

  // node_modules/proc-log/lib/index.js
  var require_lib2 = __commonJS({
    "node_modules/proc-log/lib/index.js"(exports, module) {
      var META = /* @__PURE__ */ Symbol("proc-log.meta");
      module.exports = {
        META,
        output: {
          LEVELS: [
            "standard",
            "error",
            "buffer",
            "flush"
          ],
          KEYS: {
            standard: "standard",
            error: "error",
            buffer: "buffer",
            flush: "flush"
          },
          standard: function(...args) {
            return process.emit("output", "standard", ...args);
          },
          error: function(...args) {
            return process.emit("output", "error", ...args);
          },
          buffer: function(...args) {
            return process.emit("output", "buffer", ...args);
          },
          flush: function(...args) {
            return process.emit("output", "flush", ...args);
          }
        },
        log: {
          LEVELS: [
            "notice",
            "error",
            "warn",
            "info",
            "verbose",
            "http",
            "silly",
            "timing",
            "pause",
            "resume"
          ],
          KEYS: {
            notice: "notice",
            error: "error",
            warn: "warn",
            info: "info",
            verbose: "verbose",
            http: "http",
            silly: "silly",
            timing: "timing",
            pause: "pause",
            resume: "resume"
          },
          error: function(...args) {
            return process.emit("log", "error", ...args);
          },
          notice: function(...args) {
            return process.emit("log", "notice", ...args);
          },
          warn: function(...args) {
            return process.emit("log", "warn", ...args);
          },
          info: function(...args) {
            return process.emit("log", "info", ...args);
          },
          verbose: function(...args) {
            return process.emit("log", "verbose", ...args);
          },
          http: function(...args) {
            return process.emit("log", "http", ...args);
          },
          silly: function(...args) {
            return process.emit("log", "silly", ...args);
          },
          timing: function(...args) {
            return process.emit("log", "timing", ...args);
          },
          pause: function() {
            return process.emit("log", "pause");
          },
          resume: function() {
            return process.emit("log", "resume");
          }
        },
        time: {
          LEVELS: [
            "start",
            "end"
          ],
          KEYS: {
            start: "start",
            end: "end"
          },
          start: function(name, fn) {
            process.emit("time", "start", name);
            function end() {
              return process.emit("time", "end", name);
            }
            if (typeof fn === "function") {
              const res = fn();
              if (res && res.finally) {
                return res.finally(end);
              }
              end();
              return res;
            }
            return end;
          },
          end: function(name) {
            return process.emit("time", "end", name);
          }
        },
        input: {
          LEVELS: [
            "start",
            "end",
            "read"
          ],
          KEYS: {
            start: "start",
            end: "end",
            read: "read"
          },
          start: function(...args) {
            let fn;
            if (typeof args[0] === "function") {
              fn = args.shift();
            }
            process.emit("input", "start", ...args);
            function end() {
              return process.emit("input", "end", ...args);
            }
            if (typeof fn === "function") {
              const res = fn();
              if (res && res.finally) {
                return res.finally(end);
              }
              end();
              return res;
            }
            return end;
          },
          end: function(...args) {
            return process.emit("input", "end", ...args);
          },
          read: function(...args) {
            let resolve, reject;
            const promise = new Promise((_resolve, _reject) => {
              resolve = _resolve;
              reject = _reject;
            });
            process.emit("input", "read", resolve, reject, ...args);
            return promise;
          }
        }
      };
    }
  });

  // node_modules/@npmcli/config/lib/type-defs.js
  var require_type_defs2 = __commonJS({
    "node_modules/@npmcli/config/lib/type-defs.js"(exports, module) {
      var nopt = require_nopt();
      var noptValidatePath = nopt.typeDefs.path.validate;
      var validatePath = (data, k, val) => {
        if (typeof val !== "string") {
          return false;
        }
        return noptValidatePath(data, k, val);
      };
      module.exports = {
        ...nopt.typeDefs,
        path: {
          ...nopt.typeDefs.path,
          validate: validatePath
        }
      };
      nopt.typeDefs = module.exports;
    }
  });

  // node_modules/@npmcli/config/lib/nerf-dart.js
  var require_nerf_dart = __commonJS({
    "node_modules/@npmcli/config/lib/nerf-dart.js"(exports, module) {
      var { URL } = __require("node:url");
      module.exports = (url) => {
        const parsed = new URL(url);
        const from = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
        const rel = new URL(".", from);
        const res = `//${rel.host}${rel.pathname}`;
        return res;
      };
    }
  });

  // node_modules/@npmcli/config/lib/env-replace.js
  var require_env_replace = __commonJS({
    "node_modules/@npmcli/config/lib/env-replace.js"(exports, module) {
      var envExpr = /(?<!\\)(\\*)\$\{([^${}?]+)(\?)?\}/g;
      module.exports = (f, env) => f.replace(envExpr, (orig, esc, name, modifier) => {
        const fallback = modifier === "?" ? "" : `\${${name}}`;
        const val = env[name] !== void 0 ? env[name] : fallback;
        if (esc.length % 2) {
          return orig.slice((esc.length + 1) / 2);
        }
        return esc.slice(esc.length / 2) + val;
      });
    }
  });

  // node_modules/@npmcli/config/lib/parse-field.js
  var require_parse_field = __commonJS({
    "node_modules/@npmcli/config/lib/parse-field.js"(exports, module) {
      var typeDefs = require_type_defs2();
      var envReplace = require_env_replace();
      var { resolve } = __require("node:path");
      var parseField = (f, key, opts, listElement = false) => {
        if (typeof f !== "string" && !Array.isArray(f)) {
          return f;
        }
        const { platform, types, home, env } = opts;
        const typeList = new Set([].concat(types[key]));
        const isPath = typeList.has(typeDefs.path.type);
        const isBool = typeList.has(typeDefs.Boolean.type);
        const isString = isPath || typeList.has(typeDefs.String.type);
        const isNumber = typeList.has(typeDefs.Number.type);
        const isList = !listElement && typeList.has(Array);
        if (Array.isArray(f)) {
          return !isList ? f : f.map((field) => parseField(field, key, opts, true));
        }
        f = f.trim();
        if (isList) {
          return parseField(f.split("\n\n"), key, opts);
        }
        if (isBool && !isString && f === "") {
          return true;
        }
        if (!isString && !isPath && !isNumber) {
          switch (f) {
            case "true":
              return true;
            case "false":
              return false;
            case "null":
              return null;
            case "undefined":
              return void 0;
          }
        }
        f = envReplace(f, env);
        if (isPath) {
          const homePattern = platform === "win32" ? /^~(\/|\\)/ : /^~\//;
          if (homePattern.test(f) && home) {
            f = resolve(home, f.slice(2));
          } else {
            f = resolve(f);
          }
        }
        if (isNumber && !isNaN(f)) {
          f = +f;
        }
        return f;
      };
      module.exports = parseField;
    }
  });

  // node_modules/@npmcli/config/lib/definitions/definitions.js
  var require_definitions = __commonJS({
    "node_modules/@npmcli/config/lib/definitions/definitions.js"(exports, module) {
      var Definition = class {
        constructor(key, def) {
          this.key = key;
          this.type = def.type;
          this.default = def.default;
        }
      };
      var {
        url: { type: url },
        path: { type: path }
      } = require_type_defs2();
      var definitions = {
        _auth: new Definition("_auth", {
          default: null,
          type: [null, String]
        }),
        global: new Definition("global", {
          default: false,
          type: Boolean
        }),
        // the globalconfig has its default defined outside of this module
        globalconfig: new Definition("globalconfig", {
          type: path,
          default: ""
        }),
        location: new Definition("location", {
          default: "user",
          type: [
            "global",
            "user",
            "project"
          ]
        }),
        // `prefix` has its default defined outside of this module
        prefix: new Definition("prefix", {
          type: path,
          default: ""
        }),
        registry: new Definition("registry", {
          default: "https://registry.npmjs.org/",
          type: url
        }),
        userconfig: new Definition("userconfig", {
          default: "~/.npmrc",
          type: path
        })
      };
      module.exports = definitions;
    }
  });

  // node_modules/@npmcli/config/lib/definitions/index.js
  var require_definitions2 = __commonJS({
    "node_modules/@npmcli/config/lib/definitions/index.js"(exports, module) {
      var definitions = require_definitions();
      var flatten = (obj, flat = {}) => {
        for (const [key, val] of Object.entries(obj)) {
          const def = definitions[key];
          if (def && def.flatten) {
            def.flatten(key, obj, flat);
          } else if (/@.*:registry$/i.test(key) || /^\/\//.test(key)) {
            flat[key] = val;
          }
        }
        return flat;
      };
      module.exports = {
        definitions,
        flatten
      };
    }
  });

  // node_modules/@npmcli/config/lib/errors.js
  var require_errors = __commonJS({
    "node_modules/@npmcli/config/lib/errors.js"(exports, module) {
      "use strict";
      var ErrInvalidAuth = class extends Error {
        constructor(problems) {
          let message = "Invalid auth configuration found: ";
          message += problems.map((problem) => {
            if (problem.action === "delete") {
              return `\`${problem.key}\` is not allowed in ${problem.where} config`;
            } else if (problem.action === "rename") {
              return `\`${problem.from}\` must be renamed to \`${problem.to}\` in ${problem.where} config`;
            }
          }).join(", ");
          message += "\nPlease run `npm config fix` to repair your configuration.`";
          super(message);
          this.code = "ERR_INVALID_AUTH";
          this.problems = problems;
        }
      };
      module.exports = {
        ErrInvalidAuth
      };
    }
  });

  // node_modules/@npmcli/config/lib/index.js
  var require_lib3 = __commonJS({
    "node_modules/@npmcli/config/lib/index.js"(exports, module) {
      var ini = require_ini();
      var nopt = require_nopt();
      var { log } = require_lib2();
      var { resolve, dirname, join } = __require("node:path");
      var { homedir } = __require("node:os");
      var {
        readFile,
        stat
      } = __require("node:fs/promises");
      var fileExists = (...p) => stat(resolve(...p)).then((st) => st.isFile()).catch(() => false);
      var hasOwnProperty = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
      var typeDefs = require_type_defs2();
      var nerfDart = require_nerf_dart();
      var envReplace = require_env_replace();
      var parseField = require_parse_field();
      var { definitions } = require_definitions2();
      var confFileTypes = /* @__PURE__ */ new Set([
        "global",
        "user",
        "project"
      ]);
      var confTypes = /* @__PURE__ */ new Set([
        "default",
        "builtin",
        ...confFileTypes,
        "env"
        // CLI logic removed
        // 'cli',
      ]);
      var highestConfType = "env";
      var Config = class {
        #loaded = false;
        #projectRoot = "";
        #workspaceRoot = "";
        constructor({
          npmPath,
          projectRoot,
          workspaceRoot: workspaceRoot2,
          // options just to override in tests, mostly
          env = process.env,
          platform = process.platform,
          execPath = process.execPath,
          cwd = process.cwd()
        }) {
          if (!projectRoot || !workspaceRoot2) {
            throw new Error("must provide projectRoot and workspaceRoot options");
          }
          this.#projectRoot = projectRoot;
          this.#workspaceRoot = workspaceRoot2;
          const types = {};
          const defaults = {};
          for (const [key, def] of Object.entries(definitions)) {
            defaults[key] = def.default;
            types[key] = def.type;
          }
          this.types = types;
          this.defaults = defaults;
          this.npmPath = npmPath;
          this.env = env;
          this.execPath = execPath;
          this.platform = platform;
          this.cwd = cwd;
          this.globalPrefix = null;
          this.localPrefix = null;
          this.home = null;
          const wheres = [...confTypes];
          this.data = /* @__PURE__ */ new Map();
          let parent = null;
          for (const where of wheres) {
            this.data.set(where, parent = new ConfigData(parent));
          }
          this.data.set = () => {
            throw new Error("cannot change internal config data structure");
          };
          this.data.delete = () => {
            throw new Error("cannot change internal config data structure");
          };
          this.sources = /* @__PURE__ */ new Map([]);
          for (const { data } of this.data.values()) {
            this.list.unshift(data);
          }
          this.#loaded = false;
        }
        /** NOTE: this is a getter which will recompute each time it's accessed */
        get list() {
          const list = [];
          for (const { data } of this.data.values()) {
            list.unshift(data);
          }
          return list;
        }
        get loaded() {
          return this.#loaded;
        }
        get prefix() {
          return this.#get("global") ? this.globalPrefix : this.localPrefix;
        }
        /**
         * @param {Config.ConfType|null} [where] Get values from only this location if specified.
         * Otherwise checks up the prototype chain in order of precedence.
         */
        get(key, where) {
          if (!this.loaded) {
            throw new Error("call config.load() before reading values");
          }
          return this.#get(key, where);
        }
        // we need to get values sometimes, so use this internal one to do so
        // while in the process of loading.
        /**
         * @param {Config.ConfType|null} [where] Get values from only this location if specified.
         * Otherwise checks up the prototype chain in order of precedence.
         */
        #get(key, where = null) {
          if (where !== null && !confTypes.has(where)) {
            throw new Error("invalid config location param: " + where);
          }
          const { data } = this.data.get(where || highestConfType);
          return where === null || hasOwnProperty(data, key) ? data[key] : void 0;
        }
        async load() {
          if (this.loaded) {
            throw new Error("attempting to load npm config multiple times");
          }
          this.loadDefaults();
          await this.loadBuiltinConfig();
          this.loadEnv();
          await this.loadProjectConfig();
          await this.loadUserConfig();
          await this.loadGlobalConfig();
          this.#loaded = true;
          this.globalPrefix = this.get("prefix");
        }
        loadDefaults() {
          this.loadGlobalPrefix();
          this.loadHome();
          const defaultsObject = {
            ...this.defaults,
            prefix: this.globalPrefix
          };
          try {
            defaultsObject["npm-version"] = __require(join(this.npmPath, "package.json")).version;
          } catch {
          }
          this.#loadObject(defaultsObject, "default", "default values");
          const { data } = this.data.get("default");
          Object.defineProperty(data, "globalconfig", {
            get: () => resolve(this.#get("prefix"), "etc/npmrc"),
            set(value) {
              Object.defineProperty(data, "globalconfig", {
                value,
                configurable: true,
                writable: true,
                enumerable: true
              });
            },
            configurable: true,
            enumerable: true
          });
        }
        loadHome() {
          this.home = this.env.HOME || homedir();
        }
        loadGlobalPrefix() {
          if (this.globalPrefix) {
            throw new Error("cannot load default global prefix more than once");
          }
          if (this.env.PREFIX) {
            this.globalPrefix = this.env.PREFIX;
          } else if (this.platform === "win32") {
            this.globalPrefix = dirname(this.execPath);
          } else {
            this.globalPrefix = dirname(dirname(this.execPath));
            if (this.env.DESTDIR) {
              this.globalPrefix = join(this.env.DESTDIR, this.globalPrefix);
            }
          }
        }
        loadEnv() {
          const conf = /* @__PURE__ */ Object.create(null);
          for (const [envKey, envVal] of Object.entries(this.env)) {
            if (!/^npm_config_/i.test(envKey) || envVal === "") {
              continue;
            }
            let key = envKey.slice("npm_config_".length);
            if (!key.startsWith("//")) {
              key = key.replace(/(?!^)_/g, "-").toLowerCase();
            }
            conf[key] = envVal;
          }
          this.#loadObject(conf, "env", "environment");
        }
        get valid() {
          for (const [where, { valid }] of this.data.entries()) {
            if (valid === false || valid === null && !this.validate(where)) {
              return false;
            }
          }
          return true;
        }
        /** @param {Config.ConfType} [where] */
        validate(where) {
          if (!where) {
            let valid = true;
            const authProblems = [];
            for (const entryWhere of this.data.keys()) {
              if (entryWhere === "default" || entryWhere === "builtin") {
                continue;
              }
              const ret = this.validate(entryWhere);
              valid = valid && ret;
              if (["global", "user", "project"].includes(entryWhere)) {
                for (const key of ["_authtoken", "-authtoken"]) {
                  if (this.get(key, entryWhere)) {
                    authProblems.push({ action: "delete", key, where: entryWhere });
                  }
                }
                const nerfedReg = nerfDart(this.get("registry"));
                for (const key of ["_auth", "_authToken", "username", "_password"]) {
                  if (this.get(key, entryWhere)) {
                    if (key === "username" && !this.get("_password", entryWhere)) {
                      authProblems.push({ action: "delete", key, where: entryWhere });
                    } else if (key === "_password" && !this.get("username", entryWhere)) {
                      authProblems.push({ action: "delete", key, where: entryWhere });
                    } else {
                      authProblems.push({
                        action: "rename",
                        from: key,
                        to: `${nerfedReg}:${key}`,
                        where: entryWhere
                      });
                    }
                  }
                }
              }
            }
            if (authProblems.length) {
              const { ErrInvalidAuth } = require_errors();
              throw new ErrInvalidAuth(authProblems);
            }
            return valid;
          } else {
            const obj = this.data.get(where);
            obj[_valid] = true;
            nopt.invalidHandler = (k, val, type) => this.invalidHandler(k, val, type, obj.source, where);
            nopt.clean(obj.data, this.types, typeDefs);
            nopt.invalidHandler = null;
            return obj[_valid];
          }
        }
        // Returns true if the value is coming directly from the source defined
        // in default definitions, if the current value for the key config is
        // coming from any other different source, returns false
        isDefault(key) {
          const [defaultType, ...types] = [...confTypes];
          const defaultData = this.data.get(defaultType).data;
          return hasOwnProperty(defaultData, key) && types.every((type) => {
            const typeData = this.data.get(type).data;
            return !hasOwnProperty(typeData, key);
          });
        }
        invalidHandler(k, val, type, source, where) {
          log.warn(
            "invalid config",
            k + "=" + JSON.stringify(val),
            `set in ${source}`
          );
          this.data.get(where)[_valid] = false;
        }
        /**
         * @param {Config.ConfType} where
         * @param {string} source file name or source description
         */
        #loadObject(obj, where, source, er = null) {
          const conf = this.data.get(where);
          if (conf.source) {
            const m = `double-loading "${where}" configs from ${source}, previously loaded from ${conf.source}`;
            throw new Error(m);
          }
          if (this.sources.has(source)) {
            const m = `double-loading config "${source}" as "${where}", previously loaded as "${this.sources.get(source)}"`;
            throw new Error(m);
          }
          conf.source = source;
          this.sources.set(source, where);
          if (er) {
            conf.loadError = er;
            if (er.code !== "ENOENT") {
              log.verbose("config", `error loading ${where} config`, er);
            }
          } else {
            conf.raw = obj;
            for (const [key, value] of Object.entries(obj)) {
              const k = envReplace(key, this.env);
              const v = this.parseField(value, k);
              conf.data[k] = v;
            }
          }
        }
        // Parse a field, coercing it to the best type available.
        parseField(f, key, listElement = false) {
          return parseField(f, key, this, listElement);
        }
        /**
         * @param {string} file
         * @param {Config.ConfType} type
         */
        async #loadFile(file, type) {
          log.silly("config", `load:file:${file}`);
          await readFile(file, "utf8").then(
            (data) => {
              const parsedConfig = ini.parse(data);
              if (type === "project" && parsedConfig.prefix) {
                log.error("config", `prefix cannot be changed from project config: ${file}.`);
              }
              return this.#loadObject(parsedConfig, type, file);
            },
            (er) => this.#loadObject(null, type, file, er)
          );
        }
        loadBuiltinConfig() {
          return this.#loadFile(resolve(this.npmPath, "npmrc"), "builtin");
        }
        async loadProjectConfig() {
          await this.loadLocalPrefix();
          if (this.#get("global") === true || this.#get("location") === "global") {
            this.data.get("project").source = "(global mode enabled, ignored)";
            this.sources.set(this.data.get("project").source, "project");
            return;
          }
          const projectFile = resolve(this.localPrefix, ".npmrc");
          if (projectFile !== this.#get("userconfig")) {
            return this.#loadFile(projectFile, "project");
          } else {
            this.data.get("project").source = '(same as "user" config, ignored)';
            this.sources.set(this.data.get("project").source, "project");
          }
        }
        // RE-WRITTEN to use passed in projectRoot and workspaceRoot
        async loadLocalPrefix() {
          const isGlobal = this.#get("global") || this.#get("location") === "global";
          if (isGlobal) {
            this.localPrefix = this.#workspaceRoot;
          } else {
            if (this.#projectRoot !== this.#workspaceRoot && await fileExists(this.#workspaceRoot, ".npmrc")) {
              log.warn("config", `ignoring workspace config at ${this.#workspaceRoot}/.npmrc`);
            }
            this.localPrefix = this.#projectRoot;
          }
        }
        loadUserConfig() {
          return this.#loadFile(this.#get("userconfig"), "user");
        }
        loadGlobalConfig() {
          return this.#loadFile(this.#get("globalconfig"), "global");
        }
        // this has to be a bit more complicated to support legacy data of all forms
        getCredentialsByURI(uri) {
          const nerfed = nerfDart(uri);
          const creds = {};
          const certfileReg = this.get(`${nerfed}:certfile`);
          const keyfileReg = this.get(`${nerfed}:keyfile`);
          if (certfileReg && keyfileReg) {
            creds.certfile = certfileReg;
            creds.keyfile = keyfileReg;
          }
          const tokenReg = this.get(`${nerfed}:_authToken`);
          if (tokenReg) {
            creds.token = tokenReg;
            return creds;
          }
          const userReg = this.get(`${nerfed}:username`);
          const passReg = this.get(`${nerfed}:_password`);
          if (userReg && passReg) {
            creds.username = userReg;
            creds.password = Buffer.from(passReg, "base64").toString("utf8");
            const auth = `${creds.username}:${creds.password}`;
            creds.auth = Buffer.from(auth, "utf8").toString("base64");
            return creds;
          }
          const authReg = this.get(`${nerfed}:_auth`);
          if (authReg) {
            const authDecode = Buffer.from(authReg, "base64").toString("utf8");
            const authSplit = authDecode.split(":");
            creds.username = authSplit.shift();
            creds.password = authSplit.join(":");
            creds.auth = authReg;
            return creds;
          }
          return creds;
        }
      };
      var _loadError = /* @__PURE__ */ Symbol("loadError");
      var _valid = /* @__PURE__ */ Symbol("valid");
      var ConfigData = class {
        #data;
        /** @type {string|null} */
        #source = null;
        #raw = {};
        constructor(parent) {
          this.#data = Object.create(parent && parent.data);
          this[_valid] = true;
        }
        get data() {
          return this.#data;
        }
        get valid() {
          return this[_valid];
        }
        set source(s) {
          if (this.#source) {
            throw new Error("cannot set ConfigData source more than once");
          }
          this.#source = s;
        }
        get source() {
          return this.#source;
        }
        set loadError(e) {
          if (this[_loadError] || Object.keys(this.#raw).length) {
            throw new Error("cannot set ConfigData loadError after load");
          }
          this[_loadError] = e;
        }
        get loadError() {
          return this[_loadError];
        }
        set raw(r) {
          if (Object.keys(this.#raw).length || this[_loadError]) {
            throw new Error("cannot set ConfigData raw after load");
          }
          this.#raw = r;
        }
        get raw() {
          return this.#raw;
        }
      };
      module.exports = Config;
    }
  });

  // node_modules/isexe/dist/commonjs/index.min.js
  var require_index_min = __commonJS({
    "node_modules/isexe/dist/commonjs/index.min.js"(exports) {
      "use strict";
      var a = (t, e) => () => (e || t((e = { exports: {} }).exports, e), e.exports);
      var _ = a((i) => {
        "use strict";
        Object.defineProperty(i, "__esModule", { value: true });
        i.sync = i.isexe = void 0;
        var M = __require("node:fs"), x = __require("node:fs/promises"), q = async (t, e = {}) => {
          let { ignoreErrors: r = false } = e;
          try {
            return d(await (0, x.stat)(t), e);
          } catch (s) {
            let n = s;
            if (r || n.code === "EACCES") return false;
            throw n;
          }
        };
        i.isexe = q;
        var m = (t, e = {}) => {
          let { ignoreErrors: r = false } = e;
          try {
            return d((0, M.statSync)(t), e);
          } catch (s) {
            let n = s;
            if (r || n.code === "EACCES") return false;
            throw n;
          }
        };
        i.sync = m;
        var d = (t, e) => t.isFile() && A(t, e), A = (t, e) => {
          let r = e.uid ?? process.getuid?.(), s = e.groups ?? process.getgroups?.() ?? [], n = e.gid ?? process.getgid?.() ?? s[0];
          if (r === void 0 || n === void 0) throw new Error("cannot get uid or gid");
          let u = /* @__PURE__ */ new Set([n, ...s]), c = t.mode, S = t.uid, P = t.gid, f = parseInt("100", 8), l = parseInt("010", 8), j = parseInt("001", 8), C = f | l;
          return !!(c & j || c & l && u.has(P) || c & f && S === r || c & C && r === 0);
        };
      });
      var g = a((o) => {
        "use strict";
        Object.defineProperty(o, "__esModule", { value: true });
        o.sync = o.isexe = void 0;
        var T = __require("node:fs"), I = __require("node:fs/promises"), D = __require("node:path"), F = async (t, e = {}) => {
          let { ignoreErrors: r = false } = e;
          try {
            return y(await (0, I.stat)(t), t, e);
          } catch (s) {
            let n = s;
            if (r || n.code === "EACCES") return false;
            throw n;
          }
        };
        o.isexe = F;
        var L = (t, e = {}) => {
          let { ignoreErrors: r = false } = e;
          try {
            return y((0, T.statSync)(t), t, e);
          } catch (s) {
            let n = s;
            if (r || n.code === "EACCES") return false;
            throw n;
          }
        };
        o.sync = L;
        var B = (t, e) => {
          let { pathExt: r = process.env.PATHEXT || "" } = e, s = r.split(D.delimiter);
          if (s.indexOf("") !== -1) return true;
          for (let n of s) {
            let u = n.toLowerCase(), c = t.substring(t.length - u.length).toLowerCase();
            if (u && c === u) return true;
          }
          return false;
        }, y = (t, e, r) => t.isFile() && B(e, r);
      });
      var p = a((h) => {
        "use strict";
        Object.defineProperty(h, "__esModule", { value: true });
      });
      var v = exports && exports.__createBinding || (Object.create ? (function(t, e, r, s) {
        s === void 0 && (s = r);
        var n = Object.getOwnPropertyDescriptor(e, r);
        (!n || ("get" in n ? !e.__esModule : n.writable || n.configurable)) && (n = { enumerable: true, get: function() {
          return e[r];
        } }), Object.defineProperty(t, s, n);
      }) : (function(t, e, r, s) {
        s === void 0 && (s = r), t[s] = e[r];
      }));
      var G = exports && exports.__setModuleDefault || (Object.create ? (function(t, e) {
        Object.defineProperty(t, "default", { enumerable: true, value: e });
      }) : function(t, e) {
        t.default = e;
      });
      var w = exports && exports.__importStar || /* @__PURE__ */ (function() {
        var t = function(e) {
          return t = Object.getOwnPropertyNames || function(r) {
            var s = [];
            for (var n in r) Object.prototype.hasOwnProperty.call(r, n) && (s[s.length] = n);
            return s;
          }, t(e);
        };
        return function(e) {
          if (e && e.__esModule) return e;
          var r = {};
          if (e != null) for (var s = t(e), n = 0; n < s.length; n++) s[n] !== "default" && v(r, e, s[n]);
          return G(r, e), r;
        };
      })();
      var X = exports && exports.__exportStar || function(t, e) {
        for (var r in t) r !== "default" && !Object.prototype.hasOwnProperty.call(e, r) && v(e, t, r);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.sync = exports.isexe = exports.posix = exports.win32 = void 0;
      var E = w(_());
      exports.posix = E;
      var O = w(g());
      exports.win32 = O;
      X(p(), exports);
      var H = process.env._ISEXE_TEST_PLATFORM_ || process.platform;
      var b = H === "win32" ? O : E;
      exports.isexe = b.isexe;
      exports.sync = b.sync;
    }
  });

  // node_modules/which/lib/index.js
  var require_lib4 = __commonJS({
    "node_modules/which/lib/index.js"(exports, module) {
      var { isexe, sync: isexeSync } = require_index_min();
      var { join, delimiter, sep, posix } = __require("path");
      var isWindows = process.platform === "win32";
      var rSlash = new RegExp(`[${posix.sep}${sep === posix.sep ? "" : sep}]`.replace(/(\\)/g, "\\$1"));
      var rRel = new RegExp(`^\\.${rSlash.source}`);
      var getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" });
      var getPathInfo = (cmd, {
        path: optPath = process.env.PATH,
        pathExt: optPathExt = process.env.PATHEXT,
        delimiter: optDelimiter = delimiter
      }) => {
        const pathEnv = cmd.match(rSlash) ? [""] : [
          // windows always checks the cwd first
          ...isWindows ? [process.cwd()] : [],
          ...(optPath || /* istanbul ignore next: very unusual */
          "").split(optDelimiter)
        ];
        if (isWindows) {
          const pathExtExe = optPathExt || [".EXE", ".CMD", ".BAT", ".COM"].join(optDelimiter);
          const pathExt = pathExtExe.split(optDelimiter).flatMap((item) => [item, item.toLowerCase()]);
          if (cmd.includes(".") && pathExt[0] !== "") {
            pathExt.unshift("");
          }
          return { pathEnv, pathExt, pathExtExe };
        }
        return { pathEnv, pathExt: [""] };
      };
      var getPathPart = (raw, cmd) => {
        const pathPart = /^".*"$/.test(raw) ? raw.slice(1, -1) : raw;
        const prefix = !pathPart && rRel.test(cmd) ? cmd.slice(0, 2) : "";
        return prefix + join(pathPart, cmd);
      };
      var which2 = async (cmd, opt = {}) => {
        const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
        const found = [];
        for (const envPart of pathEnv) {
          const p = getPathPart(envPart, cmd);
          for (const ext of pathExt) {
            const withExt = p + ext;
            const is = await isexe(withExt, { pathExt: pathExtExe, ignoreErrors: true });
            if (is) {
              if (!opt.all) {
                return withExt;
              }
              found.push(withExt);
            }
          }
        }
        if (opt.all && found.length) {
          return found;
        }
        if (opt.nothrow) {
          return null;
        }
        throw getNotFoundError(cmd);
      };
      var whichSync = (cmd, opt = {}) => {
        const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
        const found = [];
        for (const pathEnvPart of pathEnv) {
          const p = getPathPart(pathEnvPart, cmd);
          for (const ext of pathExt) {
            const withExt = p + ext;
            const is = isexeSync(withExt, { pathExt: pathExtExe, ignoreErrors: true });
            if (is) {
              if (!opt.all) {
                return withExt;
              }
              found.push(withExt);
            }
          }
        }
        if (opt.all && found.length) {
          return found;
        }
        if (opt.nothrow) {
          return null;
        }
        throw getNotFoundError(cmd);
      };
      module.exports = which2;
      which2.sync = whichSync;
    }
  });

  // src/constants.ts
  var pluginName;
  var init_constants = __esm({
    "src/constants.ts"() {
      "use strict";
      pluginName = "yarn-plugin-npmrc";
    }
  });

  // src/errors.ts
  var errors_exports = {};
  __export(errors_exports, {
    throwError: () => throwError
  });
  function throwError(messageOrError) {
    throw new import_core.ReportError(import_core.MessageName.UNNAMED, `[${pluginName}] ${messageOrError.message || messageOrError}`);
  }
  var import_core;
  var init_errors = __esm({
    "src/errors.ts"() {
      "use strict";
      import_core = __require("@yarnpkg/core");
      init_constants();
    }
  });

  // src/loadNpmrc.ts
  var loadNpmrc_exports = {};
  __export(loadNpmrc_exports, {
    loadNpmrc: () => loadNpmrc
  });
  async function loadNpmrc(params) {
    let npmPath = "";
    try {
      npmPath = import_fs.default.realpathSync(import_which.default.sync("npm"));
    } catch {
      throwError(`Couldn't find "npm" executable to help read the config`);
    }
    const logLevels = ["silly", "verbose", "info", "http", "timing", "notice", "warn", "error"];
    const maxLevelIndex = logLevels.indexOf(process.env.NPM_CONFIG_LOGLEVEL || process.env.npm_config_loglevel || "warn");
    const onLog = (level, ...args) => {
      if (logLevels.indexOf(level) < maxLevelIndex) {
        return;
      }
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](`[${pluginName}][${level}]`, ...args);
    };
    process.on("log", onLog);
    try {
      const conf = new import_config.default({ npmPath, ...params });
      await conf.load();
      conf.validate();
      return conf;
    } catch (err) {
      throwError(err);
    } finally {
      process.off("log", onLog);
    }
  }
  var import_config, import_fs, import_which;
  var init_loadNpmrc = __esm({
    "src/loadNpmrc.ts"() {
      "use strict";
      import_config = __toESM(require_lib3());
      import_fs = __toESM(__require("fs"));
      import_which = __toESM(require_lib4());
      init_constants();
      init_errors();
    }
  });

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });
  var import_core2 = __require("@yarnpkg/core");
  var configurationMap = {
    npmrcAuthEnabled: {
      description: "Attempt to read auth info from .npmrc for all registry requests",
      type: import_core2.SettingsType.BOOLEAN,
      default: false
    }
  };
  var enabledPropName = "npmrcAuthEnabled";
  var npmrc;
  var npmrcError;
  var cachedHeaders = {};
  var workspaceRoot;
  var validateProject = (project) => {
    workspaceRoot = project.getWorkspaceByCwd(project.cwd).cwd;
  };
  var getNpmAuthenticationHeader = async (currentHeader, registry, { configuration }) => {
    if (!configuration.get(enabledPropName) || !configuration.projectCwd) {
      return currentHeader;
    }
    if (registry in cachedHeaders) {
      return cachedHeaders[registry];
    }
    if (npmrcError) {
      throw npmrcError;
    }
    if (!npmrc) {
      const { loadNpmrc: loadNpmrc2 } = await Promise.resolve().then(() => (init_loadNpmrc(), loadNpmrc_exports));
      try {
        npmrc = await loadNpmrc2({
          projectRoot: configuration.projectCwd,
          workspaceRoot: workspaceRoot || configuration.projectCwd
        });
      } catch (err) {
        npmrcError = err;
        throw npmrcError;
      }
    }
    let credentials = npmrc.getCredentialsByURI(registry);
    if (Object.keys(credentials).length === 0 && !registry.endsWith("/")) {
      credentials = npmrc.getCredentialsByURI(`${registry}/`);
    }
    if (credentials.certfile || credentials.keyfile) {
      const { throwError: throwError2 } = await Promise.resolve().then(() => (init_errors(), errors_exports));
      throwError2(`This plugin does not support certfile or keyfile auth (for registry "${registry}")`);
    }
    let newHeader;
    if ("token" in credentials) {
      newHeader = `Bearer ${credentials.token}`;
    } else if ("auth" in credentials) {
      newHeader = `Basic ${credentials.auth}`;
    } else {
      newHeader = currentHeader;
    }
    cachedHeaders[registry] = newHeader;
    return newHeader;
  };
  var plugin = {
    hooks: { validateProject, getNpmAuthenticationHeader },
    configuration: configurationMap
  };
  var index_default = plugin;
  return __toCommonJS(index_exports);
})();
return plugin;
}
};
