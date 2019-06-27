var pas = {}, rtl = {quiet:!1, debug_load_units:!1, debug:function() {
  !rtl.quiet && console && console.log && console.log(arguments);
}, error:function(a) {
  rtl.debug("Error: ", a);
  throw a;
}, warn:function(a) {
  rtl.debug("Warn: ", a);
}, hasString:function(a) {
  return rtl.isString(a) && 0 < a.length;
}, isArray:function(a) {
  return Array.isArray(a);
}, isFunction:function(a) {
  return "function" === typeof a;
}, isModule:function(a) {
  return rtl.isObject(a) && rtl.hasString(a.$name) && pas[a.$name] === a;
}, isImplementation:function(a) {
  return rtl.isObject(a) && rtl.isModule(a.$module) && a.$module.$impl === a;
}, isNumber:function(a) {
  return "number" === typeof a;
}, isObject:function(a) {
  return "object" === typeof a && null != a;
}, isString:function(a) {
  return "string" === typeof a;
}, getNumber:function(a) {
  return "number" === typeof a ? a : NaN;
}, getChar:function(a) {
  return "string" === typeof a && 1 === a.length ? a : "";
}, getObject:function(a) {
  return "object" === typeof a || "function" === typeof a ? a : null;
}, isPasClass:function(a) {
  return rtl.isObject(a) && a.hasOwnProperty("$classname") && rtl.isObject(a.$module);
}, isPasClassInstance:function(a) {
  return rtl.isObject(a) && rtl.isPasClass(a.$class);
}, hexStr:function(a, b) {
  return ("000000000000000" + a.toString(16).toUpperCase()).slice(-b);
}, m_loading:0, m_loading_intf:1, m_intf_loaded:2, m_loading_impl:3, m_initializing:4, m_initialized:5, module:function(a, b, c, d, e) {
  rtl.debug_load_units && rtl.debug('rtl.module name="' + a + '" intfuses=' + b + " impluses=" + d + " hasimplcode=" + rtl.isFunction(e));
  rtl.hasString(a) || rtl.error('invalid module name "' + a + '"');
  rtl.isArray(b) || rtl.error('invalid interface useslist of "' + a + '"');
  rtl.isFunction(c) || rtl.error('invalid interface code of "' + a + '"');
  void 0 == d || rtl.isArray(d) || rtl.error('invalid implementation useslist of "' + a + '"');
  void 0 == e || rtl.isFunction(e) || rtl.error('invalid implementation code of "' + a + '"');
  pas[a] && rtl.error('module "' + a + '" is already registered');
  a = pas[a] = {$name:a, $intfuseslist:b, $impluseslist:d, $state:rtl.m_loading, $intfcode:c, $implcode:e, $impl:null};
  e && (a.$impl = {$module:a});
}, exitcode:0, run:function(a) {
  function b() {
    rtl.hasString(a) || (a = "program");
    rtl.debug_load_units && rtl.debug('rtl.run module="' + a + '"');
    var b = pas[a];
    b || rtl.error('rtl.run module "' + a + '" missing');
    rtl.loadintf(b);
    rtl.loadimpl(b);
    "program" == a && (rtl.debug_load_units && rtl.debug("running $main"), b = pas.program.$main(), rtl.isNumber(b) && (rtl.exitcode = b));
  }
  if (rtl.showUncaughtExceptions) {
    try {
      b();
    } catch (d) {
      var c = d.hasOwnProperty("$class") ? d.$class.$classname : "";
      c += (c ? ": " : "") + (d.hasOwnProperty("fMessage") ? d.fMessage : d);
      alert("Uncaught Exception : " + c);
      rtl.exitCode = 216;
    }
  } else {
    b();
  }
  return rtl.exitcode;
}, loadintf:function(a) {
  a.$state > rtl.m_loading_intf || (rtl.debug_load_units && rtl.debug('loadintf: "' + a.$name + '"'), a.$state === rtl.m_loading_intf && rtl.error('unit cycle detected "' + a.$name + '"'), a.$state = rtl.m_loading_intf, rtl.loaduseslist(a, a.$intfuseslist, rtl.loadintf), rtl.debug_load_units && rtl.debug('loadintf: run intf of "' + a.$name + '"'), a.$intfcode(a.$intfuseslist), a.$state = rtl.m_intf_loaded);
}, loaduseslist:function(a, b, c) {
  if (void 0 != b) {
    for (var d in b) {
      var e = b[d];
      rtl.debug_load_units && rtl.debug('loaduseslist of "' + a.$name + '" uses="' + e + '"');
      void 0 == pas[e] && rtl.error('module "' + a.$name + '" misses "' + e + '"');
      c(pas[e]);
    }
  }
}, loadimpl:function(a) {
  a.$state >= rtl.m_loading_impl || (a.$state < rtl.m_intf_loaded && rtl.error('loadimpl: interface not loaded of "' + a.$name + '"'), rtl.debug_load_units && rtl.debug('loadimpl: load uses of "' + a.$name + '"'), a.$state = rtl.m_loading_impl, rtl.loaduseslist(a, a.$impluseslist, rtl.loadintf), rtl.loaduseslist(a, a.$intfuseslist, rtl.loadimpl), rtl.loaduseslist(a, a.$impluseslist, rtl.loadimpl), rtl.debug_load_units && rtl.debug('loadimpl: run impl of "' + a.$name + '"'), rtl.isFunction(a.$implcode) &&
  a.$implcode(a.$impluseslist), rtl.debug_load_units && rtl.debug('loadimpl: run init of "' + a.$name + '"'), a.$state = rtl.m_initializing, rtl.isFunction(a.$init) && a.$init(), a.$state = rtl.m_initialized);
}, createCallback:function(a, b) {
  var c = "string" === typeof b ? function() {
    return a[b].apply(a, arguments);
  } : function() {
    return b.apply(a, arguments);
  };
  c.scope = a;
  c.fn = b;
  return c;
}, cloneCallback:function(a) {
  return rtl.createCallback(a.scope, a.fn);
}, eqCallback:function(a, b) {
  return a == b ? !0 : null != a && null != b && a.fn && a.scope === b.scope && a.fn == b.fn;
}, initClass:function(a, b, c, d) {
  b[c] = a;
  a.$classname = c;
  b.$module && b.$module.$impl === b && (b = b.$module);
  a.$parent = b;
  a.$fullname = b.$name + "." + c;
  rtl.isModule(b) ? (a.$module = b, a.$name = c) : (a.$module = b.$module, a.$name = b.name + "." + c);
  t.ancestor || (t.ancestor = null);
  d.call(a);
}, createClass:function(a, b, c, d) {
  var e = null;
  null != c ? (e = Object.create(c), e.$ancestor = c) : e = {$create:function(a, b) {
    void 0 == b && (b = []);
    var c = Object.create(this);
    c.$class = this;
    c.$init();
    try {
      c[a].apply(c, b), c.AfterConstruction();
    } catch (k) {
      throw c.$destroy, k;
    }
    return c;
  }, $destroy:function(a) {
    this.BeforeDestruction();
    this[a]();
    this.$final;
  }};
  rtl.initClass(e, a, b, d);
}, createClassExt:function(a, b, c, d, e) {
  var f = null;
  f = Object.create(c);
  f.$create = function(a, b) {
    void 0 == b && (b = []);
    var c = 0 < d.length ? this[d](a, b) : Object.create(this);
    c.$class = this;
    c.$init();
    try {
      c[a].apply(c, b), c.AfterConstruction && c.AfterConstruction();
    } catch (l) {
      throw c.$destroy, l;
    }
    return c;
  };
  f.$destroy = function(a) {
    this.BeforeDestruction && this.BeforeDestruction();
    this[a]();
    this.$final;
  };
  rtl.initClass(f, a, b, e);
}, tObjectDestroy:"Destroy", free:function(a, b) {
  null != a[b] && (a[b].$destroy(rtl.tObjectDestroy), a[b] = null);
}, freeLoc:function(a) {
  if (null != a) {
    return a.$destroy(rtl.tObjectDestroy), null;
  }
}, is:function(a, b) {
  return b.isPrototypeOf(a) || a === b;
}, isExt:function(a, b, c) {
  return null == a || "object" !== typeof b && "function" !== typeof b ? !1 : a === b ? 1 === c ? !1 : 2 === c ? rtl.isPasClass(a) : !0 : b.isPrototypeOf && b.isPrototypeOf(a) ? 1 === c ? rtl.isPasClassInstance(a) : 2 === c ? rtl.isPasClass(a) : !0 : "function" == typeof b && a instanceof b ? !0 : !1;
}, Exception:null, EInvalidCast:null, EAbstractError:null, ERangeError:null, raiseE:function(a) {
  var b = rtl[a];
  if (null == b) {
    var c = pas.SysUtils;
    c || (c = pas.sysutils);
    c && ((b = c[a]) || (b = c[a.toLowerCase()]), b || (b = c.Exception), b || (b = c.exception));
  }
  if (b) {
    if (b.Create) {
      throw b.$create("Create");
    }
    if (b.create) {
      throw b.$create("create");
    }
  }
  if ("EInvalidCast" === a) {
    throw "invalid type cast";
  }
  if ("EAbstractError" === a) {
    throw "Abstract method called";
  }
  if ("ERangeError" === a) {
    throw "range error";
  }
  throw a;
}, as:function(a, b) {
  if (null === a || rtl.is(a, b)) {
    return a;
  }
  rtl.raiseE("EInvalidCast");
}, asExt:function(a, b, c) {
  if (null === a || rtl.isExt(a, b, c)) {
    return a;
  }
  rtl.raiseE("EInvalidCast");
}, createInterface:function(a, b, c, d, e, f) {
  e = e ? Object.create(e) : {};
  a[b] = e;
  e.$module = a;
  e.$name = b;
  e.$fullname = a.$name + "." + b;
  e.$guid = c;
  e.$guidr = null;
  e.$names = d ? d : [];
  rtl.isFunction(f) && (t.ancestor || (t.ancestor = null), f.call(e));
  return e;
}, strToGUIDR:function(a, b) {
  function c(b) {
    var c = a.substr(d, b);
    d += b;
    return parseInt(c, 16);
  }
  var d = 0;
  d += 1;
  b.D1 = c(8);
  d += 1;
  b.D2 = c(4);
  d += 1;
  b.D3 = c(4);
  d += 1;
  b.D4 || (b.D4 = []);
  b.D4[0] = c(2);
  b.D4[1] = c(2);
  d += 1;
  for (var e = 2; 8 > e; e++) {
    b.D4[e] = c(2);
  }
  return b;
}, guidrToStr:function(a) {
  if (a.$intf) {
    return a.$intf.$guid;
  }
  for (var b = rtl.hexStr, c = "{" + b(a.D1, 8) + "-" + b(a.D2, 4) + "-" + b(a.D3, 4) + "-" + b(a.D4[0], 2) + b(a.D4[1], 2) + "-", d = 2; 8 > d; d++) {
    c += b(a.D4[d], 2);
  }
  return c + "}";
}, createTGUID:function(a) {
  return rtl.strToGUIDR(a, new (pas.System ? pas.System.TGuid : pas.system.tguid));
}, getIntfGUIDR:function(a) {
  if (!a) {
    return null;
  }
  if (!a.$guidr) {
    var b = rtl.createTGUID(a.$guid);
    a.hasOwnProperty("$guid") || (a = Object.getPrototypeOf(a));
    b.$intf = a;
    a.$guidr = b;
  }
  return a.$guidr;
}, addIntf:function(a, b, c) {
  function d(a) {
    return "function" === typeof a ? function() {
      return a.apply(this.$o, arguments);
    } : function() {
      rtl.raiseE("EAbstractError");
    };
  }
  c || (c = {});
  var e = b, f = Object.create(e);
  a.hasOwnProperty("$intfmaps") || (a.$intfmaps = {});
  a.$intfmaps[b.$guid] = f;
  do {
    b = e.$names;
    if (!b) {
      break;
    }
    for (var h = 0; h < b.length; h++) {
      var g = b[h], k = c[g];
      k || (k = g);
      f[g] = d(a[k]);
    }
    e = Object.getPrototypeOf(e);
  } while (null != e);
}, getIntfG:function(a, b, c) {
  if (!a) {
    return null;
  }
  var d = a.$intfmaps;
  if (!d) {
    return null;
  }
  d = d[b];
  if (!d) {
    return null;
  }
  if ("function" === typeof d) {
    return d.call(a);
  }
  var e = null;
  a.$interfaces && (e = a.$interfaces[b]);
  e || (e = Object.create(d), e.$o = a, a.$interfaces || (a.$interfaces = {}), a.$interfaces[b] = e);
  if ("object" === typeof c) {
    var f = null;
    return 0 === e.QueryInterface(rtl.getIntfGUIDR(c), {get:function() {
      return f;
    }, set:function(a) {
      f = a;
    }}) ? f : null;
  }
  2 === c && "com" === e.$kind && e._AddRef();
  return e;
}, getIntfT:function(a, b) {
  return rtl.getIntfG(a, b.$guid);
}, queryIntfT:function(a, b) {
  return rtl.getIntfG(a, b.$guid, b);
}, queryIntfIsT:function(a, b) {
  var c = rtl.queryIntfG(a, b.$guid);
  if (!c) {
    return !1;
  }
  "com" === c.$kind && c._Release();
  return !0;
}, asIntfT:function(a, b) {
  var c = rtl.getIntfG(a, b.$guid);
  if (null !== c) {
    return c;
  }
  rtl.raiseEInvalidCast();
}, intfIsClass:function(a, b) {
  return null != a && rtl.is(a.$o, b);
}, intfAsClass:function(a, b) {
  return null == a ? null : rtl.as(a.$o, b);
}, intfToClass:function(a, b) {
  return null !== a && rtl.is(a.$o, b) ? a.$o : null;
}, intfRefs:{ref:function(a, b) {
  var c = this[a];
  c && (delete this[a], c._Release());
  return this[a] = b;
}, free:function() {
  for (var a in this) {
    this.hasOwnProperty(a) && this[a]._Release();
  }
}}, createIntfRefs:function() {
  return Object.create(rtl.intfRefs);
}, setIntfP:function(a, b, c, d) {
  var e = a[b];
  e !== c && (null !== e && (a[b] = null, e._Release()), null !== c && (d || c._AddRef(), a[b] = c));
}, setIntfL:function(a, b, c) {
  a !== b ? (null !== b && (c || b._AddRef()), null !== a && a._Release()) : c && null !== a && a._Release();
  return b;
}, _AddRef:function(a) {
  a && a._AddRef();
  return a;
}, _Release:function(a) {
  a && a._Release();
  return a;
}, checkMethodCall:function(a, b) {
  rtl.isObject(a) && rtl.is(a, b) || rtl.raiseE("EInvalidCast");
}, rc:function(a, b, c) {
  if (Math.floor(a) === a && a >= b && a <= c) {
    return a;
  }
  rtl.raiseE("ERangeError");
}, rcc:function(a, b, c) {
  if ("string" === typeof a && 1 === a.length) {
    var d = a.charCodeAt(0);
    if (d >= b && d <= c) {
      return a;
    }
  }
  rtl.raiseE("ERangeError");
}, rcSetCharAt:function(a, b, c) {
  ("string" !== typeof a || 0 > b || b >= a.length) && rtl.raiseE("ERangeError");
  return rtl.setCharAt(a, b, c);
}, rcCharAt:function(a, b) {
  ("string" !== typeof a || 0 > b || b >= a.length) && rtl.raiseE("ERangeError");
  return a.charAt(b);
}, rcArrR:function(a, b) {
  if (Array.isArray(a) && "number" === typeof b && 0 <= b && b < a.length) {
    if (2 < arguments.length) {
      a = a[b];
      for (var c = 2; c < arguments.length; c++) {
        a = rtl.rcArrR(a, arguments[c]);
      }
      return a;
    }
    return a[b];
  }
  rtl.raiseE("ERangeError");
}, rcArrW:function(a, b, c) {
  for (var d = 3; d < arguments.length; d++) {
    a = rtl.rcArrR(a, b), b = arguments[d - 1], c = arguments[d];
  }
  if (Array.isArray(a) && "number" === typeof b && 0 <= b && b < a.length) {
    return a[b] = c;
  }
  rtl.raiseE("ERangeError");
}, length:function(a) {
  return null == a ? 0 : a.length;
}, arraySetLength:function(a, b, c) {
  function d(a, h) {
    var g = a.length, f = e[h];
    if (g !== c) {
      if (a.length = c, h === e.length - 1) {
        if (rtl.isArray(b)) {
          for (; g < f; g++) {
            a[g] = [];
          }
        } else {
          if (rtl.isFunction(b)) {
            for (; g < f; g++) {
              a[g] = new b;
            }
          } else {
            if (rtl.isObject(b)) {
              for (; g < f; g++) {
                a[g] = {};
              }
            } else {
              for (; g < f; g++) {
                a[g] = b;
              }
            }
          }
        }
      } else {
        for (; g < f; g++) {
          a[g] = [];
        }
      }
    }
    if (h < e.length - 1) {
      for (g = 0; g < f; g++) {
        a[g] = d(a[g], h + 1);
      }
    }
    return a;
  }
  null == a && (a = []);
  var e = arguments;
  return d(a, 2);
}, arrayEq:function(a, b) {
  if (null === a) {
    return null === b;
  }
  if (null === b || a.length !== b.length) {
    return !1;
  }
  for (var c = 0; c < a.length; c++) {
    if (a[c] !== b[c]) {
      return !1;
    }
  }
  return !0;
}, arrayClone:function(a, b, c, d, e, f) {
  if (rtl.isFunction(a)) {
    for (; c < d; c++) {
      e[f++] = new a(b[c]);
    }
  } else {
    if ("refSet" === a) {
      for (; c < d; c++) {
        e[f++] = rtl.refSet(b[c]);
      }
    } else {
      for (; c < d; c++) {
        e[f++] = b[c];
      }
    }
  }
}, arrayConcat:function(a) {
  for (var b = [], c = 0, d = 1; d < arguments.length; d++) {
    var e = arguments[d];
    null !== e && (c += e.length);
  }
  b.length = c;
  c = 0;
  for (d = 1; d < arguments.length; d++) {
    e = arguments[d], null !== e && (rtl.arrayClone(a, e, 0, e.length, b, c), c += e.length);
  }
  return b;
}, arrayConcatN:function() {
  for (var a = null, b = 1; b < arguments.length; b++) {
    var c = arguments[b];
    null !== c && (a = null === a ? c : a.concat(c));
  }
  return a;
}, arrayCopy:function(a, b, c, d) {
  if (null === b) {
    return [];
  }
  0 > c && (c = 0);
  void 0 === d && (d = b.length);
  d = c + d;
  d > b.length && (d = b.length);
  if (c >= d) {
    return [];
  }
  if (0 === a) {
    return b.slice(c, d);
  }
  var e = [];
  e.length = d - c;
  rtl.arrayClone(a, b, c, d, e, 0);
  return e;
}, setCharAt:function(a, b, c) {
  return a.substr(0, b) + c + a.substr(b + 1);
}, getResStr:function(a, b) {
  var c = a.$resourcestrings[b];
  return c.current ? c.current : c.org;
}, createSet:function() {
  for (var a = {}, b = 0; b < arguments.length; b++) {
    if (null != arguments[b]) {
      a[arguments[b]] = !0;
    } else {
      for (var c = arguments[b += 1], d = arguments[b += 1]; c <= d; c++) {
        a[c] = !0;
      }
    }
  }
  return a;
}, cloneSet:function(a) {
  var b = {}, c;
  for (c in a) {
    b[c] = !0;
  }
  return b;
}, refSet:function(a) {
  a.$shared = !0;
  return a;
}, includeSet:function(a, b) {
  a.$shared && (a = rtl.cloneSet(a));
  a[b] = !0;
  return a;
}, excludeSet:function(a, b) {
  a.$shared && (a = rtl.cloneSet(a));
  delete a[b];
  return a;
}, diffSet:function(a, b) {
  var c = {}, d;
  for (d in a) {
    b[d] || (c[d] = !0);
  }
  delete c.$shared;
  return c;
}, unionSet:function(a, b) {
  var c = {}, d;
  for (d in a) {
    c[d] = !0;
  }
  for (d in b) {
    c[d] = !0;
  }
  delete c.$shared;
  return c;
}, intersectSet:function(a, b) {
  var c = {}, d;
  for (d in a) {
    b[d] && (c[d] = !0);
  }
  delete c.$shared;
  return c;
}, symDiffSet:function(a, b) {
  var c = {}, d;
  for (d in a) {
    b[d] || (c[d] = !0);
  }
  for (d in b) {
    a[d] || (c[d] = !0);
  }
  delete c.$shared;
  return c;
}, eqSet:function(a, b) {
  for (var c in a) {
    if (!b[c] && "$shared" != c) {
      return !1;
    }
  }
  for (c in b) {
    if (!a[c] && "$shared" != c) {
      return !1;
    }
  }
  return !0;
}, neSet:function(a, b) {
  return !rtl.eqSet(a, b);
}, leSet:function(a, b) {
  for (var c in a) {
    if (!b[c] && "$shared" != c) {
      return !1;
    }
  }
  return !0;
}, geSet:function(a, b) {
  for (var c in b) {
    if (!a[c] && "$shared" != c) {
      return !1;
    }
  }
  return !0;
}, strSetLength:function(a, b) {
  var c = a.length;
  if (c > b) {
    return a.substring(0, b);
  }
  if (a.repeat) {
    return a + " ".repeat(b - c);
  }
  for (; c < b;) {
    a += " ", c++;
  }
  return a;
}, spaceLeft:function(a, b) {
  var c = a.length;
  if (c >= b) {
    return a;
  }
  if (a.repeat) {
    return " ".repeat(b - c) + a;
  }
  for (; c < b;) {
    a = " " + a, c++;
  }
}, floatToStr:function(a, b, c) {
  if (2 < arguments.length) {
    return rtl.spaceLeft(a.toFixed(c), b);
  }
  var d = "", e = Math.abs(a);
  1.0e+10 > e ? d = "00" : 1.0e+100 > e && (d = "0");
  2 > arguments.length ? b = 9 : 9 > b && (b = 9);
  e = (0 < a ? " " : "") + a.toExponential(b - 8);
  e = e.replace(/e(.)/, "E$1" + d);
  return rtl.spaceLeft(e, b);
}};

