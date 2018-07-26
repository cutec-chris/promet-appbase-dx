var pas = {};

var rtl = {

  quiet: false,
  debug_load_units: false,
  debug_rtti: false,

  debug: function(){
    if (rtl.quiet || !console || !console.log) return;
    console.log(arguments);
  },

  error: function(s){
    rtl.debug('Error: ',s);
    throw s;
  },

  warn: function(s){
    rtl.debug('Warn: ',s);
  },

  hasString: function(s){
    return rtl.isString(s) && (s.length>0);
  },

  isArray: function(a) {
    return Array.isArray(a);
  },

  isFunction: function(f){
    return typeof(f)==="function";
  },

  isModule: function(m){
    return rtl.isObject(m) && rtl.hasString(m.$name) && (pas[m.$name]===m);
  },

  isImplementation: function(m){
    return rtl.isObject(m) && rtl.isModule(m.$module) && (m.$module.$impl===m);
  },

  isNumber: function(n){
    return typeof(n)==="number";
  },

  isObject: function(o){
    var s=typeof(o);
    return (typeof(o)==="object") && (o!=null);
  },

  isString: function(s){
    return typeof(s)==="string";
  },

  getNumber: function(n){
    return typeof(n)==="number"?n:NaN;
  },

  getChar: function(c){
    return ((typeof(c)==="string") && (c.length===1)) ? c : "";
  },

  getObject: function(o){
    return ((typeof(o)==="object") || (typeof(o)==='function')) ? o : null;
  },

  isPasClass: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$classname') && rtl.isObject(type.$module));
  },

  isPasClassInstance: function(type){
    return (rtl.isObject(type) && rtl.isPasClass(type.$class));
  },

  hexStr: function(n,digits){
    return ("000000000000000"+n.toString(16).toUpperCase()).slice(-digits);
  },

  m_loading: 0,
  m_loading_intf: 1,
  m_intf_loaded: 2,
  m_loading_impl: 3, // loading all used unit
  m_initializing: 4, // running initialization
  m_initialized: 5,

  module: function(module_name, intfuseslist, intfcode, impluseslist, implcode){
    if (rtl.debug_load_units) rtl.debug('rtl.module name="'+module_name+'" intfuses='+intfuseslist+' impluses='+impluseslist+' hasimplcode='+rtl.isFunction(implcode));
    if (!rtl.hasString(module_name)) rtl.error('invalid module name "'+module_name+'"');
    if (!rtl.isArray(intfuseslist)) rtl.error('invalid interface useslist of "'+module_name+'"');
    if (!rtl.isFunction(intfcode)) rtl.error('invalid interface code of "'+module_name+'"');
    if (!(impluseslist==undefined) && !rtl.isArray(impluseslist)) rtl.error('invalid implementation useslist of "'+module_name+'"');
    if (!(implcode==undefined) && !rtl.isFunction(implcode)) rtl.error('invalid implementation code of "'+module_name+'"');

    if (pas[module_name])
      rtl.error('module "'+module_name+'" is already registered');

    var module = pas[module_name] = {
      $name: module_name,
      $intfuseslist: intfuseslist,
      $impluseslist: impluseslist,
      $state: rtl.m_loading,
      $intfcode: intfcode,
      $implcode: implcode,
      $impl: null,
      $rtti: Object.create(rtl.tSectionRTTI)
    };
    module.$rtti.$module = module;
    if (implcode) module.$impl = {
      $module: module,
      $rtti: module.$rtti
    };
  },

  exitcode: 0,

  run: function(module_name){
  
    function doRun(){
      if (!rtl.hasString(module_name)) module_name='program';
      if (rtl.debug_load_units) rtl.debug('rtl.run module="'+module_name+'"');
      rtl.initRTTI();
      var module = pas[module_name];
      if (!module) rtl.error('rtl.run module "'+module_name+'" missing');
      rtl.loadintf(module);
      rtl.loadimpl(module);
      if (module_name=='program'){
        if (rtl.debug_load_units) rtl.debug('running $main');
        var r = pas.program.$main();
        if (rtl.isNumber(r)) rtl.exitcode = r;
      }
    }
    
    if (rtl.showUncaughtExceptions) {
      try{
        doRun();
      } catch(re) {
        var errMsg = re.hasOwnProperty('$class') ? re.$class.$classname : '';
	    errMsg +=  ((errMsg) ? ': ' : '') + (re.hasOwnProperty('fMessage') ? re.fMessage : re);
        alert('Uncaught Exception : '+errMsg);
        rtl.exitCode = 216;
      }
    } else {
      doRun();
    }
    return rtl.exitcode;
  },

  loadintf: function(module){
    if (module.$state>rtl.m_loading_intf) return; // already finished
    if (rtl.debug_load_units) rtl.debug('loadintf: "'+module.$name+'"');
    if (module.$state===rtl.m_loading_intf)
      rtl.error('unit cycle detected "'+module.$name+'"');
    module.$state=rtl.m_loading_intf;
    // load interfaces of interface useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadintf);
    // run interface
    if (rtl.debug_load_units) rtl.debug('loadintf: run intf of "'+module.$name+'"');
    module.$intfcode(module.$intfuseslist);
    // success
    module.$state=rtl.m_intf_loaded;
    // Note: units only used in implementations are not yet loaded (not even their interfaces)
  },

  loaduseslist: function(module,useslist,f){
    if (useslist==undefined) return;
    for (var i in useslist){
      var unitname=useslist[i];
      if (rtl.debug_load_units) rtl.debug('loaduseslist of "'+module.$name+'" uses="'+unitname+'"');
      if (pas[unitname]==undefined)
        rtl.error('module "'+module.$name+'" misses "'+unitname+'"');
      f(pas[unitname]);
    }
  },

  loadimpl: function(module){
    if (module.$state>=rtl.m_loading_impl) return; // already processing
    if (module.$state<rtl.m_intf_loaded) rtl.error('loadimpl: interface not loaded of "'+module.$name+'"');
    if (rtl.debug_load_units) rtl.debug('loadimpl: load uses of "'+module.$name+'"');
    module.$state=rtl.m_loading_impl;
    // load interfaces of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadintf);
    // load implementation of interfaces useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadimpl);
    // load implementation of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadimpl);
    // Note: At this point all interfaces used by this unit are loaded. If
    //   there are implementation uses cycles some used units might not yet be
    //   initialized. This is by design.
    // run implementation
    if (rtl.debug_load_units) rtl.debug('loadimpl: run impl of "'+module.$name+'"');
    if (rtl.isFunction(module.$implcode)) module.$implcode(module.$impluseslist);
    // run initialization
    if (rtl.debug_load_units) rtl.debug('loadimpl: run init of "'+module.$name+'"');
    module.$state=rtl.m_initializing;
    if (rtl.isFunction(module.$init)) module.$init();
    // unit initialized
    module.$state=rtl.m_initialized;
  },

  createCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      cb = function(){
        return scope[fn].apply(scope,arguments);
      };
    } else {
      cb = function(){
        return fn.apply(scope,arguments);
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  cloneCallback: function(cb){
    return rtl.createCallback(cb.scope,cb.fn);
  },

  eqCallback: function(a,b){
    // can be a function or a function wrapper
    if (a==b){
      return true;
    } else {
      return (a!=null) && (b!=null) && (a.fn) && (a.scope===b.scope) && (a.fn==b.fn);
    }
  },

  initClass: function(c,parent,name,initfn){
    parent[name] = c;
    c.$classname = name;
    if ((parent.$module) && (parent.$module.$impl===parent)) parent=parent.$module;
    c.$parent = parent;
    c.$fullname = parent.$name+'.'+name;
    if (rtl.isModule(parent)){
      c.$module = parent;
      c.$name = name;
    } else {
      c.$module = parent.$module;
      c.$name = parent.name+'.'+name;
    };
    // rtti
    if (rtl.debug_rtti) rtl.debug('initClass '+c.$fullname);
    var t = c.$module.$rtti.$Class(c.$name,{ "class": c, module: parent });
    c.$rtti = t;
    if (rtl.isObject(c.$ancestor)) t.ancestor = c.$ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  createClass: function(parent,name,ancestor,initfn){
    // create a normal class,
    // ancestor must be null or a normal class,
    // the root ancestor can be an external class
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // Note:
      // if root is an "object" then c.$ancestor === Object.getPrototypeOf(c)
      // if root is a "function" then c.$ancestor === c.__proto__, Object.getPrototypeOf(c) returns the root
    } else {
      c = {};
      c.$create = function(fnname,args){
        if (args == undefined) args = [];
        var o = Object.create(this);
        o.$class = this; // Note: o.$class === Object.getPrototypeOf(o)
        o.$init();
        try{
          o[fnname].apply(o,args);
          o.AfterConstruction();
        } catch($e){
          o.$destroy;
          throw $e;
        }
        return o;
      };
      c.$destroy = function(fnname){
        this.BeforeDestruction();
        this[fnname]();
        this.$final;
      };
    };
    rtl.initClass(c,parent,name,initfn);
  },

  createClassExt: function(parent,name,ancestor,newinstancefnname,initfn){
    // Create a class using an external ancestor.
    // If newinstancefnname is given, use that function to create the new object.
    // If exist call BeforeDestruction and AfterConstruction.
    var c = null;
    c = Object.create(ancestor);
    c.$create = function(fnname,args){
      if (args == undefined) args = [];
      var o = null;
      if (newinstancefnname.length>0){
        o = this[newinstancefnname](fnname,args);
      } else {
        o = Object.create(this);
      }
      o.$class = this; // Note: o.$class === Object.getPrototypeOf(o)
      o.$init();
      try{
        o[fnname].apply(o,args);
        if (o.AfterConstruction) o.AfterConstruction();
      } catch($e){
        o.$destroy;
        throw $e;
      }
      return o;
    };
    c.$destroy = function(fnname){
      if (this.BeforeDestruction) this.BeforeDestruction();
      this[fnname]();
      this.$final;
    };
    rtl.initClass(c,parent,name,initfn);
  },

  tObjectDestroy: "Destroy",

  free: function(obj,name){
    if (obj[name]==null) return;
    obj[name].$destroy(rtl.tObjectDestroy);
    obj[name]=null;
  },

  freeLoc: function(obj){
    if (obj==null) return;
    obj.$destroy(rtl.tObjectDestroy);
    return null;
  },

  is: function(instance,type){
    return type.isPrototypeOf(instance) || (instance===type);
  },

  isExt: function(instance,type,mode){
    // mode===1 means instance must be a Pascal class instance
    // mode===2 means instance must be a Pascal class
    // Notes:
    // isPrototypeOf and instanceof return false on equal
    // isPrototypeOf does not work for Date.isPrototypeOf(new Date())
    //   so if isPrototypeOf is false test with instanceof
    // instanceof needs a function on right side
    if (instance == null) return false; // Note: ==null checks for undefined too
    if ((typeof(type) !== 'object') && (typeof(type) !== 'function')) return false;
    if (instance === type){
      if (mode===1) return false;
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if (type.isPrototypeOf && type.isPrototypeOf(instance)){
      if (mode===1) return rtl.isPasClassInstance(instance);
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if ((typeof type == 'function') && (instance instanceof type)) return true;
    return false;
  },

  Exception: null,
  EInvalidCast: null,
  EAbstractError: null,
  ERangeError: null,

  raiseE: function(typename){
    var t = rtl[typename];
    if (t==null){
      var mod = pas.SysUtils;
      if (!mod) mod = pas.sysutils;
      if (mod){
        t = mod[typename];
        if (!t) t = mod[typename.toLowerCase()];
        if (!t) t = mod['Exception'];
        if (!t) t = mod['exception'];
      }
    }
    if (t){
      if (t.Create){
        throw t.$create("Create");
      } else if (t.create){
        throw t.$create("create");
      }
    }
    if (typename === "EInvalidCast") throw "invalid type cast";
    if (typename === "EAbstractError") throw "Abstract method called";
    if (typename === "ERangeError") throw "range error";
    throw typename;
  },

  as: function(instance,type){
    if((instance === null) || rtl.is(instance,type)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  asExt: function(instance,type,mode){
    if((instance === null) || rtl.isExt(instance,type,mode)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  createInterface: function(module, name, guid, fnnames, ancestor, initfn){
    //console.log('createInterface name="'+name+'" guid="'+guid+'" names='+fnnames);
    var i = ancestor?Object.create(ancestor):{};
    module[name] = i;
    i.$module = module;
    i.$name = name;
    i.$fullname = module.$name+'.'+name;
    i.$guid = guid;
    i.$guidr = null;
    i.$names = fnnames?fnnames:[];
    if (rtl.isFunction(initfn)){
      // rtti
      if (rtl.debug_rtti) rtl.debug('createInterface '+i.$fullname);
      var t = i.$module.$rtti.$Interface(name,{ "interface": i, module: module });
      i.$rtti = t;
      if (ancestor) t.ancestor = ancestor.$rtti;
      if (!t.ancestor) t.ancestor = null;
      initfn.call(i);
    }
    return i;
  },

  strToGUIDR: function(s,g){
    var p = 0;
    function n(l){
      var h = s.substr(p,l);
      p+=l;
      return parseInt(h,16);
    }
    p+=1; // skip {
    g.D1 = n(8);
    p+=1; // skip -
    g.D2 = n(4);
    p+=1; // skip -
    g.D3 = n(4);
    p+=1; // skip -
    if (!g.D4) g.D4=[];
    g.D4[0] = n(2);
    g.D4[1] = n(2);
    p+=1; // skip -
    for(var i=2; i<8; i++) g.D4[i] = n(2);
    return g;
  },

  guidrToStr: function(g){
    if (g.$intf) return g.$intf.$guid;
    var h = rtl.hexStr;
    var s='{'+h(g.D1,8)+'-'+h(g.D2,4)+'-'+h(g.D3,4)+'-'+h(g.D4[0],2)+h(g.D4[1],2)+'-';
    for (var i=2; i<8; i++) s+=h(g.D4[i],2);
    s+='}';
    return s;
  },

  createTGUID: function(guid){
    var TGuid = (pas.System)?pas.System.TGuid:pas.system.tguid;
    var g = rtl.strToGUIDR(guid,new TGuid());
    return g;
  },

  getIntfGUIDR: function(intfTypeOrVar){
    if (!intfTypeOrVar) return null;
    if (!intfTypeOrVar.$guidr){
      var g = rtl.createTGUID(intfTypeOrVar.$guid);
      if (!intfTypeOrVar.hasOwnProperty('$guid')) intfTypeOrVar = Object.getPrototypeOf(intfTypeOrVar);
      g.$intf = intfTypeOrVar;
      intfTypeOrVar.$guidr = g;
    }
    return intfTypeOrVar.$guidr;
  },

  addIntf: function (aclass, intf, map){
    function jmp(fn){
      if (typeof(fn)==="function"){
        return function(){ return fn.apply(this.$o,arguments); };
      } else {
        return function(){ rtl.raiseE('EAbstractError'); };
      }
    }
    if(!map) map = {};
    var t = intf;
    var item = Object.create(t);
    aclass.$intfmaps[intf.$guid] = item;
    do{
      var names = t.$names;
      if (!names) break;
      for (var i=0; i<names.length; i++){
        var intfname = names[i];
        var fnname = map[intfname];
        if (!fnname) fnname = intfname;
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" old='+typeof(item[intfname]));
        item[intfname] = jmp(aclass[fnname]);
      }
      t = Object.getPrototypeOf(t);
    }while(t!=null);
  },

  getIntfG: function (obj, guid, query){
    if (!obj) return null;
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query);
    // search
    var maps = obj.$intfmaps;
    if (!maps) return null;
    var item = maps[guid];
    if (!item) return null;
    // check delegation
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query+' item='+typeof(item));
    if (typeof item === 'function') return item.call(obj); // delegate. Note: COM contains _AddRef
    // check cache
    var intf = null;
    if (obj.$interfaces){
      intf = obj.$interfaces[guid];
      //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' cache='+typeof(intf));
    }
    if (!intf){ // intf can be undefined!
      intf = Object.create(item);
      intf.$o = obj;
      if (!obj.$interfaces) obj.$interfaces = {};
      obj.$interfaces[guid] = intf;
    }
    if (typeof(query)==='object'){
      // called by queryIntfT
      var o = null;
      if (intf.QueryInterface(rtl.getIntfGUIDR(query),
          {get:function(){ return o; }, set:function(v){ o=v; }}) === 0){
        return o;
      } else {
        return null;
      }
    } else if(query===2){
      // called by TObject.GetInterfaceByStr
      if (intf.$kind === 'com') intf._AddRef();
    }
    return intf;
  },

  getIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid);
  },

  queryIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid,intftype);
  },

  queryIntfIsT: function(obj,intftype){
    var i = rtl.queryIntfG(obj,intftype.$guid);
    if (!i) return false;
    if (i.$kind === 'com') i._Release();
    return true;
  },

  asIntfT: function (obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (i!==null) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsClass: function(intf,classtype){
    return (intf!=null) && (rtl.is(intf.$o,classtype));
  },

  intfAsClass: function(intf,classtype){
    if (intf==null) return null;
    return rtl.as(intf.$o,classtype);
  },

  intfToClass: function(intf,classtype){
    if ((intf!==null) && rtl.is(intf.$o,classtype)) return intf.$o;
    return null;
  },

  // interface reference counting
  intfRefs: { // base object for temporary interface variables
    ref: function(id,intf){
      // called for temporary interface references needing delayed release
      var old = this[id];
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null')+' $o='+(intf?intf.$o:'null'));
      if (old){
        // called again, e.g. in a loop
        delete this[id];
        old._Release(); // may fail
      }
      this[id]=intf;
      return intf;
    },
    free: function(){
      //console.log('rtl.intfRefs.free...');
      for (var id in this){
        if (this.hasOwnProperty(id)){
          //console.log('rtl.intfRefs.free: id='+id+' '+this[id].$name+' $o='+this[id].$o.$classname);
          this[id]._Release();
        }
      }
    }
  },

  createIntfRefs: function(){
    //console.log('rtl.createIntfRefs');
    return Object.create(rtl.intfRefs);
  },

  setIntfP: function(path,name,value,skipAddRef){
    var old = path[name];
    //console.log('rtl.setIntfP path='+path+' name='+name+' old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old === value) return;
    if (old !== null){
      path[name]=null;
      old._Release();
    }
    if (value !== null){
      if (!skipAddRef) value._AddRef();
      path[name]=value;
    }
  },

  setIntfL: function(old,value,skipAddRef){
    //console.log('rtl.setIntfL old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old !== value){
      if (value!==null){
        if (!skipAddRef) value._AddRef();
      }
      if (old!==null){
        old._Release();  // Release after AddRef, to avoid double Release if Release creates an exception
      }
    } else if (skipAddRef){
      if (old!==null){
        old._Release();  // value has an AddRef
      }
    }
    return value;
  },

  _AddRef: function(intf){
    //if (intf) console.log('rtl._AddRef intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._AddRef();
    return intf;
  },

  _Release: function(intf){
    //if (intf) console.log('rtl._Release intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._Release();
    return intf;
  },

  checkMethodCall: function(obj,type){
    if (rtl.isObject(obj) && rtl.is(obj,type)) return;
    rtl.raiseE("EInvalidCast");
  },

  rc: function(i,minval,maxval){
    // range check integer
    if ((Math.floor(i)===i) && (i>=minval) && (i<=maxval)) return i;
    rtl.raiseE('ERangeError');
  },

  rcc: function(c,minval,maxval){
    // range check char
    if ((typeof(c)==='string') && (c.length===1)){
      var i = c.charCodeAt(0);
      if ((i>=minval) && (i<=maxval)) return c;
    }
    rtl.raiseE('ERangeError');
  },

  rcSetCharAt: function(s,index,c){
    // range check setCharAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return rtl.setCharAt(s,index,c);
  },

  rcCharAt: function(s,index){
    // range check charAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return s.charAt(index);
  },

  rcArrR: function(arr,index){
    // range check read array
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      if (arguments.length>2){
        // arr,index1,index2,...
        arr=arr[index];
        for (var i=2; i<arguments.length; i++) arr=rtl.rcArrR(arr,arguments[i]);
        return arr;
      }
      return arr[index];
    }
    rtl.raiseE('ERangeError');
  },

  rcArrW: function(arr,index,value){
    // range check write array
    // arr,index1,index2,...,value
    for (var i=3; i<arguments.length; i++){
      arr=rtl.rcArrR(arr,index);
      index=arguments[i-1];
      value=arguments[i];
    }
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      return arr[index]=value;
    }
    rtl.raiseE('ERangeError');
  },

  length: function(arr){
    return (arr == null) ? 0 : arr.length;
  },

  arraySetLength: function(arr,defaultvalue,newlength){
    // multi dim: (arr,defaultvalue,dim1,dim2,...)
    if (arr == null) arr = [];
    var p = arguments;
    function setLength(a,argNo){
      var oldlen = a.length;
      var newlen = p[argNo];
      if (oldlen!==newlength){
        a.length = newlength;
        if (argNo === p.length-1){
          if (rtl.isArray(defaultvalue)){
            for (var i=oldlen; i<newlen; i++) a[i]=[]; // nested array
          } else if (rtl.isFunction(defaultvalue)){
            for (var i=oldlen; i<newlen; i++) a[i]=new defaultvalue(); // e.g. record
          } else if (rtl.isObject(defaultvalue)) {
            for (var i=oldlen; i<newlen; i++) a[i]={}; // e.g. set
          } else {
            for (var i=oldlen; i<newlen; i++) a[i]=defaultvalue;
          }
        } else {
          for (var i=oldlen; i<newlen; i++) a[i]=[]; // nested array
        }
      }
      if (argNo < p.length-1){
        // multi argNo
        for (var i=0; i<newlen; i++) a[i]=setLength(a[i],argNo+1);
      }
      return a;
    }
    return setLength(arr,2);
  },

  arrayEq: function(a,b){
    if (a===null) return b===null;
    if (b===null) return false;
    if (a.length!==b.length) return false;
    for (var i=0; i<a.length; i++) if (a[i]!==b[i]) return false;
    return true;
  },

  arrayClone: function(type,src,srcpos,endpos,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if (rtl.isFunction(type)){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = new type(src[srcpos]); // clone record
    } else if(type === 'refSet') {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    }  else {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src !== null) l+=src.length;
    };
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayConcatN: function(){
    var a = null;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      if (a===null){
        a=src; // Note: concat(a) does not clone
      } else {
        a=a.concat(src);
      }
    };
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray === null) return [];
    if (index < 0) index = 0;
    if (count === undefined) count=srcarray.length;
    var end = index+count;
    if (end>srcarray.length) end = srcarray.length;
    if (index>=end) return [];
    if (type===0){
      return srcarray.slice(index,end);
    } else {
      var a = [];
      a.length = end-index;
      rtl.arrayClone(type,srcarray,index,end,a,0);
      return a;
    }
  },

  setCharAt: function(s,index,c){
    return s.substr(0,index)+c+s.substr(index+1);
  },

  getResStr: function(mod,name){
    var rs = mod.$resourcestrings[name];
    return rs.current?rs.current:rs.org;
  },

  createSet: function(){
    var s = {};
    for (var i=0; i<arguments.length; i++){
      if (arguments[i]!=null){
        s[arguments[i]]=true;
      } else {
        var first=arguments[i+=1];
        var last=arguments[i+=1];
        for(var j=first; j<=last; j++) s[j]=true;
      }
    }
    return s;
  },

  cloneSet: function(s){
    var r = {};
    for (var key in s) r[key]=true;
    return r;
  },

  refSet: function(s){
    s.$shared = true;
    return s;
  },

  includeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    s[enumvalue] = true;
    return s;
  },

  excludeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    delete s[enumvalue];
    return s;
  },

  diffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    delete r.$shared;
    return r;
  },

  unionSet: function(s,t){
    var r = {};
    for (var key in s) r[key]=true;
    for (var key in t) r[key]=true;
    delete r.$shared;
    return r;
  },

  intersectSet: function(s,t){
    var r = {};
    for (var key in s) if (t[key]) r[key]=true;
    delete r.$shared;
    return r;
  },

  symDiffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    for (var key in t) if (!s[key]) r[key]=true;
    delete r.$shared;
    return r;
  },

  eqSet: function(s,t){
    for (var key in s) if (!t[key] && (key!='$shared')) return false;
    for (var key in t) if (!s[key] && (key!='$shared')) return false;
    return true;
  },

  neSet: function(s,t){
    return !rtl.eqSet(s,t);
  },

  leSet: function(s,t){
    for (var key in s) if (!t[key] && (key!='$shared')) return false;
    return true;
  },

  geSet: function(s,t){
    for (var key in t) if (!s[key] && (key!='$shared')) return false;
    return true;
  },

  strSetLength: function(s,newlen){
    var oldlen = s.length;
    if (oldlen > newlen){
      return s.substring(0,newlen);
    } else if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return s+' '.repeat(newlen-oldlen);
    } else {
       while (oldlen<newlen){
         s+=' ';
         oldlen++;
       };
       return s;
    }
  },

  spaceLeft: function(s,width){
    var l=s.length;
    if (l>=width) return s;
    if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return ' '.repeat(width-l) + s;
    } else {
      while (l<width){
        s=' '+s;
        l++;
      };
    };
  },

  floatToStr : function(d,w,p){
    // input 1-3 arguments: double, width, precision
    if (arguments.length>2){
      return rtl.spaceLeft(d.toFixed(p),w);
    } else {
	  // exponent width
	  var pad = "";
	  var ad = Math.abs(d);
	  if (ad<1.0e+10) {
		pad='00';
	  } else if (ad<1.0e+100) {
		pad='0';
      }  	
	  if (arguments.length<2) {
	    w=9;		
      } else if (w<9) {
		w=9;
      }		  
      var p = w-8;
      var s=(d>0 ? " " : "" ) + d.toExponential(p);
      s=s.replace(/e(.)/,'E$1'+pad);
      return rtl.spaceLeft(s,w);
    }
  },

  initRTTI: function(){
    if (rtl.debug_rtti) rtl.debug('initRTTI');

    // base types
    rtl.tTypeInfo = { name: "tTypeInfo" };
    function newBaseTI(name,kind,ancestor){
      if (!ancestor) ancestor = rtl.tTypeInfo;
      if (rtl.debug_rtti) rtl.debug('initRTTI.newBaseTI "'+name+'" '+kind+' ("'+ancestor.name+'")');
      var t = Object.create(ancestor);
      t.name = name;
      t.kind = kind;
      rtl[name] = t;
      return t;
    };
    function newBaseInt(name,minvalue,maxvalue,ordtype){
      var t = newBaseTI(name,1 /* tkInteger */,rtl.tTypeInfoInteger);
      t.minvalue = minvalue;
      t.maxvalue = maxvalue;
      t.ordtype = ordtype;
      return t;
    };
    newBaseTI("tTypeInfoInteger",1 /* tkInteger */);
    newBaseInt("shortint",-0x80,0x7f,0);
    newBaseInt("byte",0,0xff,1);
    newBaseInt("smallint",-0x8000,0x7fff,2);
    newBaseInt("word",0,0xffff,3);
    newBaseInt("longint",-0x80000000,0x7fffffff,4);
    newBaseInt("longword",0,0xffffffff,5);
    newBaseInt("nativeint",-0x10000000000000,0xfffffffffffff,6);
    newBaseInt("nativeuint",0,0xfffffffffffff,7);
    newBaseTI("char",2 /* tkChar */);
    newBaseTI("string",3 /* tkString */);
    newBaseTI("tTypeInfoEnum",4 /* tkEnumeration */,rtl.tTypeInfoInteger);
    newBaseTI("tTypeInfoSet",5 /* tkSet */);
    newBaseTI("double",6 /* tkDouble */);
    newBaseTI("boolean",7 /* tkBool */);
    newBaseTI("tTypeInfoProcVar",8 /* tkProcVar */);
    newBaseTI("tTypeInfoMethodVar",9 /* tkMethod */,rtl.tTypeInfoProcVar);
    newBaseTI("tTypeInfoArray",10 /* tkArray */);
    newBaseTI("tTypeInfoDynArray",11 /* tkDynArray */);
    newBaseTI("tTypeInfoPointer",15 /* tkPointer */);
    var t = newBaseTI("pointer",15 /* tkPointer */,rtl.tTypeInfoPointer);
    t.reftype = null;
    newBaseTI("jsvalue",16 /* tkJSValue */);
    newBaseTI("tTypeInfoRefToProcVar",17 /* tkRefToProcVar */,rtl.tTypeInfoProcVar);

    // member kinds
    rtl.tTypeMember = {};
    function newMember(name,kind){
      var m = Object.create(rtl.tTypeMember);
      m.name = name;
      m.kind = kind;
      rtl[name] = m;
    };
    newMember("tTypeMemberField",1); // tmkField
    newMember("tTypeMemberMethod",2); // tmkMethod
    newMember("tTypeMemberProperty",3); // tmkProperty

    // base object for storing members: a simple object
    rtl.tTypeMembers = {};

    // tTypeInfoStruct - base object for tTypeInfoClass, tTypeInfoRecord, tTypeInfoInterface
    var tis = newBaseTI("tTypeInfoStruct",0);
    tis.$addMember = function(name,ancestor,options){
      if (rtl.debug_rtti){
        if (!rtl.hasString(name) || (name.charAt()==='$')) throw 'invalid member "'+name+'", this="'+this.name+'"';
        if (!rtl.is(ancestor,rtl.tTypeMember)) throw 'invalid ancestor "'+ancestor+':'+ancestor.name+'", "'+this.name+'.'+name+'"';
        if ((options!=undefined) && (typeof(options)!='object')) throw 'invalid options "'+options+'", "'+this.name+'.'+name+'"';
      };
      var t = Object.create(ancestor);
      t.name = name;
      this.members[name] = t;
      this.names.push(name);
      if (rtl.isObject(options)){
        for (var key in options) if (options.hasOwnProperty(key)) t[key] = options[key];
      };
      return t;
    };
    tis.addField = function(name,type,options){
      var t = this.$addMember(name,rtl.tTypeMemberField,options);
      if (rtl.debug_rtti){
        if (!rtl.is(type,rtl.tTypeInfo)) throw 'invalid type "'+type+'", "'+this.name+'.'+name+'"';
      };
      t.typeinfo = type;
      this.fields.push(name);
      return t;
    };
    tis.addFields = function(){
      var i=0;
      while(i<arguments.length){
        var name = arguments[i++];
        var type = arguments[i++];
        if ((i<arguments.length) && (typeof(arguments[i])==='object')){
          this.addField(name,type,arguments[i++]);
        } else {
          this.addField(name,type);
        };
      };
    };
    tis.addMethod = function(name,methodkind,params,result,options){
      var t = this.$addMember(name,rtl.tTypeMemberMethod,options);
      t.methodkind = methodkind;
      t.procsig = rtl.newTIProcSig(params);
      t.procsig.resulttype = result?result:null;
      this.methods.push(name);
      return t;
    };
    tis.addProperty = function(name,flags,result,getter,setter,options){
      var t = this.$addMember(name,rtl.tTypeMemberProperty,options);
      t.flags = flags;
      t.typeinfo = result;
      t.getter = getter;
      t.setter = setter;
      // Note: in options: params, stored, defaultvalue
      if (rtl.isArray(t.params)) t.params = rtl.newTIParams(t.params);
      this.properties.push(name);
      if (!rtl.isString(t.stored)) t.stored = "";
      return t;
    };
    tis.getField = function(index){
      return this.members[this.fields[index]];
    };
    tis.getMethod = function(index){
      return this.members[this.methods[index]];
    };
    tis.getProperty = function(index){
      return this.members[this.properties[index]];
    };

    newBaseTI("tTypeInfoRecord",12 /* tkRecord */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClass",13 /* tkClass */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClassRef",14 /* tkClassRef */);
    newBaseTI("tTypeInfoInterface",15 /* tkInterface */,rtl.tTypeInfoStruct);
  },

  tSectionRTTI: {
    $module: null,
    $inherited: function(name,ancestor,o){
      if (rtl.debug_rtti){
        rtl.debug('tSectionRTTI.newTI "'+(this.$module?this.$module.$name:"(no module)")
          +'"."'+name+'" ('+ancestor.name+') '+(o?'init':'forward'));
      };
      var t = this[name];
      if (t){
        if (!t.$forward) throw 'duplicate type "'+name+'"';
        if (!ancestor.isPrototypeOf(t)) throw 'typeinfo ancestor mismatch "'+name+'" ancestor="'+ancestor.name+'" t.name="'+t.name+'"';
      } else {
        t = Object.create(ancestor);
        t.name = name;
        t.$module = this.$module;
        this[name] = t;
      }
      if (o){
        delete t.$forward;
        for (var key in o) if (o.hasOwnProperty(key)) t[key]=o[key];
      } else {
        t.$forward = true;
      }
      return t;
    },
    $Scope: function(name,ancestor,o){
      var t=this.$inherited(name,ancestor,o);
      t.members = {};
      t.names = [];
      t.fields = [];
      t.methods = [];
      t.properties = [];
      return t;
    },
    $TI: function(name,kind,o){ var t=this.$inherited(name,rtl.tTypeInfo,o); t.kind = kind; return t; },
    $Int: function(name,o){ return this.$inherited(name,rtl.tTypeInfoInteger,o); },
    $Enum: function(name,o){ return this.$inherited(name,rtl.tTypeInfoEnum,o); },
    $Set: function(name,o){ return this.$inherited(name,rtl.tTypeInfoSet,o); },
    $StaticArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoArray,o); },
    $DynArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoDynArray,o); },
    $ProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoProcVar,o); },
    $RefToProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoRefToProcVar,o); },
    $MethodVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoMethodVar,o); },
    $Record: function(name,o){ return this.$Scope(name,rtl.tTypeInfoRecord,o); },
    $Class: function(name,o){ return this.$Scope(name,rtl.tTypeInfoClass,o); },
    $ClassRef: function(name,o){ return this.$inherited(name,rtl.tTypeInfoClassRef,o); },
    $Pointer: function(name,o){ return this.$inherited(name,rtl.tTypeInfoPointer,o); },
    $Interface: function(name,o){ return this.$Scope(name,rtl.tTypeInfoInterface,o); }
  },

  newTIParam: function(param){
    // param is an array, 0=name, 1=type, 2=optional flags
    var t = {
      name: param[0],
      typeinfo: param[1],
      flags: (rtl.isNumber(param[2]) ? param[2] : 0)
    };
    return t;
  },

  newTIParams: function(list){
    // list: optional array of [paramname,typeinfo,optional flags]
    var params = [];
    if (rtl.isArray(list)){
      for (var i=0; i<list.length; i++) params.push(rtl.newTIParam(list[i]));
    };
    return params;
  },

  newTIProcSig: function(params,result,flags){
    var s = {
      params: rtl.newTIParams(params),
      resulttype: result,
      flags: flags
    };
    return s;
  }
}
rtl.module("System",[],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.LineEnding = "\n";
  this.sLineBreak = $mod.LineEnding;
  this.MaxSmallint = 32767;
  this.MinSmallint = -32768;
  this.MaxShortInt = 127;
  this.MinShortInt = -128;
  this.MaxByte = 0xFF;
  this.MaxWord = 0xFFFF;
  this.MaxLongint = 0x7fffffff;
  this.MaxCardinal = 0xffffffff;
  this.Maxint = 2147483647;
  this.IsMultiThread = false;
  $mod.$rtti.$inherited("Real",rtl.double,{});
  $mod.$rtti.$inherited("Extended",rtl.double,{});
  $mod.$rtti.$inherited("TDateTime",rtl.double,{});
  $mod.$rtti.$inherited("TTime",$mod.$rtti["TDateTime"],{});
  $mod.$rtti.$inherited("TDate",$mod.$rtti["TDateTime"],{});
  $mod.$rtti.$inherited("Int64",rtl.nativeint,{});
  $mod.$rtti.$inherited("UInt64",rtl.nativeuint,{});
  $mod.$rtti.$inherited("QWord",rtl.nativeuint,{});
  $mod.$rtti.$inherited("Single",rtl.double,{});
  $mod.$rtti.$inherited("Comp",rtl.nativeint,{});
  $mod.$rtti.$inherited("UnicodeString",rtl.string,{});
  $mod.$rtti.$inherited("WideString",rtl.string,{});
  this.TTextLineBreakStyle = {"0": "tlbsLF", tlbsLF: 0, "1": "tlbsCRLF", tlbsCRLF: 1, "2": "tlbsCR", tlbsCR: 2};
  $mod.$rtti.$Enum("TTextLineBreakStyle",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TTextLineBreakStyle});
  this.TGuid = function (s) {
    if (s) {
      this.D1 = s.D1;
      this.D2 = s.D2;
      this.D3 = s.D3;
      this.D4 = s.D4.slice(0);
    } else {
      this.D1 = 0;
      this.D2 = 0;
      this.D3 = 0;
      this.D4 = rtl.arraySetLength(null,0,8);
    };
    this.$equal = function (b) {
      return (this.D1 === b.D1) && ((this.D2 === b.D2) && ((this.D3 === b.D3) && rtl.arrayEq(this.D4,b.D4)));
    };
  };
  $mod.$rtti.$StaticArray("TGuid.D4$a",{dims: [8], eltype: rtl.byte});
  $mod.$rtti.$Record("TGuid",{}).addFields("D1",rtl.longword,"D2",rtl.word,"D3",rtl.word,"D4",$mod.$rtti["TGuid.D4$a"]);
  $mod.$rtti.$inherited("TGUIDString",rtl.string,{});
  $mod.$rtti.$Class("TObject");
  $mod.$rtti.$ClassRef("TClass",{instancetype: $mod.$rtti["TObject"]});
  rtl.createClass($mod,"TObject",null,function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
    this.Create = function () {
    };
    this.Destroy = function () {
    };
    this.Free = function () {
      this.$destroy("Destroy");
    };
    this.ClassType = function () {
      return this;
    };
    this.ClassNameIs = function (Name) {
      var Result = false;
      Result = $impl.SameText(Name,this.$classname);
      return Result;
    };
    this.InheritsFrom = function (aClass) {
      return (aClass!=null) && ((this==aClass) || aClass.isPrototypeOf(this));
    };
    this.AfterConstruction = function () {
    };
    this.BeforeDestruction = function () {
    };
    this.GetInterface = function (iid, obj) {
      var Result = false;
      var i = iid.$intf;
      if (i){
        i = rtl.getIntfG(this,i.$guid,2);
        if (i){
          obj.set(i);
          return true;
        }
      };
      Result = this.GetInterfaceByStr(rtl.guidrToStr(iid),obj);
      return Result;
    };
    this.GetInterface$1 = function (iidstr, obj) {
      var Result = false;
      Result = this.GetInterfaceByStr(iidstr,obj);
      return Result;
    };
    this.GetInterfaceByStr = function (iidstr, obj) {
      var Result = false;
      if ($mod.IObjectInstance.$equal(rtl.createTGUID(iidstr))) {
        obj.set(this);
        return true;
      };
      var i = rtl.getIntfG(this,iidstr,2);
      obj.set(i);
      return i!==null;
      Result = false;
      return Result;
    };
    this.GetInterfaceWeak = function (iid, obj) {
      var Result = false;
      Result = this.GetInterface(iid,obj);
      if (Result){
        var o = obj.get();
        if (o.$kind==='com'){
          o._Release();
        }
      };
      return Result;
    };
    this.Equals = function (Obj) {
      var Result = false;
      Result = Obj === this;
      return Result;
    };
    this.ToString = function () {
      var Result = "";
      Result = this.$classname;
      return Result;
    };
  });
  this.S_OK = 0;
  this.S_FALSE = 1;
  this.E_NOINTERFACE = -2147467262;
  this.E_UNEXPECTED = -2147418113;
  this.E_NOTIMPL = -2147467263;
  rtl.createInterface($mod,"IUnknown","{00000000-0000-0000-C000-000000000046}",["QueryInterface","_AddRef","_Release"],null,function () {
    this.$kind = "com";
    var $r = this.$rtti;
    $r.addMethod("QueryInterface",1,[["iid",$mod.$rtti["TGuid"],2],["obj",null,4]],rtl.longint);
    $r.addMethod("_AddRef",1,null,rtl.longint);
    $r.addMethod("_Release",1,null,rtl.longint);
  });
  rtl.createInterface($mod,"IInvokable","{88387EF6-BCEE-3E17-9E85-5D491ED4FC10}",[],$mod.IUnknown,function () {
  });
  rtl.createInterface($mod,"IEnumerator","{ECEC7568-4E50-30C9-A2F0-439342DE2ADB}",["GetCurrent","MoveNext","Reset"],$mod.IUnknown,function () {
    var $r = this.$rtti;
    $r.addMethod("GetCurrent",1,null,$mod.$rtti["TObject"]);
    $r.addMethod("MoveNext",1,null,rtl.boolean);
    $r.addMethod("Reset",0,null);
    $r.addProperty("Current",1,$mod.$rtti["TObject"],"GetCurrent","");
  });
  rtl.createInterface($mod,"IEnumerable","{9791C368-4E51-3424-A3CE-D4911D54F385}",["GetEnumerator"],$mod.IUnknown,function () {
    var $r = this.$rtti;
    $r.addMethod("GetEnumerator",1,null,$mod.$rtti["IEnumerator"]);
  });
  rtl.createClass($mod,"TInterfacedObject",$mod.TObject,function () {
    this.$init = function () {
      $mod.TObject.$init.call(this);
      this.fRefCount = 0;
    };
    this.QueryInterface = function (iid, obj) {
      var Result = 0;
      if (this.GetInterface(iid,obj)) {
        Result = 0}
       else Result = -2147467262;
      return Result;
    };
    this._AddRef = function () {
      var Result = 0;
      this.fRefCount += 1;
      Result = this.fRefCount;
      return Result;
    };
    this._Release = function () {
      var Result = 0;
      this.fRefCount -= 1;
      Result = this.fRefCount;
      if (this.fRefCount === 0) this.$destroy("Destroy");
      return Result;
    };
    this.BeforeDestruction = function () {
      if (this.fRefCount !== 0) rtl.raiseE('EHeapMemoryError');
    };
    this.$intfmaps = {};
    rtl.addIntf(this,$mod.IUnknown);
  });
  $mod.$rtti.$ClassRef("TInterfacedClass",{instancetype: $mod.$rtti["TInterfacedObject"]});
  rtl.createClass($mod,"TAggregatedObject",$mod.TObject,function () {
    this.$init = function () {
      $mod.TObject.$init.call(this);
      this.fController = null;
    };
    this.GetController = function () {
      var Result = null;
      var $ok = false;
      try {
        Result = rtl.setIntfL(Result,this.fController);
        $ok = true;
      } finally {
        if (!$ok) rtl._Release(Result);
      };
      return Result;
    };
    this.QueryInterface = function (iid, obj) {
      var Result = 0;
      Result = this.fController.QueryInterface(iid,obj);
      return Result;
    };
    this._AddRef = function () {
      var Result = 0;
      Result = this.fController._AddRef();
      return Result;
    };
    this._Release = function () {
      var Result = 0;
      Result = this.fController._Release();
      return Result;
    };
    this.Create$1 = function (aController) {
      $mod.TObject.Create.call(this);
      this.fController = aController;
    };
  });
  rtl.createClass($mod,"TContainedObject",$mod.TAggregatedObject,function () {
    this.QueryInterface = function (iid, obj) {
      var Result = 0;
      if (this.GetInterface(iid,obj)) {
        Result = 0}
       else Result = -2147467262;
      return Result;
    };
    this.$intfmaps = {};
    rtl.addIntf(this,$mod.IUnknown);
  });
  this.IObjectInstance = new $mod.TGuid({D1: 0xD91C9AF4, D2: 0x3C93, D3: 0x420F, D4: [0xA3,0x03,0xBF,0x5B,0xA8,0x2B,0xFD,0x23]});
  this.IsConsole = false;
  $mod.$rtti.$ProcVar("TOnParamCount",{procsig: rtl.newTIProcSig(null,rtl.longint)});
  $mod.$rtti.$ProcVar("TOnParamStr",{procsig: rtl.newTIProcSig([["Index",rtl.longint]],rtl.string)});
  this.OnParamCount = null;
  this.OnParamStr = null;
  this.ParamCount = function () {
    var Result = 0;
    if ($mod.OnParamCount != null) {
      Result = $mod.OnParamCount()}
     else Result = 0;
    return Result;
  };
  this.ParamStr = function (Index) {
    var Result = "";
    if ($mod.OnParamStr != null) {
      Result = $mod.OnParamStr(Index)}
     else if (Index === 0) {
      Result = "js"}
     else Result = "";
    return Result;
  };
  this.Frac = function (A) {
    return A % 1;
  };
  this.Odd = function (A) {
    return A&1 != 0;
  };
  this.Random = function (Range) {
    return Math.floor(Math.random()*Range);
  };
  this.Sqr = function (A) {
    return A*A;
  };
  this.Sqr$1 = function (A) {
    return A*A;
  };
  this.Trunc = function (A) {
    if (!Math.trunc) {
      Math.trunc = function(v) {
        v = +v;
        if (!isFinite(v)) return v;
        return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
      };
    }
    $mod.Trunc = Math.trunc;
    return Math.trunc(A);
  };
  this.DefaultTextLineBreakStyle = $mod.TTextLineBreakStyle.tlbsLF;
  this.Int = function (A) {
    var Result = 0.0;
    Result = Math.trunc(A);
    return Result;
  };
  this.Copy = function (S, Index, Size) {
    if (Index<1) Index = 1;
    return (Size>0) ? S.substring(Index-1,Index+Size-1) : "";
  };
  this.Copy$1 = function (S, Index) {
    if (Index<1) Index = 1;
    return S.substr(Index-1);
  };
  this.Delete = function (S, Index, Size) {
    var h = "";
    if (((Index < 1) || (Index > S.get().length)) || (Size <= 0)) return;
    h = S.get();
    S.set($mod.Copy(h,1,Index - 1) + $mod.Copy$1(h,Index + Size));
  };
  this.Pos = function (Search, InString) {
    return InString.indexOf(Search)+1;
  };
  this.Pos$1 = function (Search, InString, StartAt) {
    return InString.indexOf(Search,StartAt-1)+1;
  };
  this.Insert = function (Insertion, Target, Index) {
    var t = "";
    if (Insertion === "") return;
    t = Target.get();
    if (Index < 1) {
      Target.set(Insertion + t)}
     else if (Index > t.length) {
      Target.set(t + Insertion)}
     else Target.set(($mod.Copy(t,1,Index - 1) + Insertion) + $mod.Copy(t,Index,t.length));
  };
  this.upcase = function (c) {
    return c.toUpperCase();
  };
  this.val = function (S, NI, Code) {
    var x = 0.0;
    Code.set(0);
    x = Number(S);
    if (isNaN(x) || (x !== $mod.Int(x))) {
      Code.set(1)}
     else NI.set($mod.Trunc(x));
  };
  this.val$1 = function (S, SI, Code) {
    var X = 0.0;
    Code.set(0);
    X = Number(S);
    if (isNaN(X) || (X !== $mod.Int(X))) {
      Code.set(1)}
     else if ((X < -128) || (X > 127)) {
      Code.set(2)}
     else SI.set($mod.Trunc(X));
  };
  this.val$2 = function (S, B, Code) {
    var x = 0.0;
    Code.set(0);
    x = Number(S);
    if (isNaN(x) || (x !== $mod.Int(x))) {
      Code.set(1)}
     else if ((x < 0) || (x > 255)) {
      Code.set(2)}
     else B.set($mod.Trunc(x));
  };
  this.val$3 = function (S, SI, Code) {
    var x = 0.0;
    Code.set(0);
    x = Number(S);
    if (isNaN(x) || (x !== $mod.Int(x))) {
      Code.set(1)}
     else if ((x < -32768) || (x > 32767)) {
      Code.set(2)}
     else SI.set($mod.Trunc(x));
  };
  this.val$4 = function (S, W, Code) {
    var x = 0.0;
    Code.set(0);
    x = Number(S);
    if (isNaN(x)) {
      Code.set(1)}
     else if ((x < 0) || (x > 65535)) {
      Code.set(2)}
     else W.set($mod.Trunc(x));
  };
  this.val$5 = function (S, I, Code) {
    var x = 0.0;
    Code.set(0);
    x = Number(S);
    if (isNaN(x)) {
      Code.set(1)}
     else if (x > 2147483647) {
      Code.set(2)}
     else I.set($mod.Trunc(x));
  };
  this.val$6 = function (S, C, Code) {
    var x = 0.0;
    Code.set(0);
    x = Number(S);
    if (isNaN(x) || (x !== $mod.Int(x))) {
      Code.set(1)}
     else if ((x < 0) || (x > 4294967295)) {
      Code.set(2)}
     else C.set($mod.Trunc(x));
  };
  this.val$7 = function (S, d, Code) {
    var x = 0.0;
    x = Number(S);
    if (isNaN(x)) {
      Code.set(1)}
     else {
      Code.set(0);
      d.set(x);
    };
  };
  this.StringOfChar = function (c, l) {
    var Result = "";
    var i = 0;
    Result = "";
    for (var $l1 = 1, $end2 = l; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = Result + c;
    };
    return Result;
  };
  this.Write = function () {
    var i = 0;
    for (var $l1 = 0, $end2 = rtl.length(arguments) - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      if ($impl.WriteCallBack != null) {
        $impl.WriteCallBack(arguments[i],false)}
       else $impl.WriteBuf = $impl.WriteBuf + ("" + arguments[i]);
    };
  };
  this.Writeln = function () {
    var i = 0;
    var l = 0;
    var s = "";
    l = rtl.length(arguments) - 1;
    if ($impl.WriteCallBack != null) {
      for (var $l1 = 0, $end2 = l; $l1 <= $end2; $l1++) {
        i = $l1;
        $impl.WriteCallBack(arguments[i],i === l);
      };
    } else {
      s = $impl.WriteBuf;
      for (var $l3 = 0, $end4 = l; $l3 <= $end4; $l3++) {
        i = $l3;
        s = s + ("" + arguments[i]);
      };
      console.log(s);
      $impl.WriteBuf = "";
    };
  };
  $mod.$rtti.$ProcVar("TConsoleHandler",{procsig: rtl.newTIProcSig([["S",rtl.jsvalue],["NewLine",rtl.boolean]])});
  this.SetWriteCallBack = function (H) {
    var Result = null;
    Result = $impl.WriteCallBack;
    $impl.WriteCallBack = H;
    return Result;
  };
  this.Assigned = function (V) {
    return (V!=undefined) && (V!=null) && (!rtl.isArray(V) || (V.length > 0));
  };
  this.StrictEqual = function (A, B) {
    return A === B;
  };
  this.StrictInequal = function (A, B) {
    return A !== B;
  };
  $mod.$init = function () {
    rtl.exitcode = 0;
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.SameText = function (s1, s2) {
    return s1.toLowerCase() == s2.toLowerCase();
  };
  $impl.WriteBuf = "";
  $impl.WriteCallBack = null;
});
rtl.module("Types",["System"],function () {
  "use strict";
  var $mod = this;
  this.TDirection = {"0": "FromBeginning", FromBeginning: 0, "1": "FromEnd", FromEnd: 1};
  $mod.$rtti.$Enum("TDirection",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TDirection});
  $mod.$rtti.$DynArray("TBooleanDynArray",{eltype: rtl.boolean});
  $mod.$rtti.$DynArray("TIntegerDynArray",{eltype: rtl.longint});
  $mod.$rtti.$DynArray("TNativeIntDynArray",{eltype: rtl.nativeint});
  $mod.$rtti.$DynArray("TStringDynArray",{eltype: rtl.string});
  $mod.$rtti.$DynArray("TDoubleDynArray",{eltype: rtl.double});
  $mod.$rtti.$DynArray("TJSValueDynArray",{eltype: rtl.jsvalue});
  this.TDuplicates = {"0": "dupIgnore", dupIgnore: 0, "1": "dupAccept", dupAccept: 1, "2": "dupError", dupError: 2};
  $mod.$rtti.$Enum("TDuplicates",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TDuplicates});
  $mod.$rtti.$MethodVar("TListCallback",{procsig: rtl.newTIProcSig([["data",rtl.jsvalue],["arg",rtl.jsvalue]]), methodkind: 0});
  $mod.$rtti.$ProcVar("TListStaticCallback",{procsig: rtl.newTIProcSig([["data",rtl.jsvalue],["arg",rtl.jsvalue]])});
  this.TSize = function (s) {
    if (s) {
      this.cx = s.cx;
      this.cy = s.cy;
    } else {
      this.cx = 0;
      this.cy = 0;
    };
    this.$equal = function (b) {
      return (this.cx === b.cx) && (this.cy === b.cy);
    };
  };
  $mod.$rtti.$Record("TSize",{}).addFields("cx",rtl.longint,"cy",rtl.longint);
  this.TPoint = function (s) {
    if (s) {
      this.x = s.x;
      this.y = s.y;
    } else {
      this.x = 0;
      this.y = 0;
    };
    this.$equal = function (b) {
      return (this.x === b.x) && (this.y === b.y);
    };
  };
  $mod.$rtti.$Record("TPoint",{}).addFields("x",rtl.longint,"y",rtl.longint);
  this.TRect = function (s) {
    if (s) {
      this.Left = s.Left;
      this.Top = s.Top;
      this.Right = s.Right;
      this.Bottom = s.Bottom;
    } else {
      this.Left = 0;
      this.Top = 0;
      this.Right = 0;
      this.Bottom = 0;
    };
    this.$equal = function (b) {
      return (this.Left === b.Left) && ((this.Top === b.Top) && ((this.Right === b.Right) && (this.Bottom === b.Bottom)));
    };
  };
  $mod.$rtti.$Record("TRect",{}).addFields("Left",rtl.longint,"Top",rtl.longint,"Right",rtl.longint,"Bottom",rtl.longint);
  this.EqualRect = function (r1, r2) {
    var Result = false;
    Result = (((r1.Left === r2.Left) && (r1.Right === r2.Right)) && (r1.Top === r2.Top)) && (r1.Bottom === r2.Bottom);
    return Result;
  };
  this.Rect = function (Left, Top, Right, Bottom) {
    var Result = new $mod.TRect();
    Result.Left = Left;
    Result.Top = Top;
    Result.Right = Right;
    Result.Bottom = Bottom;
    return Result;
  };
  this.Bounds = function (ALeft, ATop, AWidth, AHeight) {
    var Result = new $mod.TRect();
    Result.Left = ALeft;
    Result.Top = ATop;
    Result.Right = ALeft + AWidth;
    Result.Bottom = ATop + AHeight;
    return Result;
  };
  this.Point = function (x, y) {
    var Result = new $mod.TPoint();
    Result.x = x;
    Result.y = y;
    return Result;
  };
  this.PtInRect = function (aRect, p) {
    var Result = false;
    Result = (((p.y >= aRect.Top) && (p.y < aRect.Bottom)) && (p.x >= aRect.Left)) && (p.x < aRect.Right);
    return Result;
  };
  this.IntersectRect = function (aRect, R1, R2) {
    var Result = false;
    var lRect = new $mod.TRect();
    lRect = new $mod.TRect(R1);
    if (R2.Left > R1.Left) lRect.Left = R2.Left;
    if (R2.Top > R1.Top) lRect.Top = R2.Top;
    if (R2.Right < R1.Right) lRect.Right = R2.Right;
    if (R2.Bottom < R1.Bottom) lRect.Bottom = R2.Bottom;
    if ($mod.IsRectEmpty(lRect)) {
      aRect.set(new $mod.TRect($mod.Rect(0,0,0,0)));
      Result = false;
    } else {
      Result = true;
      aRect.set(new $mod.TRect(lRect));
    };
    return Result;
  };
  this.UnionRect = function (aRect, R1, R2) {
    var Result = false;
    var lRect = new $mod.TRect();
    lRect = new $mod.TRect(R1);
    if (R2.Left < R1.Left) lRect.Left = R2.Left;
    if (R2.Top < R1.Top) lRect.Top = R2.Top;
    if (R2.Right > R1.Right) lRect.Right = R2.Right;
    if (R2.Bottom > R1.Bottom) lRect.Bottom = R2.Bottom;
    if ($mod.IsRectEmpty(lRect)) {
      aRect.set(new $mod.TRect($mod.Rect(0,0,0,0)));
      Result = false;
    } else {
      aRect.set(new $mod.TRect(lRect));
      Result = true;
    };
    return Result;
  };
  this.IsRectEmpty = function (aRect) {
    var Result = false;
    Result = (aRect.Right <= aRect.Left) || (aRect.Bottom <= aRect.Top);
    return Result;
  };
  this.OffsetRect = function (aRect, DX, DY) {
    var Result = false;
    var $with1 = aRect.get();
    $with1.Left += DX;
    $with1.Top += DY;
    $with1.Right += DX;
    $with1.Bottom += DY;
    Result = true;
    return Result;
  };
  this.CenterPoint = function (aRect) {
    var Result = new $mod.TPoint();
    function Avg(a, b) {
      var Result = 0;
      if (a < b) {
        Result = a + ((b - a) >>> 1)}
       else Result = b + ((a - b) >>> 1);
      return Result;
    };
    Result.x = Avg(aRect.Left,aRect.Right);
    Result.y = Avg(aRect.Top,aRect.Bottom);
    return Result;
  };
  this.InflateRect = function (aRect, dx, dy) {
    var Result = false;
    var $with1 = aRect.get();
    $with1.Left -= dx;
    $with1.Top -= dy;
    $with1.Right += dx;
    $with1.Bottom += dy;
    Result = true;
    return Result;
  };
  this.Size = function (AWidth, AHeight) {
    var Result = new $mod.TSize();
    Result.cx = AWidth;
    Result.cy = AHeight;
    return Result;
  };
  this.Size$1 = function (aRect) {
    var Result = new $mod.TSize();
    Result.cx = aRect.Right - aRect.Left;
    Result.cy = aRect.Bottom - aRect.Top;
    return Result;
  };
});
rtl.module("JS",["System","Types"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"EJS",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FMessage = "";
    };
    this.Create$1 = function (Msg) {
      this.FMessage = Msg;
    };
  });
  $mod.$rtti.$DynArray("TJSObjectDynArray",{eltype: $mod.$rtti["TJSObject"]});
  $mod.$rtti.$DynArray("TJSObjectDynArrayArray",{eltype: $mod.$rtti["TJSObjectDynArray"]});
  $mod.$rtti.$DynArray("TJSStringDynArray",{eltype: rtl.string});
  this.TLocaleCompareOptions = function (s) {
    if (s) {
      this.localematched = s.localematched;
      this.usage = s.usage;
      this.sensitivity = s.sensitivity;
      this.ignorePunctuation = s.ignorePunctuation;
      this.numeric = s.numeric;
      this.caseFirst = s.caseFirst;
    } else {
      this.localematched = "";
      this.usage = "";
      this.sensitivity = "";
      this.ignorePunctuation = false;
      this.numeric = false;
      this.caseFirst = "";
    };
    this.$equal = function (b) {
      return (this.localematched === b.localematched) && ((this.usage === b.usage) && ((this.sensitivity === b.sensitivity) && ((this.ignorePunctuation === b.ignorePunctuation) && ((this.numeric === b.numeric) && (this.caseFirst === b.caseFirst)))));
    };
  };
  $mod.$rtti.$Record("TLocaleCompareOptions",{}).addFields("localematched",rtl.string,"usage",rtl.string,"sensitivity",rtl.string,"ignorePunctuation",rtl.boolean,"numeric",rtl.boolean,"caseFirst",rtl.string);
  $mod.$rtti.$ProcVar("TReplaceCallBack",{procsig: rtl.newTIProcSig(null,rtl.string,2)});
  $mod.$rtti.$RefToProcVar("TJSArrayEvent",{procsig: rtl.newTIProcSig([["element",rtl.jsvalue],["index",rtl.nativeint],["anArray",$mod.$rtti["TJSArray"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSArrayMapEvent",{procsig: rtl.newTIProcSig([["element",rtl.jsvalue],["index",rtl.nativeint],["anArray",$mod.$rtti["TJSArray"]]],rtl.jsvalue)});
  $mod.$rtti.$RefToProcVar("TJSArrayReduceEvent",{procsig: rtl.newTIProcSig([["accumulator",rtl.jsvalue],["currentValue",rtl.jsvalue],["currentIndex",rtl.nativeint],["anArray",$mod.$rtti["TJSArray"]]],rtl.jsvalue)});
  $mod.$rtti.$RefToProcVar("TJSArrayCompareEvent",{procsig: rtl.newTIProcSig([["a",rtl.jsvalue],["b",rtl.jsvalue]],rtl.nativeint)});
  $mod.$rtti.$ProcVar("TJSTypedArrayCallBack",{procsig: rtl.newTIProcSig([["element",rtl.jsvalue],["index",rtl.nativeint],["anArray",$mod.$rtti["TJSTypedArray"]]],rtl.boolean)});
  $mod.$rtti.$MethodVar("TJSTypedArrayEvent",{procsig: rtl.newTIProcSig([["element",rtl.jsvalue],["index",rtl.nativeint],["anArray",$mod.$rtti["TJSTypedArray"]]],rtl.boolean), methodkind: 1});
  $mod.$rtti.$ProcVar("TJSTypedArrayMapCallBack",{procsig: rtl.newTIProcSig([["element",rtl.jsvalue],["index",rtl.nativeint],["anArray",$mod.$rtti["TJSTypedArray"]]],rtl.jsvalue)});
  $mod.$rtti.$MethodVar("TJSTypedArrayMapEvent",{procsig: rtl.newTIProcSig([["element",rtl.jsvalue],["index",rtl.nativeint],["anArray",$mod.$rtti["TJSTypedArray"]]],rtl.jsvalue), methodkind: 1});
  $mod.$rtti.$ProcVar("TJSTypedArrayReduceCallBack",{procsig: rtl.newTIProcSig([["accumulator",rtl.jsvalue],["currentValue",rtl.jsvalue],["currentIndex",rtl.nativeint],["anArray",$mod.$rtti["TJSTypedArray"]]],rtl.jsvalue)});
  $mod.$rtti.$ProcVar("TJSTypedArrayCompareCallBack",{procsig: rtl.newTIProcSig([["a",rtl.jsvalue],["b",rtl.jsvalue]],rtl.nativeint)});
  $mod.$rtti.$RefToProcVar("TJSPromiseResolver",{procsig: rtl.newTIProcSig([["aValue",rtl.jsvalue]],rtl.jsvalue)});
  $mod.$rtti.$RefToProcVar("TJSPromiseExecutor",{procsig: rtl.newTIProcSig([["resolve",$mod.$rtti["TJSPromiseResolver"]],["reject",$mod.$rtti["TJSPromiseResolver"]]])});
  $mod.$rtti.$RefToProcVar("TJSPromiseFinallyHandler",{procsig: rtl.newTIProcSig(null)});
  $mod.$rtti.$DynArray("TJSPromiseArray",{eltype: $mod.$rtti["TJSPromise"]});
  this.New = function (aElements) {
    var Result = null;
    var L = 0;
    var I = 0;
    var S = "";
    L = rtl.length(aElements);
    if ((L % 2) === 1) throw $mod.EJS.$create("Create$1",["Number of arguments must be even"]);
    I = 0;
    while (I < L) {
      if (!rtl.isString(aElements[I])) {
        S = String(I);
        throw $mod.EJS.$create("Create$1",[("Argument " + S) + " must be a string."]);
      };
      I += 2;
    };
    I = 0;
    Result = new Object();
    while (I < L) {
      S = "" + aElements[I];
      Result[S] = aElements[I + 1];
      I += 2;
    };
    return Result;
  };
  this.JSDelete = function (Obj, PropName) {
    return delete Obj[PropName];
  };
  this.hasValue = function (v) {
    if(v){ return true; } else { return false; };
  };
  this.isBoolean = function (v) {
    return typeof(v) == 'boolean';
  };
  this.isCallback = function (v) {
    return rtl.isObject(v) && rtl.isObject(v.scope) && (rtl.isString(v.fn) || rtl.isFunction(v.fn));
  };
  this.isChar = function (v) {
    return (typeof(v)!="string") && (v.length==1);
  };
  this.isClass = function (v) {
    return (typeof(v)=="object") && (v!=null) && (v.$class == v);
  };
  this.isClassInstance = function (v) {
    return (typeof(v)=="object") && (v!=null) && (v.$class == Object.getPrototypeOf(v));
  };
  this.isInteger = function (v) {
    return Math.floor(v)===v;
  };
  this.isNull = function (v) {
    return v === null;
  };
  this.isRecord = function (v) {
    return (typeof(v)=="function") && (typeof(v.$create) == "function");
  };
  this.isUndefined = function (v) {
    return v == undefined;
  };
  this.isDefined = function (v) {
    return !(v == undefined);
  };
  this.isUTF16Char = function (v) {
    if (typeof(v)!="string") return false;
    if ((v.length==0) || (v.length>2)) return false;
    var code = v.charCodeAt(0);
    if (code < 0xD800){
      if (v.length == 1) return true;
    } else if (code <= 0xDBFF){
      if (v.length==2){
        code = v.charCodeAt(1);
        if (code >= 0xDC00 && code <= 0xDFFF) return true;
      };
    };
    return false;
  };
  this.jsInstanceOf = function (aFunction, aFunctionWithPrototype) {
    return aFunction instanceof aFunctionWithPrototype;
  };
  this.toNumber = function (v) {
    return v-0;
  };
  this.toInteger = function (v) {
    var Result = 0;
    if ($mod.isInteger(v)) {
      Result = Math.floor(v)}
     else Result = 0;
    return Result;
  };
  this.toObject = function (Value) {
    var Result = null;
    if (rtl.isObject(Value)) {
      Result = rtl.getObject(Value)}
     else Result = null;
    return Result;
  };
  this.toArray = function (Value) {
    var Result = null;
    if (rtl.isArray(Value)) {
      Result = rtl.getObject(Value)}
     else Result = null;
    return Result;
  };
  this.toBoolean = function (Value) {
    var Result = false;
    if ($mod.isBoolean(Value)) {
      Result = !(Value == false)}
     else Result = false;
    return Result;
  };
  this.ToString = function (Value) {
    var Result = "";
    if (rtl.isString(Value)) {
      Result = "" + Value}
     else Result = "";
    return Result;
  };
  this.TJSValueType = {"0": "jvtNull", jvtNull: 0, "1": "jvtBoolean", jvtBoolean: 1, "2": "jvtInteger", jvtInteger: 2, "3": "jvtFloat", jvtFloat: 3, "4": "jvtString", jvtString: 4, "5": "jvtObject", jvtObject: 5, "6": "jvtArray", jvtArray: 6};
  $mod.$rtti.$Enum("TJSValueType",{minvalue: 0, maxvalue: 6, ordtype: 1, enumtype: this.TJSValueType});
  this.GetValueType = function (JS) {
    var Result = 0;
    var t = "";
    if ($mod.isNull(JS)) {
      Result = $mod.TJSValueType.jvtNull}
     else {
      t = typeof(JS);
      if (t === "string") {
        Result = $mod.TJSValueType.jvtString}
       else if (t === "boolean") {
        Result = $mod.TJSValueType.jvtBoolean}
       else if (t === "object") {
        if (rtl.isArray(JS)) {
          Result = $mod.TJSValueType.jvtArray}
         else Result = $mod.TJSValueType.jvtObject;
      } else if (t === "number") if ($mod.isInteger(JS)) {
        Result = $mod.TJSValueType.jvtInteger}
       else Result = $mod.TJSValueType.jvtFloat;
    };
    return Result;
  };
});
rtl.module("Web",["System","Types","JS"],function () {
  "use strict";
  var $mod = this;
  $mod.$rtti.$RefToProcVar("TJSEventHandler",{procsig: rtl.newTIProcSig([["Event",$mod.$rtti["TEventListenerEvent"]]],rtl.boolean)});
  $mod.$rtti.$ProcVar("TJSNodeListCallBack",{procsig: rtl.newTIProcSig([["currentValue",$mod.$rtti["TJSNode"]],["currentIndex",rtl.nativeint],["list",$mod.$rtti["TJSNodeList"]]])});
  $mod.$rtti.$MethodVar("TJSNodeListEvent",{procsig: rtl.newTIProcSig([["currentValue",$mod.$rtti["TJSNode"]],["currentIndex",rtl.nativeint],["list",$mod.$rtti["TJSNodeList"]]]), methodkind: 0});
  $mod.$rtti.$ProcVar("TDOMTokenlistCallBack",{procsig: rtl.newTIProcSig([["Current",rtl.jsvalue],["currentIndex",rtl.nativeint],["list",$mod.$rtti["TJSDOMTokenList"]]])});
  this.TJSClientRect = function (s) {
    if (s) {
      this.left = s.left;
      this.top = s.top;
      this.right = s.right;
      this.bottom = s.bottom;
    } else {
      this.left = 0.0;
      this.top = 0.0;
      this.right = 0.0;
      this.bottom = 0.0;
    };
    this.$equal = function (b) {
      return (this.left === b.left) && ((this.top === b.top) && ((this.right === b.right) && (this.bottom === b.bottom)));
    };
  };
  $mod.$rtti.$Record("TJSClientRect",{}).addFields("left",rtl.double,"top",rtl.double,"right",rtl.double,"bottom",rtl.double);
  $mod.$rtti.$DynArray("TJSClientRectArray",{eltype: $mod.$rtti["TJSClientRect"]});
  this.TJSElementCreationOptions = function (s) {
    if (s) {
      this.named = s.named;
    } else {
      this.named = "";
    };
    this.$equal = function (b) {
      return this.named === b.named;
    };
  };
  $mod.$rtti.$Record("TJSElementCreationOptions",{}).addFields("named",rtl.string);
  this.TJSEventInit = function (s) {
    if (s) {
      this.bubbles = s.bubbles;
      this.cancelable = s.cancelable;
      this.scoped = s.scoped;
      this.composed = s.composed;
    } else {
      this.bubbles = false;
      this.cancelable = false;
      this.scoped = false;
      this.composed = false;
    };
    this.$equal = function (b) {
      return (this.bubbles === b.bubbles) && ((this.cancelable === b.cancelable) && ((this.scoped === b.scoped) && (this.composed === b.composed)));
    };
  };
  $mod.$rtti.$Record("TJSEventInit",{}).addFields("bubbles",rtl.boolean,"cancelable",rtl.boolean,"scoped",rtl.boolean,"composed",rtl.boolean);
  $mod.$rtti.$ProcVar("TJSNameSpaceMapperCallback",{procsig: rtl.newTIProcSig([["aNameSpace",rtl.string]],rtl.string)});
  $mod.$rtti.$RefToProcVar("TJSDataTransferItemCallBack",{procsig: rtl.newTIProcSig([["aData",rtl.string]])});
  $mod.$rtti.$RefToProcVar("TJSDragDropEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSDragEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("THTMLClickEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSMouseEvent"]]],rtl.boolean)});
  rtl.createClassExt($mod,"TJSAnimationEvent",Event,"",function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
  });
  rtl.createClassExt($mod,"TJSLoadEvent",Event,"",function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
  });
  rtl.createClassExt($mod,"TJsPageTransitionEvent",Event,"",function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
  });
  $mod.$rtti.$RefToProcVar("TJSPageTransitionEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJsPageTransitionEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSHashChangeEventhandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSHashChangeEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSMouseWheelEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSWheelEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSMouseEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSMouseEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("THTMLAnimationEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSAnimationEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSErrorEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSErrorEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSFocusEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSKeyEventhandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSKeyboardEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSLoadEventhandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSLoadEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSPointerEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSPointerEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSUIEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSUIEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSPopStateEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSPopStateEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSStorageEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSStorageEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSProgressEventhandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSProgressEvent"]]],rtl.boolean)});
  $mod.$rtti.$RefToProcVar("TJSTouchEventHandler",{procsig: rtl.newTIProcSig([["aEvent",$mod.$rtti["TJSTouchEvent"]]],rtl.boolean)});
  rtl.createClass($mod,"TJSIDBTransactionMode",pas.System.TObject,function () {
    this.readonly = "readonly";
    this.readwrite = "readwrite";
    this.versionchange = "versionchange";
  });
  this.TJSIDBIndexParameters = function (s) {
    if (s) {
      this.unique = s.unique;
      this.multiEntry = s.multiEntry;
      this.locale = s.locale;
    } else {
      this.unique = false;
      this.multiEntry = false;
      this.locale = "";
    };
    this.$equal = function (b) {
      return (this.unique === b.unique) && ((this.multiEntry === b.multiEntry) && (this.locale === b.locale));
    };
  };
  $mod.$rtti.$Record("TJSIDBIndexParameters",{}).addFields("unique",rtl.boolean,"multiEntry",rtl.boolean,"locale",rtl.string);
  this.TJSCreateObjectStoreOptions = function (s) {
    if (s) {
      this.keyPath = s.keyPath;
      this.autoIncrement = s.autoIncrement;
    } else {
      this.keyPath = undefined;
      this.autoIncrement = false;
    };
    this.$equal = function (b) {
      return (this.keyPath === b.keyPath) && (this.autoIncrement === b.autoIncrement);
    };
  };
  $mod.$rtti.$Record("TJSCreateObjectStoreOptions",{}).addFields("keyPath",rtl.jsvalue,"autoIncrement",rtl.boolean);
  this.TJSPositionError = function (s) {
    if (s) {
      this.code = s.code;
      this.message = s.message;
    } else {
      this.code = 0;
      this.message = "";
    };
    this.$equal = function (b) {
      return (this.code === b.code) && (this.message === b.message);
    };
  };
  $mod.$rtti.$Record("TJSPositionError",{}).addFields("code",rtl.longint,"message",rtl.string);
  this.TJSPositionOptions = function (s) {
    if (s) {
      this.enableHighAccuracy = s.enableHighAccuracy;
      this.timeout = s.timeout;
      this.maximumAge = s.maximumAge;
    } else {
      this.enableHighAccuracy = false;
      this.timeout = 0;
      this.maximumAge = 0;
    };
    this.$equal = function (b) {
      return (this.enableHighAccuracy === b.enableHighAccuracy) && ((this.timeout === b.timeout) && (this.maximumAge === b.maximumAge));
    };
  };
  $mod.$rtti.$Record("TJSPositionOptions",{}).addFields("enableHighAccuracy",rtl.boolean,"timeout",rtl.longint,"maximumAge",rtl.longint);
  this.TJSCoordinates = function (s) {
    if (s) {
      this.latitude = s.latitude;
      this.longitude = s.longitude;
      this.altitude = s.altitude;
      this.accuracy = s.accuracy;
      this.altitudeAccuracy = s.altitudeAccuracy;
      this.heading = s.heading;
      this.speed = s.speed;
    } else {
      this.latitude = 0.0;
      this.longitude = 0.0;
      this.altitude = 0.0;
      this.accuracy = 0.0;
      this.altitudeAccuracy = 0.0;
      this.heading = 0.0;
      this.speed = 0.0;
    };
    this.$equal = function (b) {
      return (this.latitude === b.latitude) && ((this.longitude === b.longitude) && ((this.altitude === b.altitude) && ((this.accuracy === b.accuracy) && ((this.altitudeAccuracy === b.altitudeAccuracy) && ((this.heading === b.heading) && (this.speed === b.speed))))));
    };
  };
  $mod.$rtti.$Record("TJSCoordinates",{}).addFields("latitude",rtl.double,"longitude",rtl.double,"altitude",rtl.double,"accuracy",rtl.double,"altitudeAccuracy",rtl.double,"heading",rtl.double,"speed",rtl.double);
  this.TJSPosition = function (s) {
    if (s) {
      this.coords = new $mod.TJSCoordinates(s.coords);
      this.timestamp = s.timestamp;
    } else {
      this.coords = new $mod.TJSCoordinates();
      this.timestamp = "";
    };
    this.$equal = function (b) {
      return this.coords.$equal(b.coords) && (this.timestamp === b.timestamp);
    };
  };
  $mod.$rtti.$Record("TJSPosition",{}).addFields("coords",$mod.$rtti["TJSCoordinates"],"timestamp",rtl.string);
  $mod.$rtti.$ProcVar("TJSGeoLocationCallback",{procsig: rtl.newTIProcSig([["aPosition",$mod.$rtti["TJSPosition"]]])});
  $mod.$rtti.$MethodVar("TJSGeoLocationEvent",{procsig: rtl.newTIProcSig([["aPosition",$mod.$rtti["TJSPosition"]]]), methodkind: 0});
  $mod.$rtti.$ProcVar("TJSGeoLocationErrorCallback",{procsig: rtl.newTIProcSig([["aValue",$mod.$rtti["TJSPositionError"]]])});
  $mod.$rtti.$MethodVar("TJSGeoLocationErrorEvent",{procsig: rtl.newTIProcSig([["aValue",$mod.$rtti["TJSPositionError"]]]), methodkind: 0});
  this.TJSServiceWorkerContainerOptions = function (s) {
    if (s) {
      this.scope = s.scope;
    } else {
      this.scope = "";
    };
    this.$equal = function (b) {
      return this.scope === b.scope;
    };
  };
  $mod.$rtti.$Record("TJSServiceWorkerContainerOptions",{}).addFields("scope",rtl.string);
  $mod.$rtti.$RefToProcVar("TJSTimerCallBack",{procsig: rtl.newTIProcSig(null)});
  $mod.$rtti.$ProcVar("TFrameRequestCallback",{procsig: rtl.newTIProcSig([["aTime",rtl.double]])});
  $mod.$rtti.$DynArray("TJSWindowArray",{eltype: $mod.$rtti["TJSWindow"]});
  $mod.$rtti.$RefToProcVar("THTMLCanvasToBlobCallback",{procsig: rtl.newTIProcSig([["aBlob",$mod.$rtti["TJSBlob"]]],rtl.boolean)});
  this.TJSTextMetrics = function (s) {
    if (s) {
      this.width = s.width;
      this.actualBoundingBoxLeft = s.actualBoundingBoxLeft;
      this.actualBoundingBoxRight = s.actualBoundingBoxRight;
      this.fontBoundingBoxAscent = s.fontBoundingBoxAscent;
      this.fontBoundingBoxDescent = s.fontBoundingBoxDescent;
      this.actualBoundingBoxAscent = s.actualBoundingBoxAscent;
      this.actualBoundingBoxDescent = s.actualBoundingBoxDescent;
      this.emHeightAscent = s.emHeightAscent;
      this.emHeightDescent = s.emHeightDescent;
      this.hangingBaseline = s.hangingBaseline;
      this.alphabeticBaseline = s.alphabeticBaseline;
      this.ideographicBaseline = s.ideographicBaseline;
    } else {
      this.width = 0.0;
      this.actualBoundingBoxLeft = 0.0;
      this.actualBoundingBoxRight = 0.0;
      this.fontBoundingBoxAscent = 0.0;
      this.fontBoundingBoxDescent = 0.0;
      this.actualBoundingBoxAscent = 0.0;
      this.actualBoundingBoxDescent = 0.0;
      this.emHeightAscent = 0.0;
      this.emHeightDescent = 0.0;
      this.hangingBaseline = 0.0;
      this.alphabeticBaseline = 0.0;
      this.ideographicBaseline = 0.0;
    };
    this.$equal = function (b) {
      return (this.width === b.width) && ((this.actualBoundingBoxLeft === b.actualBoundingBoxLeft) && ((this.actualBoundingBoxRight === b.actualBoundingBoxRight) && ((this.fontBoundingBoxAscent === b.fontBoundingBoxAscent) && ((this.fontBoundingBoxDescent === b.fontBoundingBoxDescent) && ((this.actualBoundingBoxAscent === b.actualBoundingBoxAscent) && ((this.actualBoundingBoxDescent === b.actualBoundingBoxDescent) && ((this.emHeightAscent === b.emHeightAscent) && ((this.emHeightDescent === b.emHeightDescent) && ((this.hangingBaseline === b.hangingBaseline) && ((this.alphabeticBaseline === b.alphabeticBaseline) && (this.ideographicBaseline === b.ideographicBaseline)))))))))));
    };
  };
  $mod.$rtti.$Record("TJSTextMetrics",{}).addFields("width",rtl.double,"actualBoundingBoxLeft",rtl.double,"actualBoundingBoxRight",rtl.double,"fontBoundingBoxAscent",rtl.double,"fontBoundingBoxDescent",rtl.double,"actualBoundingBoxAscent",rtl.double,"actualBoundingBoxDescent",rtl.double,"emHeightAscent",rtl.double,"emHeightDescent",rtl.double,"hangingBaseline",rtl.double,"alphabeticBaseline",rtl.double,"ideographicBaseline",rtl.double);
  $mod.$rtti.$RefToProcVar("TJSOnReadyStateChangeHandler",{procsig: rtl.newTIProcSig(null)});
  this.TJSWheelEventInit = function (s) {
    if (s) {
      this.deltaX = s.deltaX;
      this.deltaY = s.deltaY;
      this.deltaZ = s.deltaZ;
      this.deltaMode = s.deltaMode;
    } else {
      this.deltaX = 0.0;
      this.deltaY = 0.0;
      this.deltaZ = 0.0;
      this.deltaMode = 0;
    };
    this.$equal = function (b) {
      return (this.deltaX === b.deltaX) && ((this.deltaY === b.deltaY) && ((this.deltaZ === b.deltaZ) && (this.deltaMode === b.deltaMode)));
    };
  };
  $mod.$rtti.$Record("TJSWheelEventInit",{}).addFields("deltaX",rtl.double,"deltaY",rtl.double,"deltaZ",rtl.double,"deltaMode",rtl.nativeint);
  rtl.createClass($mod,"TJSKeyNames",pas.System.TObject,function () {
    this.Alt = "Alt";
    this.AltGraph = "AltGraph";
    this.CapsLock = "CapsLock";
    this.Control = "Control";
    this.Fn = "Fn";
    this.FnLock = "FnLock";
    this.Hyper = "Hyper";
    this.Meta = "Meta";
    this.NumLock = "NumLock";
    this.ScrollLock = "ScrollLock";
    this.Shift = "Shift";
    this.Super = "Super";
    this.symbol = "Symbol";
    this.SymbolLock = "SymbolLock";
    this.Enter = "Enter";
    this.Tab = "Tab";
    this.Space = " ";
    this.ArrowDown = "ArrowDown";
    this.ArrowLeft = "ArrowLeft";
    this.ArrowRight = "ArrowRight";
    this.ArrowUp = "ArrowUp";
    this._End = "End";
    this.Home = "Home";
    this.PageDown = "PageDown";
    this.PageUp = "PageUp";
    this.BackSpace = "Backspace";
    this.Clear = "Clear";
    this.Copy = "Copy";
    this.CrSel = "CrSel";
    this.Cut = "Cut";
    this.Delete = "Delete";
    this.EraseEof = "EraseEof";
    this.ExSel = "ExSel";
    this.Insert = "Insert";
    this.Paste = "Paste";
    this.Redo = "Redo";
    this.Undo = "Undo";
    this.Accept = "Accept";
    this.Again = "Again";
    this.Attn = "Attn";
    this.Cancel = "Cancel";
    this.ContextMenu = "Contextmenu";
    this.Escape = "Escape";
    this.Execute = "Execute";
    this.Find = "Find";
    this.Finish = "Finish";
    this.Help = "Help";
    this.Pause = "Pause";
    this.Play = "Play";
    this.Props = "Props";
    this.Select = "Select";
    this.ZoomIn = "ZoomIn";
    this.ZoomOut = "ZoomOut";
    this.BrightnessDown = "BrightnessDown";
    this.BrightnessUp = "BrightnessUp";
    this.Eject = "Eject";
    this.LogOff = "LogOff";
    this.Power = "Power";
    this.PowerOff = "PowerOff";
    this.PrintScreen = "PrintScreen";
    this.Hibernate = "Hibernate";
    this.Standby = "Standby";
    this.WakeUp = "WakeUp";
    this.AllCandidates = "AllCandidates";
    this.Alphanumeric = "Alphanumeric";
    this.CodeInput = "CodeInput";
    this.Compose = "Compose";
    this.Convert = "Convert";
    this.Dead = "Dead";
    this.FinalMode = "FinalMode";
    this.GroupFirst = "GroupFirst";
    this.GroupLast = "GroupLast";
    this.GroupNext = "GroupNext";
    this.GroupPrevious = "GroupPrevious";
    this.ModelChange = "ModelChange";
    this.NextCandidate = "NextCandidate";
    this.NonConvert = "NonConvert";
    this.PreviousCandidate = "PreviousCandidate";
    this.Process = "Process";
    this.SingleCandidate = "SingleCandidate";
    this.HangulMode = "HangulMode";
    this.HanjaMode = "HanjaMode";
    this.JunjaMode = "JunjaMode";
    this.Eisu = "Eisu";
    this.Hankaku = "Hankaku";
    this.Hiranga = "Hiranga";
    this.HirangaKatakana = "HirangaKatakana";
    this.KanaMode = "KanaMode";
    this.Katakana = "Katakana";
    this.Romaji = "Romaji";
    this.Zenkaku = "Zenkaku";
    this.ZenkakuHanaku = "ZenkakuHanaku";
    this.F1 = "F1";
    this.F2 = "F2";
    this.F3 = "F3";
    this.F4 = "F4";
    this.F5 = "F5";
    this.F6 = "F6";
    this.F7 = "F7";
    this.F8 = "F8";
    this.F9 = "F9";
    this.F10 = "F10";
    this.F11 = "F11";
    this.F12 = "F12";
    this.F13 = "F13";
    this.F14 = "F14";
    this.F15 = "F15";
    this.F16 = "F16";
    this.F17 = "F17";
    this.F18 = "F18";
    this.F19 = "F19";
    this.F20 = "F20";
    this.Soft1 = "Soft1";
    this.Soft2 = "Soft2";
    this.Soft3 = "Soft3";
    this.Soft4 = "Soft4";
    this.Decimal = "Decimal";
    this.Key11 = "Key11";
    this.Key12 = "Key12";
    this.Multiply = "Multiply";
    this.Add = "Add";
    this.NumClear = "Clear";
    this.Divide = "Divide";
    this.Subtract = "Subtract";
    this.Separator = "Separator";
    this.AppSwitch = "AppSwitch";
    this.Call = "Call";
    this.Camera = "Camera";
    this.CameraFocus = "CameraFocus";
    this.EndCall = "EndCall";
    this.GoBack = "GoBack";
    this.GoHome = "GoHome";
    this.HeadsetHook = "HeadsetHook";
    this.LastNumberRedial = "LastNumberRedial";
    this.Notification = "Notification";
    this.MannerMode = "MannerMode";
    this.VoiceDial = "VoiceDial";
  });
  this.TJSMutationRecord = function (s) {
    if (s) {
      this.type_ = s.type_;
      this.target = s.target;
      this.addedNodes = s.addedNodes;
      this.removedNodes = s.removedNodes;
      this.previousSibling = s.previousSibling;
      this.nextSibling = s.nextSibling;
      this.attributeName = s.attributeName;
      this.attributeNamespace = s.attributeNamespace;
      this.oldValue = s.oldValue;
    } else {
      this.type_ = "";
      this.target = null;
      this.addedNodes = null;
      this.removedNodes = null;
      this.previousSibling = null;
      this.nextSibling = null;
      this.attributeName = "";
      this.attributeNamespace = "";
      this.oldValue = "";
    };
    this.$equal = function (b) {
      return (this.type_ === b.type_) && ((this.target === b.target) && ((this.addedNodes === b.addedNodes) && ((this.removedNodes === b.removedNodes) && ((this.previousSibling === b.previousSibling) && ((this.nextSibling === b.nextSibling) && ((this.attributeName === b.attributeName) && ((this.attributeNamespace === b.attributeNamespace) && (this.oldValue === b.oldValue))))))));
    };
  };
  $mod.$rtti.$Record("TJSMutationRecord",{}).addFields("type_",rtl.string,"target",$mod.$rtti["TJSNode"],"addedNodes",$mod.$rtti["TJSNodeList"],"removedNodes",$mod.$rtti["TJSNodeList"],"previousSibling",$mod.$rtti["TJSNode"],"nextSibling",$mod.$rtti["TJSNode"],"attributeName",rtl.string,"attributeNamespace",rtl.string,"oldValue",rtl.string);
  $mod.$rtti.$DynArray("TJSMutationRecordArray",{eltype: $mod.$rtti["TJSMutationRecord"]});
  $mod.$rtti.$RefToProcVar("TJSMutationCallback",{procsig: rtl.newTIProcSig([["mutations",$mod.$rtti["TJSMutationRecordArray"]],["observer",$mod.$rtti["TJSMutationObserver"]]])});
  this.TJSMutationObserverInit = function (s) {
    if (s) {
      this.attributes = s.attributes;
      this.attributeOldValue = s.attributeOldValue;
      this.characterData = s.characterData;
      this.characterDataOldValue = s.characterDataOldValue;
      this.childList = s.childList;
      this.subTree = s.subTree;
      this.attributeFilter = s.attributeFilter;
    } else {
      this.attributes = false;
      this.attributeOldValue = false;
      this.characterData = false;
      this.characterDataOldValue = false;
      this.childList = false;
      this.subTree = false;
      this.attributeFilter = null;
    };
    this.$equal = function (b) {
      return (this.attributes === b.attributes) && ((this.attributeOldValue === b.attributeOldValue) && ((this.characterData === b.characterData) && ((this.characterDataOldValue === b.characterDataOldValue) && ((this.childList === b.childList) && ((this.subTree === b.subTree) && (this.attributeFilter === b.attributeFilter))))));
    };
  };
  $mod.$rtti.$Record("TJSMutationObserverInit",{}).addFields("attributes",rtl.boolean,"attributeOldValue",rtl.boolean,"characterData",rtl.boolean,"characterDataOldValue",rtl.boolean,"childList",rtl.boolean,"subTree",rtl.boolean,"attributeFilter",pas.JS.$rtti["TJSArray"]);
});
rtl.module("RTLConsts",["System"],function () {
  "use strict";
  var $mod = this;
  this.SArgumentMissing = 'Missing argument in format "%s"';
  this.SInvalidFormat = 'Invalid format specifier : "%s"';
  this.SInvalidArgIndex = 'Invalid argument index in format: "%s"';
  this.SListCapacityError = "List capacity (%s) exceeded.";
  this.SListCountError = "List count (%s) out of bounds.";
  this.SListIndexError = "List index (%s) out of bounds";
  this.SSortedListError = "Operation not allowed on sorted list";
  this.SDuplicateString = "String list does not allow duplicates";
  this.SErrFindNeedsSortedList = "Cannot use find on unsorted list";
  this.SInvalidName = 'Invalid component name: "%s"';
  this.SInvalidBoolean = '"%s" is not a valid boolean.';
  this.SDuplicateName = 'Duplicate component name: "%s"';
  this.SErrInvalidDate = 'Invalid date: "%s"';
  this.SErrInvalidTimeFormat = 'Invalid time format: "%s"';
  this.SInvalidDateFormat = 'Invalid date format: "%s"';
  this.SCantReadPropertyS = 'Cannot read property "%s"';
  this.SCantWritePropertyS = 'Cannot write property "%s"';
  this.SErrPropertyNotFound = 'Unknown property: "%s"';
  this.SIndexedPropertyNeedsParams = 'Indexed property "%s" needs parameters';
  this.SErrInvalidInteger = 'Invalid integer value: "%s"';
  this.SErrInvalidFloat = 'Invalid floating-point value: "%s"';
  this.SInvalidDateTime = "Invalid date-time value: %s";
  this.SInvalidCurrency = "Invalid currency value: %s";
  this.SErrInvalidDayOfWeek = "%d is not a valid day of the week";
  this.SErrInvalidTimeStamp = 'Invalid date\/timestamp : "%s"';
  this.SErrInvalidDateWeek = "%d %d %d is not a valid dateweek";
  this.SErrInvalidDayOfYear = "Year %d does not have a day number %d";
  this.SErrInvalidDateMonthWeek = "Year %d, month %d, Week %d and day %d is not a valid date.";
  this.SErrInvalidDayOfWeekInMonth = "Year %d Month %d NDow %d DOW %d is not a valid date";
  this.SInvalidJulianDate = "%f Julian cannot be represented as a DateTime";
  this.SErrInvalidHourMinuteSecMsec = "%d:%d:%d.%d is not a valid time specification";
  this.SInvalidGUID = '"%s" is not a valid GUID value';
});
rtl.module("SysUtils",["System","RTLConsts","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.FreeAndNil = function (Obj) {
    var o = null;
    o = Obj.get();
    if (o === null) return;
    Obj.set(null);
    o.$destroy("Destroy");
  };
  $mod.$rtti.$ProcVar("TProcedure",{procsig: rtl.newTIProcSig(null)});
  this.TFloatRec = function (s) {
    if (s) {
      this.Exponent = s.Exponent;
      this.Negative = s.Negative;
      this.Digits = s.Digits;
    } else {
      this.Exponent = 0;
      this.Negative = false;
      this.Digits = [];
    };
    this.$equal = function (b) {
      return (this.Exponent === b.Exponent) && ((this.Negative === b.Negative) && (this.Digits === b.Digits));
    };
  };
  $mod.$rtti.$DynArray("TFloatRec.Digits$a",{eltype: rtl.char});
  $mod.$rtti.$Record("TFloatRec",{}).addFields("Exponent",rtl.longint,"Negative",rtl.boolean,"Digits",$mod.$rtti["TFloatRec.Digits$a"]);
  this.TEndian = {"0": "Little", Little: 0, "1": "Big", Big: 1};
  $mod.$rtti.$Enum("TEndian",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TEndian});
  $mod.$rtti.$StaticArray("TByteArray",{dims: [32768], eltype: rtl.byte});
  $mod.$rtti.$StaticArray("TWordArray",{dims: [16384], eltype: rtl.word});
  $mod.$rtti.$DynArray("TBytes",{eltype: rtl.byte});
  $mod.$rtti.$DynArray("TStringArray",{eltype: rtl.string});
  $mod.$rtti.$StaticArray("TMonthNameArray",{dims: [12], eltype: rtl.string});
  $mod.$rtti.$StaticArray("TDayTable",{dims: [12], eltype: rtl.word});
  $mod.$rtti.$StaticArray("TWeekNameArray",{dims: [7], eltype: rtl.string});
  $mod.$rtti.$StaticArray("TDayNames",{dims: [7], eltype: rtl.string});
  rtl.createClass($mod,"Exception",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fMessage = "";
      this.fHelpContext = 0;
    };
    this.Create$1 = function (Msg) {
      this.fMessage = Msg;
    };
    this.CreateFmt = function (Msg, Args) {
      this.fMessage = $mod.Format(Msg,Args);
    };
    this.CreateHelp = function (Msg, AHelpContext) {
      this.fMessage = Msg;
      this.fHelpContext = AHelpContext;
    };
    this.CreateFmtHelp = function (Msg, Args, AHelpContext) {
      this.fMessage = $mod.Format(Msg,Args);
      this.fHelpContext = AHelpContext;
    };
    this.ToString = function () {
      var Result = "";
      Result = (this.$classname + ": ") + this.fMessage;
      return Result;
    };
  });
  $mod.$rtti.$ClassRef("ExceptClass",{instancetype: $mod.$rtti["Exception"]});
  rtl.createClass($mod,"EExternal",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EMathError",$mod.EExternal,function () {
  });
  rtl.createClass($mod,"EInvalidOp",$mod.EMathError,function () {
  });
  rtl.createClass($mod,"EZeroDivide",$mod.EMathError,function () {
  });
  rtl.createClass($mod,"EOverflow",$mod.EMathError,function () {
  });
  rtl.createClass($mod,"EUnderflow",$mod.EMathError,function () {
  });
  rtl.createClass($mod,"EAbort",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EInvalidCast",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EAssertionFailed",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EObjectCheck",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EConvertError",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EFormatError",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EIntError",$mod.EExternal,function () {
  });
  rtl.createClass($mod,"EDivByZero",$mod.EIntError,function () {
  });
  rtl.createClass($mod,"ERangeError",$mod.EIntError,function () {
  });
  rtl.createClass($mod,"EIntOverflow",$mod.EIntError,function () {
  });
  rtl.createClass($mod,"EInOutError",$mod.Exception,function () {
    this.$init = function () {
      $mod.Exception.$init.call(this);
      this.ErrorCode = 0;
    };
  });
  rtl.createClass($mod,"EHeapMemoryError",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EExternalException",$mod.EExternal,function () {
  });
  rtl.createClass($mod,"EInvalidPointer",$mod.EHeapMemoryError,function () {
  });
  rtl.createClass($mod,"EOutOfMemory",$mod.EHeapMemoryError,function () {
  });
  rtl.createClass($mod,"EVariantError",$mod.Exception,function () {
    this.$init = function () {
      $mod.Exception.$init.call(this);
      this.ErrCode = 0;
    };
    this.CreateCode = function (Code) {
      this.ErrCode = Code;
    };
  });
  rtl.createClass($mod,"EAccessViolation",$mod.EExternal,function () {
  });
  rtl.createClass($mod,"EBusError",$mod.EAccessViolation,function () {
  });
  rtl.createClass($mod,"EPrivilege",$mod.EExternal,function () {
  });
  rtl.createClass($mod,"EStackOverflow",$mod.EExternal,function () {
  });
  rtl.createClass($mod,"EControlC",$mod.EExternal,function () {
  });
  rtl.createClass($mod,"EAbstractError",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EPropReadOnly",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EPropWriteOnly",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EIntfCastError",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EInvalidContainer",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EInvalidInsert",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EPackageError",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EOSError",$mod.Exception,function () {
    this.$init = function () {
      $mod.Exception.$init.call(this);
      this.ErrorCode = 0;
    };
  });
  rtl.createClass($mod,"ESafecallException",$mod.Exception,function () {
  });
  rtl.createClass($mod,"ENoThreadSupport",$mod.Exception,function () {
  });
  rtl.createClass($mod,"ENoWideStringSupport",$mod.Exception,function () {
  });
  rtl.createClass($mod,"ENotImplemented",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EArgumentException",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EArgumentOutOfRangeException",$mod.EArgumentException,function () {
  });
  rtl.createClass($mod,"EArgumentNilException",$mod.EArgumentException,function () {
  });
  rtl.createClass($mod,"EPathTooLongException",$mod.Exception,function () {
  });
  rtl.createClass($mod,"ENotSupportedException",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EDirectoryNotFoundException",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EFileNotFoundException",$mod.Exception,function () {
  });
  rtl.createClass($mod,"EPathNotFoundException",$mod.Exception,function () {
  });
  rtl.createClass($mod,"ENoConstructException",$mod.Exception,function () {
  });
  this.EmptyStr = "";
  this.EmptyWideStr = "";
  this.HexDisplayPrefix = "$";
  this.LeadBytes = {};
  this.CharInSet = function (Ch, CSet) {
    var Result = false;
    var I = 0;
    Result = false;
    I = rtl.length(CSet) - 1;
    while (!Result && (I >= 0)) {
      Result = Ch === CSet[I];
      I -= 1;
    };
    return Result;
  };
  this.LeftStr = function (S, Count) {
    return (Count>0) ? S.substr(0,Count) : "";
  };
  this.RightStr = function (S, Count) {
    var l = S.length;
    return (Count<1) ? "" : ( Count>=l ? S : S.substr(l-Count));
  };
  this.Trim = function (S) {
    return S.trim();
  };
  this.TrimLeft = function (S) {
    return S.replace(/^[\s\uFEFF\xA0\x00-\x1f]+/,'');
  };
  this.TrimRight = function (S) {
    return S.replace(/[\s\uFEFF\xA0\x00-\x1f]+$/,'');
  };
  this.UpperCase = function (s) {
    return s.toUpperCase();
  };
  this.LowerCase = function (s) {
    return s.toLowerCase();
  };
  this.CompareStr = function (s1, s2) {
    var l1 = s1.length;
    var l2 = s2.length;
    if (l1<=l2){
      var s = s2.substr(0,l1);
      if (s1<s){ return -1;
      } else if (s1>s){ return 1;
      } else { return l1<l2 ? -1 : 0; };
    } else {
      var s = s1.substr(0,l2);
      if (s<s2){ return -1;
      } else { return 1; };
    };
  };
  this.SameStr = function (s1, s2) {
    return s1 == s2;
  };
  this.CompareText = function (s1, s2) {
    var l1 = s1.toLowerCase();
    var l2 = s2.toLowerCase();
    if (l1>l2){ return 1;
    } else if (l1<l2){ return -1;
    } else { return 0; };
  };
  this.SameText = function (s1, s2) {
    return s1.toLowerCase() == s2.toLowerCase();
  };
  this.AnsiCompareText = function (s1, s2) {
    return s1.localeCompare(s2);
  };
  this.AnsiSameText = function (s1, s2) {
    return s1.localeCompare(s2) == 0;
  };
  this.AnsiCompareStr = function (s1, s2) {
    var Result = 0;
    Result = $mod.CompareText(s1,s2);
    return Result;
  };
  this.AppendStr = function (Dest, S) {
    Dest.set(Dest.get() + S);
  };
  this.Format = function (Fmt, Args) {
    var Result = "";
    var ChPos = 0;
    var OldPos = 0;
    var ArgPos = 0;
    var DoArg = 0;
    var Len = 0;
    var Hs = "";
    var ToAdd = "";
    var Index = 0;
    var Width = 0;
    var Prec = 0;
    var Left = false;
    var Fchar = "";
    var vq = 0;
    function ReadFormat() {
      var Result = "";
      var Value = 0;
      function ReadInteger() {
        var Code = 0;
        var ArgN = 0;
        if (Value !== -1) return;
        OldPos = ChPos;
        while (((ChPos <= Len) && (Fmt.charAt(ChPos - 1) <= "9")) && (Fmt.charAt(ChPos - 1) >= "0")) ChPos += 1;
        if (ChPos > Len) $impl.DoFormatError(1,Fmt);
        if (Fmt.charAt(ChPos - 1) === "*") {
          if (Index === -1) {
            ArgN = ArgPos}
           else {
            ArgN = Index;
            Index += 1;
          };
          if ((ChPos > OldPos) || (ArgN > (rtl.length(Args) - 1))) $impl.DoFormatError(1,Fmt);
          ArgPos = ArgN + 1;
          if (rtl.isNumber(Args[ArgN]) && pas.JS.isInteger(Args[ArgN])) {
            Value = Math.floor(Args[ArgN])}
           else $impl.DoFormatError(1,Fmt);
          ChPos += 1;
        } else {
          if (OldPos < ChPos) {
            pas.System.val(pas.System.Copy(Fmt,OldPos,ChPos - OldPos),{get: function () {
                return Value;
              }, set: function (v) {
                Value = v;
              }},{get: function () {
                return Code;
              }, set: function (v) {
                Code = v;
              }});
            if (Code > 0) $impl.DoFormatError(1,Fmt);
          } else Value = -1;
        };
      };
      function ReadIndex() {
        if (Fmt.charAt(ChPos - 1) !== ":") {
          ReadInteger()}
         else Value = 0;
        if (Fmt.charAt(ChPos - 1) === ":") {
          if (Value === -1) $impl.DoFormatError(2,Fmt);
          Index = Value;
          Value = -1;
          ChPos += 1;
        };
      };
      function ReadLeft() {
        if (Fmt.charAt(ChPos - 1) === "-") {
          Left = true;
          ChPos += 1;
        } else Left = false;
      };
      function ReadWidth() {
        ReadInteger();
        if (Value !== -1) {
          Width = Value;
          Value = -1;
        };
      };
      function ReadPrec() {
        if (Fmt.charAt(ChPos - 1) === ".") {
          ChPos += 1;
          ReadInteger();
          if (Value === -1) Value = 0;
          Prec = Value;
        };
      };
      Index = -1;
      Width = -1;
      Prec = -1;
      Value = -1;
      ChPos += 1;
      if (Fmt.charAt(ChPos - 1) === "%") {
        Result = "%";
        return Result;
      };
      ReadIndex();
      ReadLeft();
      ReadWidth();
      ReadPrec();
      Result = pas.System.upcase(Fmt.charAt(ChPos - 1));
      return Result;
    };
    function Checkarg(AT, err) {
      var Result = false;
      Result = false;
      if (Index === -1) {
        DoArg = ArgPos}
       else DoArg = Index;
      ArgPos = DoArg + 1;
      if ((DoArg > (rtl.length(Args) - 1)) || (pas.JS.GetValueType(Args[DoArg]) !== AT)) {
        if (err) $impl.DoFormatError(3,Fmt);
        ArgPos -= 1;
        return Result;
      };
      Result = true;
      return Result;
    };
    Result = "";
    Len = Fmt.length;
    ChPos = 1;
    OldPos = 1;
    ArgPos = 0;
    while (ChPos <= Len) {
      while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) !== "%")) ChPos += 1;
      if (ChPos > OldPos) Result = Result + pas.System.Copy(Fmt,OldPos,ChPos - OldPos);
      if (ChPos < Len) {
        Fchar = ReadFormat();
        var $tmp1 = Fchar;
        if ($tmp1 === "D") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          ToAdd = $mod.IntToStr(Math.floor(Args[DoArg]));
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          if (ToAdd.charAt(0) !== "-") {
            ToAdd = pas.System.StringOfChar("0",Index) + ToAdd}
           else pas.System.Insert(pas.System.StringOfChar("0",Index + 1),{get: function () {
              return ToAdd;
            }, set: function (v) {
              ToAdd = v;
            }},2);
        } else if ($tmp1 === "U") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          if (Math.floor(Args[DoArg]) < 0) $impl.DoFormatError(3,Fmt);
          ToAdd = $mod.IntToStr(Math.floor(Args[DoArg]));
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          ToAdd = pas.System.StringOfChar("0",Index) + ToAdd;
        } else if ($tmp1 === "E") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffFixed,9999,Prec);
        } else if ($tmp1 === "F") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffFixed,9999,Prec);
        } else if ($tmp1 === "G") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffGeneral,Prec,3);
        } else if ($tmp1 === "N") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffNumber,9999,Prec);
        } else if ($tmp1 === "M") {
          if (Checkarg(pas.JS.TJSValueType.jvtFloat,false) || Checkarg(pas.JS.TJSValueType.jvtInteger,true)) ToAdd = $mod.FloatToStrF(rtl.getNumber(Args[DoArg]),$mod.TFloatFormat.ffCurrency,9999,Prec);
        } else if ($tmp1 === "S") {
          Checkarg(pas.JS.TJSValueType.jvtString,true);
          Hs = "" + Args[DoArg];
          Index = Hs.length;
          if ((Prec !== -1) && (Index > Prec)) Index = Prec;
          ToAdd = pas.System.Copy(Hs,1,Index);
        } else if ($tmp1 === "P") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          ToAdd = $mod.IntToHex(Math.floor(Args[DoArg]),31);
        } else if ($tmp1 === "X") {
          Checkarg(pas.JS.TJSValueType.jvtInteger,true);
          vq = Math.floor(Args[DoArg]);
          Index = 31;
          if (Prec > Index) {
            ToAdd = $mod.IntToHex(vq,Index)}
           else {
            Index = 1;
            while (((1 << (Index * 4)) <= vq) && (Index < 16)) Index += 1;
            if (Index > Prec) Prec = Index;
            ToAdd = $mod.IntToHex(vq,Prec);
          };
        } else if ($tmp1 === "%") ToAdd = "%";
        if (Width !== -1) if (ToAdd.length < Width) if (!Left) {
          ToAdd = pas.System.StringOfChar(" ",Width - ToAdd.length) + ToAdd}
         else ToAdd = ToAdd + pas.System.StringOfChar(" ",Width - ToAdd.length);
        Result = Result + ToAdd;
      };
      ChPos += 1;
      OldPos = ChPos;
    };
    return Result;
  };
  this.LocaleCompare = function (s1, s2, locales) {
    return s1.localeCompare(s2,locales) == 0;
  };
  this.NormalizeStr = function (S, Norm) {
    return S.normalize(Norm);
  };
  var Alpha = rtl.createSet(null,65,90,null,97,122,95);
  var AlphaNum = rtl.unionSet(Alpha,rtl.createSet(null,48,57));
  var Dot = ".";
  this.IsValidIdent = function (Ident, AllowDots, StrictDots) {
    var Result = false;
    var First = false;
    var I = 0;
    var Len = 0;
    Len = Ident.length;
    if (Len < 1) return false;
    First = true;
    Result = false;
    I = 1;
    while (I <= Len) {
      if (First) {
        if (!(Ident.charCodeAt(I - 1) in Alpha)) return Result;
        First = false;
      } else if (AllowDots && (Ident.charAt(I - 1) === Dot)) {
        if (StrictDots) {
          if (I >= Len) return Result;
          First = true;
        };
      } else if (!(Ident.charCodeAt(I - 1) in AlphaNum)) return Result;
      I = I + 1;
    };
    Result = true;
    return Result;
  };
  this.TStringReplaceFlag = {"0": "rfReplaceAll", rfReplaceAll: 0, "1": "rfIgnoreCase", rfIgnoreCase: 1};
  $mod.$rtti.$Enum("TStringReplaceFlag",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TStringReplaceFlag});
  $mod.$rtti.$Set("TStringReplaceFlags",{comptype: $mod.$rtti["TStringReplaceFlag"]});
  this.StringReplace = function (aOriginal, aSearch, aReplace, Flags) {
    var Result = "";
    var REFlags = "";
    var REString = "";
    REFlags = "";
    if ($mod.TStringReplaceFlag.rfReplaceAll in Flags) REFlags = "g";
    if ($mod.TStringReplaceFlag.rfIgnoreCase in Flags) REFlags = REFlags + "i";
    REString = aSearch.replace(new RegExp($impl.RESpecials,"g"),"\\$1");
    Result = aOriginal.replace(new RegExp(REString,REFlags),aReplace);
    return Result;
  };
  this.QuoteString = function (aOriginal, AQuote) {
    var Result = "";
    var REString = "";
    REString = AQuote.replace(new RegExp(aOriginal,"g"),"\\\\$1");
    Result = (AQuote + aOriginal.replace(new RegExp(REString,"g"),"$1\\$1")) + AQuote;
    return Result;
  };
  this.IsDelimiter = function (Delimiters, S, Index) {
    var Result = false;
    Result = false;
    if ((Index > 0) && (Index <= S.length)) Result = pas.System.Pos(S.charAt(Index - 1),Delimiters) !== 0;
    return Result;
  };
  this.AdjustLineBreaks = function (S) {
    var Result = "";
    Result = $mod.AdjustLineBreaks$1(S,pas.System.DefaultTextLineBreakStyle);
    return Result;
  };
  this.AdjustLineBreaks$1 = function (S, Style) {
    var Result = "";
    var I = 0;
    var L = 0;
    var Res = "";
    function Add(C) {
      Res = Res + C;
    };
    I = 0;
    L = S.length;
    Result = "";
    while (I <= L) {
      var $tmp1 = S.charAt(I - 1);
      if ($tmp1 === "\n") {
        if (Style in rtl.createSet(pas.System.TTextLineBreakStyle.tlbsCRLF,pas.System.TTextLineBreakStyle.tlbsCR)) Add("\r");
        if (Style === pas.System.TTextLineBreakStyle.tlbsCRLF) Add("\n");
        I += 1;
      } else if ($tmp1 === "\r") {
        if (Style === pas.System.TTextLineBreakStyle.tlbsCRLF) Add("\r");
        Add("\n");
        I += 1;
        if (S.charAt(I - 1) === "\n") I += 1;
      } else {
        Add(S.charAt(I - 1));
        I += 1;
      };
    };
    Result = Res;
    return Result;
  };
  var Quotes = rtl.createSet(39,34);
  this.WrapText = function (Line, BreakStr, BreakChars, MaxCol) {
    var Result = "";
    var L = "";
    var C = "";
    var LQ = "";
    var BC = "";
    var P = 0;
    var BLen = 0;
    var Len = 0;
    var HB = false;
    var IBC = false;
    Result = "";
    L = Line;
    BLen = BreakStr.length;
    if (BLen > 0) {
      BC = BreakStr.charAt(0)}
     else BC = "\x00";
    Len = L.length;
    while (Len > 0) {
      P = 1;
      LQ = "\x00";
      HB = false;
      IBC = false;
      while (((P <= Len) && ((P <= MaxCol) || !IBC)) && ((LQ !== "\x00") || !HB)) {
        C = L.charAt(P - 1);
        if (C === LQ) {
          LQ = "\x00"}
         else if (C.charCodeAt() in Quotes) LQ = C;
        if (LQ !== "\x00") {
          P += 1}
         else {
          HB = (C === BC) && (BreakStr === pas.System.Copy(L,P,BLen));
          if (HB) {
            P += BLen}
           else {
            if (P >= MaxCol) IBC = $mod.CharInSet(C,BreakChars);
            P += 1;
          };
        };
      };
      Result = Result + pas.System.Copy(L,1,P - 1);
      pas.System.Delete({get: function () {
          return L;
        }, set: function (v) {
          L = v;
        }},1,P - 1);
      Len = L.length;
      if ((Len > 0) && !HB) Result = Result + BreakStr;
    };
    return Result;
  };
  this.WrapText$1 = function (Line, MaxCol) {
    var Result = "";
    Result = $mod.WrapText(Line,pas.System.sLineBreak,[" ","-","\t"],MaxCol);
    return Result;
  };
  this.IntToStr = function (Value) {
    var Result = "";
    Result = "" + Value;
    return Result;
  };
  this.TryStrToInt = function (S, res) {
    var Result = false;
    var NI = 0;
    Result = $mod.TryStrToInt$1(S,{get: function () {
        return NI;
      }, set: function (v) {
        NI = v;
      }});
    if (Result) res.set(NI);
    return Result;
  };
  this.TryStrToInt$1 = function (S, res) {
    var Result = false;
    var Radix = 10;
    var F = "";
    var N = "";
    var J = undefined;
    N = S;
    F = pas.System.Copy(N,1,1);
    if (F === "$") {
      Radix = 16}
     else if (F === "&") {
      Radix = 8}
     else if (F === "%") Radix = 2;
    if (Radix !== 10) pas.System.Delete({get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},1,1);
    J = parseInt(N,Radix);
    Result = !isNaN(J);
    if (Result) res.set(Math.floor(J));
    return Result;
  };
  this.StrToIntDef = function (S, aDef) {
    var Result = 0;
    var R = 0;
    if ($mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) {
      Result = R}
     else Result = aDef;
    return Result;
  };
  this.StrToIntDef$1 = function (S, aDef) {
    var Result = 0;
    var R = 0;
    if ($mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) {
      Result = R}
     else Result = aDef;
    return Result;
  };
  this.StrToInt = function (S) {
    var Result = 0;
    var R = 0;
    if (!$mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidInteger,[S]]);
    Result = R;
    return Result;
  };
  this.StrToNativeInt = function (S) {
    var Result = 0;
    if (!$mod.TryStrToInt$1(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidInteger,[S]]);
    return Result;
  };
  this.StrToInt64 = function (S) {
    var Result = 0;
    var N = 0;
    if (!$mod.TryStrToInt$1(S,{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidInteger,[S]]);
    Result = N;
    return Result;
  };
  this.StrToInt64Def = function (S, ADefault) {
    var Result = 0;
    if ($mod.TryStrToInt64(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = ADefault;
    return Result;
  };
  this.TryStrToInt64 = function (S, res) {
    var Result = false;
    var R = 0;
    Result = $mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }});
    if (Result) res.set(R);
    return Result;
  };
  this.StrToQWord = function (S) {
    var Result = 0;
    var N = 0;
    if (!$mod.TryStrToInt$1(S,{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }}) || (N < 0)) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidInteger,[S]]);
    Result = N;
    return Result;
  };
  this.StrToQWordDef = function (S, ADefault) {
    var Result = 0;
    if (!$mod.TryStrToQWord(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = ADefault;
    return Result;
  };
  this.TryStrToQWord = function (S, res) {
    var Result = false;
    var R = 0;
    Result = $mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }}) && (R >= 0);
    if (Result) res.set(R);
    return Result;
  };
  this.StrToUInt64 = function (S) {
    var Result = 0;
    var N = 0;
    if (!$mod.TryStrToInt$1(S,{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }}) || (N < 0)) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidInteger,[S]]);
    Result = N;
    return Result;
  };
  this.StrToUInt64Def = function (S, ADefault) {
    var Result = 0;
    if (!$mod.TryStrToUInt64(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = ADefault;
    return Result;
  };
  this.TryStrToUInt64 = function (S, res) {
    var Result = false;
    var R = 0;
    Result = $mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }}) && (R >= 0);
    if (Result) res.set(R);
    return Result;
  };
  this.StrToDWord = function (S) {
    var Result = 0;
    if (!$mod.TryStrToDWord(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidInteger,[S]]);
    return Result;
  };
  this.StrToDWordDef = function (S, ADefault) {
    var Result = 0;
    if (!$mod.TryStrToDWord(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = ADefault;
    return Result;
  };
  this.TryStrToDWord = function (S, res) {
    var Result = false;
    var R = 0;
    Result = ($mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }}) && (R >= 0)) && (R <= 0xFFFFFFFF);
    if (Result) res.set(R);
    return Result;
  };
  var HexDigits = "0123456789ABCDEF";
  this.IntToHex = function (Value, Digits) {
    var Result = "";
    if (Digits === 0) Digits = 1;
    Result = "";
    while (Value > 0) {
      Result = HexDigits.charAt(((Value & 15) + 1) - 1) + Result;
      Value = Value >>> 4;
    };
    while (Result.length < Digits) Result = "0" + Result;
    return Result;
  };
  this.MaxCurrency = 450359962737.0495;
  this.MinCurrency = -450359962737.0496;
  this.TFloatFormat = {"0": "ffFixed", ffFixed: 0, "1": "ffGeneral", ffGeneral: 1, "2": "ffExponent", ffExponent: 2, "3": "ffNumber", ffNumber: 3, "4": "ffCurrency", ffCurrency: 4};
  $mod.$rtti.$Enum("TFloatFormat",{minvalue: 0, maxvalue: 4, ordtype: 1, enumtype: this.TFloatFormat});
  var Rounds = "234567890";
  this.FloatToDecimal = function (Value, Precision, Decimals) {
    var Result = new $mod.TFloatRec();
    var Buffer = "";
    var InfNan = "";
    var error = 0;
    var N = 0;
    var L = 0;
    var Start = 0;
    var C = 0;
    var GotNonZeroBeforeDot = false;
    var BeforeDot = false;
    if (Value === 0) ;
    Result.Digits = rtl.arraySetLength(Result.Digits,"",19);
    Buffer=Value.toPrecision(21); // Double precision;
    N = 1;
    L = Buffer.length;
    while (Buffer.charAt(N - 1) === " ") N += 1;
    Result.Negative = Buffer.charAt(N - 1) === "-";
    if (Result.Negative) {
      N += 1}
     else if (Buffer.charAt(N - 1) === "+") N += 1;
    if (L >= (N + 2)) {
      InfNan = pas.System.Copy(Buffer,N,3);
      if (InfNan === "Inf") {
        Result.Digits[0] = "\x00";
        Result.Exponent = 32767;
        return Result;
      };
      if (InfNan === "Nan") {
        Result.Digits[0] = "\x00";
        Result.Exponent = -32768;
        return Result;
      };
    };
    Start = N;
    Result.Exponent = 0;
    BeforeDot = true;
    GotNonZeroBeforeDot = false;
    while ((L >= N) && (Buffer.charAt(N - 1) !== "E")) {
      if (Buffer.charAt(N - 1) === ".") {
        BeforeDot = false}
       else {
        if (BeforeDot) {
          Result.Exponent += 1;
          Result.Digits[N - Start] = Buffer.charAt(N - 1);
          if (Buffer.charAt(N - 1) !== "0") GotNonZeroBeforeDot = true;
        } else Result.Digits[(N - Start) - 1] = Buffer.charAt(N - 1);
      };
      N += 1;
    };
    N += 1;
    if (N <= L) {
      pas.System.val$5(pas.System.Copy(Buffer,N,(L - N) + 1),{get: function () {
          return C;
        }, set: function (v) {
          C = v;
        }},{get: function () {
          return error;
        }, set: function (v) {
          error = v;
        }});
      Result.Exponent += C;
    };
    if (BeforeDot) {
      N = (N - Start) - 1}
     else N = (N - Start) - 2;
    L = rtl.length(Result.Digits);
    if (N < L) Result.Digits[N] = "0";
    if ((Decimals + Result.Exponent) < Precision) {
      N = Decimals + Result.Exponent}
     else N = Precision;
    if (N >= L) N = L - 1;
    if (N === 0) {
      if (Result.Digits[0] >= "5") {
        Result.Digits[0] = "1";
        Result.Digits[1] = "\x00";
        Result.Exponent += 1;
      } else Result.Digits[0] = "\x00";
    } else if (N > 0) {
      if (Result.Digits[N] >= "5") {
        do {
          Result.Digits[N] = "\x00";
          N -= 1;
          Result.Digits[N] = Rounds.charAt($mod.StrToInt(Result.Digits[N]) - 1);
        } while (!((N === 0) || (Result.Digits[N] < ":")));
        if (Result.Digits[0] === ":") {
          Result.Digits[0] = "1";
          Result.Exponent += 1;
        };
      } else {
        Result.Digits[N] = "0";
        while ((N > -1) && (Result.Digits[N] === "0")) {
          Result.Digits[N] = "\x00";
          N -= 1;
        };
      };
    } else Result.Digits[0] = "\x00";
    if ((Result.Digits[0] === "\x00") && !GotNonZeroBeforeDot) {
      Result.Exponent = 0;
      Result.Negative = false;
    };
    return Result;
  };
  this.FloatToStr = function (Value) {
    var Result = "";
    Result = $mod.FloatToStrF(Value,$mod.TFloatFormat.ffGeneral,15,0);
    return Result;
  };
  this.FloatToStrF = function (Value, format, Precision, Digits) {
    var Result = "";
    var DS = "";
    DS = $mod.DecimalSeparator;
    var $tmp1 = format;
    if ($tmp1 === $mod.TFloatFormat.ffGeneral) {
      Result = $impl.FormatGeneralFloat(Value,Precision,DS)}
     else if ($tmp1 === $mod.TFloatFormat.ffExponent) {
      Result = $impl.FormatExponentFloat(Value,Precision,Digits,DS)}
     else if ($tmp1 === $mod.TFloatFormat.ffFixed) {
      Result = $impl.FormatFixedFloat(Value,Digits,DS)}
     else if ($tmp1 === $mod.TFloatFormat.ffNumber) {
      Result = $impl.FormatNumberFloat(Value,Digits,DS,$mod.ThousandSeparator)}
     else if ($tmp1 === $mod.TFloatFormat.ffCurrency) Result = $impl.FormatNumberCurrency(Value * 10000,Digits,DS,$mod.ThousandSeparator);
    if (((format !== $mod.TFloatFormat.ffCurrency) && (Result.length > 1)) && (Result.charAt(0) === "-")) $impl.RemoveLeadingNegativeSign({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},DS);
    return Result;
  };
  this.TryStrToFloat = function (S, res) {
    var Result = false;
    var J = undefined;
    var N = "";
    N = S;
    if ($mod.ThousandSeparator !== "") N = $mod.StringReplace(N,$mod.ThousandSeparator,"",rtl.createSet($mod.TStringReplaceFlag.rfReplaceAll));
    if ($mod.DecimalSeparator !== ".") N = $mod.StringReplace(N,$mod.DecimalSeparator,".",{});
    J = parseFloat(N);
    Result = !isNaN(J);
    if (Result) res.set(rtl.getNumber(J));
    return Result;
  };
  this.StrToFloatDef = function (S, aDef) {
    var Result = 0.0;
    if (!$mod.TryStrToFloat(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = aDef;
    return Result;
  };
  this.StrToFloat = function (S) {
    var Result = 0.0;
    if (!$mod.TryStrToFloat(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidFloat,[S]]);
    return Result;
  };
  var MaxPrecision = 18;
  this.FormatFloat = function (Fmt, aValue) {
    var Result = "";
    var E = 0.0;
    var FV = new $mod.TFloatRec();
    var Section = "";
    var SectionLength = 0;
    var ThousandSep = false;
    var IsScientific = false;
    var DecimalPos = 0;
    var FirstDigit = 0;
    var LastDigit = 0;
    var RequestedDigits = 0;
    var ExpSize = 0;
    var Available = 0;
    var Current = 0;
    var PadZeroes = 0;
    var DistToDecimal = 0;
    function InitVars() {
      E = aValue;
      Section = "";
      SectionLength = 0;
      ThousandSep = false;
      IsScientific = false;
      DecimalPos = 0;
      FirstDigit = 2147483647;
      LastDigit = 0;
      RequestedDigits = 0;
      ExpSize = 0;
      Available = -1;
    };
    function ToResult(AChar) {
      Result = Result + AChar;
    };
    function AddToResult(AStr) {
      Result = Result + AStr;
    };
    function WriteDigit(ADigit) {
      if (ADigit === "\x00") return;
      DistToDecimal -= 1;
      if (DistToDecimal === -1) {
        AddToResult($mod.DecimalSeparator);
        ToResult(ADigit);
      } else {
        ToResult(ADigit);
        if ((ThousandSep && ((DistToDecimal % 3) === 0)) && (DistToDecimal > 1)) AddToResult($mod.ThousandSeparator);
      };
    };
    function GetDigit() {
      var Result = "";
      Result = "\x00";
      if (Current <= Available) {
        Result = FV.Digits[Current];
        Current += 1;
      } else if (DistToDecimal <= LastDigit) {
        DistToDecimal -= 1}
       else Result = "0";
      return Result;
    };
    function CopyDigit() {
      if (PadZeroes === 0) {
        WriteDigit(GetDigit())}
       else if (PadZeroes < 0) {
        PadZeroes += 1;
        if (DistToDecimal <= FirstDigit) {
          WriteDigit("0")}
         else DistToDecimal -= 1;
      } else {
        while (PadZeroes > 0) {
          WriteDigit(GetDigit());
          PadZeroes -= 1;
        };
        WriteDigit(GetDigit());
      };
    };
    function GetSections(SP) {
      var Result = 0;
      var FL = 0;
      var i = 0;
      var C = "";
      var Q = "";
      var inQuote = false;
      Result = 1;
      SP.get()[1] = -1;
      SP.get()[2] = -1;
      SP.get()[3] = -1;
      inQuote = false;
      Q = "\x00";
      i = 1;
      FL = Fmt.length;
      while (i <= FL) {
        C = Fmt.charAt(i - 1);
        var $tmp1 = C;
        if ($tmp1 === ";") {
          if (!inQuote) {
            if (Result > 3) throw $mod.Exception.$create("Create$1",["Invalid float format"]);
            SP.get()[Result] = i + 1;
            Result += 1;
          };
        } else if (($tmp1 === '"') || ($tmp1 === "'")) {
          if (inQuote) {
            inQuote = C !== Q}
           else {
            inQuote = true;
            Q = C;
          };
        };
        i += 1;
      };
      if (SP.get()[Result] === -1) SP.get()[Result] = FL + 1;
      return Result;
    };
    function AnalyzeFormat() {
      var I = 0;
      var Len = 0;
      var Q = "";
      var C = "";
      var InQuote = false;
      Len = Section.length;
      I = 1;
      InQuote = false;
      Q = "\x00";
      while (I <= Len) {
        C = Section.charAt(I - 1);
        if (C.charCodeAt() in rtl.createSet(34,39)) {
          if (InQuote) {
            InQuote = C !== Q}
           else {
            InQuote = true;
            Q = C;
          };
        } else if (!InQuote) {
          var $tmp1 = C;
          if ($tmp1 === ".") {
            if (DecimalPos === 0) DecimalPos = RequestedDigits + 1}
           else if ($tmp1 === ",") {
            ThousandSep = $mod.ThousandSeparator !== "\x00"}
           else if (($tmp1 === "e") || ($tmp1 === "E")) {
            I += 1;
            if (I < Len) {
              C = Section.charAt(I - 1);
              IsScientific = C.charCodeAt() in rtl.createSet(45,43);
              if (IsScientific) while ((I < Len) && (Section.charAt((I + 1) - 1) === "0")) {
                ExpSize += 1;
                I += 1;
              };
              if (ExpSize > 4) ExpSize = 4;
            };
          } else if ($tmp1 === "#") {
            RequestedDigits += 1}
           else if ($tmp1 === "0") {
            if (RequestedDigits < FirstDigit) FirstDigit = RequestedDigits + 1;
            RequestedDigits += 1;
            LastDigit = RequestedDigits + 1;
          };
        };
        I += 1;
      };
      if (DecimalPos === 0) DecimalPos = RequestedDigits + 1;
      LastDigit = DecimalPos - LastDigit;
      if (LastDigit > 0) LastDigit = 0;
      FirstDigit = DecimalPos - FirstDigit;
      if (FirstDigit < 0) FirstDigit = 0;
    };
    function ValueOutSideScope() {
      var Result = false;
      Result = (((FV.Exponent >= 18) && !IsScientific) || (FV.Exponent === 0x7FF)) || (FV.Exponent === 0x800);
      return Result;
    };
    function CalcRunVars() {
      var D = 0;
      var P = 0;
      if (IsScientific) {
        P = RequestedDigits;
        D = 9999;
      } else {
        P = 18;
        D = (RequestedDigits - DecimalPos) + 1;
      };
      FV = new $mod.TFloatRec($mod.FloatToDecimal(aValue,P,D));
      DistToDecimal = DecimalPos - 1;
      if (IsScientific) {
        PadZeroes = 0}
       else {
        PadZeroes = FV.Exponent - (DecimalPos - 1);
        if (PadZeroes >= 0) DistToDecimal = FV.Exponent;
      };
      Available = -1;
      while ((Available < (rtl.length(FV.Digits) - 1)) && (FV.Digits[Available + 1] !== "\x00")) Available += 1;
    };
    function FormatExponent(ASign, aExponent) {
      var Result = "";
      Result = $mod.IntToStr(aExponent);
      Result = pas.System.StringOfChar("0",ExpSize - Result.length) + Result;
      if (aExponent < 0) {
        Result = "-" + Result}
       else if ((aExponent > 0) && (ASign === "+")) Result = ASign + Result;
      return Result;
    };
    var I = 0;
    var S = 0;
    var C = "";
    var Q = "";
    var PA = [];
    var InLiteral = false;
    PA = rtl.arraySetLength(PA,0,4);
    Result = "";
    InitVars();
    if (E > 0) {
      S = 1}
     else if (E < 0) {
      S = 2}
     else S = 3;
    PA[0] = 0;
    I = GetSections({get: function () {
        return PA;
      }, set: function (v) {
        PA = v;
      }});
    if ((I < S) || ((PA[S] - PA[S - 1]) === 0)) S = 1;
    SectionLength = (PA[S] - PA[S - 1]) - 1;
    Section = pas.System.Copy(Fmt,PA[S - 1] + 1,SectionLength);
    Section = rtl.strSetLength(Section,SectionLength);
    AnalyzeFormat();
    CalcRunVars();
    if ((SectionLength === 0) || ValueOutSideScope()) {
      Section=E.toPrecision(15);
      Result = Section;
    };
    I = 1;
    Current = 0;
    Q = " ";
    InLiteral = false;
    if (FV.Negative && (S === 1)) ToResult("-");
    while (I <= SectionLength) {
      C = Section.charAt(I - 1);
      if (C.charCodeAt() in rtl.createSet(34,39)) {
        if (InLiteral) {
          InLiteral = C !== Q}
         else {
          InLiteral = true;
          Q = C;
        };
      } else if (InLiteral) {
        ToResult(C)}
       else {
        var $tmp1 = C;
        if (($tmp1 === "0") || ($tmp1 === "#")) {
          CopyDigit()}
         else if (($tmp1 === ".") || ($tmp1 === ",")) {}
        else if (($tmp1 === "e") || ($tmp1 === "E")) {
          ToResult(C);
          I += 1;
          if (I <= Section.length) {
            C = Section.charAt(I - 1);
            if (C.charCodeAt() in rtl.createSet(43,45)) {
              AddToResult(FormatExponent(C,(FV.Exponent - DecimalPos) + 1));
              while ((I < SectionLength) && (Section.charAt((I + 1) - 1) === "0")) I += 1;
            };
          };
        } else {
          ToResult(C);
        };
      };
      I += 1;
    };
    return Result;
  };
  this.TrueBoolStrs = [];
  this.FalseBoolStrs = [];
  this.StrToBool = function (S) {
    var Result = false;
    if (!$mod.TryStrToBool(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidBoolean,[S]]);
    return Result;
  };
  this.BoolToStr = function (B, UseBoolStrs) {
    var Result = "";
    if (UseBoolStrs) {
      $impl.CheckBoolStrs();
      if (B) {
        Result = $mod.TrueBoolStrs[0]}
       else Result = $mod.FalseBoolStrs[0];
    } else if (B) {
      Result = "-1"}
     else Result = "0";
    return Result;
  };
  this.BoolToStr$1 = function (B, TrueS, FalseS) {
    var Result = "";
    if (B) {
      Result = TrueS}
     else Result = FalseS;
    return Result;
  };
  this.StrToBoolDef = function (S, Default) {
    var Result = false;
    if (!$mod.TryStrToBool(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = Default;
    return Result;
  };
  this.TryStrToBool = function (S, Value) {
    var Result = false;
    var Temp = "";
    var I = 0;
    var D = 0.0;
    var Code = 0;
    Temp = $mod.UpperCase(S);
    pas.System.val$7(Temp,{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return Code;
      }, set: function (v) {
        Code = v;
      }});
    Result = true;
    if (Code === 0) {
      Value.set(D !== 0.0)}
     else {
      $impl.CheckBoolStrs();
      for (var $l1 = 0, $end2 = rtl.length($mod.TrueBoolStrs) - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        if (Temp === $mod.UpperCase($mod.TrueBoolStrs[I])) {
          Value.set(true);
          return Result;
        };
      };
      for (var $l3 = 0, $end4 = rtl.length($mod.FalseBoolStrs) - 1; $l3 <= $end4; $l3++) {
        I = $l3;
        if (Temp === $mod.UpperCase($mod.FalseBoolStrs[I])) {
          Value.set(false);
          return Result;
        };
      };
      Result = false;
    };
    return Result;
  };
  this.ConfigExtension = ".cfg";
  this.SysConfigDir = "";
  $mod.$rtti.$ProcVar("TOnGetEnvironmentVariable",{procsig: rtl.newTIProcSig([["EnvVar",rtl.string,2]],rtl.string)});
  $mod.$rtti.$ProcVar("TOnGetEnvironmentString",{procsig: rtl.newTIProcSig([["Index",rtl.longint]],rtl.string)});
  $mod.$rtti.$ProcVar("TOnGetEnvironmentVariableCount",{procsig: rtl.newTIProcSig(null,rtl.longint)});
  this.OnGetEnvironmentVariable = null;
  this.OnGetEnvironmentString = null;
  this.OnGetEnvironmentVariableCount = null;
  this.GetEnvironmentVariable = function (EnvVar) {
    var Result = "";
    if ($mod.OnGetEnvironmentVariable != null) {
      Result = $mod.OnGetEnvironmentVariable(EnvVar)}
     else Result = "";
    return Result;
  };
  this.GetEnvironmentVariableCount = function () {
    var Result = 0;
    if ($mod.OnGetEnvironmentVariableCount != null) {
      Result = $mod.OnGetEnvironmentVariableCount()}
     else Result = 0;
    return Result;
  };
  this.GetEnvironmentString = function (Index) {
    var Result = "";
    if ($mod.OnGetEnvironmentString != null) {
      Result = $mod.OnGetEnvironmentString(Index)}
     else Result = "";
    return Result;
  };
  this.ShowException = function (ExceptObject, ExceptAddr) {
    var S = "";
    S = "Application raised an exception " + ExceptObject.$classname;
    if ($mod.Exception.isPrototypeOf(ExceptObject)) S = (S + " : ") + ExceptObject.fMessage;
    window.alert(S);
    if (ExceptAddr === null) ;
  };
  this.Abort = function () {
    throw $mod.EAbort.$create("Create$1",[$impl.SAbortError]);
  };
  this.TEventType = {"0": "etCustom", etCustom: 0, "1": "etInfo", etInfo: 1, "2": "etWarning", etWarning: 2, "3": "etError", etError: 3, "4": "etDebug", etDebug: 4};
  $mod.$rtti.$Enum("TEventType",{minvalue: 0, maxvalue: 4, ordtype: 1, enumtype: this.TEventType});
  $mod.$rtti.$Set("TEventTypes",{comptype: $mod.$rtti["TEventType"]});
  this.TSystemTime = function (s) {
    if (s) {
      this.Year = s.Year;
      this.Month = s.Month;
      this.Day = s.Day;
      this.DayOfWeek = s.DayOfWeek;
      this.Hour = s.Hour;
      this.Minute = s.Minute;
      this.Second = s.Second;
      this.MilliSecond = s.MilliSecond;
    } else {
      this.Year = 0;
      this.Month = 0;
      this.Day = 0;
      this.DayOfWeek = 0;
      this.Hour = 0;
      this.Minute = 0;
      this.Second = 0;
      this.MilliSecond = 0;
    };
    this.$equal = function (b) {
      return (this.Year === b.Year) && ((this.Month === b.Month) && ((this.Day === b.Day) && ((this.DayOfWeek === b.DayOfWeek) && ((this.Hour === b.Hour) && ((this.Minute === b.Minute) && ((this.Second === b.Second) && (this.MilliSecond === b.MilliSecond)))))));
    };
  };
  $mod.$rtti.$Record("TSystemTime",{}).addFields("Year",rtl.word,"Month",rtl.word,"Day",rtl.word,"DayOfWeek",rtl.word,"Hour",rtl.word,"Minute",rtl.word,"Second",rtl.word,"MilliSecond",rtl.word);
  this.TTimeStamp = function (s) {
    if (s) {
      this.Time = s.Time;
      this.date = s.date;
    } else {
      this.Time = 0;
      this.date = 0;
    };
    this.$equal = function (b) {
      return (this.Time === b.Time) && (this.date === b.date);
    };
  };
  $mod.$rtti.$Record("TTimeStamp",{}).addFields("Time",rtl.longint,"date",rtl.longint);
  this.TimeSeparator = ":";
  this.DateSeparator = "-";
  this.ShortDateFormat = "yyyy-mm-dd";
  this.LongDateFormat = "ddd, yyyy-mm-dd";
  this.ShortTimeFormat = "hh:nn";
  this.LongTimeFormat = "hh:nn:ss";
  this.DecimalSeparator = ".";
  this.ThousandSeparator = "";
  this.TimeAMString = "AM";
  this.TimePMString = "PM";
  this.HoursPerDay = 24;
  this.MinsPerHour = 60;
  this.SecsPerMin = 60;
  this.MSecsPerSec = 1000;
  this.MinsPerDay = 24 * 60;
  this.SecsPerDay = 1440 * 60;
  this.MSecsPerDay = 86400 * 1000;
  this.MaxDateTime = 2958465.99999999;
  this.MinDateTime = -693593.99999999;
  this.JulianEpoch = -2415018.5;
  this.UnixEpoch = -2415018.5 + 2440587.5;
  this.DateDelta = 693594;
  this.UnixDateDelta = 25569;
  this.MonthDays = [[31,28,31,30,31,30,31,31,30,31,30,31],[31,29,31,30,31,30,31,31,30,31,30,31]];
  this.ShortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  this.LongMonthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  this.ShortDayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  this.LongDayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  rtl.createClass($mod,"TFormatSettings",pas.System.TObject,function () {
    this.GetCurrencyDecimals = function () {
      var Result = 0;
      Result = $mod.CurrencyDecimals;
      return Result;
    };
    this.GetCurrencyFormat = function () {
      var Result = 0;
      Result = $mod.CurrencyFormat;
      return Result;
    };
    this.GetCurrencyString = function () {
      var Result = "";
      Result = $mod.CurrencyString;
      return Result;
    };
    this.GetDateSeparator = function () {
      var Result = "";
      Result = $mod.DateSeparator;
      return Result;
    };
    this.GetDecimalSeparator = function () {
      var Result = "";
      Result = $mod.DecimalSeparator;
      return Result;
    };
    this.GetLongDateFormat = function () {
      var Result = "";
      Result = $mod.LongDateFormat;
      return Result;
    };
    this.GetLongDayNames = function () {
      var Result = rtl.arraySetLength(null,"",7);
      Result = $mod.LongDayNames.slice(0);
      return Result;
    };
    this.GetLongMonthNames = function () {
      var Result = rtl.arraySetLength(null,"",12);
      Result = $mod.LongMonthNames.slice(0);
      return Result;
    };
    this.GetLongTimeFormat = function () {
      var Result = "";
      Result = $mod.LongTimeFormat;
      return Result;
    };
    this.GetNegCurrFormat = function () {
      var Result = 0;
      Result = $mod.NegCurrFormat;
      return Result;
    };
    this.GetShortDateFormat = function () {
      var Result = "";
      Result = $mod.ShortDateFormat;
      return Result;
    };
    this.GetShortDayNames = function () {
      var Result = rtl.arraySetLength(null,"",7);
      Result = $mod.ShortDayNames.slice(0);
      return Result;
    };
    this.GetShortMonthNames = function () {
      var Result = rtl.arraySetLength(null,"",12);
      Result = $mod.ShortMonthNames.slice(0);
      return Result;
    };
    this.GetShortTimeFormat = function () {
      var Result = "";
      Result = $mod.ShortTimeFormat;
      return Result;
    };
    this.GetThousandSeparator = function () {
      var Result = "";
      Result = $mod.ThousandSeparator;
      return Result;
    };
    this.GetTimeAMString = function () {
      var Result = "";
      Result = $mod.TimeAMString;
      return Result;
    };
    this.GetTimePMString = function () {
      var Result = "";
      Result = $mod.TimePMString;
      return Result;
    };
    this.GetTimeSeparator = function () {
      var Result = "";
      Result = $mod.TimeSeparator;
      return Result;
    };
    this.SetCurrencyFormat = function (AValue) {
      $mod.CurrencyFormat = AValue;
    };
    this.SetCurrencyString = function (AValue) {
      $mod.CurrencyString = AValue;
    };
    this.SetDateSeparator = function (Value) {
      $mod.DateSeparator = Value;
    };
    this.SetDecimalSeparator = function (Value) {
      $mod.DecimalSeparator = Value;
    };
    this.SetLongDateFormat = function (Value) {
      $mod.LongDateFormat = Value;
    };
    this.SetLongDayNames = function (AValue) {
      $mod.LongDayNames = AValue.slice(0);
    };
    this.SetLongMonthNames = function (AValue) {
      $mod.LongMonthNames = AValue.slice(0);
    };
    this.SetLongTimeFormat = function (Value) {
      $mod.LongTimeFormat = Value;
    };
    this.SetNegCurrFormat = function (AValue) {
      $mod.NegCurrFormat = AValue;
    };
    this.SetShortDateFormat = function (Value) {
      $mod.ShortDateFormat = Value;
    };
    this.SetShortDayNames = function (AValue) {
      $mod.ShortDayNames = AValue.slice(0);
    };
    this.SetShortMonthNames = function (AValue) {
      $mod.ShortMonthNames = AValue.slice(0);
    };
    this.SetShortTimeFormat = function (Value) {
      $mod.ShortTimeFormat = Value;
    };
    this.SetCurrencyDecimals = function (AValue) {
      $mod.CurrencyDecimals = AValue;
    };
    this.SetThousandSeparator = function (Value) {
      $mod.ThousandSeparator = Value;
    };
    this.SetTimeAMString = function (Value) {
      $mod.TimeAMString = Value;
    };
    this.SetTimePMString = function (Value) {
      $mod.TimePMString = Value;
    };
    this.SetTimeSeparator = function (Value) {
      $mod.TimeSeparator = Value;
    };
  });
  this.FormatSettings = null;
  this.TwoDigitYearCenturyWindow = 50;
  this.DateTimeToJSDate = function (aDateTime) {
    var Result = null;
    var Y = 0;
    var M = 0;
    var D = 0;
    var h = 0;
    var n = 0;
    var s = 0;
    var z = 0;
    $mod.DecodeDate(pas.System.Trunc(aDateTime),{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    $mod.DecodeTime(pas.System.Frac(aDateTime),{get: function () {
        return h;
      }, set: function (v) {
        h = v;
      }},{get: function () {
        return n;
      }, set: function (v) {
        n = v;
      }},{get: function () {
        return s;
      }, set: function (v) {
        s = v;
      }},{get: function () {
        return z;
      }, set: function (v) {
        z = v;
      }});
    Result = new Date(Y,M,D,h,n,s,z);
    return Result;
  };
  this.JSDateToDateTime = function (aDate) {
    var Result = 0.0;
    Result = $mod.EncodeDate(aDate.getFullYear(),aDate.getMonth() + 1,aDate.getDate()) + $mod.EncodeTime(aDate.getHours(),aDate.getMinutes(),aDate.getSeconds(),aDate.getMilliseconds());
    return Result;
  };
  this.DateTimeToTimeStamp = function (DateTime) {
    var Result = new $mod.TTimeStamp();
    var D = 0.0;
    D = DateTime * 86400000;
    if (D < 0) {
      D = D - 0.5}
     else D = D + 0.5;
    Result.Time = pas.System.Trunc(Math.abs(pas.System.Trunc(D)) % 86400000);
    Result.date = 693594 + Math.floor(pas.System.Trunc(D) / 86400000);
    return Result;
  };
  this.TimeStampToDateTime = function (TimeStamp) {
    var Result = 0.0;
    Result = $mod.ComposeDateTime(TimeStamp.date - 693594,TimeStamp.Time / 86400000);
    return Result;
  };
  this.MSecsToTimeStamp = function (MSecs) {
    var Result = new $mod.TTimeStamp();
    Result.date = pas.System.Trunc(MSecs / 86400000);
    MSecs = MSecs - (Result.date * 86400000);
    Result.Time = Math.round(MSecs);
    return Result;
  };
  this.TimeStampToMSecs = function (TimeStamp) {
    var Result = 0;
    Result = TimeStamp.Time + (TimeStamp.date * 86400000);
    return Result;
  };
  this.TryEncodeDate = function (Year, Month, Day, date) {
    var Result = false;
    var c = 0;
    var ya = 0;
    Result = (((((Year > 0) && (Year < 10000)) && (Month >= 1)) && (Month <= 12)) && (Day > 0)) && (Day <= $mod.MonthDays[+$mod.IsLeapYear(Year)][Month - 1]);
    if (Result) {
      if (Month > 2) {
        Month -= 3}
       else {
        Month += 9;
        Year -= 1;
      };
      c = Math.floor(Year / 100);
      ya = Year - (100 * c);
      date.set(((((146097 * c) >>> 2) + ((1461 * ya) >>> 2)) + Math.floor(((153 * Month) + 2) / 5)) + Day);
      date.set(date.get() - 693900);
    };
    return Result;
  };
  this.TryEncodeTime = function (Hour, Min, Sec, MSec, Time) {
    var Result = false;
    Result = (((Hour < 24) && (Min < 60)) && (Sec < 60)) && (MSec < 1000);
    if (Result) Time.set(((((Hour * 3600000) + (Min * 60000)) + (Sec * 1000)) + MSec) / 86400000);
    return Result;
  };
  this.EncodeDate = function (Year, Month, Day) {
    var Result = 0.0;
    if (!$mod.TryEncodeDate(Year,Month,Day,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",["%s-%s-%s is not a valid date specification",[$mod.IntToStr(Year),$mod.IntToStr(Month),$mod.IntToStr(Day)]]);
    return Result;
  };
  this.EncodeTime = function (Hour, Minute, Second, MilliSecond) {
    var Result = 0.0;
    if (!$mod.TryEncodeTime(Hour,Minute,Second,MilliSecond,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",["%s:%s:%s.%s is not a valid time specification",[$mod.IntToStr(Hour),$mod.IntToStr(Minute),$mod.IntToStr(Second),$mod.IntToStr(MilliSecond)]]);
    return Result;
  };
  this.ComposeDateTime = function (date, Time) {
    var Result = 0.0;
    if (date < 0) {
      Result = pas.System.Trunc(date) - Math.abs(pas.System.Frac(Time))}
     else Result = pas.System.Trunc(date) + Math.abs(pas.System.Frac(Time));
    return Result;
  };
  this.DecodeDate = function (date, Year, Month, Day) {
    var ly = 0;
    var ld = 0;
    var lm = 0;
    var j = 0;
    if (date <= -693594) {
      Year.set(0);
      Month.set(0);
      Day.set(0);
    } else {
      if (date > 0) {
        date = date + (1 / (86400000 * 2))}
       else date = date - (1 / (86400000 * 2));
      if (date > $mod.MaxDateTime) date = $mod.MaxDateTime;
      j = ((pas.System.Trunc(date) + 693900) << 2) - 1;
      ly = Math.floor(j / 146097);
      j = j - (146097 * ly);
      ld = j >>> 2;
      j = Math.floor(((ld << 2) + 3) / 1461);
      ld = (((ld << 2) + 7) - (1461 * j)) >>> 2;
      lm = Math.floor(((5 * ld) - 3) / 153);
      ld = Math.floor((((5 * ld) + 2) - (153 * lm)) / 5);
      ly = (100 * ly) + j;
      if (lm < 10) {
        lm += 3}
       else {
        lm -= 9;
        ly += 1;
      };
      Year.set(ly);
      Month.set(lm);
      Day.set(ld);
    };
  };
  this.DecodeDateFully = function (DateTime, Year, Month, Day, DOW) {
    var Result = false;
    $mod.DecodeDate(DateTime,Year,Month,Day);
    DOW.set($mod.DayOfWeek(DateTime));
    Result = $mod.IsLeapYear(Year.get());
    return Result;
  };
  this.DecodeTime = function (Time, Hour, Minute, Second, MilliSecond) {
    var l = 0;
    l = $mod.DateTimeToTimeStamp(Time).Time;
    Hour.set(Math.floor(l / 3600000));
    l = l % 3600000;
    Minute.set(Math.floor(l / 60000));
    l = l % 60000;
    Second.set(Math.floor(l / 1000));
    l = l % 1000;
    MilliSecond.set(l);
  };
  this.DateTimeToSystemTime = function (DateTime, SystemTime) {
    $mod.DecodeDateFully(DateTime,{p: SystemTime.get(), get: function () {
        return this.p.Year;
      }, set: function (v) {
        this.p.Year = v;
      }},{p: SystemTime.get(), get: function () {
        return this.p.Month;
      }, set: function (v) {
        this.p.Month = v;
      }},{p: SystemTime.get(), get: function () {
        return this.p.Day;
      }, set: function (v) {
        this.p.Day = v;
      }},{p: SystemTime.get(), get: function () {
        return this.p.DayOfWeek;
      }, set: function (v) {
        this.p.DayOfWeek = v;
      }});
    $mod.DecodeTime(DateTime,{p: SystemTime.get(), get: function () {
        return this.p.Hour;
      }, set: function (v) {
        this.p.Hour = v;
      }},{p: SystemTime.get(), get: function () {
        return this.p.Minute;
      }, set: function (v) {
        this.p.Minute = v;
      }},{p: SystemTime.get(), get: function () {
        return this.p.Second;
      }, set: function (v) {
        this.p.Second = v;
      }},{p: SystemTime.get(), get: function () {
        return this.p.MilliSecond;
      }, set: function (v) {
        this.p.MilliSecond = v;
      }});
    SystemTime.get().DayOfWeek -= 1;
  };
  this.SystemTimeToDateTime = function (SystemTime) {
    var Result = 0.0;
    Result = $mod.ComposeDateTime($impl.DoEncodeDate(SystemTime.Year,SystemTime.Month,SystemTime.Day),$impl.DoEncodeTime(SystemTime.Hour,SystemTime.Minute,SystemTime.Second,SystemTime.MilliSecond));
    return Result;
  };
  this.DayOfWeek = function (DateTime) {
    var Result = 0;
    Result = 1 + ((pas.System.Trunc(DateTime) - 1) % 7);
    if (Result <= 0) Result += 7;
    return Result;
  };
  this.date = function () {
    var Result = 0.0;
    Result = pas.System.Trunc($mod.Now());
    return Result;
  };
  this.Time = function () {
    var Result = 0.0;
    Result = $mod.Now() - $mod.date();
    return Result;
  };
  this.Now = function () {
    var Result = 0.0;
    Result = $mod.JSDateToDateTime(new Date());
    return Result;
  };
  this.IncMonth = function (DateTime, NumberOfMonths) {
    var Result = 0.0;
    var Year = 0;
    var Month = 0;
    var Day = 0;
    $mod.DecodeDate(DateTime,{get: function () {
        return Year;
      }, set: function (v) {
        Year = v;
      }},{get: function () {
        return Month;
      }, set: function (v) {
        Month = v;
      }},{get: function () {
        return Day;
      }, set: function (v) {
        Day = v;
      }});
    $mod.IncAMonth({get: function () {
        return Year;
      }, set: function (v) {
        Year = v;
      }},{get: function () {
        return Month;
      }, set: function (v) {
        Month = v;
      }},{get: function () {
        return Day;
      }, set: function (v) {
        Day = v;
      }},NumberOfMonths);
    Result = $mod.ComposeDateTime($impl.DoEncodeDate(Year,Month,Day),DateTime);
    return Result;
  };
  this.IncAMonth = function (Year, Month, Day, NumberOfMonths) {
    var TempMonth = 0;
    var S = 0;
    if (NumberOfMonths >= 0) {
      S = 1}
     else S = -1;
    Year.set(Year.get() + Math.floor(NumberOfMonths / 12));
    TempMonth = (Month.get() + (NumberOfMonths % 12)) - 1;
    if ((TempMonth > 11) || (TempMonth < 0)) {
      TempMonth -= S * 12;
      Year.set(Year.get() + S);
    };
    Month.set(TempMonth + 1);
    if (Day.get() > $mod.MonthDays[+$mod.IsLeapYear(Year.get())][Month.get() - 1]) Day.set($mod.MonthDays[+$mod.IsLeapYear(Year.get())][Month.get() - 1]);
  };
  this.IsLeapYear = function (Year) {
    var Result = false;
    Result = ((Year % 4) === 0) && (((Year % 100) !== 0) || ((Year % 400) === 0));
    return Result;
  };
  this.DateToStr = function (date) {
    var Result = "";
    Result = $mod.FormatDateTime("ddddd",date);
    return Result;
  };
  this.TimeToStr = function (Time) {
    var Result = "";
    Result = $mod.FormatDateTime("tt",Time);
    return Result;
  };
  this.DateTimeToStr = function (DateTime, ForceTimeIfZero) {
    var Result = "";
    Result = $mod.FormatDateTime($impl.DateTimeToStrFormat[+ForceTimeIfZero],DateTime);
    return Result;
  };
  this.StrToDate = function (S) {
    var Result = 0.0;
    Result = $mod.StrToDate$2(S,$mod.ShortDateFormat,"\x00");
    return Result;
  };
  this.StrToDate$1 = function (S, separator) {
    var Result = 0.0;
    Result = $mod.StrToDate$2(S,$mod.ShortDateFormat,separator);
    return Result;
  };
  this.StrToDate$2 = function (S, useformat, separator) {
    var Result = 0.0;
    var MSg = "";
    Result = $impl.IntStrToDate({get: function () {
        return MSg;
      }, set: function (v) {
        MSg = v;
      }},S,useformat,separator);
    if (MSg !== "") throw $mod.EConvertError.$create("Create$1",[MSg]);
    return Result;
  };
  this.StrToTime = function (S) {
    var Result = 0.0;
    Result = $mod.StrToTime$1(S,$mod.TimeSeparator);
    return Result;
  };
  this.StrToTime$1 = function (S, separator) {
    var Result = 0.0;
    var Msg = "";
    Result = $impl.IntStrToTime({get: function () {
        return Msg;
      }, set: function (v) {
        Msg = v;
      }},S,S.length,separator);
    if (Msg !== "") throw $mod.EConvertError.$create("Create$1",[Msg]);
    return Result;
  };
  this.StrToDateTime = function (S) {
    var Result = 0.0;
    var TimeStr = "";
    var DateStr = "";
    var PartsFound = 0;
    PartsFound = $impl.SplitDateTimeStr(S,{get: function () {
        return DateStr;
      }, set: function (v) {
        DateStr = v;
      }},{get: function () {
        return TimeStr;
      }, set: function (v) {
        TimeStr = v;
      }});
    var $tmp1 = PartsFound;
    if ($tmp1 === 0) {
      Result = $mod.StrToDate("")}
     else if ($tmp1 === 1) {
      if (DateStr.length > 0) {
        Result = $mod.StrToDate$2(DateStr,$mod.ShortDateFormat,$mod.DateSeparator)}
       else Result = $mod.StrToTime(TimeStr)}
     else if ($tmp1 === 2) Result = $mod.ComposeDateTime($mod.StrToDate$2(DateStr,$mod.ShortDateFormat,$mod.DateSeparator),$mod.StrToTime(TimeStr));
    return Result;
  };
  this.FormatDateTime = function (FormatStr, DateTime) {
    var Result = "";
    function StoreStr(APos, Len) {
      Result = Result + pas.System.Copy(FormatStr,APos,Len);
    };
    function StoreString(AStr) {
      Result = Result + AStr;
    };
    function StoreInt(Value, Digits) {
      var S = "";
      S = $mod.IntToStr(Value);
      while (S.length < Digits) S = "0" + S;
      StoreString(S);
    };
    var Year = 0;
    var Month = 0;
    var Day = 0;
    var DayOfWeek = 0;
    var Hour = 0;
    var Minute = 0;
    var Second = 0;
    var MilliSecond = 0;
    function StoreFormat(FormatStr, Nesting, TimeFlag) {
      var Token = "";
      var lastformattoken = "";
      var prevlasttoken = "";
      var Count = 0;
      var Clock12 = false;
      var tmp = 0;
      var isInterval = false;
      var P = 0;
      var FormatCurrent = 0;
      var FormatEnd = 0;
      if (Nesting > 1) return;
      FormatCurrent = 1;
      FormatEnd = FormatStr.length;
      Clock12 = false;
      isInterval = false;
      P = 1;
      while (P <= FormatEnd) {
        Token = FormatStr.charAt(P - 1);
        var $tmp1 = Token;
        if (($tmp1 === "'") || ($tmp1 === '"')) {
          P += 1;
          while ((P < FormatEnd) && (FormatStr.charAt(P - 1) !== Token)) P += 1;
        } else if (($tmp1 === "A") || ($tmp1 === "a")) {
          if ((($mod.CompareText(pas.System.Copy(FormatStr,P,3),"A\/P") === 0) || ($mod.CompareText(pas.System.Copy(FormatStr,P,4),"AMPM") === 0)) || ($mod.CompareText(pas.System.Copy(FormatStr,P,5),"AM\/PM") === 0)) {
            Clock12 = true;
            break;
          };
        };
        P += 1;
      };
      Token = "ÿ";
      lastformattoken = " ";
      prevlasttoken = "H";
      while (FormatCurrent <= FormatEnd) {
        Token = $mod.UpperCase(FormatStr.charAt(FormatCurrent - 1)).charAt(0);
        Count = 1;
        P = FormatCurrent + 1;
        var $tmp2 = Token;
        if (($tmp2 === "'") || ($tmp2 === '"')) {
          while ((P < FormatEnd) && (FormatStr.charAt(P - 1) !== Token)) P += 1;
          P += 1;
          Count = P - FormatCurrent;
          StoreStr(FormatCurrent + 1,Count - 2);
        } else if ($tmp2 === "A") {
          if ($mod.CompareText(pas.System.Copy(FormatStr,FormatCurrent,4),"AMPM") === 0) {
            Count = 4;
            if (Hour < 12) {
              StoreString($mod.TimeAMString)}
             else StoreString($mod.TimePMString);
          } else if ($mod.CompareText(pas.System.Copy(FormatStr,FormatCurrent,5),"AM\/PM") === 0) {
            Count = 5;
            if (Hour < 12) {
              StoreStr(FormatCurrent,2)}
             else StoreStr(FormatCurrent + 3,2);
          } else if ($mod.CompareText(pas.System.Copy(FormatStr,FormatCurrent,3),"A\/P") === 0) {
            Count = 3;
            if (Hour < 12) {
              StoreStr(FormatCurrent,1)}
             else StoreStr(FormatCurrent + 2,1);
          } else throw $mod.EConvertError.$create("Create$1",["Illegal character in format string"]);
        } else if ($tmp2 === "\/") {
          StoreString($mod.DateSeparator);
        } else if ($tmp2 === ":") {
          StoreString($mod.TimeSeparator)}
         else if ((((((((((($tmp2 === " ") || ($tmp2 === "C")) || ($tmp2 === "D")) || ($tmp2 === "H")) || ($tmp2 === "M")) || ($tmp2 === "N")) || ($tmp2 === "S")) || ($tmp2 === "T")) || ($tmp2 === "Y")) || ($tmp2 === "Z")) || ($tmp2 === "F")) {
          while ((P <= FormatEnd) && ($mod.UpperCase(FormatStr.charAt(P - 1)) === Token)) P += 1;
          Count = P - FormatCurrent;
          var $tmp3 = Token;
          if ($tmp3 === " ") {
            StoreStr(FormatCurrent,Count)}
           else if ($tmp3 === "Y") {
            if (Count > 2) {
              StoreInt(Year,4)}
             else StoreInt(Year % 100,2);
          } else if ($tmp3 === "M") {
            if (isInterval && ((prevlasttoken === "H") || TimeFlag)) {
              StoreInt(Minute + ((Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24)) * 60),0)}
             else if ((lastformattoken === "H") || TimeFlag) {
              if (Count === 1) {
                StoreInt(Minute,0)}
               else StoreInt(Minute,2);
            } else {
              var $tmp4 = Count;
              if ($tmp4 === 1) {
                StoreInt(Month,0)}
               else if ($tmp4 === 2) {
                StoreInt(Month,2)}
               else if ($tmp4 === 3) {
                StoreString($mod.ShortMonthNames[Month - 1])}
               else {
                StoreString($mod.LongMonthNames[Month - 1]);
              };
            };
          } else if ($tmp3 === "D") {
            var $tmp5 = Count;
            if ($tmp5 === 1) {
              StoreInt(Day,0)}
             else if ($tmp5 === 2) {
              StoreInt(Day,2)}
             else if ($tmp5 === 3) {
              StoreString($mod.ShortDayNames[DayOfWeek])}
             else if ($tmp5 === 4) {
              StoreString($mod.LongDayNames[DayOfWeek])}
             else if ($tmp5 === 5) {
              StoreFormat($mod.ShortDateFormat,Nesting + 1,false)}
             else {
              StoreFormat($mod.LongDateFormat,Nesting + 1,false);
            };
          } else if ($tmp3 === "H") {
            if (isInterval) {
              StoreInt(Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24),0)}
             else if (Clock12) {
              tmp = Hour % 12;
              if (tmp === 0) tmp = 12;
              if (Count === 1) {
                StoreInt(tmp,0)}
               else StoreInt(tmp,2);
            } else {
              if (Count === 1) {
                StoreInt(Hour,0)}
               else StoreInt(Hour,2);
            }}
           else if ($tmp3 === "N") {
            if (isInterval) {
              StoreInt(Minute + ((Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24)) * 60),0)}
             else if (Count === 1) {
              StoreInt(Minute,0)}
             else StoreInt(Minute,2)}
           else if ($tmp3 === "S") {
            if (isInterval) {
              StoreInt(Second + ((Minute + ((Hour + (pas.System.Trunc(Math.abs(DateTime)) * 24)) * 60)) * 60),0)}
             else if (Count === 1) {
              StoreInt(Second,0)}
             else StoreInt(Second,2)}
           else if ($tmp3 === "Z") {
            if (Count === 1) {
              StoreInt(MilliSecond,0)}
             else StoreInt(MilliSecond,3)}
           else if ($tmp3 === "T") {
            if (Count === 1) {
              StoreFormat($mod.ShortTimeFormat,Nesting + 1,true)}
             else StoreFormat($mod.LongTimeFormat,Nesting + 1,true)}
           else if ($tmp3 === "C") {
            StoreFormat($mod.ShortDateFormat,Nesting + 1,false);
            if (((Hour !== 0) || (Minute !== 0)) || (Second !== 0)) {
              StoreString(" ");
              StoreFormat($mod.LongTimeFormat,Nesting + 1,true);
            };
          } else if ($tmp3 === "F") {
            StoreFormat($mod.ShortDateFormat,Nesting + 1,false);
            StoreString(" ");
            StoreFormat($mod.LongTimeFormat,Nesting + 1,true);
          };
          prevlasttoken = lastformattoken;
          lastformattoken = Token;
        } else {
          StoreString(Token);
        };
        FormatCurrent += Count;
      };
    };
    $mod.DecodeDateFully(DateTime,{get: function () {
        return Year;
      }, set: function (v) {
        Year = v;
      }},{get: function () {
        return Month;
      }, set: function (v) {
        Month = v;
      }},{get: function () {
        return Day;
      }, set: function (v) {
        Day = v;
      }},{get: function () {
        return DayOfWeek;
      }, set: function (v) {
        DayOfWeek = v;
      }});
    $mod.DecodeTime(DateTime,{get: function () {
        return Hour;
      }, set: function (v) {
        Hour = v;
      }},{get: function () {
        return Minute;
      }, set: function (v) {
        Minute = v;
      }},{get: function () {
        return Second;
      }, set: function (v) {
        Second = v;
      }},{get: function () {
        return MilliSecond;
      }, set: function (v) {
        MilliSecond = v;
      }});
    if (FormatStr !== "") {
      StoreFormat(FormatStr,0,false)}
     else StoreFormat("C",0,false);
    return Result;
  };
  this.TryStrToDate = function (S, Value) {
    var Result = false;
    Result = $mod.TryStrToDate$2(S,Value,$mod.ShortDateFormat,"\x00");
    return Result;
  };
  this.TryStrToDate$1 = function (S, Value, separator) {
    var Result = false;
    Result = $mod.TryStrToDate$2(S,Value,$mod.ShortDateFormat,separator);
    return Result;
  };
  this.TryStrToDate$2 = function (S, Value, useformat, separator) {
    var Result = false;
    var Msg = "";
    Result = S.length !== 0;
    if (Result) {
      Value.set($impl.IntStrToDate({get: function () {
          return Msg;
        }, set: function (v) {
          Msg = v;
        }},S,useformat,separator));
      Result = Msg === "";
    };
    return Result;
  };
  this.TryStrToTime = function (S, Value) {
    var Result = false;
    Result = $mod.TryStrToTime$1(S,Value,"\x00");
    return Result;
  };
  this.TryStrToTime$1 = function (S, Value, separator) {
    var Result = false;
    var Msg = "";
    Result = S.length !== 0;
    if (Result) {
      Value.set($impl.IntStrToTime({get: function () {
          return Msg;
        }, set: function (v) {
          Msg = v;
        }},S,S.length,separator));
      Result = Msg === "";
    };
    return Result;
  };
  this.TryStrToDateTime = function (S, Value) {
    var Result = false;
    var I = 0;
    var dtdate = 0.0;
    var dttime = 0.0;
    Result = false;
    I = pas.System.Pos($mod.TimeSeparator,S);
    if (I > 0) {
      while ((I > 0) && (S.charAt(I - 1) !== " ")) I -= 1;
      if (I > 0) {
        if (!$mod.TryStrToDate(pas.System.Copy(S,1,I - 1),{get: function () {
            return dtdate;
          }, set: function (v) {
            dtdate = v;
          }})) return Result;
        if (!$mod.TryStrToTime(pas.System.Copy(S,I + 1,S.length - I),{get: function () {
            return dttime;
          }, set: function (v) {
            dttime = v;
          }})) return Result;
        Value.set($mod.ComposeDateTime(dtdate,dttime));
        Result = true;
      } else Result = $mod.TryStrToTime(S,Value);
    } else Result = $mod.TryStrToDate(S,Value);
    return Result;
  };
  this.StrToDateDef = function (S, Defvalue) {
    var Result = 0.0;
    Result = $mod.StrToDateDef$1(S,Defvalue,"\x00");
    return Result;
  };
  this.StrToDateDef$1 = function (S, Defvalue, separator) {
    var Result = 0.0;
    if (!$mod.TryStrToDate$1(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},separator)) Result = Defvalue;
    return Result;
  };
  this.StrToTimeDef = function (S, Defvalue) {
    var Result = 0.0;
    Result = $mod.StrToTimeDef$1(S,Defvalue,"\x00");
    return Result;
  };
  this.StrToTimeDef$1 = function (S, Defvalue, separator) {
    var Result = 0.0;
    if (!$mod.TryStrToTime$1(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},separator)) Result = Defvalue;
    return Result;
  };
  this.StrToDateTimeDef = function (S, Defvalue) {
    var Result = 0.0;
    if (!$mod.TryStrToDateTime(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = Defvalue;
    return Result;
  };
  this.CurrentYear = function () {
    var Result = 0;
    Result = (new Date()).getFullYear();
    return Result;
  };
  this.ReplaceTime = function (dati, NewTime) {
    dati.set($mod.ComposeDateTime(dati.get(),NewTime));
  };
  this.ReplaceDate = function (DateTime, NewDate) {
    var tmp = 0.0;
    tmp = NewDate;
    $mod.ReplaceTime({get: function () {
        return tmp;
      }, set: function (v) {
        tmp = v;
      }},DateTime.get());
    DateTime.set(tmp);
  };
  this.FloatToDateTime = function (Value) {
    var Result = 0.0;
    if ((Value < $mod.MinDateTime) || (Value > $mod.MaxDateTime)) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidDateTime,[$mod.FloatToStr(Value)]]);
    Result = Value;
    return Result;
  };
  this.CurrencyFormat = 0;
  this.NegCurrFormat = 0;
  this.CurrencyDecimals = 2;
  this.CurrencyString = "$";
  this.FloattoCurr = function (Value) {
    var Result = 0;
    if (!$mod.TryFloatToCurr(Value,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidCurrency,[$mod.FloatToStr(Value)]]);
    return Result;
  };
  this.TryFloatToCurr = function (Value, AResult) {
    var Result = false;
    Result = ((Value * 10000) >= $mod.MinCurrency) && ((Value * 10000) <= $mod.MaxCurrency);
    if (Result) AResult.set(Math.floor(Value * 10000));
    return Result;
  };
  this.CurrToStr = function (Value) {
    var Result = "";
    Result = $mod.FloatToStrF(Value / 10000,$mod.TFloatFormat.ffGeneral,-1,0);
    return Result;
  };
  this.StrToCurr = function (S) {
    var Result = 0;
    if (!$mod.TryStrToCurr(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidCurrency,[S]]);
    return Result;
  };
  this.TryStrToCurr = function (S, Value) {
    var Result = false;
    var D = 0.0;
    Result = $mod.TryStrToFloat(S,{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    if (Result) Value.set(Math.floor(D * 10000));
    return Result;
  };
  this.StrToCurrDef = function (S, Default) {
    var Result = 0;
    var R = 0;
    if ($mod.TryStrToCurr(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) {
      Result = R}
     else Result = Default;
    return Result;
  };
  this.GUID_NULL = new pas.System.TGuid({D1: 0x00000000, D2: 0x0000, D3: 0x0000, D4: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]});
  this.Supports = function (Instance, AClass, Obj) {
    var Result = false;
    Result = ((Instance !== null) && (Instance.QueryInterface(pas.System.IObjectInstance,Obj) === 0)) && Obj.get().$class.InheritsFrom(AClass);
    return Result;
  };
  this.Supports$1 = function (Instance, IID, Intf) {
    var Result = false;
    Result = (Instance !== null) && (Instance.QueryInterface(IID,Intf) === 0);
    return Result;
  };
  this.Supports$2 = function (Instance, IID, Intf) {
    var Result = false;
    Result = (Instance !== null) && Instance.GetInterface(IID,Intf);
    return Result;
  };
  this.Supports$3 = function (Instance, IID, Intf) {
    var Result = false;
    Result = (Instance !== null) && Instance.GetInterfaceByStr(IID,Intf);
    return Result;
  };
  this.Supports$4 = function (Instance, AClass) {
    var Result = false;
    var Temp = null;
    Result = $mod.Supports(Instance,AClass,{get: function () {
        return Temp;
      }, set: function (v) {
        Temp = v;
      }});
    return Result;
  };
  this.Supports$5 = function (Instance, IID) {
    var Result = false;
    var Temp = null;
    try {
      Result = $mod.Supports$1(Instance,IID,{get: function () {
          return Temp;
        }, set: function (v) {
          Temp = v;
        }});
    } finally {
      rtl._Release(Temp);
    };
    return Result;
  };
  this.Supports$6 = function (Instance, IID) {
    var Result = false;
    var Temp = null;
    Result = $mod.Supports$2(Instance,IID,{get: function () {
        return Temp;
      }, set: function (v) {
        Temp = v;
      }});
    if (Temp && Temp.$kind==='com') Temp._Release();
    return Result;
  };
  this.Supports$7 = function (Instance, IID) {
    var Result = false;
    var Temp = null;
    Result = $mod.Supports$3(Instance,IID,{get: function () {
        return Temp;
      }, set: function (v) {
        Temp = v;
      }});
    if (Temp && Temp.$kind==='com') Temp._Release();
    return Result;
  };
  this.Supports$8 = function (AClass, IID) {
    var Result = false;
    var maps = undefined;
    if (AClass === null) return false;
    maps = AClass["$intfmaps"];
    if (!maps) return false;
    if (rtl.getObject(maps)[$mod.GUIDToString(IID)]) return true;
    Result = false;
    return Result;
  };
  this.Supports$9 = function (AClass, IID) {
    var Result = false;
    var maps = undefined;
    if (AClass === null) return false;
    maps = AClass["$intfmaps"];
    if (!maps) return false;
    if (rtl.getObject(maps)[$mod.UpperCase(IID)]) return true;
    Result = false;
    return Result;
  };
  this.TryStringToGUID = function (s, Guid) {
    var Result = false;
    var re = null;
    if (s.length !== 38) return false;
    re = new RegExp("^\\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\}$");
    Result = re.test(s);
    if (!Result) {
      Guid.get().D1 = 0;
      return Result;
    };
    rtl.strToGUIDR(s,Guid.get());
    Result = true;
    return Result;
  };
  this.StringToGUID = function (S) {
    var Result = new pas.System.TGuid();
    if (!$mod.TryStringToGUID(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidGUID,[S]]);
    return Result;
  };
  this.GUIDToString = function (guid) {
    var Result = "";
    Result = rtl.guidrToStr(guid);
    return Result;
  };
  this.IsEqualGUID = function (guid1, guid2) {
    var Result = false;
    var i = 0;
    if (((guid1.D1 !== guid2.D1) || (guid1.D2 !== guid2.D2)) || (guid1.D3 !== guid2.D3)) return false;
    for (i = 0; i <= 7; i++) if (guid1.D4[i] !== guid2.D4[i]) return false;
    Result = true;
    return Result;
  };
  this.GuidCase = function (guid, List) {
    var Result = 0;
    for (var $l1 = rtl.length(List) - 1; $l1 >= 0; $l1--) {
      Result = $l1;
      if ($mod.IsEqualGUID(guid,List[Result])) return Result;
    };
    Result = -1;
    return Result;
  };
  $mod.$init = function () {
    $mod.FormatSettings = $mod.TFormatSettings.$create("Create");
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.SAbortError = "Operation aborted";
  $impl.CheckBoolStrs = function () {
    if (rtl.length($mod.TrueBoolStrs) === 0) {
      $mod.TrueBoolStrs = rtl.arraySetLength($mod.TrueBoolStrs,"",1);
      $mod.TrueBoolStrs[0] = "True";
    };
    if (rtl.length($mod.FalseBoolStrs) === 0) {
      $mod.FalseBoolStrs = rtl.arraySetLength($mod.FalseBoolStrs,"",1);
      $mod.FalseBoolStrs[0] = "False";
    };
  };
  $impl.feInvalidFormat = 1;
  $impl.feMissingArgument = 2;
  $impl.feInvalidArgIndex = 3;
  $impl.DoFormatError = function (ErrCode, fmt) {
    var $tmp1 = ErrCode;
    if ($tmp1 === 1) {
      throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidFormat,[fmt]])}
     else if ($tmp1 === 2) {
      throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SArgumentMissing,[fmt]])}
     else if ($tmp1 === 3) throw $mod.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidArgIndex,[fmt]]);
  };
  $impl.maxdigits = 15;
  $impl.ReplaceDecimalSep = function (S, DS) {
    var Result = "";
    var P = 0;
    P = pas.System.Pos(".",S);
    if (P > 0) {
      Result = (pas.System.Copy(S,1,P - 1) + DS) + pas.System.Copy(S,P + 1,S.length - P)}
     else Result = S;
    return Result;
  };
  $impl.FormatGeneralFloat = function (Value, Precision, DS) {
    var Result = "";
    var P = 0;
    var PE = 0;
    var Q = 0;
    var Exponent = 0;
    if ((Precision === -1) || (Precision > 15)) Precision = 15;
    Result = rtl.floatToStr(Value,Precision + 7);
    Result = $mod.TrimLeft(Result);
    P = pas.System.Pos(".",Result);
    if (P === 0) return Result;
    PE = pas.System.Pos("E",Result);
    if (PE === 0) {
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    Q = PE + 2;
    Exponent = 0;
    while (Q <= Result.length) {
      Exponent = ((Exponent * 10) + Result.charCodeAt(Q - 1)) - "0".charCodeAt();
      Q += 1;
    };
    if (Result.charAt((PE + 1) - 1) === "-") Exponent = -Exponent;
    if (((P + Exponent) < PE) && (Exponent > -6)) {
      Result = rtl.strSetLength(Result,PE - 1);
      if (Exponent >= 0) {
        for (var $l1 = 0, $end2 = Exponent - 1; $l1 <= $end2; $l1++) {
          Q = $l1;
          Result = rtl.setCharAt(Result,P - 1,Result.charAt((P + 1) - 1));
          P += 1;
        };
        Result = rtl.setCharAt(Result,P - 1,".");
        P = 1;
        if (Result.charAt(P - 1) === "-") P += 1;
        while (((Result.charAt(P - 1) === "0") && (P < Result.length)) && (pas.System.Copy(Result,P + 1,DS.length) !== DS)) pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P,1);
      } else {
        pas.System.Insert(pas.System.Copy("00000",1,-Exponent),{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P - 1);
        Result = rtl.setCharAt(Result,(P - Exponent) - 1,Result.charAt(((P - Exponent) - 1) - 1));
        Result = rtl.setCharAt(Result,P - 1,".");
        if (Exponent !== -1) Result = rtl.setCharAt(Result,((P - Exponent) - 1) - 1,"0");
      };
      Q = Result.length;
      while ((Q > 0) && (Result.charAt(Q - 1) === "0")) Q -= 1;
      if (Result.charAt(Q - 1) === ".") Q -= 1;
      if ((Q === 0) || ((Q === 1) && (Result.charAt(0) === "-"))) {
        Result = "0"}
       else Result = rtl.strSetLength(Result,Q);
    } else {
      while (Result.charAt((PE - 1) - 1) === "0") {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE - 1,1);
        PE -= 1;
      };
      if (Result.charAt((PE - 1) - 1) === DS) {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE - 1,1);
        PE -= 1;
      };
      if (Result.charAt((PE + 1) - 1) === "+") {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE + 1,1)}
       else PE += 1;
      while (Result.charAt((PE + 1) - 1) === "0") pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},PE + 1,1);
    };
    Result = $impl.ReplaceDecimalSep(Result,DS);
    return Result;
  };
  $impl.FormatExponentFloat = function (Value, Precision, Digits, DS) {
    var Result = "";
    var P = 0;
    DS = $mod.DecimalSeparator;
    if ((Precision === -1) || (Precision > 15)) Precision = 15;
    Result = rtl.floatToStr(Value,Precision + 7);
    while (Result.charAt(0) === " ") pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    P = pas.System.Pos("E",Result);
    if (P === 0) {
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    P += 2;
    if (Digits > 4) Digits = 4;
    Digits = ((Result.length - P) - Digits) + 1;
    if (Digits < 0) {
      pas.System.Insert(pas.System.Copy("0000",1,-Digits),{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P)}
     else while ((Digits > 0) && (Result.charAt(P - 1) === "0")) {
      pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P,1);
      if (P > Result.length) {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P - 2,2);
        break;
      };
      Digits -= 1;
    };
    Result = $impl.ReplaceDecimalSep(Result,DS);
    return Result;
  };
  $impl.FormatFixedFloat = function (Value, Digits, DS) {
    var Result = "";
    if (Digits === -1) {
      Digits = 2}
     else if (Digits > 18) Digits = 18;
    Result = rtl.floatToStr(Value,0,Digits);
    if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    Result = $impl.ReplaceDecimalSep(Result,DS);
    return Result;
  };
  $impl.FormatNumberFloat = function (Value, Digits, DS, TS) {
    var Result = "";
    var P = 0;
    if (Digits === -1) {
      Digits = 2}
     else if (Digits > 15) Digits = 15;
    Result = rtl.floatToStr(Value,0,Digits);
    if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    P = pas.System.Pos(".",Result);
    Result = $impl.ReplaceDecimalSep(Result,DS);
    P -= 3;
    if ((TS !== "") && (TS !== "\x00")) while (P > 1) {
      if (Result.charAt((P - 1) - 1) !== "-") pas.System.Insert(TS,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P);
      P -= 3;
    };
    return Result;
  };
  $impl.RemoveLeadingNegativeSign = function (AValue, DS) {
    var Result = false;
    var i = 0;
    var TS = "";
    var StartPos = 0;
    Result = false;
    StartPos = 2;
    TS = $mod.ThousandSeparator;
    for (var $l1 = StartPos, $end2 = AValue.get().length; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = (AValue.get().charCodeAt(i - 1) in rtl.createSet(48,DS.charCodeAt(),69,43)) || (AValue.get() === TS);
      if (!Result) break;
    };
    if (Result) pas.System.Delete(AValue,1,1);
    return Result;
  };
  $impl.FormatNumberCurrency = function (Value, Digits, DS, TS) {
    var Result = "";
    var Negative = false;
    var P = 0;
    if (Digits === -1) {
      Digits = $mod.CurrencyDecimals}
     else if (Digits > 18) Digits = 18;
    Result = rtl.spaceLeft("" + Value,0);
    Negative = Result.charAt(0) === "-";
    if (Negative) pas.System.Delete({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},1,1);
    P = pas.System.Pos(".",Result);
    if (P !== 0) {
      Result = $impl.ReplaceDecimalSep(Result,DS)}
     else P = Result.length + 1;
    P -= 3;
    while (P > 1) {
      if ($mod.ThousandSeparator !== "\x00") pas.System.Insert($mod.FormatSettings.GetThousandSeparator(),{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},P);
      P -= 3;
    };
    if ((Result.length > 1) && Negative) Negative = !$impl.RemoveLeadingNegativeSign({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},DS);
    if (!Negative) {
      var $tmp1 = $mod.CurrencyFormat;
      if ($tmp1 === 0) {
        Result = $mod.CurrencyString + Result}
       else if ($tmp1 === 1) {
        Result = Result + $mod.CurrencyString}
       else if ($tmp1 === 2) {
        Result = ($mod.CurrencyString + " ") + Result}
       else if ($tmp1 === 3) Result = (Result + " ") + $mod.CurrencyString;
    } else {
      var $tmp2 = $mod.NegCurrFormat;
      if ($tmp2 === 0) {
        Result = (("(" + $mod.CurrencyString) + Result) + ")"}
       else if ($tmp2 === 1) {
        Result = ("-" + $mod.CurrencyString) + Result}
       else if ($tmp2 === 2) {
        Result = ($mod.CurrencyString + "-") + Result}
       else if ($tmp2 === 3) {
        Result = ($mod.CurrencyString + Result) + "-"}
       else if ($tmp2 === 4) {
        Result = (("(" + Result) + $mod.CurrencyString) + ")"}
       else if ($tmp2 === 5) {
        Result = ("-" + Result) + $mod.CurrencyString}
       else if ($tmp2 === 6) {
        Result = (Result + "-") + $mod.CurrencyString}
       else if ($tmp2 === 7) {
        Result = (Result + $mod.CurrencyString) + "-"}
       else if ($tmp2 === 8) {
        Result = (("-" + Result) + " ") + $mod.CurrencyString}
       else if ($tmp2 === 9) {
        Result = (("-" + $mod.CurrencyString) + " ") + Result}
       else if ($tmp2 === 10) {
        Result = ((Result + " ") + $mod.CurrencyString) + "-"}
       else if ($tmp2 === 11) {
        Result = (($mod.CurrencyString + " ") + Result) + "-"}
       else if ($tmp2 === 12) {
        Result = (($mod.CurrencyString + " ") + "-") + Result}
       else if ($tmp2 === 13) {
        Result = ((Result + "-") + " ") + $mod.CurrencyString}
       else if ($tmp2 === 14) {
        Result = ((("(" + $mod.CurrencyString) + " ") + Result) + ")"}
       else if ($tmp2 === 15) Result = ((("(" + Result) + " ") + $mod.CurrencyString) + ")";
    };
    if (TS === "") ;
    return Result;
  };
  $impl.RESpecials = "([\\[\\]\\(\\)\\\\\\.\\*])";
  $impl.DoEncodeDate = function (Year, Month, Day) {
    var Result = 0;
    var D = 0.0;
    if ($mod.TryEncodeDate(Year,Month,Day,{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }})) {
      Result = pas.System.Trunc(D)}
     else Result = 0;
    return Result;
  };
  $impl.DoEncodeTime = function (Hour, Minute, Second, MilliSecond) {
    var Result = 0.0;
    if (!$mod.TryEncodeTime(Hour,Minute,Second,MilliSecond,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = 0;
    return Result;
  };
  $impl.DateTimeToStrFormat = ["c","f"];
  var WhiteSpace = " \b\t\n\f\r";
  var Digits = "0123456789";
  $impl.IntStrToDate = function (ErrorMsg, S, useformat, separator) {
    var Result = 0.0;
    function FixErrorMsg(errmarg) {
      ErrorMsg.set($mod.Format(pas.RTLConsts.SInvalidDateFormat,[errmarg]));
    };
    var df = "";
    var d = 0;
    var m = 0;
    var y = 0;
    var ly = 0;
    var ld = 0;
    var lm = 0;
    var n = 0;
    var i = 0;
    var len = 0;
    var c = 0;
    var dp = 0;
    var mp = 0;
    var yp = 0;
    var which = 0;
    var s1 = "";
    var values = [];
    var YearMoreThenTwoDigits = false;
    values = rtl.arraySetLength(values,0,4);
    Result = 0;
    len = S.length;
    ErrorMsg.set("");
    while ((len > 0) && (pas.System.Pos(S.charAt(len - 1),WhiteSpace) > 0)) len -= 1;
    if (len === 0) {
      FixErrorMsg(S);
      return Result;
    };
    YearMoreThenTwoDigits = false;
    if (separator === "\x00") if ($mod.DateSeparator !== "\x00") {
      separator = $mod.DateSeparator}
     else separator = "-";
    df = $mod.UpperCase(useformat);
    yp = 0;
    mp = 0;
    dp = 0;
    which = 0;
    i = 0;
    while ((i < df.length) && (which < 3)) {
      i += 1;
      var $tmp1 = df.charAt(i - 1);
      if ($tmp1 === "Y") {
        if (yp === 0) {
          which += 1;
          yp = which;
        }}
       else if ($tmp1 === "M") {
        if (mp === 0) {
          which += 1;
          mp = which;
        }}
       else if ($tmp1 === "D") if (dp === 0) {
        which += 1;
        dp = which;
      };
    };
    for (i = 1; i <= 3; i++) values[i] = 0;
    s1 = "";
    n = 0;
    for (var $l2 = 1, $end3 = len; $l2 <= $end3; $l2++) {
      i = $l2;
      if (pas.System.Pos(S.charAt(i - 1),Digits) > 0) s1 = s1 + S.charAt(i - 1);
      if ((separator !== " ") && (S.charAt(i - 1) === " ")) continue;
      if ((S.charAt(i - 1) === separator) || ((i === len) && (pas.System.Pos(S.charAt(i - 1),Digits) > 0))) {
        n += 1;
        if (n > 3) {
          FixErrorMsg(S);
          return Result;
        };
        if ((n === yp) && (s1.length > 2)) YearMoreThenTwoDigits = true;
        pas.System.val$5(s1,{a: n, p: values, get: function () {
            return this.p[this.a];
          }, set: function (v) {
            this.p[this.a] = v;
          }},{get: function () {
            return c;
          }, set: function (v) {
            c = v;
          }});
        if (c !== 0) {
          FixErrorMsg(S);
          return Result;
        };
        s1 = "";
      } else if (pas.System.Pos(S.charAt(i - 1),Digits) === 0) {
        FixErrorMsg(S);
        return Result;
      };
    };
    if ((which < 3) && (n > which)) {
      FixErrorMsg(S);
      return Result;
    };
    $mod.DecodeDate($mod.date(),{get: function () {
        return ly;
      }, set: function (v) {
        ly = v;
      }},{get: function () {
        return lm;
      }, set: function (v) {
        lm = v;
      }},{get: function () {
        return ld;
      }, set: function (v) {
        ld = v;
      }});
    if (n === 3) {
      y = values[yp];
      m = values[mp];
      d = values[dp];
    } else {
      y = ly;
      if (n < 2) {
        d = values[1];
        m = lm;
      } else if (dp < mp) {
        d = values[1];
        m = values[2];
      } else {
        d = values[2];
        m = values[1];
      };
    };
    if (((y >= 0) && (y < 100)) && !YearMoreThenTwoDigits) {
      ly = ly - $mod.TwoDigitYearCenturyWindow;
      y += Math.floor(ly / 100) * 100;
      if (($mod.TwoDigitYearCenturyWindow > 0) && (y < ly)) y += 100;
    };
    if (!$mod.TryEncodeDate(y,m,d,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) ErrorMsg.set(pas.RTLConsts.SErrInvalidDate);
    return Result;
  };
  var AMPM_None = 0;
  var AMPM_AM = 1;
  var AMPM_PM = 2;
  var tiHour = 0;
  var tiMin = 1;
  var tiSec = 2;
  var tiMSec = 3;
  var Digits$1 = "0123456789";
  $impl.IntStrToTime = function (ErrorMsg, S, Len, separator) {
    var Result = 0.0;
    var AmPm = 0;
    var TimeValues = [];
    function SplitElements(TimeValues, AmPm) {
      var Result = false;
      var Cur = 0;
      var Offset = 0;
      var ElemLen = 0;
      var Err = 0;
      var TimeIndex = 0;
      var FirstSignificantDigit = 0;
      var Value = 0;
      var DigitPending = false;
      var MSecPending = false;
      var AmPmStr = "";
      var CurChar = "";
      var I = 0;
      var allowedchars = "";
      Result = false;
      AmPm.set(0);
      MSecPending = false;
      TimeIndex = 0;
      for (I = 0; I <= 3; I++) TimeValues.get()[I] = 0;
      Cur = 1;
      while ((Cur < Len) && (S.charAt(Cur - 1) === " ")) Cur += 1;
      Offset = Cur;
      if (((Cur > (Len - 1)) || (S.charAt(Cur - 1) === separator)) || (S.charAt(Cur - 1) === $mod.DecimalSeparator)) {
        return Result;
      };
      DigitPending = pas.System.Pos(S.charAt(Cur - 1),Digits$1) > 0;
      while (Cur <= Len) {
        CurChar = S.charAt(Cur - 1);
        if (pas.System.Pos(CurChar,Digits$1) > 0) {
          if (!DigitPending || (TimeIndex > 3)) {
            return Result;
          };
          Offset = Cur;
          if (CurChar !== "0") {
            FirstSignificantDigit = Offset}
           else FirstSignificantDigit = -1;
          while ((Cur < Len) && (pas.System.Pos(S.charAt((Cur + 1) - 1),Digits$1) > 0)) {
            if ((FirstSignificantDigit === -1) && (S.charAt(Cur - 1) !== "0")) FirstSignificantDigit = Cur;
            Cur += 1;
          };
          if (FirstSignificantDigit === -1) FirstSignificantDigit = Cur;
          ElemLen = (1 + Cur) - FirstSignificantDigit;
          if ((ElemLen <= 2) || ((ElemLen <= 3) && (TimeIndex === 3))) {
            pas.System.val$5(pas.System.Copy(S,FirstSignificantDigit,ElemLen),{get: function () {
                return Value;
              }, set: function (v) {
                Value = v;
              }},{get: function () {
                return Err;
              }, set: function (v) {
                Err = v;
              }});
            TimeValues.get()[TimeIndex] = Value;
            TimeIndex += 1;
            DigitPending = false;
          } else {
            return Result;
          };
        } else if (CurChar === " ") {}
        else if (CurChar === separator) {
          if (DigitPending || (TimeIndex > 2)) {
            return Result;
          };
          DigitPending = true;
          MSecPending = false;
        } else if (CurChar === $mod.DecimalSeparator) {
          if ((DigitPending || MSecPending) || (TimeIndex !== 3)) {
            return Result;
          };
          DigitPending = true;
          MSecPending = true;
        } else {
          if ((AmPm.get() !== 0) || DigitPending) {
            return Result;
          };
          Offset = Cur;
          allowedchars = $mod.DecimalSeparator + " ";
          if (separator !== "\x00") allowedchars = allowedchars + separator;
          while (((Cur < (Len - 1)) && (pas.System.Pos(S.charAt((Cur + 1) - 1),allowedchars) === 0)) && (pas.System.Pos(S.charAt((Cur + 1) - 1),Digits$1) === 0)) Cur += 1;
          ElemLen = (1 + Cur) - Offset;
          AmPmStr = pas.System.Copy(S,1 + Offset,ElemLen);
          if ($mod.CompareText(AmPmStr,$mod.TimeAMString) === 0) {
            AmPm.set(1)}
           else if ($mod.CompareText(AmPmStr,$mod.TimePMString) === 0) {
            AmPm.set(2)}
           else if ($mod.CompareText(AmPmStr,"AM") === 0) {
            AmPm.set(1)}
           else if ($mod.CompareText(AmPmStr,"PM") === 0) {
            AmPm.set(2)}
           else {
            return Result;
          };
          if (TimeIndex === 0) {
            DigitPending = true;
          } else {
            TimeIndex = 3 + 1;
            DigitPending = false;
          };
        };
        Cur += 1;
      };
      if (((TimeIndex === 0) || ((AmPm.get() !== 0) && ((TimeValues.get()[0] > 12) || (TimeValues.get()[0] === 0)))) || DigitPending) return Result;
      Result = true;
      return Result;
    };
    TimeValues = rtl.arraySetLength(TimeValues,0,4);
    if (separator === "\x00") if ($mod.TimeSeparator !== "\x00") {
      separator = $mod.TimeSeparator}
     else separator = ":";
    AmPm = 0;
    if (!SplitElements({get: function () {
        return TimeValues;
      }, set: function (v) {
        TimeValues = v;
      }},{get: function () {
        return AmPm;
      }, set: function (v) {
        AmPm = v;
      }})) {
      ErrorMsg.set($mod.Format(pas.RTLConsts.SErrInvalidTimeFormat,[S]));
      return Result;
    };
    if ((AmPm === 2) && (TimeValues[0] !== 12)) {
      TimeValues[0] += 12}
     else if ((AmPm === 1) && (TimeValues[0] === 12)) TimeValues[0] = 0;
    if (!$mod.TryEncodeTime(TimeValues[0],TimeValues[1],TimeValues[2],TimeValues[3],{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) ErrorMsg.set($mod.Format(pas.RTLConsts.SErrInvalidTimeFormat,[S]));
    return Result;
  };
  var WhiteSpace$1 = "\t\n\r ";
  $impl.SplitDateTimeStr = function (DateTimeStr, DateStr, TimeStr) {
    var Result = 0;
    var p = 0;
    var DummyDT = 0.0;
    Result = 0;
    DateStr.set("");
    TimeStr.set("");
    DateTimeStr = $mod.Trim(DateTimeStr);
    if (DateTimeStr.length === 0) return Result;
    if ((($mod.DateSeparator === " ") && ($mod.TimeSeparator === " ")) && (pas.System.Pos(" ",DateTimeStr) > 0)) {
      DateStr.set(DateTimeStr);
      return 1;
    };
    p = 1;
    if ($mod.DateSeparator !== " ") {
      while ((p < DateTimeStr.length) && !(pas.System.Pos(DateTimeStr.charAt((p + 1) - 1),WhiteSpace$1) > 0)) p += 1;
    } else {
      p = pas.System.Pos($mod.TimeSeparator,DateTimeStr);
      if (p !== 0) do {
        p -= 1;
      } while (!((p === 0) || (pas.System.Pos(DateTimeStr.charAt(p - 1),WhiteSpace$1) > 0)));
    };
    if (p === 0) p = DateTimeStr.length;
    DateStr.set(pas.System.Copy(DateTimeStr,1,p));
    TimeStr.set($mod.Trim(pas.System.Copy(DateTimeStr,p + 1,100)));
    if (TimeStr.get().length !== 0) {
      Result = 2}
     else {
      Result = 1;
      if ((($mod.DateSeparator !== $mod.TimeSeparator) && (pas.System.Pos($mod.TimeSeparator,DateStr.get()) > 0)) || (($mod.DateSeparator === $mod.TimeSeparator) && !$mod.TryStrToDate(DateStr.get(),{get: function () {
          return DummyDT;
        }, set: function (v) {
          DummyDT = v;
        }}))) {
        TimeStr.set(DateStr.get());
        DateStr.set("");
      };
    };
    return Result;
  };
});
rtl.module("Classes",["System","RTLConsts","Types","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $mod.$rtti.$MethodVar("TNotifyEvent",{procsig: rtl.newTIProcSig([["Sender",pas.System.$rtti["TObject"]]]), methodkind: 0});
  this.TFPObservedOperation = {"0": "ooChange", ooChange: 0, "1": "ooFree", ooFree: 1, "2": "ooAddItem", ooAddItem: 2, "3": "ooDeleteItem", ooDeleteItem: 3, "4": "ooCustom", ooCustom: 4};
  $mod.$rtti.$Enum("TFPObservedOperation",{minvalue: 0, maxvalue: 4, ordtype: 1, enumtype: this.TFPObservedOperation});
  rtl.createClass($mod,"EListError",pas.SysUtils.Exception,function () {
  });
  rtl.createClass($mod,"EStringListError",$mod.EListError,function () {
  });
  rtl.createClass($mod,"EComponentError",pas.SysUtils.Exception,function () {
  });
  this.TListAssignOp = {"0": "laCopy", laCopy: 0, "1": "laAnd", laAnd: 1, "2": "laOr", laOr: 2, "3": "laXor", laXor: 3, "4": "laSrcUnique", laSrcUnique: 4, "5": "laDestUnique", laDestUnique: 5};
  $mod.$rtti.$Enum("TListAssignOp",{minvalue: 0, maxvalue: 5, ordtype: 1, enumtype: this.TListAssignOp});
  $mod.$rtti.$ProcVar("TListSortCompare",{procsig: rtl.newTIProcSig([["Item1",rtl.jsvalue],["Item2",rtl.jsvalue]],rtl.longint)});
  this.TAlignment = {"0": "taLeftJustify", taLeftJustify: 0, "1": "taRightJustify", taRightJustify: 1, "2": "taCenter", taCenter: 2};
  $mod.$rtti.$Enum("TAlignment",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TAlignment});
  $mod.$rtti.$Class("TFPList");
  rtl.createClass($mod,"TFPListEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
      this.FPosition = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AList) {
      pas.System.TObject.Create.call(this);
      this.FList = AList;
      this.FPosition = -1;
    };
    this.GetCurrent = function () {
      var Result = undefined;
      Result = this.FList.Get(this.FPosition);
      return Result;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FList.FCount;
      return Result;
    };
  });
  rtl.createClass($mod,"TFPList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = [];
      this.FCount = 0;
      this.FCapacity = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.CopyMove = function (aList) {
      var r = 0;
      this.Clear();
      for (var $l1 = 0, $end2 = aList.FCount - 1; $l1 <= $end2; $l1++) {
        r = $l1;
        this.Add(aList.Get(r));
      };
    };
    this.MergeMove = function (aList) {
      var r = 0;
      for (var $l1 = 0, $end2 = aList.FCount - 1; $l1 <= $end2; $l1++) {
        r = $l1;
        if (this.IndexOf(aList.Get(r)) < 0) this.Add(aList.Get(r));
      };
    };
    this.DoCopy = function (ListA, ListB) {
      if (ListB != null) {
        this.CopyMove(ListB)}
       else this.CopyMove(ListA);
    };
    this.DoSrcUnique = function (ListA, ListB) {
      var r = 0;
      if (ListB != null) {
        this.Clear();
        for (var $l1 = 0, $end2 = ListA.FCount - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (ListB.IndexOf(ListA.Get(r)) < 0) this.Add(ListA.Get(r));
        };
      } else {
        for (var $l3 = this.FCount - 1; $l3 >= 0; $l3--) {
          r = $l3;
          if (ListA.IndexOf(this.Get(r)) >= 0) this.Delete(r);
        };
      };
    };
    this.DoAnd = function (ListA, ListB) {
      var r = 0;
      if (ListB != null) {
        this.Clear();
        for (var $l1 = 0, $end2 = ListA.FCount - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (ListB.IndexOf(ListA.Get(r)) >= 0) this.Add(ListA.Get(r));
        };
      } else {
        for (var $l3 = this.FCount - 1; $l3 >= 0; $l3--) {
          r = $l3;
          if (ListA.IndexOf(this.Get(r)) < 0) this.Delete(r);
        };
      };
    };
    this.DoDestUnique = function (ListA, ListB) {
      var Self = this;
      function MoveElements(Src, Dest) {
        var r = 0;
        Self.Clear();
        for (var $l1 = 0, $end2 = Src.FCount - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (Dest.IndexOf(Src.Get(r)) < 0) Self.Add(Src.Get(r));
        };
      };
      var Dest = null;
      if (ListB != null) {
        MoveElements(ListB,ListA)}
       else Dest = $mod.TFPList.$create("Create");
      try {
        Dest.CopyMove(Self);
        MoveElements(ListA,Dest);
      } finally {
        Dest.$destroy("Destroy");
      };
    };
    this.DoOr = function (ListA, ListB) {
      if (ListB != null) {
        this.CopyMove(ListA);
        this.MergeMove(ListB);
      } else this.MergeMove(ListA);
    };
    this.DoXOr = function (ListA, ListB) {
      var r = 0;
      var l = null;
      if (ListB != null) {
        this.Clear();
        for (var $l1 = 0, $end2 = ListA.FCount - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (ListB.IndexOf(ListA.Get(r)) < 0) this.Add(ListA.Get(r));
        };
        for (var $l3 = 0, $end4 = ListB.FCount - 1; $l3 <= $end4; $l3++) {
          r = $l3;
          if (ListA.IndexOf(ListB.Get(r)) < 0) this.Add(ListB.Get(r));
        };
      } else {
        l = $mod.TFPList.$create("Create");
        try {
          l.CopyMove(this);
          for (var $l5 = this.FCount - 1; $l5 >= 0; $l5--) {
            r = $l5;
            if (ListA.IndexOf(this.Get(r)) >= 0) this.Delete(r);
          };
          for (var $l6 = 0, $end7 = ListA.FCount - 1; $l6 <= $end7; $l6++) {
            r = $l6;
            if (l.IndexOf(ListA.Get(r)) < 0) this.Add(ListA.Get(r));
          };
        } finally {
          l.$destroy("Destroy");
        };
      };
    };
    this.Get = function (Index) {
      var Result = undefined;
      if ((Index < 0) || (Index >= this.FCount)) this.RaiseIndexError(Index);
      Result = this.FList[Index];
      return Result;
    };
    this.Put = function (Index, Item) {
      if ((Index < 0) || (Index >= this.FCount)) this.RaiseIndexError(Index);
      this.FList[Index] = Item;
    };
    this.SetCapacity = function (NewCapacity) {
      if (NewCapacity < this.FCount) this.$class.error(pas.RTLConsts.SListCapacityError,"" + NewCapacity);
      if (NewCapacity === this.FCapacity) return;
      this.FList = rtl.arraySetLength(this.FList,undefined,NewCapacity);
      this.FCapacity = NewCapacity;
    };
    this.SetCount = function (NewCount) {
      if (NewCount < 0) this.$class.error(pas.RTLConsts.SListCountError,"" + NewCount);
      if (NewCount > this.FCount) {
        if (NewCount > this.FCapacity) this.SetCapacity(NewCount);
      };
      this.FCount = NewCount;
    };
    this.RaiseIndexError = function (Index) {
      this.$class.error(pas.RTLConsts.SListIndexError,"" + Index);
    };
    this.Destroy = function () {
      this.Clear();
      pas.System.TObject.Destroy.call(this);
    };
    this.AddList = function (AList) {
      var I = 0;
      if (this.FCapacity < (this.FCount + AList.FCount)) this.SetCapacity(this.FCount + AList.FCount);
      for (var $l1 = 0, $end2 = AList.FCount - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        this.Add(AList.Get(I));
      };
    };
    this.Add = function (Item) {
      var Result = 0;
      if (this.FCount === this.FCapacity) this.Expand();
      this.FList[this.FCount] = Item;
      Result = this.FCount;
      this.FCount += 1;
      return Result;
    };
    this.Clear = function () {
      if (rtl.length(this.FList) > 0) {
        this.SetCount(0);
        this.SetCapacity(0);
      };
    };
    this.Delete = function (Index) {
      if ((Index < 0) || (Index >= this.FCount)) this.$class.error(pas.RTLConsts.SListIndexError,"" + Index);
      this.FCount = this.FCount - 1;
      this.FList.splice(Index,1);
      this.FCapacity -= 1;
    };
    this.error = function (Msg, Data) {
      throw $mod.EListError.$create("CreateFmt",[Msg,[Data]]);
    };
    this.Exchange = function (Index1, Index2) {
      var Temp = undefined;
      if ((Index1 >= this.FCount) || (Index1 < 0)) this.$class.error(pas.RTLConsts.SListIndexError,"" + Index1);
      if ((Index2 >= this.FCount) || (Index2 < 0)) this.$class.error(pas.RTLConsts.SListIndexError,"" + Index2);
      Temp = this.FList[Index1];
      this.FList[Index1] = this.FList[Index2];
      this.FList[Index2] = Temp;
    };
    this.Expand = function () {
      var Result = null;
      var IncSize = 0;
      if (this.FCount < this.FCapacity) return this;
      IncSize = 4;
      if (this.FCapacity > 3) IncSize = IncSize + 4;
      if (this.FCapacity > 8) IncSize = IncSize + 8;
      if (this.FCapacity > 127) IncSize += this.FCapacity >>> 2;
      this.SetCapacity(this.FCapacity + IncSize);
      Result = this;
      return Result;
    };
    this.Extract = function (Item) {
      var Result = undefined;
      var i = 0;
      i = this.IndexOf(Item);
      if (i >= 0) {
        Result = Item;
        this.Delete(i);
      } else Result = null;
      return Result;
    };
    this.First = function () {
      var Result = undefined;
      if (this.FCount === 0) {
        Result = null}
       else Result = this.Get(0);
      return Result;
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TFPListEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.IndexOf = function (Item) {
      var Result = 0;
      var C = 0;
      Result = 0;
      C = this.FCount;
      while ((Result < C) && (this.FList[Result] != Item)) Result += 1;
      if (Result >= C) Result = -1;
      return Result;
    };
    this.IndexOfItem = function (Item, Direction) {
      var Result = 0;
      if (Direction === pas.Types.TDirection.FromBeginning) {
        Result = this.IndexOf(Item)}
       else {
        Result = this.FCount - 1;
        while ((Result >= 0) && (this.FList[Result] != Item)) Result = Result - 1;
      };
      return Result;
    };
    this.Insert = function (Index, Item) {
      if ((Index < 0) || (Index > this.FCount)) this.$class.error(pas.RTLConsts.SListIndexError,"" + Index);
      this.FList.splice(Index,0,Item);
      this.FCapacity += 1;
      this.FCount += 1;
    };
    this.Last = function () {
      var Result = undefined;
      if (this.FCount === 0) {
        Result = null}
       else Result = this.Get(this.FCount - 1);
      return Result;
    };
    this.Move = function (CurIndex, NewIndex) {
      var Temp = undefined;
      if ((CurIndex < 0) || (CurIndex > (this.FCount - 1))) this.$class.error(pas.RTLConsts.SListIndexError,"" + CurIndex);
      if ((NewIndex < 0) || (NewIndex > (this.FCount - 1))) this.$class.error(pas.RTLConsts.SListIndexError,"" + NewIndex);
      if (CurIndex === NewIndex) return;
      Temp = this.FList[CurIndex];
      this.FList.splice(CurIndex,1);
      this.FList.splice(NewIndex,0,Temp);
    };
    this.Assign = function (ListA, AOperator, ListB) {
      var $tmp1 = AOperator;
      if ($tmp1 === $mod.TListAssignOp.laCopy) {
        this.DoCopy(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laSrcUnique) {
        this.DoSrcUnique(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laAnd) {
        this.DoAnd(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laDestUnique) {
        this.DoDestUnique(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laOr) {
        this.DoOr(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laXor) this.DoXOr(ListA,ListB);
    };
    this.Remove = function (Item) {
      var Result = 0;
      Result = this.IndexOf(Item);
      if (Result !== -1) this.Delete(Result);
      return Result;
    };
    this.Pack = function () {
      var Dst = 0;
      var i = 0;
      var V = undefined;
      Dst = 0;
      for (var $l1 = 0, $end2 = this.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        V = this.FList[i];
        if (!pas.System.Assigned(V)) continue;
        this.FList[Dst] = V;
        Dst += 1;
      };
    };
    this.Sort = function (Compare) {
      if (!(rtl.length(this.FList) > 0) || (this.FCount < 2)) return;
      $impl.QuickSort(this.FList,0,this.FCount - 1,Compare);
    };
    this.ForEachCall = function (proc2call, arg) {
      var i = 0;
      var v = undefined;
      for (var $l1 = 0, $end2 = this.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        v = this.FList[i];
        if (pas.System.Assigned(v)) proc2call(v,arg);
      };
    };
    this.ForEachCall$1 = function (proc2call, arg) {
      var i = 0;
      var v = undefined;
      for (var $l1 = 0, $end2 = this.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        v = this.FList[i];
        if (pas.System.Assigned(v)) proc2call(v,arg);
      };
    };
  });
  this.TListNotification = {"0": "lnAdded", lnAdded: 0, "1": "lnExtracted", lnExtracted: 1, "2": "lnDeleted", lnDeleted: 2};
  $mod.$rtti.$Enum("TListNotification",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TListNotification});
  $mod.$rtti.$Class("TList");
  rtl.createClass($mod,"TListEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
      this.FPosition = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AList) {
      pas.System.TObject.Create.call(this);
      this.FList = AList;
      this.FPosition = -1;
    };
    this.GetCurrent = function () {
      var Result = undefined;
      Result = this.FList.Get(this.FPosition);
      return Result;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FList.GetCount();
      return Result;
    };
  });
  rtl.createClass($mod,"TList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.CopyMove = function (aList) {
      var r = 0;
      this.Clear();
      for (var $l1 = 0, $end2 = aList.GetCount() - 1; $l1 <= $end2; $l1++) {
        r = $l1;
        this.Add(aList.Get(r));
      };
    };
    this.MergeMove = function (aList) {
      var r = 0;
      for (var $l1 = 0, $end2 = aList.GetCount() - 1; $l1 <= $end2; $l1++) {
        r = $l1;
        if (this.IndexOf(aList.Get(r)) < 0) this.Add(aList.Get(r));
      };
    };
    this.DoCopy = function (ListA, ListB) {
      if (ListB != null) {
        this.CopyMove(ListB)}
       else this.CopyMove(ListA);
    };
    this.DoSrcUnique = function (ListA, ListB) {
      var r = 0;
      if (ListB != null) {
        this.Clear();
        for (var $l1 = 0, $end2 = ListA.GetCount() - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (ListB.IndexOf(ListA.Get(r)) < 0) this.Add(ListA.Get(r));
        };
      } else {
        for (var $l3 = this.GetCount() - 1; $l3 >= 0; $l3--) {
          r = $l3;
          if (ListA.IndexOf(this.Get(r)) >= 0) this.Delete(r);
        };
      };
    };
    this.DoAnd = function (ListA, ListB) {
      var r = 0;
      if (ListB != null) {
        this.Clear();
        for (var $l1 = 0, $end2 = ListA.GetCount() - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (ListB.IndexOf(ListA.Get(r)) >= 0) this.Add(ListA.Get(r));
        };
      } else {
        for (var $l3 = this.GetCount() - 1; $l3 >= 0; $l3--) {
          r = $l3;
          if (ListA.IndexOf(this.Get(r)) < 0) this.Delete(r);
        };
      };
    };
    this.DoDestUnique = function (ListA, ListB) {
      var Self = this;
      function MoveElements(Src, Dest) {
        var r = 0;
        Self.Clear();
        for (var $l1 = 0, $end2 = Src.GetCount() - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (Dest.IndexOf(Src.Get(r)) < 0) Self.Add(Src.Get(r));
        };
      };
      var Dest = null;
      if (ListB != null) {
        MoveElements(ListB,ListA)}
       else try {
        Dest = $mod.TList.$create("Create$1");
        Dest.CopyMove(Self);
        MoveElements(ListA,Dest);
      } finally {
        Dest.$destroy("Destroy");
      };
    };
    this.DoOr = function (ListA, ListB) {
      if (ListB != null) {
        this.CopyMove(ListA);
        this.MergeMove(ListB);
      } else this.MergeMove(ListA);
    };
    this.DoXOr = function (ListA, ListB) {
      var r = 0;
      var l = null;
      if (ListB != null) {
        this.Clear();
        for (var $l1 = 0, $end2 = ListA.GetCount() - 1; $l1 <= $end2; $l1++) {
          r = $l1;
          if (ListB.IndexOf(ListA.Get(r)) < 0) this.Add(ListA.Get(r));
        };
        for (var $l3 = 0, $end4 = ListB.GetCount() - 1; $l3 <= $end4; $l3++) {
          r = $l3;
          if (ListA.IndexOf(ListB.Get(r)) < 0) this.Add(ListB.Get(r));
        };
      } else try {
        l = $mod.TList.$create("Create$1");
        l.CopyMove(this);
        for (var $l5 = this.GetCount() - 1; $l5 >= 0; $l5--) {
          r = $l5;
          if (ListA.IndexOf(this.Get(r)) >= 0) this.Delete(r);
        };
        for (var $l6 = 0, $end7 = ListA.GetCount() - 1; $l6 <= $end7; $l6++) {
          r = $l6;
          if (l.IndexOf(ListA.Get(r)) < 0) this.Add(ListA.Get(r));
        };
      } finally {
        l.$destroy("Destroy");
      };
    };
    this.Get = function (Index) {
      var Result = undefined;
      Result = this.FList.Get(Index);
      return Result;
    };
    this.Put = function (Index, Item) {
      var V = undefined;
      V = this.Get(Index);
      this.FList.Put(Index,Item);
      if (pas.System.Assigned(V)) this.Notify(V,$mod.TListNotification.lnDeleted);
      if (pas.System.Assigned(Item)) this.Notify(Item,$mod.TListNotification.lnAdded);
    };
    this.Notify = function (aValue, Action) {
      if (pas.System.Assigned(aValue)) ;
      if (Action === $mod.TListNotification.lnExtracted) ;
    };
    this.SetCapacity = function (NewCapacity) {
      this.FList.SetCapacity(NewCapacity);
    };
    this.GetCapacity = function () {
      var Result = 0;
      Result = this.FList.FCapacity;
      return Result;
    };
    this.SetCount = function (NewCount) {
      if (NewCount < this.FList.FCount) {
        while (this.FList.FCount > NewCount) this.Delete(this.FList.FCount - 1)}
       else this.FList.SetCount(NewCount);
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FList.FCount;
      return Result;
    };
    this.GetList = function () {
      var Result = [];
      Result = this.FList.FList;
      return Result;
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.FList = $mod.TFPList.$create("Create");
    };
    this.Destroy = function () {
      if (this.FList != null) this.Clear();
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FList;
        }, set: function (v) {
          this.p.FList = v;
        }});
    };
    this.AddList = function (AList) {
      var I = 0;
      this.FList.AddList(AList.FList);
      for (var $l1 = 0, $end2 = AList.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        if (pas.System.Assigned(AList.Get(I))) this.Notify(AList.Get(I),$mod.TListNotification.lnAdded);
      };
    };
    this.Add = function (Item) {
      var Result = 0;
      Result = this.FList.Add(Item);
      if (pas.System.Assigned(Item)) this.Notify(Item,$mod.TListNotification.lnAdded);
      return Result;
    };
    this.Clear = function () {
      while (this.FList.FCount > 0) this.Delete(this.GetCount() - 1);
    };
    this.Delete = function (Index) {
      var V = undefined;
      V = this.FList.Get(Index);
      this.FList.Delete(Index);
      if (pas.System.Assigned(V)) this.Notify(V,$mod.TListNotification.lnDeleted);
    };
    this.error = function (Msg, Data) {
      throw $mod.EListError.$create("CreateFmt",[Msg,[Data]]);
    };
    this.Exchange = function (Index1, Index2) {
      this.FList.Exchange(Index1,Index2);
    };
    this.Expand = function () {
      var Result = null;
      this.FList.Expand();
      Result = this;
      return Result;
    };
    this.Extract = function (Item) {
      var Result = undefined;
      var c = 0;
      c = this.FList.FCount;
      Result = this.FList.Extract(Item);
      if (c !== this.FList.FCount) this.Notify(Result,$mod.TListNotification.lnExtracted);
      return Result;
    };
    this.First = function () {
      var Result = undefined;
      Result = this.FList.First();
      return Result;
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TListEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.IndexOf = function (Item) {
      var Result = 0;
      Result = this.FList.IndexOf(Item);
      return Result;
    };
    this.Insert = function (Index, Item) {
      this.FList.Insert(Index,Item);
      if (pas.System.Assigned(Item)) this.Notify(Item,$mod.TListNotification.lnAdded);
    };
    this.Last = function () {
      var Result = undefined;
      Result = this.FList.Last();
      return Result;
    };
    this.Move = function (CurIndex, NewIndex) {
      this.FList.Move(CurIndex,NewIndex);
    };
    this.Assign = function (ListA, AOperator, ListB) {
      var $tmp1 = AOperator;
      if ($tmp1 === $mod.TListAssignOp.laCopy) {
        this.DoCopy(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laSrcUnique) {
        this.DoSrcUnique(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laAnd) {
        this.DoAnd(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laDestUnique) {
        this.DoDestUnique(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laOr) {
        this.DoOr(ListA,ListB)}
       else if ($tmp1 === $mod.TListAssignOp.laXor) this.DoXOr(ListA,ListB);
    };
    this.Remove = function (Item) {
      var Result = 0;
      Result = this.IndexOf(Item);
      if (Result !== -1) this.Delete(Result);
      return Result;
    };
    this.Pack = function () {
      this.FList.Pack();
    };
    this.Sort = function (Compare) {
      this.FList.Sort(Compare);
    };
  });
  rtl.createClass($mod,"TPersistent",pas.System.TObject,function () {
    this.AssignError = function (Source) {
      var SourceName = "";
      if (Source !== null) {
        SourceName = Source.$classname}
       else SourceName = "Nil";
      throw pas.SysUtils.EConvertError.$create("Create$1",[((("Cannot assign a " + SourceName) + " to a ") + this.$classname) + "."]);
    };
    this.AssignTo = function (Dest) {
      Dest.AssignError(this);
    };
    this.GetOwner = function () {
      var Result = null;
      Result = null;
      return Result;
    };
    this.Assign = function (Source) {
      if (Source !== null) {
        Source.AssignTo(this)}
       else this.AssignError(null);
    };
    this.GetNamePath = function () {
      var Result = "";
      var OwnerName = "";
      var TheOwner = null;
      Result = this.$classname;
      TheOwner = this.GetOwner();
      if (TheOwner !== null) {
        OwnerName = TheOwner.GetNamePath();
        if (OwnerName !== "") Result = (OwnerName + ".") + Result;
      };
      return Result;
    };
  });
  $mod.$rtti.$ClassRef("TPersistentClass",{instancetype: $mod.$rtti["TPersistent"]});
  rtl.createClass($mod,"TInterfacedPersistent",$mod.TPersistent,function () {
    this.$init = function () {
      $mod.TPersistent.$init.call(this);
      this.FOwnerInterface = null;
    };
    this.$final = function () {
      this.FOwnerInterface = undefined;
      $mod.TPersistent.$final.call(this);
    };
    this._AddRef = function () {
      var Result = 0;
      Result = -1;
      if (this.FOwnerInterface != null) Result = this.FOwnerInterface._AddRef();
      return Result;
    };
    this._Release = function () {
      var Result = 0;
      Result = -1;
      if (this.FOwnerInterface != null) Result = this.FOwnerInterface._Release();
      return Result;
    };
    this.QueryInterface = function (IID, Obj) {
      var Result = 0;
      Result = -2147467262;
      if (this.GetInterface(IID,Obj)) Result = 0;
      return Result;
    };
    this.AfterConstruction = function () {
      try {
        pas.System.TObject.AfterConstruction.call(this);
        if (this.GetOwner() !== null) this.GetOwner().GetInterface(rtl.getIntfGUIDR(pas.System.IUnknown),{p: this, get: function () {
            return this.p.FOwnerInterface;
          }, set: function (v) {
            this.p.FOwnerInterface = v;
          }});
      } finally {
        rtl._Release(this.FOwnerInterface);
      };
    };
    this.$intfmaps = {};
    rtl.addIntf(this,pas.System.IUnknown);
  });
  $mod.$rtti.$Class("TStrings");
  rtl.createClass($mod,"TStringsEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FStrings = null;
      this.FPosition = 0;
    };
    this.$final = function () {
      this.FStrings = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AStrings) {
      pas.System.TObject.Create.call(this);
      this.FStrings = AStrings;
      this.FPosition = -1;
    };
    this.GetCurrent = function () {
      var Result = "";
      Result = this.FStrings.Get(this.FPosition);
      return Result;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FStrings.GetCount();
      return Result;
    };
  });
  rtl.createClass($mod,"TStrings",$mod.TPersistent,function () {
    this.$init = function () {
      $mod.TPersistent.$init.call(this);
      this.FSpecialCharsInited = false;
      this.FAlwaysQuote = false;
      this.FQuoteChar = "";
      this.FDelimiter = "";
      this.FNameValueSeparator = "";
      this.FUpdateCount = 0;
      this.FLBS = 0;
      this.FSkipLastLineBreak = false;
      this.FStrictDelimiter = false;
      this.FLineBreak = "";
    };
    this.GetCommaText = function () {
      var Result = "";
      var C1 = "";
      var C2 = "";
      var FSD = false;
      this.CheckSpecialChars();
      FSD = this.FStrictDelimiter;
      C1 = this.GetDelimiter();
      C2 = this.GetQuoteChar();
      this.SetDelimiter(",");
      this.SetQuoteChar('"');
      this.FStrictDelimiter = false;
      try {
        Result = this.GetDelimitedText();
      } finally {
        this.SetDelimiter(C1);
        this.SetQuoteChar(C2);
        this.FStrictDelimiter = FSD;
      };
      return Result;
    };
    this.GetName = function (Index) {
      var Result = "";
      var V = "";
      this.GetNameValue(Index,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},{get: function () {
          return V;
        }, set: function (v) {
          V = v;
        }});
      return Result;
    };
    this.GetValue = function (Name) {
      var Result = "";
      var L = 0;
      var N = "";
      Result = "";
      L = this.IndexOfName(Name);
      if (L !== -1) this.GetNameValue(L,{get: function () {
          return N;
        }, set: function (v) {
          N = v;
        }},{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }});
      return Result;
    };
    this.GetLBS = function () {
      var Result = 0;
      this.CheckSpecialChars();
      Result = this.FLBS;
      return Result;
    };
    this.SetLBS = function (AValue) {
      this.CheckSpecialChars();
      this.FLBS = AValue;
    };
    this.SetCommaText = function (Value) {
      var C1 = "";
      var C2 = "";
      this.CheckSpecialChars();
      C1 = this.GetDelimiter();
      C2 = this.GetQuoteChar();
      this.SetDelimiter(",");
      this.SetQuoteChar('"');
      try {
        this.SetDelimitedText(Value);
      } finally {
        this.SetDelimiter(C1);
        this.SetQuoteChar(C2);
      };
    };
    this.SetValue = function (Name, Value) {
      var L = 0;
      this.CheckSpecialChars();
      L = this.IndexOfName(Name);
      if (L === -1) {
        this.Add((Name + this.FNameValueSeparator) + Value)}
       else this.Put(L,(Name + this.FNameValueSeparator) + Value);
    };
    this.SetDelimiter = function (c) {
      this.CheckSpecialChars();
      this.FDelimiter = c;
    };
    this.SetQuoteChar = function (c) {
      this.CheckSpecialChars();
      this.FQuoteChar = c;
    };
    this.SetNameValueSeparator = function (c) {
      this.CheckSpecialChars();
      this.FNameValueSeparator = c;
    };
    this.DoSetTextStr = function (Value, DoClear) {
      var S = "";
      var P = 0;
      try {
        this.BeginUpdate();
        if (DoClear) this.Clear();
        P = 1;
        while (this.GetNextLinebreak(Value,{get: function () {
            return S;
          }, set: function (v) {
            S = v;
          }},{get: function () {
            return P;
          }, set: function (v) {
            P = v;
          }})) this.Add(S);
      } finally {
        this.EndUpdate();
      };
    };
    this.GetDelimiter = function () {
      var Result = "";
      this.CheckSpecialChars();
      Result = this.FDelimiter;
      return Result;
    };
    this.GetNameValueSeparator = function () {
      var Result = "";
      this.CheckSpecialChars();
      Result = this.FNameValueSeparator;
      return Result;
    };
    this.GetQuoteChar = function () {
      var Result = "";
      this.CheckSpecialChars();
      Result = this.FQuoteChar;
      return Result;
    };
    this.GetLineBreak = function () {
      var Result = "";
      this.CheckSpecialChars();
      Result = this.FLineBreak;
      return Result;
    };
    this.SetLineBreak = function (S) {
      this.CheckSpecialChars();
      this.FLineBreak = S;
    };
    this.GetSkipLastLineBreak = function () {
      var Result = false;
      this.CheckSpecialChars();
      Result = this.FSkipLastLineBreak;
      return Result;
    };
    this.SetSkipLastLineBreak = function (AValue) {
      this.CheckSpecialChars();
      this.FSkipLastLineBreak = AValue;
    };
    this.error = function (Msg, Data) {
      throw $mod.EStringListError.$create("CreateFmt",[Msg,[pas.SysUtils.IntToStr(Data)]]);
    };
    this.GetCapacity = function () {
      var Result = 0;
      Result = this.GetCount();
      return Result;
    };
    this.GetObject = function (Index) {
      var Result = null;
      if (Index === 0) ;
      Result = null;
      return Result;
    };
    this.GetTextStr = function () {
      var Result = "";
      var I = 0;
      var S = "";
      var NL = "";
      this.CheckSpecialChars();
      if (this.FLineBreak !== pas.System.sLineBreak) {
        NL = this.FLineBreak}
       else {
        var $tmp1 = this.FLBS;
        if ($tmp1 === pas.System.TTextLineBreakStyle.tlbsLF) {
          NL = "\n"}
         else if ($tmp1 === pas.System.TTextLineBreakStyle.tlbsCRLF) {
          NL = "\r\n"}
         else if ($tmp1 === pas.System.TTextLineBreakStyle.tlbsCR) NL = "\r";
      };
      Result = "";
      for (var $l2 = 0, $end3 = this.GetCount() - 1; $l2 <= $end3; $l2++) {
        I = $l2;
        S = this.Get(I);
        Result = Result + S;
        if ((I < (this.GetCount() - 1)) || !this.GetSkipLastLineBreak()) Result = Result + NL;
      };
      return Result;
    };
    this.Put = function (Index, S) {
      var Obj = null;
      Obj = this.GetObject(Index);
      this.Delete(Index);
      this.InsertObject(Index,S,Obj);
    };
    this.PutObject = function (Index, AObject) {
      if (Index === 0) return;
      if (AObject === null) return;
    };
    this.SetCapacity = function (NewCapacity) {
      if (NewCapacity === 0) ;
    };
    this.SetTextStr = function (Value) {
      this.CheckSpecialChars();
      this.DoSetTextStr(Value,true);
    };
    this.SetUpdateState = function (Updating) {
      if (Updating) ;
    };
    this.DoCompareText = function (s1, s2) {
      var Result = 0;
      Result = pas.SysUtils.CompareText(s1,s2);
      return Result;
    };
    this.GetDelimitedText = function () {
      var Result = "";
      var I = 0;
      var RE = "";
      var S = "";
      var doQuote = false;
      this.CheckSpecialChars();
      Result = "";
      RE = (this.GetQuoteChar() + "|") + this.GetDelimiter();
      if (!this.FStrictDelimiter) RE = " |" + RE;
      RE = ("\/" + RE) + "\/";
      for (var $l1 = 0, $end2 = this.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        S = this.Get(I);
        doQuote = this.FAlwaysQuote || (S.search(RE) === -1);
        if (doQuote) {
          Result = Result + pas.SysUtils.QuoteString(S,this.GetQuoteChar())}
         else Result = Result + S;
        if (I < (this.GetCount() - 1)) Result = Result + this.GetDelimiter();
      };
      if ((Result.length === 0) && (this.GetCount() === 1)) Result = this.GetQuoteChar() + this.GetQuoteChar();
      return Result;
    };
    this.SetDelimitedText = function (AValue) {
      var i = 0;
      var j = 0;
      var aNotFirst = false;
      this.CheckSpecialChars();
      this.BeginUpdate();
      i = 1;
      j = 1;
      aNotFirst = false;
      try {
        this.Clear();
        if (this.FStrictDelimiter) {
          while (i <= AValue.length) {
            if ((aNotFirst && (i <= AValue.length)) && (AValue.charAt(i - 1) === this.FDelimiter)) i += 1;
            if (i <= AValue.length) {
              if (AValue.charAt(i - 1) === this.FQuoteChar) {
                j = i + 1;
                while ((j <= AValue.length) && ((AValue.charAt(j - 1) !== this.FQuoteChar) || (((j + 1) <= AValue.length) && (AValue.charAt((j + 1) - 1) === this.FQuoteChar)))) {
                  if ((j <= AValue.length) && (AValue.charAt(j - 1) === this.FQuoteChar)) {
                    j += 2}
                   else j += 1;
                };
                this.Add(pas.SysUtils.StringReplace(pas.System.Copy(AValue,i + 1,(j - i) - 1),this.FQuoteChar + this.FQuoteChar,this.FQuoteChar,rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll)));
                i = j + 1;
              } else {
                j = i;
                while ((j <= AValue.length) && (AValue.charAt(j - 1) !== this.FDelimiter)) j += 1;
                this.Add(pas.System.Copy(AValue,i,j - i));
                i = j;
              };
            } else {
              if (aNotFirst) this.Add("");
            };
            aNotFirst = true;
          };
        } else {
          while (i <= AValue.length) {
            if ((aNotFirst && (i <= AValue.length)) && (AValue.charAt(i - 1) === this.FDelimiter)) i += 1;
            while ((i <= AValue.length) && (AValue.charCodeAt(i - 1) <= " ".charCodeAt())) i += 1;
            if (i <= AValue.length) {
              if (AValue.charAt(i - 1) === this.FQuoteChar) {
                j = i + 1;
                while ((j <= AValue.length) && ((AValue.charAt(j - 1) !== this.FQuoteChar) || (((j + 1) <= AValue.length) && (AValue.charAt((j + 1) - 1) === this.FQuoteChar)))) {
                  if ((j <= AValue.length) && (AValue.charAt(j - 1) === this.FQuoteChar)) {
                    j += 2}
                   else j += 1;
                };
                this.Add(pas.SysUtils.StringReplace(pas.System.Copy(AValue,i + 1,(j - i) - 1),this.FQuoteChar + this.FQuoteChar,this.FQuoteChar,rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll)));
                i = j + 1;
              } else {
                j = i;
                while (((j <= AValue.length) && (AValue.charCodeAt(j - 1) > " ".charCodeAt())) && (AValue.charAt(j - 1) !== this.FDelimiter)) j += 1;
                this.Add(pas.System.Copy(AValue,i,j - i));
                i = j;
              };
            } else {
              if (aNotFirst) this.Add("");
            };
            while ((i <= AValue.length) && (AValue.charCodeAt(i - 1) <= " ".charCodeAt())) i += 1;
            aNotFirst = true;
          };
        };
      } finally {
        this.EndUpdate();
      };
    };
    this.GetValueFromIndex = function (Index) {
      var Result = "";
      var N = "";
      this.GetNameValue(Index,{get: function () {
          return N;
        }, set: function (v) {
          N = v;
        }},{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }});
      return Result;
    };
    this.SetValueFromIndex = function (Index, Value) {
      if (Value === "") {
        this.Delete(Index)}
       else {
        if (Index < 0) Index = this.Add("");
        this.CheckSpecialChars();
        this.Put(Index,(this.GetName(Index) + this.FNameValueSeparator) + Value);
      };
    };
    this.CheckSpecialChars = function () {
      if (!this.FSpecialCharsInited) {
        this.FQuoteChar = '"';
        this.FDelimiter = ",";
        this.FNameValueSeparator = "=";
        this.FLBS = pas.System.DefaultTextLineBreakStyle;
        this.FSpecialCharsInited = true;
        this.FLineBreak = pas.System.sLineBreak;
      };
    };
    this.GetNextLinebreak = function (Value, S, P) {
      var Result = false;
      var PP = 0;
      S.set("");
      Result = false;
      if ((Value.length - P.get()) < 0) return Result;
      PP = Value.indexOf(this.GetLineBreak(),P.get() - 1) + 1;
      if (PP < 1) PP = Value.length + 1;
      S.set(pas.System.Copy(Value,P.get(),PP - P.get()));
      P.set(PP + this.GetLineBreak().length);
      Result = true;
      return Result;
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.FAlwaysQuote = false;
    };
    this.Destroy = function () {
      pas.System.TObject.Destroy.call(this);
    };
    this.Add = function (S) {
      var Result = 0;
      Result = this.GetCount();
      this.Insert(this.GetCount(),S);
      return Result;
    };
    this.AddObject = function (S, AObject) {
      var Result = 0;
      Result = this.Add(S);
      this.PutObject(Result,AObject);
      return Result;
    };
    this.Append = function (S) {
      this.Add(S);
    };
    this.AddStrings = function (TheStrings) {
      var Runner = 0;
      for (var $l1 = 0, $end2 = TheStrings.GetCount() - 1; $l1 <= $end2; $l1++) {
        Runner = $l1;
        this.AddObject(TheStrings.Get(Runner),TheStrings.GetObject(Runner));
      };
    };
    this.AddStrings$1 = function (TheStrings, ClearFirst) {
      this.BeginUpdate();
      try {
        if (ClearFirst) this.Clear();
        this.AddStrings(TheStrings);
      } finally {
        this.EndUpdate();
      };
    };
    this.AddStrings$2 = function (TheStrings) {
      var Runner = 0;
      if (((this.GetCount() + (rtl.length(TheStrings) - 1)) + 1) > this.GetCapacity()) this.SetCapacity((this.GetCount() + (rtl.length(TheStrings) - 1)) + 1);
      for (var $l1 = 0, $end2 = rtl.length(TheStrings) - 1; $l1 <= $end2; $l1++) {
        Runner = $l1;
        this.Add(TheStrings[Runner]);
      };
    };
    this.AddStrings$3 = function (TheStrings, ClearFirst) {
      this.BeginUpdate();
      try {
        if (ClearFirst) this.Clear();
        this.AddStrings$2(TheStrings);
      } finally {
        this.EndUpdate();
      };
    };
    this.AddPair = function (AName, AValue) {
      var Result = null;
      Result = this.AddPair$1(AName,AValue,null);
      return Result;
    };
    this.AddPair$1 = function (AName, AValue, AObject) {
      var Result = null;
      Result = this;
      this.AddObject((AName + this.GetNameValueSeparator()) + AValue,AObject);
      return Result;
    };
    this.AddText = function (S) {
      this.CheckSpecialChars();
      this.DoSetTextStr(S,false);
    };
    this.Assign = function (Source) {
      var S = null;
      if ($mod.TStrings.isPrototypeOf(Source)) {
        S = Source;
        this.BeginUpdate();
        try {
          this.Clear();
          this.FSpecialCharsInited = S.FSpecialCharsInited;
          this.FQuoteChar = S.FQuoteChar;
          this.FDelimiter = S.FDelimiter;
          this.FNameValueSeparator = S.FNameValueSeparator;
          this.FLBS = S.FLBS;
          this.FLineBreak = S.FLineBreak;
          this.AddStrings(S);
        } finally {
          this.EndUpdate();
        };
      } else $mod.TPersistent.Assign.call(this,Source);
    };
    this.BeginUpdate = function () {
      if (this.FUpdateCount === 0) this.SetUpdateState(true);
      this.FUpdateCount += 1;
    };
    this.EndUpdate = function () {
      if (this.FUpdateCount > 0) this.FUpdateCount -= 1;
      if (this.FUpdateCount === 0) this.SetUpdateState(false);
    };
    this.Equals = function (Obj) {
      var Result = false;
      if ($mod.TStrings.isPrototypeOf(Obj)) {
        Result = this.Equals$2(Obj)}
       else Result = pas.System.TObject.Equals.call(this,Obj);
      return Result;
    };
    this.Equals$2 = function (TheStrings) {
      var Result = false;
      var Runner = 0;
      var Nr = 0;
      Result = false;
      Nr = this.GetCount();
      if (Nr !== TheStrings.GetCount()) return Result;
      for (var $l1 = 0, $end2 = Nr - 1; $l1 <= $end2; $l1++) {
        Runner = $l1;
        if (this.Get(Runner) !== TheStrings.Get(Runner)) return Result;
      };
      Result = true;
      return Result;
    };
    this.Exchange = function (Index1, Index2) {
      var Obj = null;
      var Str = "";
      this.BeginUpdate();
      try {
        Obj = this.GetObject(Index1);
        Str = this.Get(Index1);
        this.PutObject(Index1,this.GetObject(Index2));
        this.Put(Index1,this.Get(Index2));
        this.PutObject(Index2,Obj);
        this.Put(Index2,Str);
      } finally {
        this.EndUpdate();
      };
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TStringsEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.IndexOf = function (S) {
      var Result = 0;
      Result = 0;
      while ((Result < this.GetCount()) && (this.DoCompareText(this.Get(Result),S) !== 0)) Result = Result + 1;
      if (Result === this.GetCount()) Result = -1;
      return Result;
    };
    this.IndexOfName = function (Name) {
      var Result = 0;
      var len = 0;
      var S = "";
      this.CheckSpecialChars();
      Result = 0;
      while (Result < this.GetCount()) {
        S = this.Get(Result);
        len = pas.System.Pos(this.FNameValueSeparator,S) - 1;
        if ((len >= 0) && (this.DoCompareText(Name,pas.System.Copy(S,1,len)) === 0)) return Result;
        Result += 1;
      };
      Result = -1;
      return Result;
    };
    this.IndexOfObject = function (AObject) {
      var Result = 0;
      Result = 0;
      while ((Result < this.GetCount()) && (this.GetObject(Result) !== AObject)) Result = Result + 1;
      if (Result === this.GetCount()) Result = -1;
      return Result;
    };
    this.InsertObject = function (Index, S, AObject) {
      this.Insert(Index,S);
      this.PutObject(Index,AObject);
    };
    this.Move = function (CurIndex, NewIndex) {
      var Obj = null;
      var Str = "";
      this.BeginUpdate();
      try {
        Obj = this.GetObject(CurIndex);
        Str = this.Get(CurIndex);
        this.PutObject(CurIndex,null);
        this.Delete(CurIndex);
        this.InsertObject(NewIndex,Str,Obj);
      } finally {
        this.EndUpdate();
      };
    };
    this.GetNameValue = function (Index, AName, AValue) {
      var L = 0;
      this.CheckSpecialChars();
      AValue.set(this.Get(Index));
      L = pas.System.Pos(this.FNameValueSeparator,AValue.get());
      if (L !== 0) {
        AName.set(pas.System.Copy(AValue.get(),1,L - 1));
        AValue.set(pas.System.Copy(AValue.get(),L + 1,AValue.get().length - L));
      } else AName.set("");
    };
    this.ExtractName = function (S) {
      var Result = "";
      var L = 0;
      this.CheckSpecialChars();
      L = pas.System.Pos(this.FNameValueSeparator,S);
      if (L !== 0) {
        Result = pas.System.Copy(S,1,L - 1)}
       else Result = "";
      return Result;
    };
  });
  this.TStringItem = function (s) {
    if (s) {
      this.FString = s.FString;
      this.FObject = s.FObject;
    } else {
      this.FString = "";
      this.FObject = null;
    };
    this.$equal = function (b) {
      return (this.FString === b.FString) && (this.FObject === b.FObject);
    };
  };
  $mod.$rtti.$Record("TStringItem",{}).addFields("FString",rtl.string,"FObject",pas.System.$rtti["TObject"]);
  $mod.$rtti.$DynArray("TStringItemArray",{eltype: $mod.$rtti["TStringItem"]});
  $mod.$rtti.$Class("TStringList");
  $mod.$rtti.$ProcVar("TStringListSortCompare",{procsig: rtl.newTIProcSig([["List",$mod.$rtti["TStringList"]],["Index1",rtl.longint],["Index2",rtl.longint]],rtl.longint)});
  this.TStringsSortStyle = {"0": "sslNone", sslNone: 0, "1": "sslUser", sslUser: 1, "2": "sslAuto", sslAuto: 2};
  $mod.$rtti.$Enum("TStringsSortStyle",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TStringsSortStyle});
  $mod.$rtti.$Set("TStringsSortStyles",{comptype: $mod.$rtti["TStringsSortStyle"]});
  rtl.createClass($mod,"TStringList",$mod.TStrings,function () {
    this.$init = function () {
      $mod.TStrings.$init.call(this);
      this.FList = [];
      this.FCount = 0;
      this.FOnChange = null;
      this.FOnChanging = null;
      this.FDuplicates = 0;
      this.FCaseSensitive = false;
      this.FForceSort = false;
      this.FOwnsObjects = false;
      this.FSortStyle = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      this.FOnChange = undefined;
      this.FOnChanging = undefined;
      $mod.TStrings.$final.call(this);
    };
    this.ExchangeItemsInt = function (Index1, Index2) {
      var S = "";
      var O = null;
      S = this.FList[Index1].FString;
      O = this.FList[Index1].FObject;
      this.FList[Index1].FString = this.FList[Index2].FString;
      this.FList[Index1].FObject = this.FList[Index2].FObject;
      this.FList[Index2].FString = S;
      this.FList[Index2].FObject = O;
    };
    this.GetSorted = function () {
      var Result = false;
      Result = this.FSortStyle in rtl.createSet($mod.TStringsSortStyle.sslUser,$mod.TStringsSortStyle.sslAuto);
      return Result;
    };
    this.Grow = function () {
      var NC = 0;
      NC = this.GetCapacity();
      if (NC >= 256) {
        NC = NC + Math.floor(NC / 4)}
       else if (NC === 0) {
        NC = 4}
       else NC = NC * 4;
      this.SetCapacity(NC);
    };
    this.InternalClear = function (FromIndex, ClearOnly) {
      var I = 0;
      if (FromIndex < this.FCount) {
        if (this.FOwnsObjects) {
          for (var $l1 = FromIndex, $end2 = this.FCount - 1; $l1 <= $end2; $l1++) {
            I = $l1;
            this.FList[I].FString = "";
            pas.SysUtils.FreeAndNil({p: this.FList[I], get: function () {
                return this.p.FObject;
              }, set: function (v) {
                this.p.FObject = v;
              }});
          };
        } else {
          for (var $l3 = FromIndex, $end4 = this.FCount - 1; $l3 <= $end4; $l3++) {
            I = $l3;
            this.FList[I].FString = "";
          };
        };
        this.FCount = FromIndex;
      };
      if (!ClearOnly) this.SetCapacity(0);
    };
    this.QuickSort = function (L, R, CompareFn) {
      var Pivot = 0;
      var vL = 0;
      var vR = 0;
      if ((R - L) <= 1) {
        if (L < R) if (CompareFn(this,L,R) > 0) this.ExchangeItems(L,R);
        return;
      };
      vL = L;
      vR = R;
      Pivot = L + pas.System.Random(R - L);
      while (vL < vR) {
        while ((vL < Pivot) && (CompareFn(this,vL,Pivot) <= 0)) vL += 1;
        while ((vR > Pivot) && (CompareFn(this,vR,Pivot) > 0)) vR -= 1;
        this.ExchangeItems(vL,vR);
        if (Pivot === vL) {
          Pivot = vR}
         else if (Pivot === vR) Pivot = vL;
      };
      if ((Pivot - 1) >= L) this.QuickSort(L,Pivot - 1,CompareFn);
      if ((Pivot + 1) <= R) this.QuickSort(Pivot + 1,R,CompareFn);
    };
    this.SetSorted = function (Value) {
      if (Value) {
        this.SetSortStyle($mod.TStringsSortStyle.sslAuto)}
       else this.SetSortStyle($mod.TStringsSortStyle.sslNone);
    };
    this.SetCaseSensitive = function (b) {
      if (b === this.FCaseSensitive) return;
      this.FCaseSensitive = b;
      if (this.FSortStyle === $mod.TStringsSortStyle.sslAuto) {
        this.FForceSort = true;
        try {
          this.Sort();
        } finally {
          this.FForceSort = false;
        };
      };
    };
    this.SetSortStyle = function (AValue) {
      if (this.FSortStyle === AValue) return;
      if (AValue === $mod.TStringsSortStyle.sslAuto) this.Sort();
      this.FSortStyle = AValue;
    };
    this.CheckIndex = function (AIndex) {
      if ((AIndex < 0) || (AIndex >= this.FCount)) this.error(pas.RTLConsts.SListIndexError,AIndex);
    };
    this.ExchangeItems = function (Index1, Index2) {
      this.ExchangeItemsInt(Index1,Index2);
    };
    this.Changed = function () {
      if (this.FUpdateCount === 0) {
        if (this.FOnChange != null) this.FOnChange(this);
      };
    };
    this.Changing = function () {
      if (this.FUpdateCount === 0) if (this.FOnChanging != null) this.FOnChanging(this);
    };
    this.Get = function (Index) {
      var Result = "";
      this.CheckIndex(Index);
      Result = this.FList[Index].FString;
      return Result;
    };
    this.GetCapacity = function () {
      var Result = 0;
      Result = rtl.length(this.FList);
      return Result;
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FCount;
      return Result;
    };
    this.GetObject = function (Index) {
      var Result = null;
      this.CheckIndex(Index);
      Result = this.FList[Index].FObject;
      return Result;
    };
    this.Put = function (Index, S) {
      if (this.GetSorted()) this.error(pas.RTLConsts.SSortedListError,0);
      this.CheckIndex(Index);
      this.Changing();
      this.FList[Index].FString = S;
      this.Changed();
    };
    this.PutObject = function (Index, AObject) {
      this.CheckIndex(Index);
      this.Changing();
      this.FList[Index].FObject = AObject;
      this.Changed();
    };
    this.SetCapacity = function (NewCapacity) {
      if (NewCapacity < 0) this.error(pas.RTLConsts.SListCapacityError,NewCapacity);
      if (NewCapacity !== this.GetCapacity()) this.FList = rtl.arraySetLength(this.FList,$mod.TStringItem,NewCapacity);
    };
    this.SetUpdateState = function (Updating) {
      if (Updating) {
        this.Changing()}
       else this.Changed();
    };
    this.InsertItem = function (Index, S) {
      this.InsertItem$1(Index,S,null);
    };
    this.InsertItem$1 = function (Index, S, O) {
      var It = new $mod.TStringItem();
      this.Changing();
      if (this.FCount === this.GetCapacity()) this.Grow();
      It.FString = S;
      It.FObject = O;
      this.FList.splice(Index,0,It);
      this.FCount += 1;
      this.Changed();
    };
    this.DoCompareText = function (s1, s2) {
      var Result = 0;
      if (this.FCaseSensitive) {
        Result = pas.SysUtils.CompareStr(s1,s2)}
       else Result = pas.SysUtils.CompareText(s1,s2);
      return Result;
    };
    this.CompareStrings = function (s1, s2) {
      var Result = 0;
      Result = this.DoCompareText(s1,s2);
      return Result;
    };
    this.Destroy = function () {
      this.InternalClear(0,false);
      $mod.TStrings.Destroy.call(this);
    };
    this.Add = function (S) {
      var Result = 0;
      if (!(this.FSortStyle === $mod.TStringsSortStyle.sslAuto)) {
        Result = this.FCount}
       else if (this.Find(S,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }})) {
        var $tmp1 = this.FDuplicates;
        if ($tmp1 === pas.Types.TDuplicates.dupIgnore) {
          return Result}
         else if ($tmp1 === pas.Types.TDuplicates.dupError) this.error(pas.RTLConsts.SDuplicateString,0);
      };
      this.InsertItem(Result,S);
      return Result;
    };
    this.Clear = function () {
      if (this.FCount === 0) return;
      this.Changing();
      this.InternalClear(0,false);
      this.Changed();
    };
    this.Delete = function (Index) {
      this.CheckIndex(Index);
      this.Changing();
      if (this.FOwnsObjects) pas.SysUtils.FreeAndNil({p: this.FList[Index], get: function () {
          return this.p.FObject;
        }, set: function (v) {
          this.p.FObject = v;
        }});
      this.FList.splice(Index,1);
      this.FList[this.GetCount() - 1].FString = "";
      this.FList[this.GetCount() - 1].FObject = null;
      this.FCount -= 1;
      this.Changed();
    };
    this.Exchange = function (Index1, Index2) {
      this.CheckIndex(Index1);
      this.CheckIndex(Index2);
      this.Changing();
      this.ExchangeItemsInt(Index1,Index2);
      this.Changed();
    };
    this.Find = function (S, Index) {
      var Result = false;
      var L = 0;
      var R = 0;
      var I = 0;
      var CompareRes = 0;
      Result = false;
      Index.set(-1);
      if (!this.GetSorted()) throw $mod.EListError.$create("Create$1",[pas.RTLConsts.SErrFindNeedsSortedList]);
      L = 0;
      R = this.GetCount() - 1;
      while (L <= R) {
        I = L + Math.floor((R - L) / 2);
        CompareRes = this.DoCompareText(S,this.FList[I].FString);
        if (CompareRes > 0) {
          L = I + 1}
         else {
          R = I - 1;
          if (CompareRes === 0) {
            Result = true;
            if (this.FDuplicates !== pas.Types.TDuplicates.dupAccept) L = I;
          };
        };
      };
      Index.set(L);
      return Result;
    };
    this.IndexOf = function (S) {
      var Result = 0;
      if (!this.GetSorted()) {
        Result = $mod.TStrings.IndexOf.call(this,S)}
       else if (!this.Find(S,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }})) Result = -1;
      return Result;
    };
    this.Insert = function (Index, S) {
      if (this.FSortStyle === $mod.TStringsSortStyle.sslAuto) {
        this.error(pas.RTLConsts.SSortedListError,0)}
       else {
        if ((Index < 0) || (Index > this.FCount)) this.error(pas.RTLConsts.SListIndexError,Index);
        this.InsertItem(Index,S);
      };
    };
    this.Sort = function () {
      this.CustomSort($impl.StringListAnsiCompare);
    };
    this.CustomSort = function (CompareFn) {
      if ((this.FForceSort || !(this.FSortStyle === $mod.TStringsSortStyle.sslAuto)) && (this.FCount > 1)) {
        this.Changing();
        this.QuickSort(0,this.FCount - 1,CompareFn);
        this.Changed();
      };
    };
  });
  $mod.$rtti.$Class("TCollection");
  rtl.createClass($mod,"TCollectionItem",$mod.TPersistent,function () {
    this.$init = function () {
      $mod.TPersistent.$init.call(this);
      this.FCollection = null;
      this.FID = 0;
      this.FUpdateCount = 0;
    };
    this.$final = function () {
      this.FCollection = undefined;
      $mod.TPersistent.$final.call(this);
    };
    this.GetIndex = function () {
      var Result = 0;
      if (this.FCollection !== null) {
        Result = this.FCollection.FItems.IndexOf(this)}
       else Result = -1;
      return Result;
    };
    this.SetCollection = function (Value) {
      if (Value !== this.FCollection) {
        if (this.FCollection !== null) this.FCollection.RemoveItem(this);
        if (Value !== null) Value.InsertItem(this);
      };
    };
    this.Changed = function (AllItems) {
      if ((this.FCollection !== null) && (this.FCollection.FUpdateCount === 0)) {
        if (AllItems) {
          this.FCollection.Update(null)}
         else this.FCollection.Update(this);
      };
    };
    this.GetOwner = function () {
      var Result = null;
      Result = this.FCollection;
      return Result;
    };
    this.GetDisplayName = function () {
      var Result = "";
      Result = this.$classname;
      return Result;
    };
    this.SetIndex = function (Value) {
      var Temp = 0;
      Temp = this.GetIndex();
      if ((Temp > -1) && (Temp !== Value)) {
        this.FCollection.FItems.Move(Temp,Value);
        this.Changed(true);
      };
    };
    this.SetDisplayName = function (Value) {
      this.Changed(false);
      if (Value === "") ;
    };
    this.Create$1 = function (ACollection) {
      pas.System.TObject.Create.call(this);
      this.SetCollection(ACollection);
    };
    this.Destroy = function () {
      this.SetCollection(null);
      pas.System.TObject.Destroy.call(this);
    };
    this.GetNamePath = function () {
      var Result = "";
      if (this.FCollection !== null) {
        Result = ((this.FCollection.GetNamePath() + "[") + pas.SysUtils.IntToStr(this.GetIndex())) + "]"}
       else Result = this.$classname;
      return Result;
    };
  });
  rtl.createClass($mod,"TCollectionEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FCollection = null;
      this.FPosition = 0;
    };
    this.$final = function () {
      this.FCollection = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (ACollection) {
      pas.System.TObject.Create.call(this);
      this.FCollection = ACollection;
      this.FPosition = -1;
    };
    this.GetCurrent = function () {
      var Result = null;
      Result = this.FCollection.GetItem(this.FPosition);
      return Result;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FCollection.GetCount();
      return Result;
    };
  });
  $mod.$rtti.$ClassRef("TCollectionItemClass",{instancetype: $mod.$rtti["TCollectionItem"]});
  this.TCollectionNotification = {"0": "cnAdded", cnAdded: 0, "1": "cnExtracting", cnExtracting: 1, "2": "cnDeleting", cnDeleting: 2};
  $mod.$rtti.$Enum("TCollectionNotification",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TCollectionNotification});
  $mod.$rtti.$ProcVar("TCollectionSortCompare",{procsig: rtl.newTIProcSig([["Item1",$mod.$rtti["TCollectionItem"]],["Item2",$mod.$rtti["TCollectionItem"]]],rtl.longint)});
  rtl.createClass($mod,"TCollection",$mod.TPersistent,function () {
    this.$init = function () {
      $mod.TPersistent.$init.call(this);
      this.FItemClass = null;
      this.FItems = null;
      this.FUpdateCount = 0;
      this.FNextID = 0;
      this.FPropName = "";
    };
    this.$final = function () {
      this.FItemClass = undefined;
      this.FItems = undefined;
      $mod.TPersistent.$final.call(this);
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FItems.FCount;
      return Result;
    };
    this.GetPropName = function () {
      var Result = "";
      Result = this.FPropName;
      this.SetPropName();
      Result = this.FPropName;
      return Result;
    };
    this.InsertItem = function (Item) {
      if (!this.FItemClass.isPrototypeOf(Item)) return;
      this.FItems.Add(Item);
      Item.FCollection = this;
      Item.FID = this.FNextID;
      this.FNextID += 1;
      this.SetItemName(Item);
      this.Notify(Item,$mod.TCollectionNotification.cnAdded);
      this.Changed();
    };
    this.RemoveItem = function (Item) {
      var I = 0;
      this.Notify(Item,$mod.TCollectionNotification.cnExtracting);
      I = this.FItems.IndexOfItem(Item,pas.Types.TDirection.FromEnd);
      if (I !== -1) this.FItems.Delete(I);
      Item.FCollection = null;
      this.Changed();
    };
    this.DoClear = function () {
      var Item = null;
      while (this.FItems.FCount > 0) {
        Item = rtl.getObject(this.FItems.Last());
        if (Item != null) Item.$destroy("Destroy");
      };
    };
    this.GetAttrCount = function () {
      var Result = 0;
      Result = 0;
      return Result;
    };
    this.GetAttr = function (Index) {
      var Result = "";
      Result = "";
      if (Index === 0) ;
      return Result;
    };
    this.GetItemAttr = function (Index, ItemIndex) {
      var Result = "";
      Result = rtl.getObject(this.FItems.Get(ItemIndex)).GetDisplayName();
      if (Index === 0) ;
      return Result;
    };
    this.Changed = function () {
      if (this.FUpdateCount === 0) this.Update(null);
    };
    this.GetItem = function (Index) {
      var Result = null;
      Result = rtl.getObject(this.FItems.Get(Index));
      return Result;
    };
    this.SetItem = function (Index, Value) {
      rtl.getObject(this.FItems.Get(Index)).Assign(Value);
    };
    this.SetItemName = function (Item) {
      if (Item === null) ;
    };
    this.SetPropName = function () {
      this.FPropName = "";
    };
    this.Update = function (Item) {
      if (Item === null) ;
    };
    this.Notify = function (Item, Action) {
      if (Item === null) ;
      if (Action === $mod.TCollectionNotification.cnAdded) ;
    };
    this.Create$1 = function (AItemClass) {
      pas.System.TObject.Create.call(this);
      this.FItemClass = AItemClass;
      this.FItems = $mod.TFPList.$create("Create");
    };
    this.Destroy = function () {
      this.FUpdateCount = 1;
      try {
        this.DoClear();
      } finally {
        this.FUpdateCount = 0;
      };
      if (this.FItems != null) this.FItems.$destroy("Destroy");
      pas.System.TObject.Destroy.call(this);
    };
    this.Owner = function () {
      var Result = null;
      Result = this.GetOwner();
      return Result;
    };
    this.Add = function () {
      var Result = null;
      Result = this.FItemClass.$create("Create$1",[this]);
      return Result;
    };
    this.Assign = function (Source) {
      var I = 0;
      if ($mod.TCollection.isPrototypeOf(Source)) {
        this.Clear();
        for (var $l1 = 0, $end2 = Source.GetCount() - 1; $l1 <= $end2; $l1++) {
          I = $l1;
          this.Add().Assign(Source.GetItem(I));
        };
        return;
      } else $mod.TPersistent.Assign.call(this,Source);
    };
    this.BeginUpdate = function () {
      this.FUpdateCount += 1;
    };
    this.Clear = function () {
      if (this.FItems.FCount === 0) return;
      this.BeginUpdate();
      try {
        this.DoClear();
      } finally {
        this.EndUpdate();
      };
    };
    this.EndUpdate = function () {
      if (this.FUpdateCount > 0) this.FUpdateCount -= 1;
      if (this.FUpdateCount === 0) this.Changed();
    };
    this.Delete = function (Index) {
      var Item = null;
      Item = rtl.getObject(this.FItems.Get(Index));
      this.Notify(Item,$mod.TCollectionNotification.cnDeleting);
      if (Item != null) Item.$destroy("Destroy");
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TCollectionEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.GetNamePath = function () {
      var Result = "";
      var o = null;
      o = this.GetOwner();
      if ((o != null) && (this.GetPropName() !== "")) {
        Result = (o.GetNamePath() + ".") + this.GetPropName()}
       else Result = this.$classname;
      return Result;
    };
    this.Insert = function (Index) {
      var Result = null;
      Result = this.Add();
      Result.SetIndex(Index);
      return Result;
    };
    this.FindItemID = function (ID) {
      var Result = null;
      var I = 0;
      for (var $l1 = 0, $end2 = this.FItems.FCount - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        Result = rtl.getObject(this.FItems.Get(I));
        if (Result.FID === ID) return Result;
      };
      Result = null;
      return Result;
    };
    this.Exchange = function (Index1, index2) {
      this.FItems.Exchange(Index1,index2);
    };
    this.Sort = function (Compare) {
      this.BeginUpdate();
      try {
        this.FItems.Sort(Compare);
      } finally {
        this.EndUpdate();
      };
    };
  });
  rtl.createClass($mod,"TOwnedCollection",$mod.TCollection,function () {
    this.$init = function () {
      $mod.TCollection.$init.call(this);
      this.FOwner = null;
    };
    this.$final = function () {
      this.FOwner = undefined;
      $mod.TCollection.$final.call(this);
    };
    this.GetOwner = function () {
      var Result = null;
      Result = this.FOwner;
      return Result;
    };
    this.Create$2 = function (AOwner, AItemClass) {
      this.FOwner = AOwner;
      $mod.TCollection.Create$1.call(this,AItemClass);
    };
  });
  $mod.$rtti.$Class("TComponent");
  this.TOperation = {"0": "opInsert", opInsert: 0, "1": "opRemove", opRemove: 1};
  $mod.$rtti.$Enum("TOperation",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TOperation});
  this.TComponentStateItem = {"0": "csLoading", csLoading: 0, "1": "csReading", csReading: 1, "2": "csWriting", csWriting: 2, "3": "csDestroying", csDestroying: 3, "4": "csDesigning", csDesigning: 4, "5": "csAncestor", csAncestor: 5, "6": "csUpdating", csUpdating: 6, "7": "csFixups", csFixups: 7, "8": "csFreeNotification", csFreeNotification: 8, "9": "csInline", csInline: 9, "10": "csDesignInstance", csDesignInstance: 10};
  $mod.$rtti.$Enum("TComponentStateItem",{minvalue: 0, maxvalue: 10, ordtype: 1, enumtype: this.TComponentStateItem});
  $mod.$rtti.$Set("TComponentState",{comptype: $mod.$rtti["TComponentStateItem"]});
  this.TComponentStyleItem = {"0": "csInheritable", csInheritable: 0, "1": "csCheckPropAvail", csCheckPropAvail: 1, "2": "csSubComponent", csSubComponent: 2, "3": "csTransient", csTransient: 3};
  $mod.$rtti.$Enum("TComponentStyleItem",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TComponentStyleItem});
  $mod.$rtti.$Set("TComponentStyle",{comptype: $mod.$rtti["TComponentStyleItem"]});
  $mod.$rtti.$MethodVar("TGetChildProc",{procsig: rtl.newTIProcSig([["Child",$mod.$rtti["TComponent"]]]), methodkind: 0});
  rtl.createClass($mod,"TComponentEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FComponent = null;
      this.FPosition = 0;
    };
    this.$final = function () {
      this.FComponent = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AComponent) {
      pas.System.TObject.Create.call(this);
      this.FComponent = AComponent;
      this.FPosition = -1;
    };
    this.GetCurrent = function () {
      var Result = null;
      Result = this.FComponent.GetComponent(this.FPosition);
      return Result;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FComponent.GetComponentCount();
      return Result;
    };
  });
  rtl.createClass($mod,"TComponent",$mod.TPersistent,function () {
    this.$init = function () {
      $mod.TPersistent.$init.call(this);
      this.FOwner = null;
      this.FName = "";
      this.FTag = 0;
      this.FComponents = null;
      this.FFreeNotifies = null;
      this.FDesignInfo = 0;
      this.FComponentState = {};
      this.FComponentStyle = {};
    };
    this.$final = function () {
      this.FOwner = undefined;
      this.FComponents = undefined;
      this.FFreeNotifies = undefined;
      this.FComponentState = undefined;
      this.FComponentStyle = undefined;
      $mod.TPersistent.$final.call(this);
    };
    this.GetComponent = function (AIndex) {
      var Result = null;
      if (!(this.FComponents != null)) {
        Result = null}
       else Result = rtl.getObject(this.FComponents.Get(AIndex));
      return Result;
    };
    this.GetComponentCount = function () {
      var Result = 0;
      if (!(this.FComponents != null)) {
        Result = 0}
       else Result = this.FComponents.FCount;
      return Result;
    };
    this.GetComponentIndex = function () {
      var Result = 0;
      if ((this.FOwner != null) && (this.FOwner.FComponents != null)) {
        Result = this.FOwner.FComponents.IndexOf(this)}
       else Result = -1;
      return Result;
    };
    this.Insert = function (AComponent) {
      if (!(this.FComponents != null)) this.FComponents = $mod.TFPList.$create("Create");
      this.FComponents.Add(AComponent);
      AComponent.FOwner = this;
    };
    this.Remove = function (AComponent) {
      AComponent.FOwner = null;
      if (this.FComponents != null) {
        this.FComponents.Remove(AComponent);
        if (this.FComponents.FCount === 0) {
          this.FComponents.$destroy("Destroy");
          this.FComponents = null;
        };
      };
    };
    this.RemoveNotification = function (AComponent) {
      if (this.FFreeNotifies !== null) {
        this.FFreeNotifies.Remove(AComponent);
        if (this.FFreeNotifies.FCount === 0) {
          this.FFreeNotifies.$destroy("Destroy");
          this.FFreeNotifies = null;
          this.FComponentState = rtl.excludeSet(this.FComponentState,$mod.TComponentStateItem.csFreeNotification);
        };
      };
    };
    this.SetComponentIndex = function (Value) {
      var Temp = 0;
      var Count = 0;
      if (!(this.FOwner != null)) return;
      Temp = this.GetComponentIndex();
      if (Temp < 0) return;
      if (Value < 0) Value = 0;
      Count = this.FOwner.FComponents.FCount;
      if (Value >= Count) Value = Count - 1;
      if (Value !== Temp) {
        this.FOwner.FComponents.Delete(Temp);
        this.FOwner.FComponents.Insert(Value,this);
      };
    };
    this.ChangeName = function (NewName) {
      this.FName = NewName;
    };
    this.GetChildren = function (Proc, Root) {
      if (Proc === null) ;
      if (Root === null) ;
    };
    this.GetChildOwner = function () {
      var Result = null;
      Result = null;
      return Result;
    };
    this.GetChildParent = function () {
      var Result = null;
      Result = this;
      return Result;
    };
    this.GetOwner = function () {
      var Result = null;
      Result = this.FOwner;
      return Result;
    };
    this.Loaded = function () {
      this.FComponentState = rtl.excludeSet(this.FComponentState,$mod.TComponentStateItem.csLoading);
    };
    this.Loading = function () {
      this.FComponentState = rtl.includeSet(this.FComponentState,$mod.TComponentStateItem.csLoading);
    };
    this.Notification = function (AComponent, Operation) {
      var C = 0;
      if (Operation === $mod.TOperation.opRemove) this.RemoveFreeNotification(AComponent);
      if (!(this.FComponents != null)) return;
      C = this.FComponents.FCount - 1;
      while (C >= 0) {
        rtl.getObject(this.FComponents.Get(C)).Notification(AComponent,Operation);
        C -= 1;
        if (C >= this.FComponents.FCount) C = this.FComponents.FCount - 1;
      };
    };
    this.PaletteCreated = function () {
    };
    this.SetAncestor = function (Value) {
      var Runner = 0;
      if (Value) {
        this.FComponentState = rtl.includeSet(this.FComponentState,$mod.TComponentStateItem.csAncestor)}
       else this.FComponentState = rtl.excludeSet(this.FComponentState,$mod.TComponentStateItem.csAncestor);
      if (this.FComponents != null) for (var $l1 = 0, $end2 = this.FComponents.FCount - 1; $l1 <= $end2; $l1++) {
        Runner = $l1;
        rtl.getObject(this.FComponents.Get(Runner)).SetAncestor(Value);
      };
    };
    this.SetDesigning = function (Value, SetChildren) {
      var Runner = 0;
      if (Value) {
        this.FComponentState = rtl.includeSet(this.FComponentState,$mod.TComponentStateItem.csDesigning)}
       else this.FComponentState = rtl.excludeSet(this.FComponentState,$mod.TComponentStateItem.csDesigning);
      if ((this.FComponents != null) && SetChildren) for (var $l1 = 0, $end2 = this.FComponents.FCount - 1; $l1 <= $end2; $l1++) {
        Runner = $l1;
        rtl.getObject(this.FComponents.Get(Runner)).SetDesigning(Value,true);
      };
    };
    this.SetDesignInstance = function (Value) {
      if (Value) {
        this.FComponentState = rtl.includeSet(this.FComponentState,$mod.TComponentStateItem.csDesignInstance)}
       else this.FComponentState = rtl.excludeSet(this.FComponentState,$mod.TComponentStateItem.csDesignInstance);
    };
    this.SetInline = function (Value) {
      if (Value) {
        this.FComponentState = rtl.includeSet(this.FComponentState,$mod.TComponentStateItem.csInline)}
       else this.FComponentState = rtl.excludeSet(this.FComponentState,$mod.TComponentStateItem.csInline);
    };
    this.SetName = function (NewName) {
      if (this.FName === NewName) return;
      if ((NewName !== "") && !pas.SysUtils.IsValidIdent(NewName,false,false)) throw $mod.EComponentError.$create("CreateFmt",[pas.RTLConsts.SInvalidName,[NewName]]);
      if (this.FOwner != null) {
        this.FOwner.ValidateRename(this,this.FName,NewName)}
       else this.ValidateRename(null,this.FName,NewName);
      this.ChangeName(NewName);
    };
    this.SetChildOrder = function (Child, Order) {
      if (Child === null) ;
      if (Order === 0) ;
    };
    this.SetParentComponent = function (Value) {
      if (Value === null) ;
    };
    this.Updating = function () {
      this.FComponentState = rtl.includeSet(this.FComponentState,$mod.TComponentStateItem.csUpdating);
    };
    this.Updated = function () {
      this.FComponentState = rtl.excludeSet(this.FComponentState,$mod.TComponentStateItem.csUpdating);
    };
    this.ValidateRename = function (AComponent, CurName, NewName) {
      if ((((AComponent !== null) && (pas.SysUtils.CompareText(CurName,NewName) !== 0)) && (AComponent.FOwner === this)) && (this.FindComponent(NewName) !== null)) throw $mod.EComponentError.$create("CreateFmt",[pas.RTLConsts.SDuplicateName,[NewName]]);
      if (($mod.TComponentStateItem.csDesigning in this.FComponentState) && (this.FOwner !== null)) this.FOwner.ValidateRename(AComponent,CurName,NewName);
    };
    this.ValidateContainer = function (AComponent) {
      AComponent.ValidateInsert(this);
    };
    this.ValidateInsert = function (AComponent) {
      if (AComponent === null) ;
    };
    this._AddRef = function () {
      var Result = 0;
      Result = -1;
      return Result;
    };
    this._Release = function () {
      var Result = 0;
      Result = -1;
      return Result;
    };
    this.Create$1 = function (AOwner) {
      this.FComponentStyle = rtl.createSet($mod.TComponentStyleItem.csInheritable);
      if (AOwner != null) AOwner.InsertComponent(this);
    };
    this.Destroy = function () {
      var I = 0;
      var C = null;
      this.Destroying();
      if (this.FFreeNotifies != null) {
        I = this.FFreeNotifies.FCount - 1;
        while (I >= 0) {
          C = rtl.getObject(this.FFreeNotifies.Get(I));
          this.FFreeNotifies.Delete(I);
          C.Notification(this,$mod.TOperation.opRemove);
          if (this.FFreeNotifies === null) {
            I = 0}
           else if (I > this.FFreeNotifies.FCount) I = this.FFreeNotifies.FCount;
          I -= 1;
        };
        pas.SysUtils.FreeAndNil({p: this, get: function () {
            return this.p.FFreeNotifies;
          }, set: function (v) {
            this.p.FFreeNotifies = v;
          }});
      };
      this.DestroyComponents();
      if (this.FOwner !== null) this.FOwner.RemoveComponent(this);
      pas.System.TObject.Destroy.call(this);
    };
    this.BeforeDestruction = function () {
      if (!($mod.TComponentStateItem.csDestroying in this.FComponentState)) this.Destroying();
    };
    this.DestroyComponents = function () {
      var acomponent = null;
      while (this.FComponents != null) {
        acomponent = rtl.getObject(this.FComponents.Last());
        this.Remove(acomponent);
        acomponent.$destroy("Destroy");
      };
    };
    this.Destroying = function () {
      var Runner = 0;
      if ($mod.TComponentStateItem.csDestroying in this.FComponentState) return;
      this.FComponentState = rtl.includeSet(this.FComponentState,$mod.TComponentStateItem.csDestroying);
      if (this.FComponents != null) for (var $l1 = 0, $end2 = this.FComponents.FCount - 1; $l1 <= $end2; $l1++) {
        Runner = $l1;
        rtl.getObject(this.FComponents.Get(Runner)).Destroying();
      };
    };
    this.QueryInterface = function (IID, Obj) {
      var Result = 0;
      if (this.GetInterface(IID,Obj)) {
        Result = 0}
       else Result = -2147467262;
      return Result;
    };
    this.FindComponent = function (AName) {
      var Result = null;
      var I = 0;
      Result = null;
      if ((AName === "") || !(this.FComponents != null)) return Result;
      for (var $l1 = 0, $end2 = this.FComponents.FCount - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        if (pas.SysUtils.CompareText(rtl.getObject(this.FComponents.Get(I)).FName,AName) === 0) {
          Result = rtl.getObject(this.FComponents.Get(I));
          return Result;
        };
      };
      return Result;
    };
    this.FreeNotification = function (AComponent) {
      if ((this.FOwner !== null) && (AComponent === this.FOwner)) return;
      if (!(this.FFreeNotifies != null)) this.FFreeNotifies = $mod.TFPList.$create("Create");
      if (this.FFreeNotifies.IndexOf(AComponent) === -1) {
        this.FFreeNotifies.Add(AComponent);
        AComponent.FreeNotification(this);
      };
    };
    this.RemoveFreeNotification = function (AComponent) {
      this.RemoveNotification(AComponent);
      AComponent.RemoveNotification(this);
    };
    this.GetNamePath = function () {
      var Result = "";
      Result = this.FName;
      return Result;
    };
    this.GetParentComponent = function () {
      var Result = null;
      Result = null;
      return Result;
    };
    this.HasParent = function () {
      var Result = false;
      Result = false;
      return Result;
    };
    this.InsertComponent = function (AComponent) {
      AComponent.ValidateContainer(this);
      this.ValidateRename(AComponent,"",AComponent.FName);
      this.Insert(AComponent);
      if ($mod.TComponentStateItem.csDesigning in this.FComponentState) AComponent.SetDesigning(true,true);
      this.Notification(AComponent,$mod.TOperation.opInsert);
    };
    this.RemoveComponent = function (AComponent) {
      this.Notification(AComponent,$mod.TOperation.opRemove);
      this.Remove(AComponent);
      AComponent.SetDesigning(false,true);
      this.ValidateRename(AComponent,AComponent.FName,"");
    };
    this.SetSubComponent = function (ASubComponent) {
      if (ASubComponent) {
        this.FComponentStyle = rtl.includeSet(this.FComponentStyle,$mod.TComponentStyleItem.csSubComponent)}
       else this.FComponentStyle = rtl.excludeSet(this.FComponentStyle,$mod.TComponentStyleItem.csSubComponent);
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TComponentEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.$intfmaps = {};
    rtl.addIntf(this,pas.System.IUnknown);
    var $r = this.$rtti;
    $r.addProperty("Name",6,rtl.string,"FName","SetName");
    $r.addProperty("Tag",0,rtl.nativeint,"FTag","FTag");
  });
  $mod.$rtti.$ClassRef("TComponentClass",{instancetype: $mod.$rtti["TComponent"]});
  this.RegisterClass = function (AClass) {
    $impl.ClassList[AClass.$classname] = AClass;
  };
  this.GetClass = function (AClassName) {
    var Result = null;
    Result = null;
    if (AClassName === "") return Result;
    if (!$impl.ClassList.hasOwnProperty(AClassName)) return Result;
    Result = rtl.getObject($impl.ClassList[AClassName]);
    return Result;
  };
  $mod.$init = function () {
    $impl.ClassList = Object.create(null);
  };
},["JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.QuickSort = function (aList, L, R, Compare) {
    var I = 0;
    var J = 0;
    var P = undefined;
    var Q = undefined;
    do {
      I = L;
      J = R;
      P = aList[Math.floor((L + R) / 2)];
      do {
        while (Compare(P,aList[I]) > 0) I = I + 1;
        while (Compare(P,aList[J]) < 0) J = J - 1;
        if (I <= J) {
          Q = aList[I];
          aList[I] = aList[J];
          aList[J] = Q;
          I = I + 1;
          J = J - 1;
        };
      } while (!(I > J));
      if ((J - L) < (R - I)) {
        if (L < J) $impl.QuickSort(aList,L,J,Compare);
        L = I;
      } else {
        if (I < R) $impl.QuickSort(aList,I,R,Compare);
        R = J;
      };
    } while (!(L >= R));
  };
  $impl.StringListAnsiCompare = function (List, Index1, Index) {
    var Result = 0;
    Result = List.DoCompareText(List.FList[Index1].FString,List.FList[Index].FString);
    return Result;
  };
  $impl.ClassList = null;
});
rtl.module("strutils",["System","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.AnsiResemblesText = function (AText, AOther) {
    var Result = false;
    if ($mod.AnsiResemblesProc != null) {
      Result = $mod.AnsiResemblesProc(AText,AOther)}
     else Result = false;
    return Result;
  };
  this.AnsiContainsText = function (AText, ASubText) {
    var Result = false;
    Result = pas.System.Pos(pas.SysUtils.UpperCase(ASubText),pas.SysUtils.UpperCase(AText)) > 0;
    return Result;
  };
  this.AnsiStartsText = function (ASubText, AText) {
    var Result = false;
    if ((AText.length >= ASubText.length) && (ASubText !== "")) {
      Result = pas.SysUtils.SameText(ASubText,pas.System.Copy(AText,1,ASubText.length))}
     else Result = false;
    return Result;
  };
  this.AnsiEndsText = function (ASubText, AText) {
    var Result = false;
    if (AText.length >= ASubText.length) {
      Result = pas.SysUtils.SameText(ASubText,$mod.RightStr(AText,ASubText.length))}
     else Result = false;
    return Result;
  };
  this.AnsiReplaceText = function (AText, AFromText, AToText) {
    var Result = "";
    Result = pas.SysUtils.StringReplace(AText,AFromText,AToText,rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll,pas.SysUtils.TStringReplaceFlag.rfIgnoreCase));
    return Result;
  };
  this.AnsiMatchText = function (AText, AValues) {
    var Result = false;
    Result = $mod.AnsiIndexText(AText,AValues) !== -1;
    return Result;
  };
  this.AnsiIndexText = function (AText, AValues) {
    var Result = 0;
    var i = 0;
    Result = -1;
    if (((rtl.length(AValues) - 1) === -1) || ((rtl.length(AValues) - 1) > 2147483647)) return Result;
    for (var $l1 = 0, $end2 = rtl.length(AValues) - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      if (pas.SysUtils.CompareText(AValues[i],AText) === 0) return i;
    };
    return Result;
  };
  this.AnsiContainsStr = function (AText, ASubText) {
    var Result = false;
    Result = pas.System.Pos(ASubText,AText) > 0;
    return Result;
  };
  this.AnsiStartsStr = function (ASubText, AText) {
    var Result = false;
    if ((AText.length >= ASubText.length) && (ASubText !== "")) {
      Result = ASubText === pas.System.Copy(AText,1,ASubText.length)}
     else Result = false;
    return Result;
  };
  this.AnsiEndsStr = function (ASubText, AText) {
    var Result = false;
    if (AText.length >= ASubText.length) {
      Result = ASubText === $mod.RightStr(AText,ASubText.length)}
     else Result = false;
    return Result;
  };
  this.AnsiReplaceStr = function (AText, AFromText, AToText) {
    var Result = "";
    Result = pas.SysUtils.StringReplace(AText,AFromText,AToText,rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
    return Result;
  };
  this.AnsiMatchStr = function (AText, AValues) {
    var Result = false;
    Result = $mod.AnsiIndexStr(AText,AValues) !== -1;
    return Result;
  };
  this.AnsiIndexStr = function (AText, AValues) {
    var Result = 0;
    var i = 0;
    Result = -1;
    if (((rtl.length(AValues) - 1) === -1) || ((rtl.length(AValues) - 1) > 2147483647)) return Result;
    for (var $l1 = 0, $end2 = rtl.length(AValues) - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      if (AValues[i] === AText) return i;
    };
    return Result;
  };
  this.MatchStr = function (AText, AValues) {
    var Result = false;
    Result = $mod.IndexStr(AText,AValues) !== -1;
    return Result;
  };
  this.IndexStr = function (AText, AValues) {
    var Result = 0;
    var i = 0;
    Result = -1;
    if (((rtl.length(AValues) - 1) === -1) || ((rtl.length(AValues) - 1) > 2147483647)) return Result;
    for (var $l1 = 0, $end2 = rtl.length(AValues) - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      if (AValues[i] === AText) return i;
    };
    return Result;
  };
  this.DupeString = function (AText, ACount) {
    var Result = "";
    var i = 0;
    Result = "";
    for (var $l1 = 1, $end2 = ACount; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = Result + AText;
    };
    return Result;
  };
  this.ReverseString = function (AText) {
    var Result = "";
    var i = 0;
    var j = 0;
    Result = rtl.strSetLength(Result,AText.length);
    i = 1;
    j = AText.length;
    while (i <= j) {
      Result = rtl.setCharAt(Result,i - 1,AText.charAt(((j - i) + 1) - 1));
      i += 1;
    };
    return Result;
  };
  this.AnsiReverseString = function (AText) {
    var Result = "";
    Result = $mod.ReverseString(AText);
    return Result;
  };
  this.StuffString = function (AText, AStart, ALength, ASubText) {
    var Result = "";
    var i = 0;
    var j = 0;
    var k = 0;
    j = ASubText.length;
    i = AText.length;
    if (AStart > i) AStart = i + 1;
    k = (i + 1) - AStart;
    if (ALength > k) ALength = k;
    Result = rtl.strSetLength(Result,(i + j) - ALength);
    Result = (pas.System.Copy(AText,1,AStart - 1) + pas.System.Copy(ASubText,1,j)) + pas.System.Copy(AText,AStart + ALength,((i + 1) - AStart) - ALength);
    return Result;
  };
  this.RandomFrom = function (AValues) {
    var Result = "";
    if ((rtl.length(AValues) - 1) === -1) return "";
    Result = AValues[pas.System.Random((rtl.length(AValues) - 1) + 1)];
    return Result;
  };
  this.IfThen = function (AValue, ATrue, AFalse) {
    var Result = "";
    if (AValue) {
      Result = ATrue}
     else Result = AFalse;
    return Result;
  };
  this.NaturalCompareText = function (S1, S2) {
    var Result = 0;
    Result = $mod.NaturalCompareText$1(S1,S2,pas.SysUtils.DecimalSeparator,pas.SysUtils.ThousandSeparator);
    return Result;
  };
  this.NaturalCompareText$1 = function (Str1, Str2, ADecSeparator, AThousandSeparator) {
    var Result = 0;
    var Num1 = 0.0;
    var Num2 = 0.0;
    var pStr1 = 0;
    var pStr2 = 0;
    var Len1 = 0;
    var Len2 = 0;
    var TextLen1 = 0;
    var TextLen2 = 0;
    var TextStr1 = "";
    var TextStr2 = "";
    var i = 0;
    var j = 0;
    function Sign(AValue) {
      var Result = 0;
      if (AValue < 0) {
        Result = -1}
       else if (AValue > 0) {
        Result = 1}
       else Result = 0;
      return Result;
    };
    function IsNumber(ch) {
      var Result = false;
      Result = ch.charCodeAt() in rtl.createSet(null,48,57);
      return Result;
    };
    function GetInteger(aString, pch, Len) {
      var Result = 0.0;
      Result = 0;
      while ((pch.get() <= aString.length) && IsNumber(aString.charAt(pch.get() - 1))) {
        Result = ((Result * 10) + aString.charCodeAt(pch.get() - 1)) - "0".charCodeAt();
        Len.set(Len.get() + 1);
        pch.set(pch.get() + 1);
      };
      return Result;
    };
    function GetChars() {
      TextLen1 = 0;
      while (!(Str1.charCodeAt((pStr1 + TextLen1) - 1) in rtl.createSet(null,48,57)) && ((pStr1 + TextLen1) <= Str1.length)) TextLen1 += 1;
      TextStr1 = "";
      i = 1;
      j = 0;
      while (i <= TextLen1) {
        TextStr1 = TextStr1 + Str1.charAt((pStr1 + j) - 1);
        i += 1;
        j += 1;
      };
      TextLen2 = 0;
      while (!(Str2.charCodeAt((pStr2 + TextLen2) - 1) in rtl.createSet(null,48,57)) && ((pStr2 + TextLen2) <= Str2.length)) TextLen2 += 1;
      i = 1;
      j = 0;
      while (i <= TextLen2) {
        TextStr2 = TextStr2 + Str2.charAt((pStr2 + j) - 1);
        i += 1;
        j += 1;
      };
    };
    if ((Str1 !== "") && (Str2 !== "")) {
      pStr1 = 1;
      pStr2 = 1;
      Result = 0;
      while ((pStr1 <= Str1.length) && (pStr2 <= Str2.length)) {
        TextLen1 = 1;
        TextLen2 = 1;
        Len1 = 0;
        Len2 = 0;
        while (Str1.charAt(pStr1 - 1) === " ") {
          pStr1 += 1;
          Len1 += 1;
        };
        while (Str2.charAt(pStr2 - 1) === " ") {
          pStr2 += 1;
          Len2 += 1;
        };
        if (IsNumber(Str1.charAt(pStr1 - 1)) && IsNumber(Str2.charAt(pStr2 - 1))) {
          Num1 = GetInteger(Str1,{get: function () {
              return pStr1;
            }, set: function (v) {
              pStr1 = v;
            }},{get: function () {
              return Len1;
            }, set: function (v) {
              Len1 = v;
            }});
          Num2 = GetInteger(Str2,{get: function () {
              return pStr2;
            }, set: function (v) {
              pStr2 = v;
            }},{get: function () {
              return Len2;
            }, set: function (v) {
              Len2 = v;
            }});
          if (Num1 < Num2) {
            Result = -1}
           else if (Num1 > Num2) {
            Result = 1}
           else {
            Result = Sign(Len1 - Len2);
          };
          pStr1 -= 1;
          pStr2 -= 1;
        } else {
          GetChars();
          if (TextStr1 !== TextStr2) {
            Result = pas.SysUtils.CompareText(TextStr1,TextStr2)}
           else Result = 0;
        };
        if (Result !== 0) break;
        pStr1 += TextLen1;
        pStr2 += TextLen2;
      };
    };
    Num1 = Str1.length;
    Num2 = Str2.length;
    if ((Result === 0) && (Num1 !== Num2)) {
      if (Num1 < Num2) {
        Result = -1}
       else Result = 1;
    };
    if (ADecSeparator === "") ;
    if (AThousandSeparator === "") ;
    return Result;
  };
  this.LeftStr = function (AText, ACount) {
    var Result = "";
    Result = pas.System.Copy(AText,1,ACount);
    return Result;
  };
  this.RightStr = function (AText, ACount) {
    var Result = "";
    var j = 0;
    var l = 0;
    l = AText.length;
    j = ACount;
    if (j > l) j = l;
    Result = pas.System.Copy(AText,(l - j) + 1,j);
    return Result;
  };
  this.MidStr = function (AText, AStart, ACount) {
    var Result = "";
    if ((ACount === 0) || (AStart > AText.length)) return "";
    Result = pas.System.Copy(AText,AStart,ACount);
    return Result;
  };
  this.RightBStr = function (AText, AByteCount) {
    var Result = "";
    Result = $mod.RightStr(AText,AByteCount);
    return Result;
  };
  this.MidBStr = function (AText, AByteStart, AByteCount) {
    var Result = "";
    Result = $mod.MidStr(AText,AByteStart,AByteCount);
    return Result;
  };
  this.AnsiLeftStr = function (AText, ACount) {
    var Result = "";
    Result = pas.System.Copy(AText,1,ACount);
    return Result;
  };
  this.AnsiRightStr = function (AText, ACount) {
    var Result = "";
    Result = pas.System.Copy(AText,(AText.length - ACount) + 1,ACount);
    return Result;
  };
  this.AnsiMidStr = function (AText, AStart, ACount) {
    var Result = "";
    Result = pas.System.Copy(AText,AStart,ACount);
    return Result;
  };
  this.LeftBStr = function (AText, AByteCount) {
    var Result = "";
    Result = $mod.LeftStr(AText,AByteCount);
    return Result;
  };
  this.WordDelimiters = [];
  this.SErrAmountStrings = "Amount of search and replace strings don't match";
  this.SInvalidRomanNumeral = "%s is not a valid Roman numeral";
  this.TStringSearchOption = {"0": "soDown", soDown: 0, "1": "soMatchCase", soMatchCase: 1, "2": "soWholeWord", soWholeWord: 2};
  $mod.$rtti.$Enum("TStringSearchOption",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TStringSearchOption});
  $mod.$rtti.$Set("TStringSearchOptions",{comptype: $mod.$rtti["TStringSearchOption"]});
  this.PosEx = function (SubStr, S, Offset) {
    var Result = 0;
    Result = (new String(S)).indexOf(SubStr,Offset - 1) + 1;
    return Result;
  };
  this.PosEx$1 = function (SubStr, S) {
    var Result = 0;
    Result = $mod.PosEx(SubStr,S,1);
    return Result;
  };
  this.PosEx$2 = function (c, S, Offset) {
    var Result = 0;
    Result = (new String(S)).indexOf(c,Offset - 1) + 1;
    return Result;
  };
  this.StringsReplace = function (S, OldPattern, NewPattern, Flags) {
    var Result = "";
    var pc = 0;
    var pcc = 0;
    var lastpc = 0;
    var strcount = 0;
    var ResStr = "";
    var CompStr = "";
    var Found = false;
    var sc = 0;
    sc = rtl.length(OldPattern);
    if (sc !== rtl.length(NewPattern)) throw pas.SysUtils.Exception.$create("Create$1",[$mod.SErrAmountStrings]);
    sc -= 1;
    if (pas.SysUtils.TStringReplaceFlag.rfIgnoreCase in Flags) {
      CompStr = pas.SysUtils.UpperCase(S);
      for (var $l1 = 0, $end2 = sc; $l1 <= $end2; $l1++) {
        strcount = $l1;
        OldPattern[strcount] = pas.SysUtils.UpperCase(OldPattern[strcount]);
      };
    } else CompStr = S;
    ResStr = "";
    pc = 1;
    pcc = 1;
    lastpc = pc + S.length;
    while (pc < lastpc) {
      Found = false;
      for (var $l3 = 0, $end4 = sc; $l3 <= $end4; $l3++) {
        strcount = $l3;
        if (pas.System.Copy(CompStr,pc,OldPattern[strcount].length) === OldPattern[strcount]) {
          ResStr = ResStr + NewPattern[strcount];
          pc = pc + OldPattern[strcount].length;
          pcc = pcc + OldPattern[strcount].length;
          Found = true;
        };
      };
      if (!Found) {
        ResStr = ResStr + S.charAt(pcc - 1);
        pc += 1;
        pcc += 1;
      } else if (!(pas.SysUtils.TStringReplaceFlag.rfReplaceAll in Flags)) {
        ResStr = ResStr + pas.System.Copy(S,pcc,(S.length - pcc) + 1);
        break;
      };
    };
    Result = ResStr;
    return Result;
  };
  this.ReplaceStr = function (AText, AFromText, AToText) {
    var Result = "";
    Result = $mod.AnsiReplaceStr(AText,AFromText,AToText);
    return Result;
  };
  this.ReplaceText = function (AText, AFromText, AToText) {
    var Result = "";
    Result = $mod.AnsiReplaceText(AText,AFromText,AToText);
    return Result;
  };
  $mod.$rtti.$Int("TSoundexLength",{minvalue: 1, maxvalue: 2147483647, ordtype: 5});
  this.Soundex = function (AText, ALength) {
    var Result = "";
    var S = "";
    var PS = "";
    var I = 0;
    var L = 0;
    Result = "";
    PS = "\x00";
    if (AText.length > 0) {
      Result = pas.System.upcase(AText.charAt(0));
      I = 2;
      L = AText.length;
      while ((I <= L) && (Result.length < ALength)) {
        S = $impl.SScore.charAt(AText.charCodeAt(I - 1) - 1);
        if (!(S.charCodeAt() in rtl.createSet(48,105,PS.charCodeAt()))) Result = Result + S;
        if (S !== "i") PS = S;
        I += 1;
      };
    };
    L = Result.length;
    if (L < ALength) Result = Result + pas.System.StringOfChar("0",ALength - L);
    return Result;
  };
  this.Soundex$1 = function (AText) {
    var Result = "";
    Result = $mod.Soundex(AText,4);
    return Result;
  };
  $mod.$rtti.$Int("TSoundexIntLength",{minvalue: 1, maxvalue: 8, ordtype: 1});
  this.SoundexInt = function (AText, ALength) {
    var Result = 0;
    var SE = "";
    var I = 0;
    Result = -1;
    SE = $mod.Soundex(AText,ALength);
    if (SE.length > 0) {
      Result = SE.charCodeAt(1 - 1) - 65;
      if (ALength > 1) {
        Result = (Result * 26) + (SE.charCodeAt(2 - 1) - 48);
        for (var $l1 = 3, $end2 = ALength; $l1 <= $end2; $l1++) {
          I = $l1;
          Result = (SE.charCodeAt(I - 1) - 48) + (Result * 7);
        };
      };
      Result = ALength + (Result * 9);
    };
    return Result;
  };
  this.SoundexInt$1 = function (AText) {
    var Result = 0;
    Result = $mod.SoundexInt(AText,4);
    return Result;
  };
  this.DecodeSoundexInt = function (AValue) {
    var Result = "";
    var I = 0;
    var Len = 0;
    Result = "";
    Len = AValue % 9;
    AValue = Math.floor(AValue / 9);
    for (var $l1 = Len; $l1 >= 3; $l1--) {
      I = $l1;
      Result = String.fromCharCode(48 + (AValue % 7)) + Result;
      AValue = Math.floor(AValue / 7);
    };
    if (Len > 1) {
      Result = String.fromCharCode(48 + (AValue % 26)) + Result;
      AValue = Math.floor(AValue / 26);
    };
    Result = String.fromCharCode(65 + AValue) + Result;
    return Result;
  };
  this.SoundexWord = function (AText) {
    var Result = 0;
    var S = "";
    S = $mod.Soundex(AText,4);
    Result = S.charCodeAt(1 - 1) - 65;
    Result = ((Result * 26) + S.charCodeAt(2 - 1)) - 48;
    Result = ((Result * 7) + S.charCodeAt(3 - 1)) - 48;
    Result = ((Result * 7) + S.charCodeAt(4 - 1)) - 48;
    return Result;
  };
  this.DecodeSoundexWord = function (AValue) {
    var Result = "";
    Result = String.fromCharCode(48 + (AValue % 7));
    AValue = Math.floor(AValue / 7);
    Result = String.fromCharCode(48 + (AValue % 7)) + Result;
    AValue = Math.floor(AValue / 7);
    Result = pas.SysUtils.IntToStr(AValue % 26) + Result;
    AValue = Math.floor(AValue / 26);
    Result = String.fromCharCode(65 + AValue) + Result;
    return Result;
  };
  this.SoundexSimilar = function (AText, AOther, ALength) {
    var Result = false;
    Result = $mod.Soundex(AText,ALength) === $mod.Soundex(AOther,ALength);
    return Result;
  };
  this.SoundexSimilar$1 = function (AText, AOther) {
    var Result = false;
    Result = $mod.SoundexSimilar(AText,AOther,4);
    return Result;
  };
  this.SoundexCompare = function (AText, AOther, ALength) {
    var Result = 0;
    Result = pas.SysUtils.AnsiCompareStr($mod.Soundex(AText,ALength),$mod.Soundex(AOther,ALength));
    return Result;
  };
  this.SoundexCompare$1 = function (AText, AOther) {
    var Result = 0;
    Result = $mod.SoundexCompare(AText,AOther,4);
    return Result;
  };
  this.SoundexProc = function (AText, AOther) {
    var Result = false;
    Result = $mod.SoundexSimilar$1(AText,AOther);
    return Result;
  };
  $mod.$rtti.$ProcVar("TCompareTextProc",{procsig: rtl.newTIProcSig([["AText",rtl.string,2],["AOther",rtl.string,2]],rtl.boolean)});
  this.AnsiResemblesProc = null;
  this.TRomanConversionStrictness = {"0": "rcsStrict", rcsStrict: 0, "1": "rcsRelaxed", rcsRelaxed: 1, "2": "rcsDontCare", rcsDontCare: 2};
  $mod.$rtti.$Enum("TRomanConversionStrictness",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TRomanConversionStrictness});
  this.IsEmptyStr = function (S, EmptyChars) {
    var Result = false;
    var i = 0;
    var l = 0;
    l = S.length;
    i = 1;
    Result = true;
    while (Result && (i <= l)) {
      Result = pas.SysUtils.CharInSet(S.charAt(i - 1),EmptyChars);
      i += 1;
    };
    return Result;
  };
  this.DelSpace = function (S) {
    var Result = "";
    Result = $mod.DelChars(S," ");
    return Result;
  };
  this.DelChars = function (S, Chr) {
    var Result = "";
    var I = 0;
    var J = 0;
    Result = S;
    I = Result.length;
    while (I > 0) {
      if (Result.charAt(I - 1) === Chr) {
        J = I - 1;
        while ((J > 0) && (Result.charAt(J - 1) === Chr)) J -= 1;
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},J + 1,I - J);
        I = J + 1;
      };
      I -= 1;
    };
    return Result;
  };
  this.DelSpace1 = function (S) {
    var Result = "";
    var I = 0;
    Result = S;
    for (var $l1 = Result.length; $l1 >= 2; $l1--) {
      I = $l1;
      if ((Result.charAt(I - 1) === " ") && (Result.charAt((I - 1) - 1) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},I,1);
    };
    return Result;
  };
  this.Tab2Space = function (S, Numb) {
    var Result = "";
    var I = 0;
    I = 1;
    Result = S;
    while (I <= Result.length) if (Result.charAt(I - 1) !== String.fromCharCode(9)) {
      I += 1}
     else {
      Result = rtl.setCharAt(Result,I - 1," ");
      if (Numb > 1) pas.System.Insert(pas.System.StringOfChar(" ",Numb - 1),{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},I);
      I += Numb;
    };
    return Result;
  };
  this.NPos = function (C, S, N) {
    var Result = 0;
    var i = 0;
    var p = 0;
    var k = 0;
    Result = 0;
    if (N < 1) return Result;
    k = 0;
    i = 1;
    do {
      p = pas.System.Pos(C,S);
      k += p;
      if (p > 0) pas.System.Delete({get: function () {
          return S;
        }, set: function (v) {
          S = v;
        }},1,p);
      i += 1;
    } while (!((i > N) || (p === 0)));
    if (p > 0) Result = k;
    return Result;
  };
  this.RPosEX = function (C, S, offs) {
    var Result = 0;
    Result = (new String(S)).lastIndexOf(C,offs - 1) + 1;
    return Result;
  };
  this.RPosex$1 = function (Substr, Source, offs) {
    var Result = 0;
    Result = (new String(Source)).lastIndexOf(Substr,offs - 1) + 1;
    return Result;
  };
  this.RPos = function (c, S) {
    var Result = 0;
    Result = $mod.RPosex$1(c,S,S.length);
    return Result;
  };
  this.RPos$1 = function (Substr, Source) {
    var Result = 0;
    Result = $mod.RPosex$1(Substr,Source,Source.length);
    return Result;
  };
  this.AddChar = function (C, S, N) {
    var Result = "";
    var l = 0;
    Result = S;
    l = Result.length;
    if (l < N) Result = pas.System.StringOfChar(C,N - l) + Result;
    return Result;
  };
  this.AddCharR = function (C, S, N) {
    var Result = "";
    var l = 0;
    Result = S;
    l = Result.length;
    if (l < N) Result = Result + pas.System.StringOfChar(C,N - l);
    return Result;
  };
  this.PadLeft = function (S, N) {
    var Result = "";
    Result = $mod.AddChar(" ",S,N);
    return Result;
  };
  this.PadRight = function (S, N) {
    var Result = "";
    Result = $mod.AddCharR(" ",S,N);
    return Result;
  };
  this.PadCenter = function (S, Len) {
    var Result = "";
    if (S.length < Len) {
      Result = pas.System.StringOfChar(" ",Math.floor(Len / 2) - Math.floor(S.length / 2)) + S;
      Result = Result + pas.System.StringOfChar(" ",Len - Result.length);
    } else Result = S;
    return Result;
  };
  this.Copy2Symb = function (S, Symb) {
    var Result = "";
    var p = 0;
    p = pas.System.Pos(Symb,S);
    if (p === 0) p = S.length + 1;
    Result = pas.System.Copy(S,1,p - 1);
    return Result;
  };
  this.Copy2SymbDel = function (S, Symb) {
    var Result = "";
    var p = 0;
    p = pas.System.Pos(Symb,S.get());
    if (p === 0) {
      Result = S.get();
      S.set("");
    } else {
      Result = pas.System.Copy(S.get(),1,p - 1);
      pas.System.Delete(S,1,p);
    };
    return Result;
  };
  this.Copy2Space = function (S) {
    var Result = "";
    Result = $mod.Copy2Symb(S," ");
    return Result;
  };
  this.Copy2SpaceDel = function (S) {
    var Result = "";
    Result = $mod.Copy2SymbDel(S," ");
    return Result;
  };
  this.AnsiProperCase = function (S, WordDelims) {
    var Result = "";
    var P = 0;
    var L = 0;
    Result = pas.SysUtils.LowerCase(S);
    P = 1;
    L = Result.length;
    while (P <= L) {
      while ((P <= L) && pas.SysUtils.CharInSet(Result.charAt(P - 1),WordDelims)) P += 1;
      if (P <= L) Result = rtl.setCharAt(Result,P - 1,pas.System.upcase(Result.charAt(P - 1)));
      while ((P <= L) && !pas.SysUtils.CharInSet(Result.charAt(P - 1),WordDelims)) P += 1;
    };
    return Result;
  };
  this.WordCount = function (S, WordDelims) {
    var Result = 0;
    var P = 0;
    var L = 0;
    Result = 0;
    P = 1;
    L = S.length;
    while (P <= L) {
      while ((P <= L) && pas.SysUtils.CharInSet(S.charAt(P - 1),WordDelims)) P += 1;
      if (P <= L) Result += 1;
      while ((P <= L) && !pas.SysUtils.CharInSet(S.charAt(P - 1),WordDelims)) P += 1;
    };
    return Result;
  };
  this.WordPosition = function (N, S, WordDelims) {
    var Result = 0;
    var PS = 0;
    var P = 0;
    var PE = 0;
    var Count = 0;
    Result = 0;
    Count = 0;
    PS = 1;
    PE = S.length;
    P = PS;
    while ((P <= PE) && (Count !== N)) {
      while ((P <= PE) && pas.SysUtils.CharInSet(S.charAt(P - 1),WordDelims)) P += 1;
      if (P <= PE) Count += 1;
      if (Count !== N) {
        while ((P <= PE) && !pas.SysUtils.CharInSet(S.charAt(P - 1),WordDelims)) P += 1}
       else Result = (P - PS) + 1;
    };
    return Result;
  };
  this.ExtractWord = function (N, S, WordDelims) {
    var Result = "";
    var i = 0;
    Result = $mod.ExtractWordPos(N,S,WordDelims,{get: function () {
        return i;
      }, set: function (v) {
        i = v;
      }});
    return Result;
  };
  this.ExtractWordPos = function (N, S, WordDelims, Pos) {
    var Result = "";
    var i = 0;
    var j = 0;
    var l = 0;
    j = 0;
    i = $mod.WordPosition(N,S,WordDelims);
    if (i > 2147483647) {
      Result = "";
      Pos.set(-1);
      return Result;
    };
    Pos.set(i);
    if (i !== 0) {
      j = i;
      l = S.length;
      while ((j <= l) && !pas.SysUtils.CharInSet(S.charAt(j - 1),WordDelims)) j += 1;
    };
    Result = pas.System.Copy(S,i,j - i);
    return Result;
  };
  this.ExtractDelimited = function (N, S, Delims) {
    var Result = "";
    var w = 0;
    var i = 0;
    var l = 0;
    var len = 0;
    w = 0;
    i = 1;
    l = 0;
    len = S.length;
    Result = rtl.strSetLength(Result,0);
    while ((i <= len) && (w !== N)) {
      if (pas.SysUtils.CharInSet(S.charAt(i - 1),Delims)) {
        w += 1}
       else {
        if ((N - 1) === w) {
          l += 1;
          Result = Result + S.charAt(i - 1);
        };
      };
      i += 1;
    };
    return Result;
  };
  this.ExtractSubstr = function (S, Pos, Delims) {
    var Result = "";
    var i = 0;
    var l = 0;
    i = Pos.get();
    l = S.length;
    while ((i <= l) && !pas.SysUtils.CharInSet(S.charAt(i - 1),Delims)) i += 1;
    Result = pas.System.Copy(S,Pos.get(),i - Pos.get());
    while ((i <= l) && pas.SysUtils.CharInSet(S.charAt(i - 1),Delims)) i += 1;
    if (i > 2147483647) {
      Pos.set(2147483647)}
     else Pos.set(i);
    return Result;
  };
  this.IsWordPresent = function (W, S, WordDelims) {
    var Result = false;
    var i = 0;
    var Count = 0;
    Result = false;
    Count = $mod.WordCount(S,WordDelims);
    i = 1;
    while (!Result && (i <= Count)) {
      Result = $mod.ExtractWord(i,S,WordDelims) === W;
      i += 1;
    };
    return Result;
  };
  this.FindPart = function (HelpWilds, InputStr) {
    var Result = 0;
    var Diff = 0;
    var i = 0;
    var J = 0;
    Result = 0;
    i = pas.System.Pos("?",HelpWilds);
    if (i === 0) {
      Result = pas.System.Pos(HelpWilds,InputStr)}
     else {
      Diff = InputStr.length - HelpWilds.length;
      for (var $l1 = 0, $end2 = Diff; $l1 <= $end2; $l1++) {
        i = $l1;
        for (var $l3 = 1, $end4 = HelpWilds.length; $l3 <= $end4; $l3++) {
          J = $l3;
          if ((InputStr.charAt((i + J) - 1) === HelpWilds.charAt(J - 1)) || (HelpWilds.charAt(J - 1) === "?")) {
            if (J === HelpWilds.length) {
              Result = i + 1;
              return Result;
            };
          } else break;
        };
      };
    };
    return Result;
  };
  this.IsWild = function (InputStr, Wilds, IgnoreCase) {
    var Result = false;
    var i = 0;
    var MaxinputWord = 0;
    var MaxWilds = 0;
    var eos = false;
    Result = true;
    if (Wilds === InputStr) return Result;
    i = pas.System.Pos("**",Wilds);
    while (i > 0) {
      pas.System.Delete({get: function () {
          return Wilds;
        }, set: function (v) {
          Wilds = v;
        }},i,1);
      i = pas.System.Pos("**",Wilds);
    };
    if (Wilds === "*") return Result;
    MaxinputWord = InputStr.length;
    MaxWilds = Wilds.length;
    if ((MaxWilds === 0) || (MaxinputWord === 0)) {
      Result = false;
      return Result;
    };
    if (IgnoreCase) {
      InputStr = pas.SysUtils.UpperCase(InputStr);
      Wilds = pas.SysUtils.UpperCase(Wilds);
    };
    Result = $impl.isMatch(1,InputStr,Wilds,1,1,MaxinputWord,MaxWilds,{get: function () {
        return eos;
      }, set: function (v) {
        eos = v;
      }});
    return Result;
  };
  this.XorString = function (Key, Src) {
    var Result = "";
    var i = 0;
    Result = Src;
    if (Key.length > 0) for (var $l1 = 1, $end2 = Src.length; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = rtl.setCharAt(Result,i - 1,String.fromCharCode(Key.charCodeAt((1 + ((i - 1) % Key.length)) - 1) ^ Src.charCodeAt(i - 1)));
    };
    return Result;
  };
  this.XorEncode = function (Key, Source) {
    var Result = "";
    var i = 0;
    var C = 0;
    Result = "";
    for (var $l1 = 1, $end2 = Source.length; $l1 <= $end2; $l1++) {
      i = $l1;
      if (Key.length > 0) {
        C = Key.charCodeAt((1 + ((i - 1) % Key.length)) - 1) ^ Source.charCodeAt(i - 1)}
       else C = Source.charCodeAt(i - 1);
      Result = Result + pas.SysUtils.LowerCase(pas.SysUtils.IntToHex(C,2));
    };
    return Result;
  };
  this.XorDecode = function (Key, Source) {
    var Result = "";
    var i = 0;
    var C = "";
    Result = "";
    for (var $l1 = 0, $end2 = Math.floor(Source.length / 2) - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      C = String.fromCharCode(pas.SysUtils.StrToIntDef("$" + pas.System.Copy(Source,(i * 2) + 1,2)," ".charCodeAt()));
      if (Key.length > 0) C = String.fromCharCode(Key.charCodeAt((1 + (i % Key.length)) - 1) ^ C.charCodeAt());
      Result = Result + C;
    };
    return Result;
  };
  this.GetCmdLineArg = function (Switch, SwitchChars) {
    var Result = "";
    var i = 0;
    var S = "";
    i = 1;
    Result = "";
    while ((Result === "") && (i <= pas.System.ParamCount())) {
      S = pas.System.ParamStr(i);
      if ((rtl.length(SwitchChars) === 0) || ((pas.SysUtils.CharInSet(S.charAt(0),SwitchChars) && (S.length > 1)) && (pas.SysUtils.CompareText(pas.System.Copy(S,2,S.length - 1),Switch) === 0))) {
        i += 1;
        if (i <= pas.System.ParamCount()) Result = pas.System.ParamStr(i);
      };
      i += 1;
    };
    return Result;
  };
  this.Numb2USA = function (S) {
    var Result = "";
    var i = 0;
    var NA = 0;
    i = S.length;
    Result = S;
    NA = 0;
    while (i > 0) {
      if ((((((Result.length - i) + 1) - NA) % 3) === 0) && (i !== 1)) {
        pas.System.Insert(",",{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},i);
        NA += 1;
      };
      i -= 1;
    };
    return Result;
  };
  this.Hex2Dec = function (S) {
    var Result = 0;
    var HexStr = "";
    if (pas.System.Pos("$",S) === 0) {
      HexStr = "$" + S}
     else HexStr = S;
    Result = pas.SysUtils.StrToInt(HexStr);
    return Result;
  };
  this.Dec2Numb = function (N, Len, Base) {
    var Result = "";
    var C = 0;
    var number = 0;
    if (N === 0) {
      Result = "0"}
     else {
      number = N;
      Result = "";
      while (number > 0) {
        C = number % Base;
        if (C > 9) {
          C = C + 55}
         else C = C + 48;
        Result = String.fromCharCode(C) + Result;
        number = Math.floor(number / Base);
      };
    };
    if (Result !== "") Result = $mod.AddChar("0",Result,Len);
    return Result;
  };
  this.Numb2Dec = function (S, Base) {
    var Result = 0;
    var i = 0;
    var P = 0;
    i = S.length;
    Result = 0;
    S = pas.SysUtils.UpperCase(S);
    P = 1;
    while (i >= 1) {
      if (S.charAt(i - 1) > "@") {
        Result = Result + ((S.charCodeAt(i - 1) - 55) * P)}
       else Result = Result + ((S.charCodeAt(i - 1) - 48) * P);
      i -= 1;
      P = P * Base;
    };
    return Result;
  };
  this.IntToBin = function (Value, Digits, Spaces) {
    var Result = "";
    var endpos = 0;
    var p = 0;
    var p2 = 0;
    var k = 0;
    Result = "";
    if (Digits > 32) Digits = 32;
    if (Spaces === 0) {
      Result = $mod.IntToBin$1(Value,Digits);
      return Result;
    };
    endpos = Digits + Math.floor((Digits - 1) / Spaces);
    Result = rtl.strSetLength(Result,endpos);
    p = endpos;
    p2 = 1;
    k = Spaces;
    while (p >= p2) {
      if (k === 0) {
        Result = rtl.setCharAt(Result,p - 1," ");
        p -= 1;
        k = Spaces;
      };
      Result = rtl.setCharAt(Result,p - 1,String.fromCharCode(48 + ((Value >>> 0) & 1)));
      Value = (Value >>> 0) >>> 1;
      p -= 1;
      k -= 1;
    };
    return Result;
  };
  this.IntToBin$1 = function (Value, Digits) {
    var Result = "";
    var p = 0;
    var p2 = 0;
    Result = "";
    if (Digits <= 0) return Result;
    Result = rtl.strSetLength(Result,Digits);
    p = Digits;
    p2 = 1;
    while ((p >= p2) && ((Value >>> 0) > 0)) {
      Result = rtl.setCharAt(Result,p - 1,String.fromCharCode(48 + ((Value >>> 0) & 1)));
      Value = (Value >>> 0) >>> 1;
      p -= 1;
    };
    Digits = (p - p2) + 1;
    while (Digits > 0) {
      Result = rtl.setCharAt(Result,Digits - 1,String.fromCharCode(48));
      Digits -= 1;
    };
    return Result;
  };
  this.IntToBin$2 = function (Value, Digits) {
    var Result = "";
    var p = 0;
    var p2 = 0;
    Result = "";
    if (Digits <= 0) return Result;
    Result = rtl.strSetLength(Result,Digits);
    p = Digits;
    p2 = 1;
    while ((p >= p2) && (Value > 0)) {
      Result = rtl.setCharAt(Result,p - 1,String.fromCharCode(48 + ((Value >>> 0) & 1)));
      Value = Math.floor(Value / 2);
      p -= 1;
    };
    Digits = (p - p2) + 1;
    while (Digits > 0) Result = rtl.setCharAt(Result,Digits - 1,"0");
    return Result;
  };
  var Arabics = [1,4,5,9,10,40,50,90,100,400,500,900,1000];
  var Romans = ["I","IV","V","IX","X","XL","L","XC","C","CD","D","CM","M"];
  this.IntToRoman = function (Value) {
    var Result = "";
    var i = 0;
    Result = "";
    for (var $l1 = 13; $l1 >= 1; $l1--) {
      i = $l1;
      while (Value >= Arabics[i - 1]) {
        Value = Value - Arabics[i - 1];
        Result = Result + Romans[i - 1];
      };
    };
    return Result;
  };
  this.TryRomanToInt = function (S, N, Strictness) {
    var Result = false;
    var i = 0;
    var Len = 0;
    var Terminated = false;
    Result = false;
    S = pas.SysUtils.UpperCase(S);
    Len = S.length;
    if (Strictness === $mod.TRomanConversionStrictness.rcsDontCare) {
      N.set($impl.RomanToIntDontCare(S));
      if (N.get() === 0) {
        Result = Len === 0;
      } else Result = true;
      return Result;
    };
    if (Len === 0) return Result;
    i = 1;
    N.set(0);
    Terminated = false;
    while (((i <= Len) && ((Strictness !== $mod.TRomanConversionStrictness.rcsStrict) || (i < 4))) && (S.charAt(i - 1) === "M")) {
      i += 1;
      N.set(N.get() + 1000);
    };
    if ((i <= Len) && (S.charAt(i - 1) === "D")) {
      i += 1;
      N.set(N.get() + 500);
    } else if (((i + 1) <= Len) && (S.charAt(i - 1) === "C")) {
      if (S.charAt((i + 1) - 1) === "M") {
        i += 2;
        N.set(N.get() + 900);
      } else if (S.charAt((i + 1) - 1) === "D") {
        i += 2;
        N.set(N.get() + 400);
      };
    };
    if ((i <= Len) && (S.charAt(i - 1) === "C")) {
      i += 1;
      N.set(N.get() + 100);
      if ((i <= Len) && (S.charAt(i - 1) === "C")) {
        i += 1;
        N.set(N.get() + 100);
      };
      if ((i <= Len) && (S.charAt(i - 1) === "C")) {
        i += 1;
        N.set(N.get() + 100);
      };
      if (((Strictness !== $mod.TRomanConversionStrictness.rcsStrict) && (i <= Len)) && (S.charAt(i - 1) === "C")) {
        i += 1;
        N.set(N.get() + 100);
      };
    };
    if (((i + 1) <= Len) && (S.charAt(i - 1) === "X")) {
      if (S.charAt((i + 1) - 1) === "C") {
        i += 2;
        N.set(N.get() + 90);
      } else if (S.charAt((i + 1) - 1) === "L") {
        i += 2;
        N.set(N.get() + 40);
      };
    };
    if ((i <= Len) && (S.charAt(i - 1) === "L")) {
      i += 1;
      N.set(N.get() + 50);
    };
    if ((i <= Len) && (S.charAt(i - 1) === "X")) {
      i += 1;
      N.set(N.get() + 10);
      if ((i <= Len) && (S.charAt(i - 1) === "X")) {
        i += 1;
        N.set(N.get() + 10);
      };
      if ((i <= Len) && (S.charAt(i - 1) === "X")) {
        i += 1;
        N.set(N.get() + 10);
      };
      if (((Strictness !== $mod.TRomanConversionStrictness.rcsStrict) && (i <= Len)) && (S.charAt(i - 1) === "X")) {
        i += 1;
        N.set(N.get() + 10);
      };
    };
    if (((i + 1) <= Len) && (S.charAt(i - 1) === "I")) {
      if (S.charAt((i + 1) - 1) === "X") {
        Terminated = true;
        i += 2;
        N.set(N.get() + 9);
      } else if (S.charAt((i + 1) - 1) === "V") {
        Terminated = true;
        i += 2;
        N.set(N.get() + 4);
      };
    };
    if ((!Terminated && (i <= Len)) && (S.charAt(i - 1) === "V")) {
      i += 1;
      N.set(N.get() + 5);
    };
    if ((!Terminated && (i <= Len)) && (S.charAt(i - 1) === "I")) {
      Terminated = true;
      i += 1;
      N.set(N.get() + 1);
      if ((i <= Len) && (S.charAt(i - 1) === "I")) {
        i += 1;
        N.set(N.get() + 1);
      };
      if ((i <= Len) && (S.charAt(i - 1) === "I")) {
        i += 1;
        N.set(N.get() + 1);
      };
      if (((Strictness !== $mod.TRomanConversionStrictness.rcsStrict) && (i <= Len)) && (S.charAt(i - 1) === "I")) {
        i += 1;
        N.set(N.get() + 1);
      };
    };
    Result = i > Len;
    return Result;
  };
  this.RomanToInt = function (S, Strictness) {
    var Result = 0;
    if (!$mod.TryRomanToInt(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},Strictness)) throw pas.SysUtils.EConvertError.$create("CreateFmt",[$mod.SInvalidRomanNumeral,[S]]);
    return Result;
  };
  this.RomanToIntDef = function (S, ADefault, Strictness) {
    var Result = 0;
    if (!$mod.TryRomanToInt(S,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},Strictness)) Result = ADefault;
    return Result;
  };
  this.DigitChars = rtl.createSet(null,48,57);
  this.Brackets = rtl.createSet(40,41,91,93,123,125);
  this.StdWordDelims = rtl.unionSet(rtl.createSet(null,0,32,44,46,59,47,92,58,39,34,96),$mod.Brackets);
  this.StdSwitchChars = rtl.createSet(45,47);
  this.PosSet = function (c, s) {
    var Result = 0;
    Result = $mod.PosSetEx(c,s,1);
    return Result;
  };
  this.PosSet$1 = function (c, s) {
    var Result = 0;
    Result = $mod.PosSetEx$1(c,s,1);
    return Result;
  };
  this.PosSetEx = function (c, s, count) {
    var Result = 0;
    var i = 0;
    var j = 0;
    if (s === "") {
      j = 0}
     else {
      i = s.length;
      j = count;
      if (j > i) {
        Result = 0;
        return Result;
      };
      while ((j <= i) && !pas.SysUtils.CharInSet(s.charAt(j - 1),c)) j += 1;
      if (j > i) j = 0;
    };
    Result = j;
    return Result;
  };
  this.PosSetEx$1 = function (c, s, count) {
    var Result = 0;
    var cset = [];
    var i = 0;
    var l = 0;
    l = c.length;
    cset = rtl.arraySetLength(cset,"",l);
    if (l > 0) for (var $l1 = 1, $end2 = l; $l1 <= $end2; $l1++) {
      i = $l1;
      cset[i - 1] = c.charAt(i - 1);
    };
    Result = $mod.PosSetEx(cset,s,count);
    return Result;
  };
  this.Removeleadingchars = function (S, CSet) {
    var I = 0;
    var J = 0;
    I = S.get().length;
    if (I > 0) {
      J = 1;
      while ((J <= I) && pas.SysUtils.CharInSet(S.get().charAt(J - 1),CSet)) J += 1;
      if (J > 1) pas.System.Delete(S,1,J - 1);
    };
  };
  this.RemoveTrailingChars = function (S, CSet) {
    var i = 0;
    var j = 0;
    i = S.get().length;
    if (i > 0) {
      j = i;
      while ((j > 0) && pas.SysUtils.CharInSet(S.get().charAt(j - 1),CSet)) j -= 1;
      if (j !== i) S.set(rtl.strSetLength(S.get(),j));
    };
  };
  this.RemovePadChars = function (S, CSet) {
    var I = 0;
    var J = 0;
    var K = 0;
    I = S.get().length;
    if (I === 0) return;
    J = I;
    while ((J > 0) && pas.SysUtils.CharInSet(S.get().charAt(J - 1),CSet)) J -= 1;
    if (J === 0) {
      S.set("");
      return;
    };
    S.set(rtl.strSetLength(S.get(),J));
    I = J;
    K = 1;
    while ((K <= I) && pas.SysUtils.CharInSet(S.get().charAt(K - 1),CSet)) K += 1;
    if (K > 1) pas.System.Delete(S,1,K - 1);
  };
  this.TrimLeftSet = function (S, CSet) {
    var Result = "";
    Result = S;
    $mod.Removeleadingchars({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},CSet);
    return Result;
  };
  this.TrimRightSet = function (S, CSet) {
    var Result = "";
    Result = S;
    $mod.RemoveTrailingChars({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},CSet);
    return Result;
  };
  this.TrimSet = function (S, CSet) {
    var Result = "";
    Result = S;
    $mod.RemovePadChars({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},CSet);
    return Result;
  };
  $mod.$rtti.$DynArray("SizeIntArray",{eltype: rtl.nativeint});
  $mod.$init = function () {
    $mod.AnsiResemblesProc = $mod.SoundexProc;
  };
},["JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.SScore = (((((((("00000000000000000000000000000000" + "00000000000000000000000000000000") + "0123012i02245501262301i2i2") + "000000") + "0123012i02245501262301i2i2") + "00000000000000000000000000000000") + "00000000000000000000000000000000") + "00000000000000000000000000000000") + "00000000000000000000000000000000") + "00000";
  $impl.Ord0 = "0".charCodeAt();
  $impl.OrdA = "A".charCodeAt();
  $impl.RomanValues = function (C) {
    var Result = 0;
    var $tmp1 = C;
    if ($tmp1 === "C") {
      Result = 100}
     else if ($tmp1 === "D") {
      Result = 500}
     else if ($tmp1 === "I") {
      Result = 1}
     else if ($tmp1 === "L") {
      Result = 50}
     else if ($tmp1 === "M") {
      Result = 1000}
     else if ($tmp1 === "V") {
      Result = 5}
     else if ($tmp1 === "X") {
      Result = 10}
     else {
      Result = 0;
    };
    return Result;
  };
  var RomanChars = rtl.createSet(67,68,73,76,77,86,88);
  $impl.RomanToIntDontCare = function (S) {
    var Result = 0;
    var index = "";
    var Next = "";
    var i = 0;
    var l = 0;
    var Negative = false;
    Result = 0;
    i = 0;
    Negative = (S.length > 0) && (S.charAt(0) === "-");
    if (Negative) i += 1;
    l = S.length;
    while (i < l) {
      i += 1;
      index = pas.System.upcase(S.charAt(i - 1));
      if (index.charCodeAt() in RomanChars) {
        if ((i + 1) <= l) {
          Next = pas.System.upcase(S.charAt((i + 1) - 1))}
         else Next = "\x00";
        if ((Next.charCodeAt() in RomanChars) && ($impl.RomanValues(index) < $impl.RomanValues(Next))) {
          Result += $impl.RomanValues(Next);
          Result -= $impl.RomanValues(index);
          i += 1;
        } else Result += $impl.RomanValues(index);
      } else {
        Result = 0;
        return Result;
      };
    };
    if (Negative) Result = -Result;
    return Result;
  };
  $impl.isMatch = function (level, inputstr, wilds, CWild, CinputWord, MaxInputword, maxwilds, EOS) {
    var Result = false;
    EOS.set(false);
    Result = true;
    do {
      if (wilds.charAt(CWild - 1) === "*") {
        CWild += 1;
        while (wilds.charAt(CWild - 1) === "?") {
          CWild += 1;
          CinputWord += 1;
        };
        do {
          while ((inputstr.charAt(CinputWord - 1) !== wilds.charAt(CWild - 1)) && (CinputWord <= MaxInputword)) CinputWord += 1;
          Result = $impl.isMatch(level + 1,inputstr,wilds,CWild,CinputWord,MaxInputword,maxwilds,EOS);
          if (!Result) CinputWord += 1;
        } while (!(Result || (CinputWord >= MaxInputword)));
        if (Result && EOS.get()) return Result;
        continue;
      };
      if (wilds.charAt(CWild - 1) === "?") {
        CWild += 1;
        CinputWord += 1;
        continue;
      };
      if (inputstr.charAt(CinputWord - 1) === wilds.charAt(CWild - 1)) {
        CWild += 1;
        CinputWord += 1;
        continue;
      };
      Result = false;
      return Result;
    } while (!((CinputWord > MaxInputword) || (CWild > maxwilds)));
    if ((CinputWord <= MaxInputword) || (CWild < maxwilds)) {
      Result = false}
     else if (CWild > maxwilds) {
      EOS.set(false)}
     else {
      EOS.set(wilds.charAt(CWild - 1) === "*");
      if (!EOS.get()) Result = false;
    };
    return Result;
  };
});
rtl.module("webrouter",["System","Classes","SysUtils","Web"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass($mod,"EHTTPRoute",pas.SysUtils.Exception,function () {
  });
  this.TScrollPoint = function (s) {
    if (s) {
      this.X = s.X;
      this.Y = s.Y;
    } else {
      this.X = 0.0;
      this.Y = 0.0;
    };
    this.$equal = function (b) {
      return (this.X === b.X) && (this.Y === b.Y);
    };
  };
  $mod.$rtti.$Record("TScrollPoint",{}).addFields("X",rtl.double,"Y",rtl.double);
  $mod.$rtti.$Class("TRouter");
  $mod.$rtti.$Class("TRoute");
  $mod.$rtti.$Class("THistory");
  $mod.$rtti.$ClassRef("TRouterClass",{instancetype: $mod.$rtti["TRouter"]});
  $mod.$rtti.$RefToProcVar("TRouteEvent",{procsig: rtl.newTIProcSig([["URl",rtl.string],["aRoute",$mod.$rtti["TRoute"]],["Params",pas.Classes.$rtti["TStrings"]]])});
  this.TTransitionResult = {"0": "trOK", trOK: 0, "1": "trError", trError: 1, "2": "trAbort", trAbort: 2};
  $mod.$rtti.$Enum("TTransitionResult",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TTransitionResult});
  this.THistoryKind = {"0": "hkAuto", hkAuto: 0, "1": "hkAbstract", hkAbstract: 1, "2": "hkHash", hkHash: 2, "3": "hkHTML5", hkHTML5: 3};
  $mod.$rtti.$Enum("THistoryKind",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.THistoryKind});
  $mod.$rtti.$RefToProcVar("TTransitionNotifyEvent",{procsig: rtl.newTIProcSig([["Sender",$mod.$rtti["THistory"]],["aLocation",rtl.string],["aRoute",$mod.$rtti["TRoute"]]])});
  $mod.$rtti.$RefToProcVar("TAllowTransitionEvent",{procsig: rtl.newTIProcSig([["Sender",$mod.$rtti["THistory"]],["aOld",$mod.$rtti["TRoute"]],["aNew",$mod.$rtti["TRoute"]],["Params",pas.Classes.$rtti["TStrings"]],["Allow",rtl.boolean,1]])});
  rtl.createClass($mod,"THistory",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FOnAllow = null;
      this.FRouter = null;
      this.FOnChange = null;
      this.FOnReady = null;
      this.FOnError = null;
      this.FCurrent = null;
      this.FBase = "";
    };
    this.$final = function () {
      this.FOnAllow = undefined;
      this.FRouter = undefined;
      this.FOnChange = undefined;
      this.FOnReady = undefined;
      this.FOnError = undefined;
      this.FCurrent = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetCurrent = function () {
      var Result = null;
      Result = this.FCurrent;
      return Result;
    };
    this.SetupListeners = function () {
    };
    this.Create$1 = function (aRouter) {
      this.Create$2(aRouter,"");
    };
    this.Create$2 = function (aRouter, aBase) {
      this.FRouter = aRouter;
      this.FBase = aBase;
    };
    this.NormalizeHash = function (aHash) {
      var Result = "";
      Result = aHash;
      if (pas.System.Copy(Result,1,1) !== "\/") Result = "\/" + Result;
      return Result;
    };
    this.UpdateRoute = function (aRoute) {
      this.FCurrent = aRoute;
      if (this.FOnChange != null) this.FOnChange(aRoute);
    };
    this.Destroy = function () {
      pas.System.TObject.Destroy.call(this);
    };
    this.ExpectScroll = function () {
      var Result = false;
      Result = (this.FRouter != null) && (this.FRouter.FOnScroll != null);
      return Result;
    };
    this.SupportsScroll = function () {
      var Result = false;
      Result = $mod.TBrowserState.supportsPushState() && this.ExpectScroll();
      return Result;
    };
    this.getLocation = function (base) {
      var Result = "";
      var path = "";
      path = window.location.pathname;
      if ((base !== "") && (pas.System.Pos(base,path) === 1)) path = pas.System.Copy(path,base.length + 1,path.length - base.length);
      Result = path;
      if (Result === "") Result = "\/";
      Result = (Result + window.location.search) + window.location.hash;
      return Result;
    };
    this.cleanPath = function (aPath) {
      var Result = "";
      Result = pas.SysUtils.StringReplace(aPath,"\/\/","\/",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      return Result;
    };
    this.Push = function (location) {
      var Result = 0;
      var Old = null;
      Old = this.GetCurrent();
      Result = this.TransitionTo(location);
      if (Result === $mod.TTransitionResult.trOK) {
        Result = this.doPush(location);
        if (Result === $mod.TTransitionResult.trOK) $mod.TWebScroll.handle(this.FRouter,this.GetCurrent(),Old,false);
      };
      return Result;
    };
    this.Replace = function (location) {
      var Result = 0;
      var Old = null;
      Old = this.GetCurrent();
      Result = this.TransitionTo(location);
      if (Result === $mod.TTransitionResult.trOK) {
        Result = this.doreplace(location);
        $mod.TWebScroll.handle(this.FRouter,this.GetCurrent(),Old,false);
      };
      return Result;
    };
    this.Go = function (N) {
      var Result = 0;
      Result = this.doGo(N);
      return Result;
    };
    this.NavigateForward = function () {
      var Result = 0;
      Result = this.Go(1);
      return Result;
    };
    this.NavigateBack = function () {
      var Result = 0;
      Result = this.Go(-1);
      return Result;
    };
    this.TransitionTo = function (aLocation) {
      var Result = 0;
      var Params = null;
      var R = null;
      Params = pas.Classes.TStringList.$create("Create$1");
      try {
        R = this.FRouter.FindHTTPRoute(aLocation,Params);
        var $tmp1 = this.ConfirmTransition(R,Params);
        if ($tmp1 === $mod.TTransitionResult.trOK) {
          R = this.FRouter.DoRouteRequest(R,aLocation,Params);
          this.UpdateRoute(R);
          if (this.FOnReady != null) this.FOnReady(this,aLocation,R);
        } else if ($tmp1 === $mod.TTransitionResult.trError) if (this.FOnError != null) this.FOnError(this,aLocation,R);
      } finally {
        Params = rtl.freeLoc(Params);
      };
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.ConfirmTransition = function (aRoute, Params) {
      var Result = 0;
      var Old = null;
      var allow = false;
      Old = this.GetCurrent();
      allow = true;
      if (this.FOnAllow != null) this.FOnAllow(this,Old,aRoute,Params,{get: function () {
          return allow;
        }, set: function (v) {
          allow = v;
        }});
      if (!allow) {
        this.ensureURL(false);
        Result = $mod.TTransitionResult.trAbort;
      };
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
  });
  rtl.createClass($mod,"TAbstractHistory",$mod.THistory,function () {
    this.$init = function () {
      $mod.THistory.$init.call(this);
      this.FIndex = 0;
      this.FStack = [];
    };
    this.$final = function () {
      this.FStack = undefined;
      $mod.THistory.$final.call(this);
    };
    this.MaybeGrow = function (AIndex) {
      if ((AIndex + 1) > rtl.length(this.FStack)) this.FStack = rtl.arraySetLength(this.FStack,"",AIndex + 1);
    };
    this.doPush = function (location) {
      var Result = 0;
      this.FIndex += 1;
      this.MaybeGrow(this.FIndex);
      this.FStack[this.FIndex] = location;
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.doreplace = function (location) {
      var Result = 0;
      this.FStack[this.FIndex] = location;
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.doGo = function (N) {
      var Result = 0;
      var I = 0;
      var Route = null;
      I = this.FIndex + N;
      if ((I < 0) || (I >= rtl.length(this.FStack))) {
        Result = $mod.TTransitionResult.trAbort}
       else {
        if (Result === $mod.TTransitionResult.trOK) {
          this.FIndex = 0;
          this.UpdateRoute(Route);
        };
      };
      return Result;
    };
    this.Create$2 = function (router, base) {
      $mod.THistory.Create$2.apply(this,arguments);
      this.FStack = rtl.arraySetLength(this.FStack,"",0);
      this.FIndex = -1;
    };
    this.GetCurrentLocation = function () {
      var Result = "";
      var I = 0;
      var Route = "";
      I = rtl.length(this.FStack) - 1;
      if (I >= 0) {
        Route = this.FStack[I]}
       else Result = "\/";
      Result = Route;
      return Result;
    };
    this.ensureURL = function (Push) {
      if (Push) ;
    };
    this.Kind = function () {
      var Result = 0;
      Result = $mod.THistoryKind.hkAbstract;
      return Result;
    };
  });
  rtl.createClass($mod,"THashHistory",$mod.THistory,function () {
    this.$init = function () {
      $mod.THistory.$init.call(this);
      this.FlastHash = "";
    };
    this.DoHashChange = function () {
      var NewHash = "";
      var Old = null;
      NewHash = this.$class.NormalizeHash(this.$class.getHash());
      if (NewHash === this.FlastHash) return;
      Old = this.GetCurrent();
      if (this.TransitionTo(NewHash) === $mod.TTransitionResult.trOK) {
        $mod.TWebScroll.handle(this.FRouter,this.GetCurrent(),Old,true);
        this.FlastHash = NewHash;
      } else this.$class.replaceHash(this.FlastHash);
    };
    this.SetupListeners = function () {
      if (this.SupportsScroll()) $mod.TWebScroll.Setup();
      if ($mod.TBrowserState.supportsPushState()) {
        window.addEventListener("popstate",rtl.createCallback(this,"DoHashChange"))}
       else window.addEventListener("hashchange",rtl.createCallback(this,"DoHashChange"));
    };
    this.doPush = function (location) {
      var Result = 0;
      var L = "";
      L = this.$class.NormalizeHash(location);
      this.FlastHash = L;
      this.$class.pushHash(L);
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.doreplace = function (location) {
      var Result = 0;
      var L = "";
      L = this.$class.NormalizeHash(location);
      this.FlastHash = L;
      this.$class.replaceHash(L);
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.doGo = function (N) {
      var Result = 0;
      window.history.go(N);
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.ensureURL = function (push) {
      var aHash = "";
      var CURL = "";
      CURL = this.$class.NormalizeHash(this.FlastHash);
      aHash = this.$class.getHash();
      if (aHash !== CURL) if (push) {
        this.$class.pushHash(CURL)}
       else this.$class.replaceHash(CURL);
    };
    this.GetCurrentLocation = function () {
      var Result = "";
      Result = this.$class.getHash();
      return Result;
    };
    this.pushHash = function (path) {
      if ($mod.TBrowserState.supportsPushState()) {
        $mod.TBrowserState.PushState(this.getUrl(path),false)}
       else window.location.hash = path;
    };
    this.replaceHash = function (path) {
      var H = "";
      H = this.getHash();
      if (H === path) return;
      if ($mod.TBrowserState.supportsPushState()) {
        $mod.TBrowserState.ReplaceState(this.getUrl(path))}
       else window.location.replace(this.getUrl(path));
    };
    this.getUrl = function (APath) {
      var Result = "";
      var HRef = "";
      var Idx = 0;
      HRef = window.location.href;
      Idx = pas.System.Pos("#",HRef);
      if (Idx === 0) {
        Result = HRef}
       else Result = pas.System.Copy(HRef,1,Idx - 1);
      Result = (Result + "#") + APath;
      return Result;
    };
    this.getHash = function () {
      var Result = "";
      var HRef = "";
      var Idx = 0;
      HRef = window.location.href;
      Idx = pas.System.Pos("#",HRef);
      if (Idx === 0) {
        Result = ""}
       else Result = pas.System.Copy(HRef,Idx + 1,HRef.length - Idx);
      return Result;
    };
    this.Kind = function () {
      var Result = 0;
      Result = $mod.THistoryKind.hkHash;
      return Result;
    };
  });
  rtl.createClass($mod,"THTMLHistory",$mod.THistory,function () {
    this.$init = function () {
      $mod.THistory.$init.call(this);
      this.FlastLocation = "";
    };
    this.DoStateChange = function () {
      var NewLocation = "";
      var Old = null;
      NewLocation = this.$class.getLocation(this.FBase);
      if (NewLocation === this.FlastLocation) return;
      Old = this.GetCurrent();
      if (this.TransitionTo(NewLocation) === $mod.TTransitionResult.trOK) {
        $mod.TWebScroll.handle(this.FRouter,this.GetCurrent(),Old,true);
        this.FlastLocation = NewLocation;
      } else this.$class.replaceState(this.FlastLocation);
    };
    this.SetupListeners = function () {
      window.addEventListener("popstate",rtl.createCallback(this,"DoStateChange"));
    };
    this.doPush = function (location) {
      var Result = 0;
      this.$class.pushState(this.getUrl(location),false);
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.doreplace = function (location) {
      var Result = 0;
      this.$class.replaceState(this.getUrl(location));
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.doGo = function (N) {
      var Result = 0;
      window.history.go(N);
      Result = $mod.TTransitionResult.trOK;
      return Result;
    };
    this.ensureURL = function (push) {
      var URL = "";
      var Actual = "";
      var Expected = "";
      Actual = this.GetCurrentLocation();
      Expected = this.FlastLocation;
      if (Actual !== Expected) {
        URL = this.getUrl(Expected);
        if (push) {
          this.$class.pushState(URL,false)}
         else this.$class.replaceState(URL);
      };
    };
    this.GetCurrentLocation = function () {
      var Result = "";
      Result = window.location;
      return Result;
    };
    this.pushState = function (path, doReplace) {
      $mod.TBrowserState.PushState(path,doReplace);
    };
    this.replaceState = function (path) {
      this.pushState(path,true);
    };
    this.getUrl = function (ALocation) {
      var Result = "";
      Result = $mod.IncludeHTTPPathDelimiter(this.FBase);
      while ((ALocation !== "") && (pas.System.Copy(ALocation,1,1) === "\/")) ALocation = pas.System.Copy(ALocation,2,ALocation.length - 1);
      Result = this.FBase + ALocation;
      return Result;
    };
    this.Kind = function () {
      var Result = 0;
      Result = $mod.THistoryKind.hkHTML5;
      return Result;
    };
  });
  rtl.createClass($mod,"TRoute",pas.Classes.TCollectionItem,function () {
    this.$init = function () {
      pas.Classes.TCollectionItem.$init.call(this);
      this.FDefault = false;
      this.FEvent = null;
      this.FURLPattern = "";
    };
    this.$final = function () {
      this.FEvent = undefined;
      pas.Classes.TCollectionItem.$final.call(this);
    };
    this.SetURLPattern = function (AValue) {
      var V = "";
      V = this.$class.NormalizeURLPattern(AValue);
      if (this.FURLPattern === V) return;
      this.FURLPattern = V;
    };
    this.NormalizeURLPattern = function (AValue) {
      var Result = "";
      var V = "";
      V = $mod.IncludeHTTPPathDelimiter(AValue);
      if ((V !== "\/") && (V.charAt(0) === "\/")) pas.System.Delete({get: function () {
          return V;
        }, set: function (v) {
          V = v;
        }},1,1);
      Result = V;
      return Result;
    };
    this.Matches = function (APattern) {
      var Result = false;
      Result = pas.SysUtils.CompareText(this.FURLPattern,this.$class.NormalizeURLPattern(APattern)) === 0;
      return Result;
    };
    this.MatchPattern = function (Path, L) {
      var Self = this;
      var Result = false;
      function StartsWith(C, S) {
        var Result = false;
        Result = (S.length > 0) && (S.charAt(0) === C);
        return Result;
      };
      function EndsWith(C, S) {
        var Result = false;
        var L = 0;
        L = S.length;
        Result = (L > 0) && (S.charAt(L - 1) === C);
        return Result;
      };
      function ExtractNextPathLevel(ALeft, ALvl, ARight, ADelim) {
        var P = 0;
        pas.System.Writeln("ExtractNextPathLevel >:",ALeft.get()," (",ALvl.get(),") ",ARight.get());
        if (ALvl.get() !== ADelim) {
          ALeft.set(ALeft.get() + ALvl.get());
          if (StartsWith(ADelim,ARight.get())) {
            ALeft.set(ALeft.get() + ADelim);
            pas.System.Delete(ARight,1,1);
          };
        };
        P = pas.System.Pos(ADelim,ARight.get());
        if (P === 0) P = ARight.get().length + 1;
        ALvl.set(pas.System.Copy(ARight.get(),1,P - 1));
        ARight.set(pas.System.Copy(ARight.get(),P,2147483647));
        pas.System.Writeln("ExtractNextPathLevel <:",ALeft.get()," (",ALvl.get(),") ",ARight.get());
      };
      function ExtractPrevPathLevel(ALeft, ALvl, ARight, ADelim) {
        var P = 0;
        var L = 0;
        pas.System.Writeln("ExtractPrevPathLevel >:",ALeft.get()," (",ALvl.get(),") ",ARight.get());
        if (ALvl.get() !== ADelim) {
          ARight.set(ALvl.get() + ARight.get());
          L = ALeft.get().length;
          if (EndsWith(ADelim,ALeft.get())) {
            ARight.set(ADelim + ARight.get());
            pas.System.Delete(ALeft,L,1);
          };
        };
        P = pas.strutils.RPos(ADelim,ALeft.get());
        ALvl.set(pas.System.Copy(ALeft.get(),P + 1,2147483647));
        ALeft.set(pas.System.Copy(ALeft.get(),1,P));
        pas.System.Writeln("ExtractPrevPathLevel <:",ALeft.get()," (",ALvl.get(),") ",ARight.get());
      };
      function AddParam(aName, AValue) {
        if (L != null) L.SetValue(aName,AValue);
      };
      var APathInfo = "";
      var APattern = "";
      var VLeftPat = "";
      var VRightPat = "";
      var VLeftVal = "";
      var VRightVal = "";
      var VVal = "";
      var VPat = "";
      var VName = "";
      Result = false;
      if (Self.FURLPattern === "") return Result;
      APathInfo = Path;
      APattern = Self.FURLPattern;
      pas.System.Delete({get: function () {
          return APattern;
        }, set: function (v) {
          APattern = v;
        }},pas.System.Pos("?",APattern),2147483647);
      pas.System.Delete({get: function () {
          return APathInfo;
        }, set: function (v) {
          APathInfo = v;
        }},pas.System.Pos("?",APathInfo),2147483647);
      if (StartsWith("\/",APattern)) pas.System.Delete({get: function () {
          return APattern;
        }, set: function (v) {
          APattern = v;
        }},1,1);
      if (StartsWith("\/",APathInfo)) pas.System.Delete({get: function () {
          return APathInfo;
        }, set: function (v) {
          APathInfo = v;
        }},1,1);
      VLeftPat = "";
      VLeftVal = "";
      VPat = "\/";
      VVal = "\/";
      VRightPat = APattern;
      VRightVal = APathInfo;
      pas.System.Writeln("Check match on ",Self.FURLPattern);
      do {
        ExtractNextPathLevel({get: function () {
            return VLeftPat;
          }, set: function (v) {
            VLeftPat = v;
          }},{get: function () {
            return VPat;
          }, set: function (v) {
            VPat = v;
          }},{get: function () {
            return VRightPat;
          }, set: function (v) {
            VRightPat = v;
          }},"\/");
        ExtractNextPathLevel({get: function () {
            return VLeftVal;
          }, set: function (v) {
            VLeftVal = v;
          }},{get: function () {
            return VVal;
          }, set: function (v) {
            VVal = v;
          }},{get: function () {
            return VRightVal;
          }, set: function (v) {
            VRightVal = v;
          }},"\/");
        pas.System.Writeln("Pat: ",VPat," Val: ",VVal);
        if (StartsWith(":",VPat)) {
          AddParam(pas.System.Copy(VPat,2,2147483647),VVal)}
         else if (StartsWith("*",VPat)) {
          VName = pas.System.Copy(VPat,2,2147483647);
          VLeftPat = VRightPat;
          VLeftVal = VVal + VRightVal;
          VPat = "\/";
          VVal = "\/";
          VRightPat = "";
          VRightVal = "";
          if (EndsWith("\/",VLeftPat) && !EndsWith("\/",VLeftVal)) pas.System.Delete({get: function () {
              return VLeftPat;
            }, set: function (v) {
              VLeftPat = v;
            }},VLeftPat.length,1);
          do {
            ExtractPrevPathLevel({get: function () {
                return VLeftPat;
              }, set: function (v) {
                VLeftPat = v;
              }},{get: function () {
                return VPat;
              }, set: function (v) {
                VPat = v;
              }},{get: function () {
                return VRightPat;
              }, set: function (v) {
                VRightPat = v;
              }},"\/");
            ExtractPrevPathLevel({get: function () {
                return VLeftVal;
              }, set: function (v) {
                VLeftVal = v;
              }},{get: function () {
                return VVal;
              }, set: function (v) {
                VVal = v;
              }},{get: function () {
                return VRightVal;
              }, set: function (v) {
                VRightVal = v;
              }},"\/");
            if (StartsWith(":",VPat)) {
              AddParam(pas.System.Copy(VPat,2,2147483647),VVal);
            } else if (!((VPat === "") && (VLeftPat === "")) && (VPat !== VVal)) return Result;
            if ((VLeftPat === "") || (VLeftVal === "")) {
              if (VLeftPat === "") {
                if (VName !== "") AddParam(VName,VLeftVal + VVal);
                Result = true;
              };
              return Result;
            };
          } while (!false);
        } else if (VPat !== VVal) return Result;
        if ((VRightPat === "") || (VRightVal === "")) {
          if ((VRightPat === "") && (VRightVal === "")) {
            Result = true}
           else if (VRightPat === "\/") Result = true;
          return Result;
        };
      } while (!false);
      return Result;
    };
    this.FullPath = function () {
      var Result = "";
      Result = this.FURLPattern;
      return Result;
    };
    var $r = this.$rtti;
    $r.addProperty("Default",0,rtl.boolean,"FDefault","FDefault");
    $r.addProperty("URLPattern",2,rtl.string,"FURLPattern","SetURLPattern");
    $r.addProperty("Event",0,$mod.$rtti["TRouteEvent"],"FEvent","FEvent");
  });
  $mod.$rtti.$ClassRef("TRouteClass",{instancetype: $mod.$rtti["TRoute"]});
  rtl.createClass($mod,"TRouteList",pas.Classes.TCollection,function () {
    this.GetR = function (AIndex) {
      var Result = null;
      Result = rtl.as(this.GetItem(AIndex),$mod.TRoute);
      return Result;
    };
    this.SetR = function (AIndex, AValue) {
      this.SetItem(AIndex,AValue);
    };
  });
  rtl.createClass($mod,"TRouteObject",pas.System.TObject,function () {
  });
  $mod.$rtti.$ClassRef("TRouteObjectClass",{instancetype: $mod.$rtti["TRouteObject"]});
  $mod.$rtti.$RefToProcVar("TBeforeRouteEvent",{procsig: rtl.newTIProcSig([["Sender",pas.System.$rtti["TObject"]],["ARouteURL",rtl.string,1]])});
  $mod.$rtti.$RefToProcVar("TAfterRouteEvent",{procsig: rtl.newTIProcSig([["Sender",pas.System.$rtti["TObject"]],["ARouteURL",rtl.string,2]])});
  this.TScrollParams = function (s) {
    if (s) {
      this.selector = s.selector;
      this.Position = new $mod.TScrollPoint(s.Position);
    } else {
      this.selector = "";
      this.Position = new $mod.TScrollPoint();
    };
    this.$equal = function (b) {
      return (this.selector === b.selector) && this.Position.$equal(b.Position);
    };
  };
  $mod.$rtti.$Record("TScrollParams",{}).addFields("selector",rtl.string,"Position",$mod.$rtti["TScrollPoint"]);
  $mod.$rtti.$RefToProcVar("TPageScrollEvent",{procsig: rtl.newTIProcSig([["Sender",pas.System.$rtti["TObject"]],["aTo",$mod.$rtti["TRoute"]],["aFrom",$mod.$rtti["TRoute"]],["aPosition",$mod.$rtti["TScrollPoint"]]],$mod.$rtti["TScrollParams"])});
  rtl.createClass($mod,"TRouter",pas.Classes.TComponent,function () {
    this.FService = null;
    this.FServiceClass = null;
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.FAfterRequest = null;
      this.FBeforeRequest = null;
      this.FHistory = null;
      this.FOnScroll = null;
      this.FRoutes = null;
    };
    this.$final = function () {
      this.FAfterRequest = undefined;
      this.FBeforeRequest = undefined;
      this.FHistory = undefined;
      this.FOnScroll = undefined;
      this.FRoutes = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.DoneService = function () {
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FService;
        }, set: function (v) {
          this.p.FService = v;
        }});
    };
    this.GetHistory = function () {
      var Result = null;
      if (this.FHistory === null) this.InitHistory($mod.THistoryKind.hkAuto,"");
      Result = this.FHistory;
      return Result;
    };
    this.GetHistoryKind = function () {
      var Result = 0;
      if (!(this.GetHistory() != null)) {
        Result = $mod.THistoryKind.hkAuto}
       else Result = this.GetHistory().Kind();
      return Result;
    };
    this.GetR = function (AIndex) {
      var Result = null;
      Result = this.FRoutes.GetR(AIndex);
      return Result;
    };
    this.GetRouteCount = function () {
      var Result = 0;
      Result = this.FRoutes.GetCount();
      return Result;
    };
    this.CreateHTTPRoute = function (AClass, APattern, IsDefault) {
      var Result = null;
      this.CheckDuplicate(APattern,IsDefault);
      Result = AClass.$create("Create$1",[this.FRoutes]);
      Result.SetURLPattern(APattern);
      Result.FDefault = IsDefault;
      return Result;
    };
    this.CreateRouteList = function () {
      var Result = null;
      Result = $mod.TRouteList.$create("Create$1",[$mod.TRoute]);
      return Result;
    };
    this.CheckDuplicate = function (APattern, isDefault) {
      var I = 0;
      var DI = 0;
      var R = null;
      DI = -1;
      for (var $l1 = 0, $end2 = this.FRoutes.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        R = this.FRoutes.GetR(I);
        if (R.FDefault) DI = I;
        if (R.Matches(APattern)) throw $mod.EHTTPRoute.$create("CreateFmt",[rtl.getResStr(pas.webrouter,"EDuplicateRoute"),[APattern]]);
      };
      if (isDefault && (DI !== -1)) throw $mod.EHTTPRoute.$create("CreateFmt",[rtl.getResStr(pas.webrouter,"EDuplicateDefaultRoute"),[APattern]]);
    };
    this.DoRouteRequest = function (ARoute, AURL, AParams) {
      var Result = null;
      Result = ARoute;
      Result.HandleRequest(this,AURL,AParams);
      return Result;
    };
    this.DoRouteRequest$1 = function (AURL) {
      var Result = null;
      var APath = "";
      var Params = null;
      APath = AURL;
      Params = pas.Classes.TStringList.$create("Create$1");
      try {
        Result = this.GetRoute(APath,Params);
        Result = this.DoRouteRequest(Result,APath,Params);
      } finally {
        Params = rtl.freeLoc(Params);
      };
      return Result;
    };
    this.Create$1 = function (AOwner) {
      pas.Classes.TComponent.Create$1.call(this,AOwner);
      this.FRoutes = this.CreateRouteList();
    };
    this.Destroy = function () {
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FRoutes;
        }, set: function (v) {
          this.p.FRoutes = v;
        }});
      pas.Classes.TComponent.Destroy.call(this);
    };
    this.InitHistory = function (aKind, aBase) {
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FHistory;
        }, set: function (v) {
          this.p.FHistory = v;
        }});
      var $tmp1 = aKind;
      if ($tmp1 === $mod.THistoryKind.hkAbstract) {
        this.FHistory = $mod.TAbstractHistory.$create("Create$2",[this,aBase])}
       else if ($tmp1 === $mod.THistoryKind.hkHash) {
        this.FHistory = $mod.THashHistory.$create("Create$2",[this,aBase])}
       else if ($tmp1 === $mod.THistoryKind.hkHTML5) {
        this.FHistory = $mod.THTMLHistory.$create("Create$2",[this,aBase])}
       else if ($tmp1 === $mod.THistoryKind.hkAuto) if ($mod.TBrowserState.supportsPushState()) {
        this.FHistory = $mod.THTMLHistory.$create("Create$2",[this,aBase])}
       else this.FHistory = $mod.THashHistory.$create("Create$2",[this,aBase]);
      this.FHistory.SetupListeners();
    };
    this.DeleteRoute = function (AIndex) {
      this.FRoutes.Delete(AIndex);
    };
    this.DeleteRouteByID = function (AID) {
      var R = null;
      R = this.FRoutes.FindItemID(AID);
      R = rtl.freeLoc(R);
    };
    this.DeleteRoute$1 = function (ARoute) {
      ARoute = rtl.freeLoc(ARoute);
    };
    this.SanitizeRoute = function (Path) {
      var Result = "";
      Result = Path;
      return Result;
    };
    this.Service = function () {
      var Result = null;
      if (this.FService === null) this.FService = this.ServiceClass().$create("Create$1",[null]);
      Result = this.FService;
      return Result;
    };
    this.ServiceClass = function () {
      var Result = null;
      if (this.FServiceClass === null) this.FServiceClass = $mod.TRouter;
      Result = this.FServiceClass;
      return Result;
    };
    this.SetServiceClass = function (AClass) {
      if (this.FService != null) pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FService;
        }, set: function (v) {
          this.p.FService = v;
        }});
      this.FServiceClass = AClass;
    };
    this.RegisterRoute = function (APattern, AEvent, IsDefault) {
      var Result = null;
      Result = this.CreateHTTPRoute($impl.TRouteEventHandler,APattern,IsDefault);
      Result.FEvent = AEvent;
      return Result;
    };
    this.RegisterRoute$1 = function (APattern, AObjectClass, IsDefault) {
      var Result = null;
      Result = this.CreateHTTPRoute($impl.TRouteObjectHandler,APattern,IsDefault);
      Result.FObjectClass = AObjectClass;
      return Result;
    };
    this.FindHTTPRoute = function (Path, Params) {
      var Result = null;
      var I = 0;
      var APathInfo = "";
      APathInfo = this.$class.SanitizeRoute(Path);
      Result = null;
      I = 0;
      while ((Result === null) && (I < this.FRoutes.GetCount())) {
        Result = this.FRoutes.GetR(I);
        if (!Result.MatchPattern(APathInfo,Params)) Result = null;
        I += 1;
      };
      return Result;
    };
    this.GetRoute = function (Path, Params) {
      var Result = null;
      Result = this.FindHTTPRoute(Path,Params);
      if (!(Result != null)) throw $mod.EHTTPRoute.$create("Create$1",["Not found"]);
      return Result;
    };
    this.RouteRequest = function (ARouteURL) {
      var Result = null;
      var AURL = "";
      AURL = ARouteURL;
      if (this.FBeforeRequest != null) this.FBeforeRequest(this,{get: function () {
          return AURL;
        }, set: function (v) {
          AURL = v;
        }});
      Result = this.DoRouteRequest$1(AURL);
      if (this.FAfterRequest != null) this.FAfterRequest(this,AURL);
      return Result;
    };
    this.GetRequestPath = function (URL) {
      var Result = "";
      Result = this.$class.SanitizeRoute(URL);
      return Result;
    };
    this.GetCurrentLocation = function () {
      var Result = "";
      return Result;
    };
    this.Push = function (location) {
      var Result = 0;
      Result = this.GetHistory().Push(location);
      return Result;
    };
    this.Replace = function (location) {
      var Result = 0;
      Result = this.GetHistory().Replace(location);
      return Result;
    };
    this.Go = function (N) {
      var Result = 0;
      Result = this.GetHistory().Go(N);
      return Result;
    };
    this.NavigateForward = function () {
      var Result = 0;
      Result = this.Go(1);
      return Result;
    };
    this.NavigateBack = function () {
      var Result = 0;
      Result = this.Go(-1);
      return Result;
    };
  });
  rtl.createClass($mod,"TWebScroll",pas.System.TObject,function () {
    this.scrollToPosition = function (AScroll) {
      var el = null;
      var P = new $mod.TScrollPoint();
      if (AScroll.selector !== "") {
        el = document.querySelector(AScroll.selector);
        if (el != null) {
          P = new $mod.TScrollPoint($impl.getElementPosition(el,new $mod.TScrollPoint(AScroll.Position)))}
         else P = new $mod.TScrollPoint(AScroll.Position);
      } else P = new $mod.TScrollPoint(AScroll.Position);
      window.scrollTo(Math.round(P.X),Math.round(P.Y));
    };
    this.getScrollPosition = function () {
      var Result = new $mod.TScrollPoint();
      var Key = "";
      var O = undefined;
      Key = this.GetStateKey();
      Result.X = 0;
      Result.Y = 0;
      if (Key !== "") {
        O = $impl.positionStore[Key];
        if (rtl.isObject(O)) {
          Result.X = rtl.getNumber(rtl.getObject(O)["x"]);
          Result.Y = rtl.getNumber(rtl.getObject(O)["y"]);
        };
      };
      return Result;
    };
    this.SaveScrollPosition = function () {
      var Key = "";
      Key = this.GetStateKey();
      if (Key !== "") $impl.positionStore[Key] = pas.JS.New(["x",window.scrollX,"y",window.scrollY]);
    };
    this.Setup = function () {
      window.history.replaceState(pas.JS.New(["key",this.GetStateKey()]),"");
      window.addEventListener("popstate",$impl.DoScroll);
    };
    this.handle = function (router, ato, afrom, isPop) {
      var Position = new $mod.TScrollPoint();
      var ScrollParams = new $mod.TScrollParams();
      if (!(router.FOnScroll != null)) return;
      Position = new $mod.TScrollPoint(this.getScrollPosition());
      ScrollParams = new $mod.TScrollParams(router.FOnScroll(router,ato,afrom,new $mod.TScrollPoint(Position)));
      this.scrollToPosition(new $mod.TScrollParams(ScrollParams));
    };
    this.GetStateKey = function () {
      var Result = "";
      Result = (new Date()).toString();
      return Result;
    };
  });
  rtl.createClass($mod,"TBrowserState",pas.System.TObject,function () {
    this.TheKey = "";
    this.GenKey = function () {
      var Result = "";
      Result = pas.SysUtils.IntToStr(Date.now());
      return Result;
    };
    this.supportsPushState = function () {
      var Self = this;
      var Result = false;
      var UA = "";
      function isB(B) {
        var Result = false;
        Result = pas.System.Pos(B,UA) !== 0;
        return Result;
      };
      if ((Result && pas.JS.isDefined(window)) && pas.JS.isDefined(window.navigator)) {
        UA = window.navigator.userAgent;
        Result = !((((isB("Android 2.") || isB("Android 4.0")) || isB("Mobile Safari")) || isB("Chrome")) || isB("Windows Phone"));
        if (Result) Result = pas.JS.isDefined(window.history) && pas.JS.isDefined(window.history);
      };
      return Result;
    };
    this.GetStateKey = function () {
      var Result = "";
      if (this.TheKey === "") this.TheKey = this.GenKey();
      Result = this.TheKey;
      return Result;
    };
    this.SetStateKey = function (akey) {
      this.TheKey = akey;
    };
    this.PushState = function (aUrl, replace) {
      var O = null;
      $mod.TWebScroll.SaveScrollPosition();
      try {
        if (!replace) this.SetStateKey(this.GenKey());
        O = pas.JS.New(["key",this.GetStateKey()]);
        if (replace) {
          window.history.replaceState(O,"",aUrl)}
         else window.history.pushState(O,"",aUrl);
      } catch ($e) {
        if (replace) {
          window.location.replace(aUrl)}
         else window.location.assign(aUrl);
      };
    };
    this.ReplaceState = function (aUrl) {
      this.PushState(aUrl,true);
    };
  });
  this.Router = function () {
    var Result = null;
    Result = $mod.TRouter.Service();
    return Result;
  };
  this.IncludeHTTPPathDelimiter = function (S) {
    var Result = "";
    if (pas.System.Copy(S,S.length,1) === "\/") {
      Result = S}
     else Result = S + "\/";
    return Result;
  };
  $mod.$init = function () {
    $impl.positionStore = pas.JS.New([]);
  };
},["strutils","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass($impl,"TRouteObjectHandler",$mod.TRoute,function () {
    this.$init = function () {
      $mod.TRoute.$init.call(this);
      this.FObjectClass = null;
    };
    this.$final = function () {
      this.FObjectClass = undefined;
      $mod.TRoute.$final.call(this);
    };
    this.HandleRequest = function (ARouter, URL, Params) {
      var O = null;
      O = this.FObjectClass.$create("Create");
      try {
        O.HandleRoute(URL,Params);
      } finally {
        O = rtl.freeLoc(O);
      };
    };
  });
  rtl.createClass($impl,"TRouteEventHandler",$mod.TRoute,function () {
    this.HandleRequest = function (ARouter, URL, Params) {
      if (this.FEvent != null) this.FEvent(URL,this,Params);
    };
  });
  $impl.DoScroll = function (Event) {
    var Result = false;
    $mod.TWebScroll.SaveScrollPosition();
    Result = true;
    return Result;
  };
  $impl.positionStore = null;
  $impl.getElementPosition = function (el, offset) {
    var Result = new $mod.TScrollPoint();
    var DocEl = null;
    var docRect = null;
    var elRect = null;
    DocEl = document.documentElement;
    docRect = DocEl.getBoundingClientRect();
    elRect = el.getBoundingClientRect();
    Result.X = (elRect.left - docRect.left) - offset.X;
    Result.Y = (elRect.top - docRect.top) - offset.Y;
    return Result;
  };
  $mod.$resourcestrings = {EDuplicateRoute: {org: "Duplicate route pattern: %s"}, EDuplicateDefaultRoute: {org: "Duplicate default route registered with pattern: %s"}};
});
rtl.module("AvammRouter",["System","Classes","SysUtils","webrouter"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TAvammRouter",pas.webrouter.TRouter,function () {
    this.DoRouteRequest = function (ARoute, AURL, AParams) {
      var Result = null;
      try {
        Result = ARoute;
        if (Result != null) {
          Result.HandleRequest(this,AURL,AParams)}
         else if (AURL !== "\/") throw pas.SysUtils.Exception.$create("Create$1",[rtl.getResStr(pas.AvammRouter,"strRouteNotFound")]);
      } catch ($e) {
        throw pas.SysUtils.Exception.$create("Create$1",[rtl.getResStr(pas.AvammRouter,"strRouteNotFound")]);
      };
      return Result;
    };
  });
  this.Router = function () {
    var Result = null;
    Result = $mod.TAvammRouter.Service();
    return Result;
  };
  $mod.$resourcestrings = {strRouteNotFound: {org: "Das gewählt Objekt wurde nicht gefunden, oder Sie besitzen nicht die nötigen Rechte um es zu sehen !"}};
  $mod.$init = function () {
    $mod.Router().$class.SetServiceClass($mod.TAvammRouter);
  };
});
rtl.module("dhtmlx_form",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_base",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.AppendCSS = function (url, onLoad, onError) {
    var file = url;
    var link = document.createElement( "link" );
    link.href = file;
    link.type = "text/css";
    link.rel = "stylesheet";
    link.media = "screen,print";
    link.onload = onLoad;
    link.onerror = onError;
    document.getElementsByTagName( "head" )[0].appendChild( link );
  };
  this.AppendJS = function (url, onLoad, onError) {
    if (document.getElementById(url) == null) {
      var file = url;
      var link = document.createElement( "script" );
      link.id = url;
      link.src = file;
      link.type = "text/javascript";
      link.onload = onLoad;
      link.onerror = onError;
      document.getElementsByTagName( "head" )[0].appendChild( link );
    };
  };
  this.WidgetsetLoaded = null;
  $mod.$init = function () {
    $impl.LoadDHTMLX();
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.LoadDHTMLX = function () {
    function DoLoadDHTMLX(resolve, reject) {
      function ScriptLoadedJS() {
        window.dhx4.skin = 'material';
        pas.System.Writeln("DHTMLX loaded...");
        resolve(true);
      };
      function ScriptErrorJS() {
        $mod.AppendJS("https:\/\/cdn.dhtmlx.com\/edge\/dhtmlx.js",ScriptLoadedJS,null);
        $mod.AppendCSS("https:\/\/cdn.dhtmlx.com\/edge\/dhtmlx.css",null,null);
        $mod.AppendCSS("https:\/\/use.fontawesome.com\/releases\/v5.2.0\/css\/all.css",null,null);
        $mod.AppendCSS("https:\/\/use.fontawesome.com\/releases\/v5.2.0\/css\/v4-shims.css",null,null);
      };
      pas.System.Writeln("Loading DHTMLX...");
      $mod.AppendJS("appbase\/dhtmlx\/dhtmlx.js",ScriptLoadedJS,ScriptErrorJS);
      $mod.AppendCSS("appbase\/dhtmlx\/dhtmlx.css",null,null);
      $mod.AppendCSS("appbase\/dhtmlx\/fonts\/font_awesome\/css\/font-awesome.min.css",null,null);
    };
    $mod.WidgetsetLoaded = new Promise(DoLoadDHTMLX);
  };
});
rtl.module("Avamm",["System","JS","Web","AvammRouter","webrouter","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $mod.$rtti.$ProcVar("TJSValueCallback",{procsig: rtl.newTIProcSig([["aName",rtl.jsvalue]])});
  this.RegisterSidebarRoute = function (aName, Route, Event, Icon) {
    var aRoute = null;
    aRoute = pas.webrouter.Router().RegisterRoute(Route,Event,false);
    if ($mod.OnAddToSidebar !== null) {
      $mod.OnAddToSidebar(aName,aRoute,Icon);
    };
  };
  this.LoadData = function (url, IgnoreLogin, Datatype, Timeout) {
    var Result = null;
    function DoRequest(resolve, reject) {
      var req = null;
      var oTimeout = 0;
      function DoOnLoad(event) {
        var Result = false;
        if (req.status === 200) {
          resolve(req)}
         else reject(req);
        window.clearTimeout(oTimeout);
        return Result;
      };
      function DoOnError(event) {
        var Result = false;
        pas.System.Writeln("Request not succesful (error)");
        reject(req);
        window.clearTimeout(oTimeout);
        return Result;
      };
      function RequestSaveTimeout() {
        pas.System.Writeln("Request Timeout");
        window.clearTimeout(oTimeout);
        req.abort();
        reject(req);
      };
      req = new XMLHttpRequest();
      req.open("get",$mod.GetBaseUrl() + url,true);
      if (($mod.AvammLogin !== "") && !IgnoreLogin) {
        req.setRequestHeader("Authorization","Basic " + $mod.AvammLogin);
      };
      if (Datatype !== "") req.overrideMimeType(Datatype);
      req.timeout = Timeout - 100;
      req.addEventListener("load",DoOnLoad);
      req.addEventListener("error",DoOnError);
      try {
        req.send();
      } catch ($e) {
        pas.System.Writeln("Request not succesful");
        reject(req);
      };
      oTimeout = window.setTimeout(RequestSaveTimeout,Timeout);
    };
    function ReturnResult(res) {
      var Result = undefined;
      pas.System.Writeln("Returning... ",res);
      Result = res;
      return Result;
    };
    var requestPromise = null;
    requestPromise = new Promise(DoRequest);
    Result = requestPromise.then(ReturnResult).catch(ReturnResult);
    return Result;
  };
  this.StoreData = function (url, Content, IgnoreLogin, Datatype, Timeout) {
    var Result = null;
    function DoRequest(resolve, reject) {
      var req = null;
      var oTimeout = 0;
      function DoOnLoad(event) {
        var Result = false;
        if (req.status === 200) {
          resolve(req)}
         else reject(req);
        window.clearTimeout(oTimeout);
        return Result;
      };
      function DoOnError(event) {
        var Result = false;
        pas.System.Writeln("Request not succesful (error)");
        reject(req);
        window.clearTimeout(oTimeout);
        return Result;
      };
      function RequestSaveTimeout() {
        pas.System.Writeln("Request Timeout");
        window.clearTimeout(oTimeout);
        req.abort();
        reject(req);
      };
      req = new XMLHttpRequest();
      req.open("post",$mod.GetBaseUrl() + url,true);
      if (($mod.AvammLogin !== "") && !IgnoreLogin) {
        req.setRequestHeader("Authorization","Basic " + $mod.AvammLogin);
      };
      if (Datatype !== "") req.overrideMimeType(Datatype);
      req.timeout = Timeout - 100;
      req.addEventListener("load",DoOnLoad);
      req.addEventListener("error",DoOnError);
      try {
        req.send(Content);
      } catch ($e) {
        pas.System.Writeln("Request not succesful");
        reject(req);
      };
      oTimeout = window.setTimeout(RequestSaveTimeout,Timeout);
    };
    function ReturnResult(res) {
      var Result = undefined;
      pas.System.Writeln("Returning... ",res);
      Result = res;
      return Result;
    };
    var requestPromise = null;
    requestPromise = new Promise(DoRequest);
    Result = requestPromise.then(ReturnResult).catch(ReturnResult);
    return Result;
  };
  this.LoadModule = function (aName, DoAfter) {
    function ModuleLoaded(aObj) {
      console.log(aObj);
      rtl.run(aObj.target.id.split("/")[0]);
      if (DoAfter) DoAfter(aObj);
    };
    pas.dhtmlx_base.AppendJS(((pas.SysUtils.LowerCase(aName) + "\/") + pas.SysUtils.LowerCase(aName)) + ".js",ModuleLoaded,null);
  };
  this.WaitForAssigned = function (name, callback) {
    var interval = 10;
    function Check() {
      if (pas.System.Assigned(window[name])) {
        callback(window[name])}
       else window.setTimeout(Check,interval);
    };
    window.setTimeout(Check,interval);
  };
  this.CheckLogin = function () {
    var Result = null;
    function IntDoCheckLogin(resolve, reject) {
      function CheckStatus(aValue) {
        var Result = undefined;
        function DoCheckStatus(resolve, reject) {
          pas.System.Writeln("CheckStatus:");
          console.log(aValue);
          var $tmp1 = rtl.getObject(aValue).status;
          if ($tmp1 === 401) {
            resolve(rtl.getObject(aValue).status)}
           else if ($tmp1 === 403) {
            resolve(rtl.getObject(aValue).status)}
           else if ($tmp1 === 200) {
            reject(new Error(rtl.getResStr(pas.Avamm,"strServerMustbeConfigured")));
            $mod.LoadModule("config",null);
            try {
              document.getElementById("pStatusHint").style.setProperty("display","none");
            } catch ($e) {
            };
          } else if ($tmp1 === 0) {
            reject(new Error(rtl.getResStr(pas.Avamm,"strServerNotRea")));
            window.dispatchEvent(pas.Avamm.ConnectionErrorEvent);
          } else {
            reject(new Error((rtl.getResStr(pas.Avamm,"strServerNotRea") + " ") + pas.SysUtils.IntToStr(rtl.getObject(aValue).status)));
            window.dispatchEvent(pas.Avamm.ConnectionErrorEvent);
          };
        };
        Result = new Promise(DoCheckStatus);
        console.log(Result);
        return Result;
      };
      function GetLoginData(aValue) {
        var Result = undefined;
        var tStatusResult = undefined;
        function DoGetLoginData(aValue) {
          var Result = undefined;
          function DoIntGetLoginData(resolve, reject) {
            function LoginSuccessful(aValue) {
              var Result = undefined;
              pas.System.Writeln("GetLoginData:");
              console.log(aValue);
              if (aValue == true) {
                resolve(true)}
               else reject(rtl.getResStr(pas.Avamm,"strLoginFailed"));
              return Result;
            };
            window.dispatchEvent(pas.Avamm.BeforeLoginEvent);
            if (tStatusResult == 401) {
              if ($mod.OnLoginForm === null) {
                reject(new Error(rtl.getResStr(pas.Avamm,"strNoLoginFormA")))}
               else {
                $mod.OnLoginForm().then(LoginSuccessful);
              };
            } else resolve(true);
          };
          Result = new Promise(DoIntGetLoginData);
          return Result;
        };
        tStatusResult = aValue;
        Result = pas.dhtmlx_base.WidgetsetLoaded.then(DoGetLoginData);
        return Result;
      };
      function GetRights(aValue) {
        var Result = undefined;
        function CatchRights(resolve, reject) {
          function CheckRightsData(aValue) {
            var Result = undefined;
            if (rtl.getObject(aValue).status === 200) {
              pas.Avamm.UserOptions = JSON.parse(aValue.responseText);
              resolve(aValue);
            } else reject(aValue);
            return Result;
          };
          $mod.LoadData("\/configuration\/userstatus",false,"",6000).then(CheckRightsData);
        };
        function DoLogout(aValue) {
          var Result = undefined;
          pas.System.Writeln("Credentials wrong Logging out");
          $mod.AvammLogin = "";
          window.dispatchEvent(pas.Avamm.AfterLogoutEvent);
          return Result;
        };
        function SetupUser(aValue) {
          var Result = undefined;
          pas.System.Writeln("User Login successful...");
          window.dispatchEvent(pas.Avamm.AfterLoginEvent);
          return Result;
        };
        Result = (new Promise(CatchRights)).then(SetupUser).catch(DoLogout);
        return Result;
      };
      Result = Promise.all([$mod.LoadData("\/configuration\/status",false,"",6000).then(CheckStatus).then(GetLoginData).then(GetRights)]);
    };
    Result = new Promise(IntDoCheckLogin);
    return Result;
  };
  this.Wait = function (ms) {
    var Result = null;
    function doTimeout(resolve, reject) {
      window.setTimeout(resolve,ms);
    };
    Result = new Promise(doTimeout);
    return Result;
  };
  this.setCookie = function (cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    if (pas.Avamm.getCookie(cname)=='') console.log('failed to store Cookie');
  };
  this.deleteCookie = function (cname) {
    document.cookie = cname + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  };
  this.getCookie = function (cname) {
    var Result = "";
    Result = "";
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            Result = c.substring(name.length, c.length);
        }
    };
    return Result;
  };
  this.AppendCSS = function (url, onLoad, onError) {
    var file = url;
    var link = document.createElement( "link" );
    link.href = file;
    link.type = "text/css";
    link.rel = "stylesheet";
    link.media = "screen,print";
    link.onload = onLoad;
    link.onerror = onError;
    document.getElementsByTagName( "head" )[0].appendChild( link );
  };
  this.AppendJS = function (url, onLoad, onError) {
    if (document.getElementById(url) == null) {
      var file = url;
      var link = document.createElement( "script" );
      link.id = url;
      link.src = file;
      link.type = "text/javascript";
      link.onload = onLoad;
      link.onerror = onError;
      document.getElementsByTagName( "head" )[0].appendChild( link );
    };
  };
  this.InitWindow = function (aWindow) {
    aWindow.addEventListener("error",function (err) {
      return $impl.WindowError(err);
    });
    aWindow.addEventListener("unhandledrejection", function(err, promise) {
      $impl.WindowError(err);
    });
  };
  this.getRight = function (aName) {
    var Result = 0;
    var aRights = null;
    var aRight = "";
    var i = 0;
    Result = -2;
    aRights = rtl.getObject($mod.UserOptions["rights"]);
    for (var $l1 = 0, $end2 = aRights.length - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      aRight = Object.getOwnPropertyNames(rtl.getObject(aRights[i]))[0];
      if (pas.SysUtils.UpperCase(aRight) === pas.SysUtils.UpperCase(aName)) {
        Result = Math.floor(rtl.getObject(aRights[i])[aRight]);
        return Result;
      };
    };
    return Result;
  };
  this.GetBaseUrl = function () {
    var Result = "";
    var IsHttpAddr = false;
    IsHttpAddr = (/^h/.test(document.location));
    if ($mod.AvammServer === "") {
      if (!IsHttpAddr) {
        $mod.AvammServer = "http:\/\/localhost:8085"}
       else if ($mod.AvammServer === "") $mod.AvammServer = document.location.protocol;
    };
    Result = $mod.AvammServer;
    return Result;
  };
  $mod.$rtti.$ProcVar("TPromiseFunction",{procsig: rtl.newTIProcSig(null,pas.JS.$rtti["TJSPromise"])});
  $mod.$rtti.$ProcVar("TRegisterToSidebarEvent",{procsig: rtl.newTIProcSig([["Name",rtl.string],["Route",pas.webrouter.$rtti["TRoute"]],["Icon",rtl.string]])});
  $mod.$rtti.$ProcVar("TJSValueFunction",{procsig: rtl.newTIProcSig(null,rtl.jsvalue)});
  this.AfterLoginEvent = null;
  this.BeforeLoginEvent = null;
  this.AfterLogoutEvent = null;
  this.ConnectionErrorEvent = null;
  this.ContainerResizedEvent = null;
  this.AvammLogin = "";
  this.AvammServer = "";
  this.UserOptions = null;
  this.OnLoginForm = null;
  this.OnAddToSidebar = null;
  this.GetAvammContainer = null;
  this.OnException = null;
  $mod.$resourcestrings = {strServerNotRea: {org: "Server nicht erreichbar"}, strNoLoginFormA: {org: "keine Login Form verfügbar"}, strLoginFailed: {org: "Login fehlgeschlagen"}, strServerMustbeConfigured: {org: "Server muss konfiguriert werden"}};
  $mod.$init = function () {
    pas.System.Writeln("Appbase initializing...");
    $mod.InitWindow(window);
    pas.webrouter.Router().InitHistory(pas.webrouter.THistoryKind.hkHash,"");
    $impl.InitAvammApp();
  };
},["dhtmlx_base"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.InitAvammApp = function () {
    var Avamm = pas.Avamm;
    function createNewEvent(eventName) {
        if(typeof(Event) === 'function') {
            var event = new Event(eventName);
        }else{
            var event = document.createEvent('Event');
            event.initEvent(eventName, true, true);
        }
      return event;
    }
    if (typeof Element.prototype.addEventListener === 'undefined') {
      Element.prototype.addEventListener = function (e, callback) {
        e = 'on' + e;
        return this.attachEvent(e, callback);
      };
    }
    try {
      pas.Avamm.BeforeLoginEvent = createNewEvent('BeforeLogin');
      pas.Avamm.AfterLoginEvent = createNewEvent('AfterLogin');
      pas.Avamm.AfterLogoutEvent = createNewEvent('AfterLogout');
      pas.Avamm.ConnectionErrorEvent = createNewEvent('ConnectionError');
      pas.Avamm.ContainerResizedEvent = createNewEvent('ContainerResized');
    } catch (err) {};
    $mod.CheckLogin();
  };
  $impl.WindowError = function (aEvent) {
    var Result = false;
    if ($mod.OnException !== null) $mod.OnException(aEvent);
    return Result;
  };
});
rtl.module("dhtmlx_windows",["System","JS","Web","dhtmlx_base"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.Windows = null;
  $mod.$init = function () {
    pas.dhtmlx_base.WidgetsetLoaded.then($impl.LoadWindows);
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.LoadWindows = function (aValue) {
    var Result = undefined;
    $mod.Windows = new dhtmlXWindows();
    return Result;
  };
});
rtl.module("promet_dhtmlx",["System","Classes","SysUtils","JS","Web","Avamm","dhtmlx_form","dhtmlx_windows"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $mod.$resourcestrings = {strLoginText: {org: "Anmeldung"}, strLogin: {org: "Login"}, strPassword: {org: "Passwort"}, strSaveLogin: {org: "Anmeldedaten speichern"}, strUserAbort: {org: "Benutzerabbruch"}};
  $mod.$init = function () {
    pas.Avamm.OnLoginForm = $impl.DHTMLXoginForm;
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.DHTMLXoginForm = function () {
    var Result = null;
    var LoginForm = null;
    var Formdata = null;
    var LoginFormCont = null;
    var aWin = null;
    var isResolved = false;
    function IntDoLoginForm(resolve, reject) {
      function AfterValidate(status) {
        if (status) {
          pas.Avamm.AvammLogin = window.btoa((("" + LoginForm.getItemValue("eUsername")) + ":") + ("" + LoginForm.getItemValue("ePassword")));
          resolve(true);
          if (LoginForm.getItemValue("cbSaveLogin") == 1) pas.Avamm.setCookie("login",pas.Avamm.AvammLogin,2);
          isResolved = true;
          aWin.close();
        };
      };
      function eSubmitClick() {
        LoginForm.validate();
      };
      function CloseWindow() {
        var Result = false;
        if (!isResolved) {
          reject(rtl.getResStr(pas.promet_dhtmlx,"strUserAbort"));
          window.dispatchEvent(pas.Avamm.ConnectionErrorEvent);
        };
        Result = true;
        return Result;
      };
      pas.Avamm.AvammLogin = pas.Avamm.getCookie("login");
      if (pas.Avamm.AvammLogin !== "") {
        resolve(true);
        return;
      };
      if (pas.dhtmlx_windows.Windows.window("LoginFormWindow") == null) {
        pas.dhtmlx_windows.Windows.createWindow("LoginFormWindow",Math.floor(document.body.clientWidth / 2) - 200,Math.floor(document.body.clientHeight / 2) - 100,400,210);
        aWin = pas.dhtmlx_windows.Windows.window("LoginFormWindow");
        aWin.setText(rtl.getResStr(pas.promet_dhtmlx,"strLoginText"));
        LoginForm = rtl.getObject(aWin.attachForm(Formdata));
        LoginForm.addItem(null,pas.JS.New(["type","block","width","auto","name","LoginBlock"]));
        LoginForm.addItem("LoginBlock",pas.JS.New(["type","input","label",rtl.getResStr(pas.promet_dhtmlx,"strLogin"),"name","eUsername","required",true]));
        LoginForm.addItem("LoginBlock",pas.JS.New(["type","password","label",rtl.getResStr(pas.promet_dhtmlx,"strPassword"),"name","ePassword"]));
        LoginForm.addItem("LoginBlock",pas.JS.New(["type","checkbox","label",rtl.getResStr(pas.promet_dhtmlx,"strSaveLogin"),"name","cbSaveLogin"]));
        LoginForm.addItem("LoginBlock",pas.JS.New(["type","button","value",rtl.getResStr(pas.promet_dhtmlx,"strLogin"),"name","eSubmit"]));
        LoginForm.setItemFocus("eUsername");
        LoginForm.attachEvent("onEnter",eSubmitClick);
        LoginForm.enableLiveValidation(true);
        LoginForm.attachEvent("onButtonClick",eSubmitClick);
        aWin.attachEvent("onClose",CloseWindow);
        LoginForm.attachEvent("onAfterValidate",AfterValidate);
      } else {
        aWin = pas.dhtmlx_windows.Windows.window("LoginFormWindow");
      };
    };
    Result = new Promise(IntDoLoginForm);
    return Result;
  };
});
rtl.module("dhtmlx_treeview",["System","JS","Web","dhtmlx_base"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_layout",["System","JS","Web","dhtmlx_base"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_sidebar",["System","JS","Web","dhtmlx_base"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("math",["System","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.MinInteger = -0x10000000000000;
  this.MaxInteger = 0xfffffffffffff;
  this.MinDouble = 5.0e-324;
  this.MaxDouble = 1.7e+308;
  this.InRange = function (AValue, AMin, AMax) {
    return (AValue >= AMin) && (AValue <= AMax);
  };
  this.InRange$1 = function (AValue, AMin, AMax) {
    return (AValue >= AMin) && (AValue <= AMax);
  };
  this.EnsureRange = function (AValue, AMin, AMax) {
    if (AValue<AMin){ return AMin;
    } else if (AValue>AMax){ return AMax;
    } else return AValue;
  };
  this.EnsureRange$1 = function (AValue, AMin, AMax) {
    if (AValue<AMin){ return AMin;
    } else if (AValue>AMax){ return AMax;
    } else return AValue;
  };
  $mod.$rtti.$Int("TRoundToRange",{minvalue: -37, maxvalue: 37, ordtype: 0});
  this.RoundTo = function (AValue, Digits) {
    var Result = 0.0;
    var RV = 0.0;
    RV = $mod.IntPower(10,Digits);
    Result = Math.round(AValue / RV) * RV;
    return Result;
  };
  this.SimpleRoundTo = function (AValue, Digits) {
    var Result = 0.0;
    var RV = 0.0;
    RV = $mod.IntPower(10,-Digits);
    if (AValue < 0) {
      Result = pas.System.Int((AValue * RV) - 0.5) / RV}
     else Result = pas.System.Int((AValue * RV) + 0.5) / RV;
    return Result;
  };
  this.randg = function (mean, stddev) {
    var Result = 0.0;
    var U1 = 0.0;
    var S2 = 0.0;
    do {
      U1 = (2 * Math.random()) - 1;
      S2 = pas.System.Sqr$1(U1) + pas.System.Sqr$1((2 * Math.random()) - 1);
    } while (!(S2 < 1));
    Result = ((Math.sqrt((-2 * Math.log(S2)) / S2) * U1) * stddev) + mean;
    return Result;
  };
  this.RandomRange = function (aFrom, aTo) {
    var Result = 0;
    Result = pas.System.Random(Math.abs(aFrom - aTo)) + Math.min(aTo,aFrom);
    return Result;
  };
  this.RandomRange$1 = function (aFrom, aTo) {
    var Result = 0;
    var m = 0;
    if (aFrom < aTo) {
      m = aFrom}
     else m = aTo;
    Result = pas.System.Random(Math.abs(aFrom - aTo)) + m;
    return Result;
  };
  this.NegativeValue = -1;
  this.ZeroValue = 0;
  this.PositiveValue = 1;
  this.IsZero = function (d, Epsilon) {
    var Result = false;
    if (Epsilon === 0) Epsilon = 1E-12;
    Result = Math.abs(d) <= Epsilon;
    return Result;
  };
  this.IsZero$1 = function (d) {
    var Result = false;
    Result = Math.abs(d) <= 1E-12;
    return Result;
  };
  this.IsInfinite = function (d) {
    return (d==Infinite) || (d==-Infinite);
  };
  this.SameValue = function (A, B, Epsilon) {
    var Result = false;
    if (Epsilon === 0.0) Epsilon = Math.max(Math.min(Math.abs(A),Math.abs(B)) * 1E-12,1E-12);
    if (A > B) {
      Result = (A - B) <= Epsilon}
     else Result = (B - A) <= Epsilon;
    return Result;
  };
  this.LogN = function (A, Base) {
    var Result = 0.0;
    Result = Math.log(A) / Math.log(Base);
    return Result;
  };
  this.Ceil = function (A) {
    var Result = 0;
    Result = pas.System.Trunc(Math.ceil(A));
    return Result;
  };
  this.Floor = function (A) {
    var Result = 0;
    Result = pas.System.Trunc(Math.floor(A));
    return Result;
  };
  this.Ceil64 = function (A) {
    var Result = 0;
    Result = pas.System.Trunc(Math.ceil(A));
    return Result;
  };
  this.Floor64 = function (A) {
    var Result = 0;
    Result = pas.System.Trunc(Math.ceil(A));
    return Result;
  };
  this.ldexp = function (x, p) {
    var Result = 0.0;
    Result = x * $mod.IntPower(2.0,p);
    return Result;
  };
  this.Frexp = function (X, Mantissa, Exponent) {
    Exponent.set(0);
    if (X !== 0) if (Math.abs(X) < 0.5) {
      do {
        X = X * 2;
        Exponent.set(Exponent.get() - 1);
      } while (!(Math.abs(X) >= 0.5))}
     else while (Math.abs(X) >= 1) {
      X = X / 2;
      Exponent.set(Exponent.get() + 1);
    };
    Mantissa.set(X);
  };
  this.lnxp1 = function (x) {
    var Result = 0.0;
    var y = 0.0;
    if (x >= 4.0) {
      Result = Math.log(1.0 + x)}
     else {
      y = 1.0 + x;
      if (y === 1.0) {
        Result = x}
       else {
        Result = Math.log(y);
        if (y > 0.0) Result = Result + ((x - (y - 1.0)) / y);
      };
    };
    return Result;
  };
  this.IntPower = function (base, exponent) {
    var Result = 0.0;
    var i = 0;
    if ((base === 0.0) && (exponent === 0)) {
      Result = 1}
     else {
      i = Math.abs(exponent);
      Result = 1.0;
      while (i > 0) {
        while ((i & 1) === 0) {
          i = i >>> 1;
          base = pas.System.Sqr$1(base);
        };
        i = i - 1;
        Result = Result * base;
      };
      if (exponent < 0) Result = 1.0 / Result;
    };
    return Result;
  };
  this.DivMod = function (Dividend, Divisor, Result, Remainder) {
    if (Dividend < 0) {
      Dividend = -Dividend;
      Result.set(-Math.floor(Dividend / Divisor));
      Remainder.set(-(Dividend + (Result.get() * Divisor)));
    } else {
      Result.set(Math.floor(Dividend / Divisor));
      Remainder.set(Dividend - (Result.get() * Divisor));
    };
  };
  this.DivMod$1 = function (Dividend, Divisor, Result, Remainder) {
    if (Dividend < 0) {
      Dividend = -Dividend;
      Result.set(-Math.floor(Dividend / Divisor));
      Remainder.set(-(Dividend + (Result.get() * Divisor)));
    } else {
      Result.set(Math.floor(Dividend / Divisor));
      Remainder.set(Dividend - (Result.get() * Divisor));
    };
  };
  this.DivMod$2 = function (Dividend, Divisor, Result, Remainder) {
    Result.set(Math.floor(Dividend / Divisor));
    Remainder.set(Dividend - (Result.get() * Divisor));
  };
  this.DivMod$3 = function (Dividend, Divisor, Result, Remainder) {
    if (Dividend < 0) {
      Dividend = -Dividend;
      Result.set(-Math.floor(Dividend / Divisor));
      Remainder.set(-(Dividend + (Result.get() * Divisor)));
    } else {
      Result.set(Math.floor(Dividend / Divisor));
      Remainder.set(Dividend - (Result.get() * Divisor));
    };
  };
  this.DegToRad = function (deg) {
    var Result = 0.0;
    Result = deg * (Math.PI / 180.0);
    return Result;
  };
  this.RadToDeg = function (rad) {
    var Result = 0.0;
    Result = rad * (180.0 / Math.PI);
    return Result;
  };
  this.GradToRad = function (grad) {
    var Result = 0.0;
    Result = grad * (Math.PI / 200.0);
    return Result;
  };
  this.RadToGrad = function (rad) {
    var Result = 0.0;
    Result = rad * (200.0 / Math.PI);
    return Result;
  };
  this.DegToGrad = function (deg) {
    var Result = 0.0;
    Result = deg * (200.0 / 180.0);
    return Result;
  };
  this.GradToDeg = function (grad) {
    var Result = 0.0;
    Result = grad * (180.0 / 200.0);
    return Result;
  };
  this.CycleToRad = function (cycle) {
    var Result = 0.0;
    Result = (2 * Math.PI) * cycle;
    return Result;
  };
  this.RadToCycle = function (rad) {
    var Result = 0.0;
    Result = rad * (1 / (2 * Math.PI));
    return Result;
  };
  this.DegNormalize = function (deg) {
    var Result = 0.0;
    Result = deg - (pas.System.Int(deg / 360) * 360);
    if (Result < 0) Result = Result + 360;
    return Result;
  };
  this.Norm = function (data) {
    var Result = 0.0;
    Result = Math.sqrt($impl.sumofsquares(data));
    return Result;
  };
  this.Mean = function (data) {
    var Result = 0.0;
    var N = 0;
    N = rtl.length(data);
    if (N === 0) {
      Result = 0}
     else Result = $mod.Sum(data) / N;
    return Result;
  };
  this.Sum = function (data) {
    var Result = 0.0;
    var i = 0;
    var N = 0;
    N = rtl.length(data);
    Result = 0.0;
    for (var $l1 = 0, $end2 = N - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = Result + data[i];
    };
    return Result;
  };
  this.SumsAndSquares = function (data, Sum, SumOfSquares) {
    var i = 0;
    var n = 0;
    var t = 0.0;
    var s = 0.0;
    var ss = 0.0;
    n = rtl.length(data);
    ss = 0.0;
    s = 0.0;
    for (var $l1 = 0, $end2 = n - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      t = data[i];
      ss = ss + pas.System.Sqr$1(t);
      s = s + t;
    };
    Sum.set(s);
    SumOfSquares.set(ss);
  };
  this.StdDev = function (data) {
    var Result = 0.0;
    Result = Math.sqrt($mod.Variance(data));
    return Result;
  };
  this.MeanAndStdDev = function (data, Mean, StdDev) {
    var I = 0;
    var N = 0;
    var M = 0.0;
    var S = 0.0;
    N = rtl.length(data);
    M = 0;
    S = 0;
    for (var $l1 = 0, $end2 = N - 1; $l1 <= $end2; $l1++) {
      I = $l1;
      M = M + data[I];
      S = S + pas.System.Sqr$1(data[I]);
    };
    M = M / N;
    S = S - (N * pas.System.Sqr$1(M));
    if (N > 1) {
      S = Math.sqrt(S / (N - 1))}
     else S = 0;
    Mean.set(M);
    StdDev.set(S);
  };
  this.Variance = function (data) {
    var Result = 0.0;
    var n = 0;
    n = rtl.length(data);
    if (n === 1) {
      Result = 0}
     else Result = $mod.TotalVariance(data) / (n - 1);
    return Result;
  };
  this.TotalVariance = function (data) {
    var Result = 0.0;
    var S = 0.0;
    var SS = 0.0;
    var N = 0;
    N = rtl.length(data);
    if (rtl.length(data) === 1) {
      Result = 0}
     else {
      $mod.SumsAndSquares(data,{get: function () {
          return S;
        }, set: function (v) {
          S = v;
        }},{get: function () {
          return SS;
        }, set: function (v) {
          SS = v;
        }});
      Result = SS - (pas.System.Sqr$1(S) / N);
    };
    return Result;
  };
  this.PopNStdDev = function (data) {
    var Result = 0.0;
    Result = Math.sqrt($mod.PopNVariance(data));
    return Result;
  };
  this.PopNVariance = function (data) {
    var Result = 0.0;
    var N = 0;
    N = rtl.length(data);
    if (N === 0) {
      Result = 0}
     else Result = $mod.TotalVariance(data) / N;
    return Result;
  };
  this.MomentSkewKurtosis = function (data, m1, m2, m3, m4, skew, kurtosis) {
    var i = 0;
    var N = 0;
    var deviation = 0.0;
    var deviation2 = 0.0;
    var reciprocalN = 0.0;
    var lm1 = 0.0;
    var lm2 = 0.0;
    var lm3 = 0.0;
    var lm4 = 0.0;
    var lskew = 0.0;
    var lkurtosis = 0.0;
    N = rtl.length(data);
    lm1 = 0;
    reciprocalN = 1 / N;
    for (var $l1 = 0, $end2 = N - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      lm1 = lm1 + data[i];
    };
    lm1 = reciprocalN * lm1;
    lm2 = 0;
    lm3 = 0;
    lm4 = 0;
    for (var $l3 = 0, $end4 = N - 1; $l3 <= $end4; $l3++) {
      i = $l3;
      deviation = data[i] - lm1;
      deviation2 = deviation * deviation;
      lm2 = lm2 + deviation2;
      lm3 = lm3 + (deviation2 * deviation);
      lm4 = lm4 + (deviation2 * deviation2);
    };
    lm2 = reciprocalN * lm2;
    lm3 = reciprocalN * lm3;
    lm4 = reciprocalN * lm4;
    lskew = lm3 / (Math.sqrt(lm2) * lm2);
    lkurtosis = lm4 / (lm2 * lm2);
    m1.set(lm1);
    m2.set(lm2);
    m3.set(lm3);
    m4.set(lm4);
    skew.set(lskew);
    kurtosis.set(lkurtosis);
  };
  this.TPaymentTime = {"0": "ptEndOfPeriod", ptEndOfPeriod: 0, "1": "ptStartOfPeriod", ptStartOfPeriod: 1};
  $mod.$rtti.$Enum("TPaymentTime",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TPaymentTime});
  this.FutureValue = function (ARate, NPeriods, APayment, APresentValue, APaymentTime) {
    var Result = 0.0;
    var q = 0.0;
    var qn = 0.0;
    var factor = 0.0;
    if (ARate === 0) {
      Result = -APresentValue - (APayment * NPeriods)}
     else {
      q = 1.0 + ARate;
      qn = Math.pow(q,NPeriods);
      factor = (qn - 1) / (q - 1);
      if (APaymentTime === $mod.TPaymentTime.ptStartOfPeriod) factor = factor * q;
      Result = -((APresentValue * qn) + (APayment * factor));
    };
    return Result;
  };
  var DELTA = 0.001;
  var EPS = 1E-9;
  var MAXIT = 20;
  this.InterestRate = function (NPeriods, APayment, APresentValue, AFutureValue, APaymentTime) {
    var Result = 0.0;
    var r1 = 0.0;
    var r2 = 0.0;
    var dr = 0.0;
    var fv1 = 0.0;
    var fv2 = 0.0;
    var iteration = 0;
    iteration = 0;
    r1 = 0.05;
    do {
      r2 = r1 + 0.001;
      fv1 = $mod.FutureValue(r1,NPeriods,APayment,APresentValue,APaymentTime);
      fv2 = $mod.FutureValue(r2,NPeriods,APayment,APresentValue,APaymentTime);
      dr = ((AFutureValue - fv1) / (fv2 - fv1)) * 0.001;
      r1 = r1 + dr;
      iteration += 1;
    } while (!((Math.abs(dr) < 1.0E-9) || (iteration >= 20)));
    Result = r1;
    return Result;
  };
  this.NumberOfPeriods = function (ARate, APayment, APresentValue, AFutureValue, APaymentTime) {
    var Result = 0.0;
    var q = 0.0;
    var x1 = 0.0;
    var x2 = 0.0;
    if (ARate === 0) {
      Result = -(APresentValue + AFutureValue) / APayment}
     else {
      q = 1.0 + ARate;
      if (APaymentTime === $mod.TPaymentTime.ptStartOfPeriod) APayment = APayment * q;
      x1 = APayment - (AFutureValue * ARate);
      x2 = APayment + (APresentValue * ARate);
      if ((x2 === 0) || ((Math.sign(x1) * Math.sign(x2)) < 0)) {
        Result = Infinity}
       else {
        Result = Math.log(x1 / x2) / Math.log(q);
      };
    };
    return Result;
  };
  this.Payment = function (ARate, NPeriods, APresentValue, AFutureValue, APaymentTime) {
    var Result = 0.0;
    var q = 0.0;
    var qn = 0.0;
    var factor = 0.0;
    if (ARate === 0) {
      Result = -(AFutureValue + APresentValue) / NPeriods}
     else {
      q = 1.0 + ARate;
      qn = Math.pow(q,NPeriods);
      factor = (qn - 1) / (q - 1);
      if (APaymentTime === $mod.TPaymentTime.ptStartOfPeriod) factor = factor * q;
      Result = -(AFutureValue + (APresentValue * qn)) / factor;
    };
    return Result;
  };
  this.PresentValue = function (ARate, NPeriods, APayment, AFutureValue, APaymentTime) {
    var Result = 0.0;
    var q = 0.0;
    var qn = 0.0;
    var factor = 0.0;
    if (ARate === 0.0) {
      Result = -AFutureValue - (APayment * NPeriods)}
     else {
      q = 1.0 + ARate;
      qn = Math.pow(q,NPeriods);
      factor = (qn - 1) / (q - 1);
      if (APaymentTime === $mod.TPaymentTime.ptStartOfPeriod) factor = factor * q;
      Result = -(AFutureValue + (APayment * factor)) / qn;
    };
    return Result;
  };
  this.IfThen = function (val, ifTrue, ifFalse) {
    var Result = 0;
    if (val) {
      Result = ifTrue}
     else Result = ifFalse;
    return Result;
  };
  this.IfThen$1 = function (val, ifTrue, ifFalse) {
    var Result = 0.0;
    if (val) {
      Result = ifTrue}
     else Result = ifFalse;
    return Result;
  };
  $mod.$rtti.$Int("TValueRelationship",{minvalue: -1, maxvalue: 1, ordtype: 0});
  this.EqualsValue = 0;
  this.LessThanValue = -1;
  this.GreaterThanValue = 1;
  this.CompareValue = function (A, B) {
    var Result = -1;
    Result = 1;
    if (A === B) {
      Result = 0}
     else if (A < B) Result = -1;
    return Result;
  };
  this.CompareValue$1 = function (A, B) {
    var Result = -1;
    Result = 1;
    if (A === B) {
      Result = 0}
     else if (A < B) Result = -1;
    return Result;
  };
  this.CompareValue$2 = function (A, B) {
    var Result = -1;
    Result = 1;
    if (A === B) {
      Result = 0}
     else if (A < B) Result = -1;
    return Result;
  };
  this.CompareValue$3 = function (A, B, delta) {
    var Result = -1;
    Result = 1;
    if (Math.abs(A - B) <= delta) {
      Result = 0}
     else if (A < B) Result = -1;
    return Result;
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.DZeroResolution = 1E-12;
  $impl.sumofsquares = function (data) {
    var Result = 0.0;
    var i = 0;
    var N = 0;
    N = rtl.length(data);
    Result = 0.0;
    for (var $l1 = 0, $end2 = N - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      Result = Result + pas.System.Sqr$1(data[i]);
    };
    return Result;
  };
});
rtl.module("DateUtils",["System","SysUtils","math"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.DaysPerWeek = 7;
  this.WeeksPerFortnight = 2;
  this.MonthsPerYear = 12;
  this.YearsPerDecade = 10;
  this.YearsPerCentury = 100;
  this.YearsPerMillennium = 1000;
  this.DayMonday = 1;
  this.DayTuesday = 2;
  this.DayWednesday = 3;
  this.DayThursday = 4;
  this.DayFriday = 5;
  this.DaySaturday = 6;
  this.DaySunday = 7;
  this.OneHour = 1 / 24;
  this.OneMinute = 1 / 1440;
  this.OneSecond = 1 / 86400;
  this.OneMillisecond = 1 / 86400000;
  this.DaysPerYear = [365,366];
  this.RecodeLeaveFieldAsIs = 65535;
  this.ApproxDaysPerMonth = 30.4375;
  this.ApproxDaysPerYear = 365.25;
  this.DateOf = function (AValue) {
    var Result = 0.0;
    Result = pas.System.Trunc(AValue);
    return Result;
  };
  this.TimeOf = function (AValue) {
    var Result = 0.0;
    Result = pas.System.Frac(AValue);
    return Result;
  };
  this.IsInLeapYear = function (AValue) {
    var Result = false;
    Result = pas.SysUtils.IsLeapYear($mod.YearOf(AValue));
    return Result;
  };
  this.IsPM = function (AValue) {
    var Result = false;
    Result = $mod.HourOf(AValue) >= 12;
    return Result;
  };
  this.IsValidDate = function (AYear, AMonth, ADay) {
    var Result = false;
    Result = ((((AYear !== 0) && (AYear < 10000)) && $impl.IsValidMonth(AMonth)) && (ADay !== 0)) && (ADay <= pas.SysUtils.MonthDays[+pas.SysUtils.IsLeapYear(AYear)][AMonth - 1]);
    return Result;
  };
  this.IsValidTime = function (AHour, AMinute, ASecond, AMilliSecond) {
    var Result = false;
    Result = (((AHour === 24) && (AMinute === 0)) && (ASecond === 0)) && (AMilliSecond === 0);
    Result = Result || ((((AHour < 24) && (AMinute < 60)) && (ASecond < 60)) && (AMilliSecond < 1000));
    return Result;
  };
  this.IsValidDateTime = function (AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond) {
    var Result = false;
    Result = $mod.IsValidDate(AYear,AMonth,ADay) && $mod.IsValidTime(AHour,AMinute,ASecond,AMilliSecond);
    return Result;
  };
  this.IsValidDateDay = function (AYear, ADayOfYear) {
    var Result = false;
    Result = (((AYear !== 0) && (ADayOfYear !== 0)) && (AYear < 10000)) && (ADayOfYear <= $mod.DaysPerYear[+pas.SysUtils.IsLeapYear(AYear)]);
    return Result;
  };
  this.IsValidDateWeek = function (AYear, AWeekOfYear, ADayOfWeek) {
    var Result = false;
    Result = ((((AYear !== 0) && (AYear < 10000)) && $impl.IsValidDayOfWeek(ADayOfWeek)) && (AWeekOfYear !== 0)) && (AWeekOfYear <= $mod.WeeksInAYear(AYear));
    return Result;
  };
  this.IsValidDateMonthWeek = function (AYear, AMonth, AWeekOfMonth, ADayOfWeek) {
    var Result = false;
    Result = ((((AYear !== 0) && (AYear < 10000)) && $impl.IsValidMonth(AMonth)) && $impl.IsValidWeekOfMonth(AWeekOfMonth)) && $impl.IsValidDayOfWeek(ADayOfWeek);
    return Result;
  };
  this.WeeksInYear = function (AValue) {
    var Result = 0;
    Result = $mod.WeeksInAYear($mod.YearOf(AValue));
    return Result;
  };
  this.WeeksInAYear = function (AYear) {
    var Result = 0;
    var DOW = 0;
    Result = 52;
    DOW = $mod.DayOfTheWeek($mod.StartOfAYear(AYear));
    if ((DOW === 4) || ((DOW === 3) && pas.SysUtils.IsLeapYear(AYear))) Result += 1;
    return Result;
  };
  this.DaysInYear = function (AValue) {
    var Result = 0;
    Result = $mod.DaysPerYear[+pas.SysUtils.IsLeapYear($mod.YearOf(AValue))];
    return Result;
  };
  this.DaysInAYear = function (AYear) {
    var Result = 0;
    Result = $mod.DaysPerYear[+pas.SysUtils.IsLeapYear(AYear)];
    return Result;
  };
  this.DaysInMonth = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    var D = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    Result = pas.SysUtils.MonthDays[+pas.SysUtils.IsLeapYear(Y)][M - 1];
    return Result;
  };
  this.DaysInAMonth = function (AYear, AMonth) {
    var Result = 0;
    Result = pas.SysUtils.MonthDays[+pas.SysUtils.IsLeapYear(AYear)][AMonth - 1];
    return Result;
  };
  this.Today = function () {
    var Result = 0.0;
    Result = pas.SysUtils.date();
    return Result;
  };
  this.Yesterday = function () {
    var Result = 0.0;
    Result = pas.SysUtils.date() - 1;
    return Result;
  };
  this.Tomorrow = function () {
    var Result = 0.0;
    Result = pas.SysUtils.date() + 1;
    return Result;
  };
  this.IsToday = function (AValue) {
    var Result = false;
    Result = $mod.IsSameDay(AValue,pas.SysUtils.date());
    return Result;
  };
  this.IsSameDay = function (AValue, ABasis) {
    var Result = false;
    var D = 0.0;
    D = AValue - pas.System.Trunc(ABasis);
    Result = (D >= 0) && (D < 1);
    return Result;
  };
  this.IsSameMonth = function (Avalue, ABasis) {
    var Result = false;
    Result = $mod.YearOf(Avalue) === $mod.YearOf(ABasis);
    Result = Result && ($mod.MonthOf(Avalue) === $mod.MonthOf(ABasis));
    return Result;
  };
  this.PreviousDayOfWeek = function (DayOfWeek) {
    var Result = 0;
    if (!$impl.IsValidDayOfWeek(DayOfWeek)) throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidDayOfWeek,[DayOfWeek]]);
    Result = $impl.DOWMap[DayOfWeek - 1];
    return Result;
  };
  this.YearOf = function (AValue) {
    var Result = 0;
    var D = 0;
    var M = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }});
    return Result;
  };
  this.MonthOf = function (AValue) {
    var Result = 0;
    var Y = 0;
    var D = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    return Result;
  };
  this.WeekOf = function (AValue) {
    var Result = 0;
    Result = $mod.WeekOfTheYear(AValue);
    return Result;
  };
  this.DayOf = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.HourOf = function (AValue) {
    var Result = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    return Result;
  };
  this.MinuteOf = function (AValue) {
    var Result = 0;
    var H = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    return Result;
  };
  this.SecondOf = function (AValue) {
    var Result = 0;
    var H = 0;
    var N = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    return Result;
  };
  this.MilliSecondOf = function (AValue) {
    var Result = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.StartOfTheYear = function (AValue) {
    var Result = 0.0;
    Result = pas.SysUtils.EncodeDate($mod.YearOf(AValue),1,1);
    return Result;
  };
  this.EndOfTheYear = function (AValue) {
    var Result = 0.0;
    Result = $mod.EncodeDateTime($mod.YearOf(AValue),12,31,23,59,59,999);
    return Result;
  };
  this.StartOfAYear = function (AYear) {
    var Result = 0.0;
    Result = pas.SysUtils.EncodeDate(AYear,1,1);
    return Result;
  };
  this.EndOfAYear = function (AYear) {
    var Result = 0.0;
    Result = $mod.EncodeDateTime(AYear,12,31,23,59,59,999);
    return Result;
  };
  this.StartOfTheMonth = function (AValue) {
    var Result = 0.0;
    var Y = 0;
    var M = 0;
    var D = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    Result = pas.SysUtils.EncodeDate(Y,M,1);
    return Result;
  };
  this.EndOfTheMonth = function (AValue) {
    var Result = 0.0;
    var Y = 0;
    var M = 0;
    var D = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    Result = $mod.EncodeDateTime(Y,M,pas.SysUtils.MonthDays[+pas.SysUtils.IsLeapYear(Y)][M - 1],23,59,59,999);
    return Result;
  };
  this.StartOfAMonth = function (AYear, AMonth) {
    var Result = 0.0;
    Result = pas.SysUtils.EncodeDate(AYear,AMonth,1);
    return Result;
  };
  this.EndOfAMonth = function (AYear, AMonth) {
    var Result = 0.0;
    Result = $mod.EncodeDateTime(AYear,AMonth,pas.SysUtils.MonthDays[+pas.SysUtils.IsLeapYear(AYear)][AMonth - 1],23,59,59,999);
    return Result;
  };
  this.StartOfTheWeek = function (AValue) {
    var Result = 0.0;
    Result = (pas.System.Trunc(AValue) - $mod.DayOfTheWeek(AValue)) + 1;
    return Result;
  };
  this.EndOfTheWeek = function (AValue) {
    var Result = 0.0;
    Result = $mod.EndOfTheDay((AValue - $mod.DayOfTheWeek(AValue)) + 7);
    return Result;
  };
  this.StartOfAWeek = function (AYear, AWeekOfYear, ADayOfWeek) {
    var Result = 0.0;
    Result = $mod.EncodeDateWeek(AYear,AWeekOfYear,ADayOfWeek);
    return Result;
  };
  this.StartOfAWeek$1 = function (AYear, AWeekOfYear) {
    var Result = 0.0;
    Result = $mod.StartOfAWeek(AYear,AWeekOfYear,1);
    return Result;
  };
  this.EndOfAWeek = function (AYear, AWeekOfYear, ADayOfWeek) {
    var Result = 0.0;
    Result = $mod.EndOfTheDay($mod.EncodeDateWeek(AYear,AWeekOfYear,ADayOfWeek));
    return Result;
  };
  this.EndOfAWeek$1 = function (AYear, AWeekOfYear) {
    var Result = 0.0;
    Result = $mod.EndOfAWeek(AYear,AWeekOfYear,7);
    return Result;
  };
  this.StartOfTheDay = function (AValue) {
    var Result = 0.0;
    Result = pas.System.Trunc(AValue);
    return Result;
  };
  this.EndOfTheDay = function (AValue) {
    var Result = 0.0;
    var Y = 0;
    var M = 0;
    var D = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    Result = $mod.EncodeDateTime(Y,M,D,23,59,59,999);
    return Result;
  };
  this.StartOfADay = function (AYear, AMonth, ADay) {
    var Result = 0.0;
    Result = pas.SysUtils.EncodeDate(AYear,AMonth,ADay);
    return Result;
  };
  this.StartOfADay$1 = function (AYear, ADayOfYear) {
    var Result = 0.0;
    Result = ($mod.StartOfAYear(AYear) + ADayOfYear) - 1;
    return Result;
  };
  this.EndOfADay = function (AYear, AMonth, ADay) {
    var Result = 0.0;
    Result = $mod.EndOfTheDay(pas.SysUtils.EncodeDate(AYear,AMonth,ADay));
    return Result;
  };
  this.EndOfADay$1 = function (AYear, ADayOfYear) {
    var Result = 0.0;
    Result = (($mod.StartOfAYear(AYear) + ADayOfYear) - 1) + pas.SysUtils.EncodeTime(23,59,59,999);
    return Result;
  };
  this.MonthOfTheYear = function (AValue) {
    var Result = 0;
    Result = $mod.MonthOf(AValue);
    return Result;
  };
  this.WeekOfTheYear = function (AValue) {
    var Result = 0;
    var Y = 0;
    var DOW = 0;
    $mod.DecodeDateWeek(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return DOW;
      }, set: function (v) {
        DOW = v;
      }});
    return Result;
  };
  this.WeekOfTheYear$1 = function (AValue, AYear) {
    var Result = 0;
    var DOW = 0;
    $mod.DecodeDateWeek(AValue,AYear,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return DOW;
      }, set: function (v) {
        DOW = v;
      }});
    return Result;
  };
  this.DayOfTheYear = function (AValue) {
    var Result = 0;
    Result = pas.System.Trunc((AValue - $mod.StartOfTheYear(AValue)) + 1);
    return Result;
  };
  this.HourOfTheYear = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = H + (($mod.DayOfTheYear(AValue) - 1) * 24);
    return Result;
  };
  this.MinuteOfTheYear = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = M + ((H + (($mod.DayOfTheYear(AValue) - 1) * 24)) * 60);
    return Result;
  };
  this.SecondOfTheYear = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = ((M + ((H + (($mod.DayOfTheYear(AValue) - 1) * 24)) * 60)) * 60) + S;
    return Result;
  };
  this.MilliSecondOfTheYear = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = ((((M + ((H + (($mod.DayOfTheYear(AValue) - 1) * 24)) * 60)) * 60) + S) * 1000) + MS;
    return Result;
  };
  this.WeekOfTheMonth = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    var DOW = 0;
    $mod.DecodeDateMonthWeek(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return DOW;
      }, set: function (v) {
        DOW = v;
      }});
    return Result;
  };
  this.WeekOfTheMonth$1 = function (AValue, AYear, AMonth) {
    var Result = 0;
    var DOW = 0;
    $mod.DecodeDateMonthWeek(AValue,AYear,AMonth,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},{get: function () {
        return DOW;
      }, set: function (v) {
        DOW = v;
      }});
    return Result;
  };
  this.DayOfTheMonth = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.HourOfTheMonth = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    var D = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    $mod.DecodeDateTime(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = ((D - 1) * 24) + H;
    return Result;
  };
  this.MinuteOfTheMonth = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    var D = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    $mod.DecodeDateTime(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = ((((D - 1) * 24) + H) * 60) + N;
    return Result;
  };
  this.SecondOfTheMonth = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    var D = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    $mod.DecodeDateTime(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = ((((((D - 1) * 24) + H) * 60) + N) * 60) + S;
    return Result;
  };
  this.MilliSecondOfTheMonth = function (AValue) {
    var Result = 0;
    var Y = 0;
    var M = 0;
    var D = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    $mod.DecodeDateTime(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = ((((((((D - 1) * 24) + H) * 60) + N) * 60) + S) * 1000) + MS;
    return Result;
  };
  this.DayOfTheWeek = function (AValue) {
    var Result = 0;
    Result = $impl.DOWMap[pas.SysUtils.DayOfWeek(AValue) - 1];
    return Result;
  };
  this.HourOfTheWeek = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (($mod.DayOfTheWeek(AValue) - 1) * 24) + H;
    return Result;
  };
  this.MinuteOfTheWeek = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (((($mod.DayOfTheWeek(AValue) - 1) * 24) + H) * 60) + M;
    return Result;
  };
  this.SecondOfTheWeek = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (((((($mod.DayOfTheWeek(AValue) - 1) * 24) + H) * 60) + M) * 60) + S;
    return Result;
  };
  this.MilliSecondOfTheWeek = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (((((((($mod.DayOfTheWeek(AValue) - 1) * 24) + H) * 60) + M) * 60) + S) * 1000) + MS;
    return Result;
  };
  this.HourOfTheDay = function (AValue) {
    var Result = 0;
    Result = $mod.HourOf(AValue);
    return Result;
  };
  this.MinuteOfTheDay = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (H * 60) + M;
    return Result;
  };
  this.SecondOfTheDay = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (((H * 60) + M) * 60) + S;
    return Result;
  };
  this.MilliSecondOfTheDay = function (AValue) {
    var Result = 0;
    var H = 0;
    var M = 0;
    var S = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (((((H * 60) + M) * 60) + S) * 1000) + MS;
    return Result;
  };
  this.MinuteOfTheHour = function (AValue) {
    var Result = 0;
    Result = $mod.MinuteOf(AValue);
    return Result;
  };
  this.SecondOfTheHour = function (AValue) {
    var Result = 0;
    var H = 0;
    var S = 0;
    var M = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (M * 60) + S;
    return Result;
  };
  this.MilliSecondOfTheHour = function (AValue) {
    var Result = 0;
    var H = 0;
    var S = 0;
    var M = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (((M * 60) + S) * 1000) + MS;
    return Result;
  };
  this.SecondOfTheMinute = function (AValue) {
    var Result = 0;
    Result = $mod.SecondOf(AValue);
    return Result;
  };
  this.MilliSecondOfTheMinute = function (AValue) {
    var Result = 0;
    var H = 0;
    var S = 0;
    var M = 0;
    var MS = 0;
    pas.SysUtils.DecodeTime(AValue,{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Result = (S * 1000) + MS;
    return Result;
  };
  this.MilliSecondOfTheSecond = function (AValue) {
    var Result = 0;
    Result = $mod.MilliSecondOf(AValue);
    return Result;
  };
  this.WithinPastYears = function (ANow, AThen, AYears) {
    var Result = false;
    Result = $mod.YearsBetween(ANow,AThen,false) <= AYears;
    return Result;
  };
  this.WithinPastMonths = function (ANow, AThen, AMonths) {
    var Result = false;
    Result = $mod.MonthsBetween(ANow,AThen,false) <= AMonths;
    return Result;
  };
  this.WithinPastWeeks = function (ANow, AThen, AWeeks) {
    var Result = false;
    Result = $mod.WeeksBetween(ANow,AThen) <= AWeeks;
    return Result;
  };
  this.WithinPastDays = function (ANow, AThen, ADays) {
    var Result = false;
    Result = $mod.DaysBetween(ANow,AThen) <= ADays;
    return Result;
  };
  this.WithinPastHours = function (ANow, AThen, AHours) {
    var Result = false;
    Result = $mod.HoursBetween(ANow,AThen) <= AHours;
    return Result;
  };
  this.WithinPastMinutes = function (ANow, AThen, AMinutes) {
    var Result = false;
    Result = $mod.MinutesBetween(ANow,AThen) <= AMinutes;
    return Result;
  };
  this.WithinPastSeconds = function (ANow, AThen, ASeconds) {
    var Result = false;
    Result = $mod.SecondsBetween(ANow,AThen) <= ASeconds;
    return Result;
  };
  this.WithinPastMilliSeconds = function (ANow, AThen, AMilliSeconds) {
    var Result = false;
    Result = $mod.MilliSecondsBetween(ANow,AThen) <= AMilliSeconds;
    return Result;
  };
  this.YearsBetween = function (ANow, AThen, AExact) {
    var Result = 0;
    var yy = 0;
    var mm = 0;
    var dd = 0;
    if ((((AExact && (ANow >= -693594)) && (AThen >= -693594)) && (ANow <= pas.SysUtils.MaxDateTime)) && (AThen <= pas.SysUtils.MaxDateTime)) {
      $mod.PeriodBetween(ANow,AThen,{get: function () {
          return yy;
        }, set: function (v) {
          yy = v;
        }},{get: function () {
          return mm;
        }, set: function (v) {
          mm = v;
        }},{get: function () {
          return dd;
        }, set: function (v) {
          dd = v;
        }});
      Result = yy;
    } else Result = pas.System.Trunc((Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9) / $mod.ApproxDaysPerYear);
    return Result;
  };
  this.MonthsBetween = function (ANow, AThen, AExact) {
    var Result = 0;
    var y = 0;
    var m = 0;
    var d = 0;
    if ((((AExact && (ANow >= -693594)) && (AThen >= -693594)) && (ANow <= pas.SysUtils.MaxDateTime)) && (AThen <= pas.SysUtils.MaxDateTime)) {
      $mod.PeriodBetween(ANow,AThen,{get: function () {
          return y;
        }, set: function (v) {
          y = v;
        }},{get: function () {
          return m;
        }, set: function (v) {
          m = v;
        }},{get: function () {
          return d;
        }, set: function (v) {
          d = v;
        }});
      Result = (y * 12) + m;
    } else Result = pas.System.Trunc((Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9) / $mod.ApproxDaysPerMonth);
    return Result;
  };
  this.WeeksBetween = function (ANow, AThen) {
    var Result = 0;
    Result = Math.floor(pas.System.Trunc(Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9) / 7);
    return Result;
  };
  this.DaysBetween = function (ANow, AThen) {
    var Result = 0;
    Result = pas.System.Trunc(Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9);
    return Result;
  };
  this.HoursBetween = function (ANow, AThen) {
    var Result = 0;
    Result = pas.System.Trunc((Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9) * 24);
    return Result;
  };
  this.MinutesBetween = function (ANow, AThen) {
    var Result = 0;
    Result = pas.System.Trunc((Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9) * 1440);
    return Result;
  };
  this.SecondsBetween = function (ANow, AThen) {
    var Result = 0;
    Result = pas.System.Trunc((Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9) * 86400);
    return Result;
  };
  this.MilliSecondsBetween = function (ANow, AThen) {
    var Result = 0;
    Result = pas.System.Trunc((Math.abs($impl.DateTimeDiff(ANow,AThen)) + 5.7870370370370369E-9) * 86400000);
    return Result;
  };
  this.PeriodBetween = function (ANow, AThen, Years, months, days) {
    var Y1 = 0;
    var Y2 = 0;
    var M1 = 0;
    var M2 = 0;
    var D1 = 0;
    var D2 = 0;
    if (AThen > ANow) {
      pas.SysUtils.DecodeDate(ANow,{get: function () {
          return Y1;
        }, set: function (v) {
          Y1 = v;
        }},{get: function () {
          return M1;
        }, set: function (v) {
          M1 = v;
        }},{get: function () {
          return D1;
        }, set: function (v) {
          D1 = v;
        }});
      pas.SysUtils.DecodeDate(AThen,{get: function () {
          return Y2;
        }, set: function (v) {
          Y2 = v;
        }},{get: function () {
          return M2;
        }, set: function (v) {
          M2 = v;
        }},{get: function () {
          return D2;
        }, set: function (v) {
          D2 = v;
        }});
    } else {
      pas.SysUtils.DecodeDate(AThen,{get: function () {
          return Y1;
        }, set: function (v) {
          Y1 = v;
        }},{get: function () {
          return M1;
        }, set: function (v) {
          M1 = v;
        }},{get: function () {
          return D1;
        }, set: function (v) {
          D1 = v;
        }});
      pas.SysUtils.DecodeDate(ANow,{get: function () {
          return Y2;
        }, set: function (v) {
          Y2 = v;
        }},{get: function () {
          return M2;
        }, set: function (v) {
          M2 = v;
        }},{get: function () {
          return D2;
        }, set: function (v) {
          D2 = v;
        }});
    };
    Years.set(Y2 - Y1);
    if ((M1 > M2) || ((M1 === M2) && (D1 > D2))) Years.set(Years.get() - 1);
    if (M1 > M2) M2 += 12;
    months.set(M2 - M1);
    if (D2 >= D1) {
      days.set(D2 - D1)}
     else {
      if (months.get() === 0) {
        months.set(11)}
       else months.set(months.get() - 1);
      days.set(($mod.DaysInAMonth(Y1,M1) - D1) + D2);
    };
  };
  this.YearSpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen)) / $mod.ApproxDaysPerYear;
    return Result;
  };
  this.MonthSpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen)) / $mod.ApproxDaysPerMonth;
    return Result;
  };
  this.WeekSpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen)) / 7;
    return Result;
  };
  this.DaySpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen));
    return Result;
  };
  this.HourSpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen)) * 24;
    return Result;
  };
  this.MinuteSpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen)) * 1440;
    return Result;
  };
  this.SecondSpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen)) * 86400;
    return Result;
  };
  this.MilliSecondSpan = function (ANow, AThen) {
    var Result = 0.0;
    Result = Math.abs($impl.DateTimeDiff(ANow,AThen)) * 86400000;
    return Result;
  };
  this.IncYear = function (AValue, ANumberOfYears) {
    var Result = 0.0;
    var Y = 0;
    var M = 0;
    var D = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    $mod.DecodeDateTime(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Y = Y + ANumberOfYears;
    if (((M === 2) && (D === 29)) && !pas.SysUtils.IsLeapYear(Y)) D = 28;
    Result = $mod.EncodeDateTime(Y,M,D,H,N,S,MS);
    return Result;
  };
  this.IncYear$1 = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncYear(AValue,1);
    return Result;
  };
  this.IncWeek = function (AValue, ANumberOfWeeks) {
    var Result = 0.0;
    Result = AValue + (ANumberOfWeeks * 7);
    $impl.MaybeSkipTimeWarp(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.IncWeek$1 = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncWeek(AValue,1);
    return Result;
  };
  this.IncDay = function (AValue, ANumberOfDays) {
    var Result = 0.0;
    Result = AValue + ANumberOfDays;
    $impl.MaybeSkipTimeWarp(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.IncDay$1 = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncDay(AValue,1);
    return Result;
  };
  this.IncHour = function (AValue, ANumberOfHours) {
    var Result = 0.0;
    if (AValue >= 0) {
      Result = AValue + (ANumberOfHours / 24)}
     else Result = $impl.IncNegativeTime(AValue,ANumberOfHours / 24);
    $impl.MaybeSkipTimeWarp(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.IncHour$1 = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncHour(AValue,1);
    return Result;
  };
  this.IncMinute = function (AValue, ANumberOfMinutes) {
    var Result = 0.0;
    if (AValue >= 0) {
      Result = AValue + (ANumberOfMinutes / 1440)}
     else Result = $impl.IncNegativeTime(AValue,ANumberOfMinutes / 1440);
    $impl.MaybeSkipTimeWarp(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.IncMinute$1 = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncMinute(AValue,1);
    return Result;
  };
  this.IncSecond = function (AValue, ANumberOfSeconds) {
    var Result = 0.0;
    if (AValue >= 0) {
      Result = AValue + (ANumberOfSeconds / 86400)}
     else Result = $impl.IncNegativeTime(AValue,ANumberOfSeconds / 86400);
    $impl.MaybeSkipTimeWarp(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.IncSecond$1 = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncSecond(AValue,1);
    return Result;
  };
  this.IncMilliSecond = function (AValue, ANumberOfMilliSeconds) {
    var Result = 0.0;
    if (AValue >= 0) {
      Result = AValue + (ANumberOfMilliSeconds / 86400000)}
     else Result = $impl.IncNegativeTime(AValue,ANumberOfMilliSeconds / 86400000);
    $impl.MaybeSkipTimeWarp(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }});
    return Result;
  };
  this.IncMilliSecond$1 = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncMilliSecond(AValue,1);
    return Result;
  };
  this.EncodeDateTime = function (AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond) {
    var Result = 0.0;
    if (!$mod.TryEncodeDateTime(AYear,AMonth,ADay,AHour,AMinute,ASecond,AMilliSecond,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) $mod.InvalidDateTimeError$1(AYear,AMonth,ADay,AHour,AMinute,ASecond,AMilliSecond);
    return Result;
  };
  this.DecodeDateTime = function (AValue, AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond) {
    pas.SysUtils.DecodeTime(AValue,AHour,AMinute,ASecond,AMilliSecond);
    if (AHour.get() === 24) {
      AHour.set(0);
      pas.SysUtils.DecodeDate(Math.round(AValue),AYear,AMonth,ADay);
    } else pas.SysUtils.DecodeDate(AValue,AYear,AMonth,ADay);
  };
  this.TryEncodeDateTime = function (AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond, AValue) {
    var Result = false;
    var tmp = 0.0;
    Result = pas.SysUtils.TryEncodeDate(AYear,AMonth,ADay,AValue);
    Result = Result && pas.SysUtils.TryEncodeTime(AHour,AMinute,ASecond,AMilliSecond,{get: function () {
        return tmp;
      }, set: function (v) {
        tmp = v;
      }});
    if (Result) AValue.set(pas.SysUtils.ComposeDateTime(AValue.get(),tmp));
    return Result;
  };
  this.EncodeDateWeek = function (AYear, AWeekOfYear, ADayOfWeek) {
    var Result = 0.0;
    if (!$mod.TryEncodeDateWeek(AYear,AWeekOfYear,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},ADayOfWeek)) $mod.InvalidDateWeekError(AYear,AWeekOfYear,ADayOfWeek);
    return Result;
  };
  this.EncodeDateWeek$1 = function (AYear, AWeekOfYear) {
    var Result = 0.0;
    Result = $mod.EncodeDateWeek(AYear,AWeekOfYear,1);
    return Result;
  };
  this.DecodeDateWeek = function (AValue, AYear, AWeekOfYear, ADayOfWeek) {
    var DOY = 0;
    var D = 0;
    var YS = 0.0;
    var YSDOW = 0;
    var YEDOW = 0;
    AYear.set($mod.YearOf(AValue));
    ADayOfWeek.set(pas.SysUtils.DayOfWeek(AValue) - 1);
    if (ADayOfWeek.get() === 0) ADayOfWeek.set(7);
    YS = $mod.StartOfAYear(AYear.get());
    DOY = pas.System.Trunc(AValue - YS) + 1;
    YSDOW = $mod.DayOfTheWeek(YS);
    if (YSDOW < 5) {
      DOY += YSDOW - 1}
     else DOY -= 8 - YSDOW;
    if (DOY <= 0) {
      $mod.DecodeDateWeek(YS - 1,AYear,AWeekOfYear,{get: function () {
          return D;
        }, set: function (v) {
          D = v;
        }})}
     else {
      AWeekOfYear.set(Math.floor(DOY / 7));
      if ((DOY % 7) !== 0) AWeekOfYear.set(AWeekOfYear.get() + 1);
      if (AWeekOfYear.get() > 52) {
        YEDOW = YSDOW;
        if (pas.SysUtils.IsLeapYear(AYear.get())) {
          YEDOW += 1;
          if (YEDOW > 7) YEDOW = 1;
        };
        if (YEDOW < 4) {
          AYear.set(AYear.get() + 1);
          AWeekOfYear.set(1);
        };
      };
    };
  };
  this.TryEncodeDateWeek = function (AYear, AWeekOfYear, AValue, ADayOfWeek) {
    var Result = false;
    var DOW = 0;
    var Rest = 0;
    Result = $mod.IsValidDateWeek(AYear,AWeekOfYear,ADayOfWeek);
    if (Result) {
      AValue.set(pas.SysUtils.EncodeDate(AYear,1,1) + (7 * (AWeekOfYear - 1)));
      DOW = $mod.DayOfTheWeek(AValue.get());
      Rest = ADayOfWeek - DOW;
      if (DOW > 4) Rest += 7;
      AValue.set(AValue.get() + Rest);
    };
    return Result;
  };
  this.TryEncodeDateWeek$1 = function (AYear, AWeekOfYear, AValue) {
    var Result = false;
    Result = $mod.TryEncodeDateWeek(AYear,AWeekOfYear,AValue,1);
    return Result;
  };
  this.EncodeDateDay = function (AYear, ADayOfYear) {
    var Result = 0.0;
    if (!$mod.TryEncodeDateDay(AYear,ADayOfYear,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) $mod.InvalidDateDayError(AYear,ADayOfYear);
    return Result;
  };
  this.DecodeDateDay = function (AValue, AYear, ADayOfYear) {
    var M = 0;
    var D = 0;
    pas.SysUtils.DecodeDate(AValue,AYear,{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    ADayOfYear.set(pas.System.Trunc(AValue - pas.SysUtils.EncodeDate(AYear.get(),1,1)) + 1);
  };
  this.TryEncodeDateDay = function (AYear, ADayOfYear, AValue) {
    var Result = false;
    Result = (ADayOfYear !== 0) && (ADayOfYear <= $mod.DaysPerYear[+pas.SysUtils.IsLeapYear(AYear)]);
    if (Result) AValue.set((pas.SysUtils.EncodeDate(AYear,1,1) + ADayOfYear) - 1);
    return Result;
  };
  this.EncodeDateMonthWeek = function (AYear, AMonth, AWeekOfMonth, ADayOfWeek) {
    var Result = 0.0;
    if (!$mod.TryEncodeDateMonthWeek(AYear,AMonth,AWeekOfMonth,ADayOfWeek,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) $mod.InvalidDateMonthWeekError(AYear,AMonth,AWeekOfMonth,ADayOfWeek);
    return Result;
  };
  this.DecodeDateMonthWeek = function (AValue, AYear, AMonth, AWeekOfMonth, ADayOfWeek) {
    var D = 0;
    var SDOM = 0;
    var EDOM = 0;
    var SOM = 0.0;
    var DOM = 0;
    pas.SysUtils.DecodeDate(AValue,AYear,AMonth,{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    ADayOfWeek.set($mod.DayOfTheWeek(AValue));
    SOM = pas.SysUtils.EncodeDate(AYear.get(),AMonth.get(),1);
    SDOM = $mod.DayOfTheWeek(SOM);
    DOM = (D - 1) + SDOM;
    if (SDOM > 4) DOM -= 7;
    if (DOM <= 0) {
      $mod.DecodeDateMonthWeek(SOM - 1,AYear,AMonth,AWeekOfMonth,{get: function () {
          return D;
        }, set: function (v) {
          D = v;
        }})}
     else {
      AWeekOfMonth.set(Math.floor(DOM / 7));
      if ((DOM % 7) !== 0) AWeekOfMonth.set(AWeekOfMonth.get() + 1);
      EDOM = $mod.DayOfTheWeek($mod.EndOfAMonth(AYear.get(),AMonth.get()));
      if ((EDOM < 4) && (($mod.DaysInAMonth(AYear.get(),AMonth.get()) - D) < EDOM)) {
        AWeekOfMonth.set(1);
        AMonth.set(AMonth.get() + 1);
        if (AMonth.get() === 13) {
          AMonth.set(1);
          AYear.set(AYear.get() + 1);
        };
      };
    };
  };
  this.TryEncodeDateMonthWeek = function (AYear, AMonth, AWeekOfMonth, ADayOfWeek, AValue) {
    var Result = false;
    var S = 0;
    var DOM = 0;
    Result = $mod.IsValidDateMonthWeek(AYear,AMonth,AWeekOfMonth,ADayOfWeek);
    if (Result) {
      AValue.set(pas.SysUtils.EncodeDate(AYear,AMonth,1));
      DOM = (((AWeekOfMonth - 1) * 7) + ADayOfWeek) - 1;
      S = $mod.DayOfTheWeek(AValue.get());
      DOM -= S - 1;
      if (((S === 5) || (S === 6)) || (S === 7)) DOM += 7;
      AValue.set(AValue.get() + DOM);
    };
    return Result;
  };
  this.TryEncodeTimeInterval = function (Hour, Min, Sec, MSec, Time) {
    var Result = false;
    Result = ((Min < 60) && (Sec < 60)) && (MSec < 1000);
    if (Result) Time.set(((((Hour * 3600000) + (Min * 60000)) + (Sec * 1000)) + MSec) / 86400000);
    return Result;
  };
  this.EncodeTimeInterval = function (Hour, Minute, Second, MilliSecond) {
    var Result = 0.0;
    if (!$mod.TryEncodeTimeInterval(Hour,Minute,Second,MilliSecond,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidHourMinuteSecMsec,[Hour,Minute,Second,MilliSecond]]);
    return Result;
  };
  this.RecodeYear = function (AValue, AYear) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,AYear,65535,65535,65535,65535,65535,65535);
    return Result;
  };
  this.RecodeMonth = function (AValue, AMonth) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,65535,AMonth,65535,65535,65535,65535,65535);
    return Result;
  };
  this.RecodeDay = function (AValue, ADay) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,65535,65535,ADay,65535,65535,65535,65535);
    return Result;
  };
  this.RecodeHour = function (AValue, AHour) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,65535,65535,65535,AHour,65535,65535,65535);
    return Result;
  };
  this.RecodeMinute = function (AValue, AMinute) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,65535,65535,65535,65535,AMinute,65535,65535);
    return Result;
  };
  this.RecodeSecond = function (AValue, ASecond) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,65535,65535,65535,65535,65535,ASecond,65535);
    return Result;
  };
  this.RecodeMilliSecond = function (AValue, AMilliSecond) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,65535,65535,65535,65535,65535,65535,AMilliSecond);
    return Result;
  };
  this.RecodeDate = function (AValue, AYear, AMonth, ADay) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,AYear,AMonth,ADay,65535,65535,65535,65535);
    return Result;
  };
  this.RecodeTime = function (AValue, AHour, AMinute, ASecond, AMilliSecond) {
    var Result = 0.0;
    Result = $mod.RecodeDateTime(AValue,65535,65535,65535,AHour,AMinute,ASecond,AMilliSecond);
    return Result;
  };
  this.RecodeDateTime = function (AValue, AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond) {
    var Result = 0.0;
    if (!$mod.TryRecodeDateTime(AValue,AYear,AMonth,ADay,AHour,AMinute,ASecond,AMilliSecond,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) $mod.InvalidDateTimeError(AYear,AMonth,ADay,AHour,AMinute,ASecond,AMilliSecond,AValue);
    return Result;
  };
  this.TryRecodeDateTime = function (AValue, AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond, AResult) {
    var Result = false;
    function FV(AV, Arg) {
      if (Arg !== 65535) AV.set(Arg);
    };
    var Y = 0;
    var M = 0;
    var D = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    $mod.DecodeDateTime(AValue,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    FV({get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},AYear);
    FV({get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},AMonth);
    FV({get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},ADay);
    FV({get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},AHour);
    FV({get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},AMinute);
    FV({get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},ASecond);
    FV({get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }},AMilliSecond);
    Result = $mod.TryEncodeDateTime(Y,M,D,H,N,S,MS,AResult);
    return Result;
  };
  this.CompareDateTime = function (A, B) {
    var Result = -1;
    if ($mod.SameDateTime(A,B)) {
      Result = 0}
     else if (pas.System.Trunc(A) === pas.System.Trunc(B)) {
      if (Math.abs(pas.System.Frac(A)) > Math.abs(pas.System.Frac(B))) {
        Result = 1}
       else Result = -1;
    } else {
      if (A > B) {
        Result = 1}
       else Result = -1;
    };
    return Result;
  };
  this.CompareDate = function (A, B) {
    var Result = -1;
    if ($mod.SameDate(A,B)) {
      Result = 0}
     else if (A < B) {
      Result = -1}
     else Result = 1;
    return Result;
  };
  this.CompareTime = function (A, B) {
    var Result = -1;
    if ($mod.SameTime(A,B)) {
      Result = 0}
     else if (pas.System.Frac(A) < pas.System.Frac(B)) {
      Result = -1}
     else Result = 1;
    return Result;
  };
  this.SameDateTime = function (A, B) {
    var Result = false;
    Result = Math.abs(A - B) < 1.1574074074074074E-8;
    return Result;
  };
  this.SameDate = function (A, B) {
    var Result = false;
    Result = pas.System.Trunc(A) === pas.System.Trunc(B);
    return Result;
  };
  this.SameTime = function (A, B) {
    var Result = false;
    Result = pas.System.Frac(Math.abs(A - B)) < 1.1574074074074074E-8;
    return Result;
  };
  this.NthDayOfWeek = function (AValue) {
    var Result = 0;
    Result = $impl.InternalNthDayOfWeek($mod.DayOfTheMonth(AValue));
    return Result;
  };
  this.DecodeDayOfWeekInMonth = function (AValue, AYear, AMonth, ANthDayOfWeek, ADayOfWeek) {
    var D = 0;
    pas.SysUtils.DecodeDate(AValue,AYear,AMonth,{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }});
    ADayOfWeek.set($mod.DayOfTheWeek(AValue));
    ANthDayOfWeek.set($impl.InternalNthDayOfWeek(D));
  };
  this.EncodeDayOfWeekInMonth = function (AYear, AMonth, ANthDayOfWeek, ADayOfWeek) {
    var Result = 0.0;
    if (!$mod.TryEncodeDayOfWeekInMonth(AYear,AMonth,ANthDayOfWeek,ADayOfWeek,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) $mod.InvalidDayOfWeekInMonthError(AYear,AMonth,ANthDayOfWeek,ADayOfWeek);
    return Result;
  };
  this.TryEncodeDayOfWeekInMonth = function (AYear, AMonth, ANthDayOfWeek, ADayOfWeek, AValue) {
    var Result = false;
    var SOM = 0;
    var D = 0;
    SOM = $mod.DayOfTheWeek(pas.SysUtils.EncodeDate(AYear,AMonth,1));
    D = ((1 + ADayOfWeek) - SOM) + (7 * (ANthDayOfWeek - 1));
    if (SOM > ADayOfWeek) D = D + 7;
    Result = pas.SysUtils.TryEncodeDate(AYear,AMonth,D,AValue);
    return Result;
  };
  this.InvalidDateTimeError = function (AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond, ABaseDate) {
    function DoField(Arg, Def, Unknown) {
      var Result = "";
      if (Def === 0) ;
      if (Arg !== 65535) {
        Result = pas.SysUtils.Format("%.*d",[Unknown.length,Arg])}
       else if (ABaseDate === 0) {
        Result = Unknown}
       else Result = pas.SysUtils.Format("%.*d",[Unknown.length,Arg]);
      return Result;
    };
    var Y = 0;
    var M = 0;
    var D = 0;
    var H = 0;
    var N = 0;
    var S = 0;
    var MS = 0;
    var Msg = "";
    $mod.DecodeDateTime(ABaseDate,{get: function () {
        return Y;
      }, set: function (v) {
        Y = v;
      }},{get: function () {
        return M;
      }, set: function (v) {
        M = v;
      }},{get: function () {
        return D;
      }, set: function (v) {
        D = v;
      }},{get: function () {
        return H;
      }, set: function (v) {
        H = v;
      }},{get: function () {
        return N;
      }, set: function (v) {
        N = v;
      }},{get: function () {
        return S;
      }, set: function (v) {
        S = v;
      }},{get: function () {
        return MS;
      }, set: function (v) {
        MS = v;
      }});
    Msg = DoField(AYear,Y,"????");
    Msg = (Msg + pas.SysUtils.DateSeparator) + DoField(AMonth,M,"??");
    Msg = (Msg + pas.SysUtils.DateSeparator) + DoField(ADay,D,"??");
    Msg = (Msg + " ") + DoField(AHour,H,"??");
    Msg = (Msg + pas.SysUtils.TimeSeparator) + DoField(AMinute,N,"??");
    Msg = (Msg + pas.SysUtils.TimeSeparator) + DoField(ASecond,S,"??");
    Msg = (Msg + pas.SysUtils.DecimalSeparator) + DoField(AMilliSecond,MS,"???");
    throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidTimeStamp,[Msg]]);
  };
  this.InvalidDateTimeError$1 = function (AYear, AMonth, ADay, AHour, AMinute, ASecond, AMilliSecond) {
    $mod.InvalidDateTimeError(AYear,AMonth,ADay,AHour,AMinute,ASecond,AMilliSecond,0);
  };
  this.InvalidDateWeekError = function (AYear, AWeekOfYear, ADayOfWeek) {
    throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidDateWeek,[AYear,AWeekOfYear,ADayOfWeek]]);
  };
  this.InvalidDateDayError = function (AYear, ADayOfYear) {
    throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidDayOfYear,[AYear,ADayOfYear]]);
  };
  this.InvalidDateMonthWeekError = function (AYear, AMonth, AWeekOfMonth, ADayOfWeek) {
    throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidDateMonthWeek,[AYear,AMonth,AWeekOfMonth,ADayOfWeek]]);
  };
  this.InvalidDayOfWeekInMonthError = function (AYear, AMonth, ANthDayOfWeek, ADayOfWeek) {
    throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SErrInvalidDayOfWeekInMonth,[AYear,AMonth,ANthDayOfWeek,ADayOfWeek]]);
  };
  this.DateTimeToJulianDate = function (AValue) {
    var Result = 0.0;
    var day = 0;
    var month = 0;
    var year = 0;
    var a = 0;
    var y = 0;
    var m = 0;
    pas.SysUtils.DecodeDate(AValue,{get: function () {
        return year;
      }, set: function (v) {
        year = v;
      }},{get: function () {
        return month;
      }, set: function (v) {
        month = v;
      }},{get: function () {
        return day;
      }, set: function (v) {
        day = v;
      }});
    a = Math.floor((14 - month) / 12);
    y = (year + 4800) - a;
    m = (month + (12 * a)) - 3;
    Result = ((((((day + Math.floor(((153 * m) + 2) / 5)) + (365 * y)) + Math.floor(y / 4)) - Math.floor(y / 100)) + Math.floor(y / 400)) - 32045.5) + pas.System.Frac(AValue);
    return Result;
  };
  this.JulianDateToDateTime = function (AValue) {
    var Result = 0.0;
    if (!$mod.TryJulianDateToDateTime(AValue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) throw pas.SysUtils.EConvertError.$create("CreateFmt",[pas.RTLConsts.SInvalidJulianDate,[AValue]]);
    return Result;
  };
  this.TryJulianDateToDateTime = function (AValue, ADateTime) {
    var Result = false;
    var a = 0;
    var b = 0;
    var c = 0;
    var d = 0;
    var e = 0;
    var m = 0;
    var day = 0;
    var month = 0;
    var year = 0;
    a = pas.System.Trunc(AValue + 32044.5);
    b = Math.floor(((4 * a) + 3) / 146097);
    c = a - Math.floor((146097 * b) / 4);
    d = Math.floor(((4 * c) + 3) / 1461);
    e = c - Math.floor((1461 * d) / 4);
    m = Math.floor(((5 * e) + 2) / 153);
    day = (e - Math.floor(((153 * m) + 2) / 5)) + 1;
    month = (m + 3) - (12 * Math.floor(m / 10));
    year = (((100 * b) + d) - 4800) + Math.floor(m / 10);
    Result = pas.SysUtils.TryEncodeDate(year,month,day,ADateTime);
    if (Result) ADateTime.set(ADateTime.get() + pas.System.Frac(AValue - 0.5));
    return Result;
  };
  this.DateTimeToModifiedJulianDate = function (AValue) {
    var Result = 0.0;
    Result = $mod.DateTimeToJulianDate(AValue) - 2400000.5;
    return Result;
  };
  this.ModifiedJulianDateToDateTime = function (AValue) {
    var Result = 0.0;
    Result = $mod.JulianDateToDateTime(AValue + 2400000.5);
    return Result;
  };
  this.TryModifiedJulianDateToDateTime = function (AValue, ADateTime) {
    var Result = false;
    Result = $mod.TryJulianDateToDateTime(AValue + 2400000.5,ADateTime);
    return Result;
  };
  this.DateTimeToUnix = function (AValue) {
    var Result = 0;
    Result = Math.round($impl.DateTimeDiff($mod.RecodeMilliSecond(AValue,0),25569) * 86400);
    return Result;
  };
  this.UnixToDateTime = function (AValue) {
    var Result = 0.0;
    Result = $mod.IncSecond(25569,AValue);
    return Result;
  };
  var Epoch = (24107 * 24) * 3600;
  this.UnixTimeStampToMac = function (AValue) {
    var Result = 0;
    Result = AValue + 2082844800;
    return Result;
  };
  this.DateTimeToMac = function (AValue) {
    var Result = 0;
    var Epoch = 0.0;
    Epoch = $mod.EncodeDateTime(1904,1,1,0,0,0,0);
    Result = $mod.SecondsBetween(Epoch,AValue);
    return Result;
  };
  this.MacToDateTime = function (AValue) {
    var Result = 0.0;
    var Epoch = 0.0;
    Epoch = $mod.EncodeDateTime(1904,1,1,0,0,0,0);
    Result = $mod.IncSecond(Epoch,AValue);
    return Result;
  };
  var Epoch$1 = (24107 * 24) * 3600;
  this.MacTimeStampToUnix = function (AValue) {
    var Result = 0;
    Result = AValue - 2082844800;
    return Result;
  };
  this.DateTimeToDosDateTime = function (AValue) {
    var Result = 0;
    var year = 0;
    var month = 0;
    var day = 0;
    var hour = 0;
    var min = 0;
    var sec = 0;
    var msec = 0;
    var zs = 0;
    $mod.DecodeDateTime(AValue,{get: function () {
        return year;
      }, set: function (v) {
        year = v;
      }},{get: function () {
        return month;
      }, set: function (v) {
        month = v;
      }},{get: function () {
        return day;
      }, set: function (v) {
        day = v;
      }},{get: function () {
        return hour;
      }, set: function (v) {
        hour = v;
      }},{get: function () {
        return min;
      }, set: function (v) {
        min = v;
      }},{get: function () {
        return sec;
      }, set: function (v) {
        sec = v;
      }},{get: function () {
        return msec;
      }, set: function (v) {
        msec = v;
      }});
    Result = -1980;
    Result = Result + (year & 127);
    Result = Result << 4;
    Result = Result + month;
    Result = Result << 5;
    Result = Result + day;
    Result = Result << 16;
    zs = hour;
    zs = zs << 6;
    zs = zs + min;
    zs = zs << 5;
    zs = zs + Math.floor(sec / 2);
    Result = Result + (zs & 0xffff);
    return Result;
  };
  this.DosDateTimeToDateTime = function (AValue) {
    var Result = 0.0;
    var year = 0;
    var month = 0;
    var day = 0;
    var hour = 0;
    var min = 0;
    var sec = 0;
    sec = (AValue & 31) * 2;
    AValue = AValue >>> 5;
    min = AValue & 63;
    AValue = AValue >>> 6;
    hour = AValue & 31;
    AValue = AValue >>> 5;
    day = AValue & 31;
    AValue = AValue >>> 5;
    month = AValue & 15;
    AValue = AValue >>> 4;
    year = AValue + 1980;
    Result = $mod.EncodeDateTime(year,month,day,hour,min,sec,0);
    return Result;
  };
  this.UniversalTimeToLocal = function (UT) {
    var Result = 0.0;
    Result = $mod.UniversalTimeToLocal$1(UT,-$impl.GetLocalTimeOffset());
    return Result;
  };
  this.UniversalTimeToLocal$1 = function (UT, TZOffset) {
    var Result = 0.0;
    if (TZOffset > 0) {
      Result = UT + pas.SysUtils.EncodeTime(Math.floor(TZOffset / 60),TZOffset % 60,0,0)}
     else if (TZOffset < 0) {
      Result = UT - pas.SysUtils.EncodeTime(Math.floor(Math.abs(TZOffset) / 60),Math.abs(TZOffset) % 60,0,0)}
     else Result = UT;
    return Result;
  };
  this.LocalTimeToUniversal = function (LT) {
    var Result = 0.0;
    Result = $mod.LocalTimeToUniversal$1(LT,-$impl.GetLocalTimeOffset());
    return Result;
  };
  this.LocalTimeToUniversal$1 = function (LT, TZOffset) {
    var Result = 0.0;
    if (TZOffset > 0) {
      Result = LT - pas.SysUtils.EncodeTime(Math.floor(TZOffset / 60),TZOffset % 60,0,0)}
     else if (TZOffset < 0) {
      Result = LT + pas.SysUtils.EncodeTime(Math.floor(Math.abs(TZOffset) / 60),Math.abs(TZOffset) % 60,0,0)}
     else Result = LT;
    return Result;
  };
  this.DateTimeToRFC3339 = function (ADate) {
    var Result = "";
    Result = pas.SysUtils.FormatDateTime('yyyy-mm-dd"T"hh":"nn":"ss"."zzz"Z"',ADate);
    return Result;
  };
  this.DateToRFC3339 = function (ADate) {
    var Result = "";
    Result = pas.SysUtils.FormatDateTime("yyyy-mm-dd",ADate);
    return Result;
  };
  this.TimeToRFC3339 = function (ADate) {
    var Result = "";
    Result = pas.SysUtils.FormatDateTime('hh":"nn":"ss"."zzz',ADate);
    return Result;
  };
  var P = [11,1,6,9,12,15,18];
  this.TryRFC3339ToDateTime = function (Avalue, ADateTime) {
    var Result = false;
    this.TPartPos = {"0": "ppTime", ppTime: 0, "1": "ppYear", ppYear: 1, "2": "ppMonth", ppMonth: 2, "3": "ppDay", ppDay: 3, "4": "ppHour", ppHour: 4, "5": "ppMinute", ppMinute: 5, "6": "ppSec", ppSec: 6};
    var lY = 0;
    var lM = 0;
    var lD = 0;
    var lH = 0;
    var lMi = 0;
    var lS = 0;
    if (pas.SysUtils.Trim(Avalue) === "") {
      Result = true;
      ADateTime.set(0);
    };
    lY = pas.SysUtils.StrToIntDef(pas.System.Copy(Avalue,P[$mod.TPartPos.ppYear],4),-1);
    lM = pas.SysUtils.StrToIntDef(pas.System.Copy(Avalue,P[$mod.TPartPos.ppMonth],2),-1);
    lD = pas.SysUtils.StrToIntDef(pas.System.Copy(Avalue,P[$mod.TPartPos.ppDay],2),-1);
    if (Avalue.length >= P[$mod.TPartPos.ppTime]) {
      lH = pas.SysUtils.StrToIntDef(pas.System.Copy(Avalue,P[$mod.TPartPos.ppHour],2),-1);
      lMi = pas.SysUtils.StrToIntDef(pas.System.Copy(Avalue,P[$mod.TPartPos.ppMinute],2),-1);
      lS = pas.SysUtils.StrToIntDef(pas.System.Copy(Avalue,P[$mod.TPartPos.ppSec],2),-1);
    } else {
      lH = 0;
      lMi = 0;
      lS = 0;
    };
    Result = (((((lY >= 0) && (lM >= 0)) && (lD >= 0)) && (lH >= 0)) && (lMi >= 0)) && (lS >= 0);
    if (!Result) {
      ADateTime.set(0)}
     else if (((lY === 0) || (lM === 0)) || (lD === 0)) {
      ADateTime.set(pas.SysUtils.EncodeTime(lH,lMi,lS,0))}
     else ADateTime.set(pas.SysUtils.EncodeDate(lY,lM,lD) + pas.SysUtils.EncodeTime(lH,lMi,lS,0));
    return Result;
  };
  this.RFC3339ToDateTime = function (Avalue) {
    var Result = 0.0;
    if (!$mod.TryRFC3339ToDateTime(Avalue,{get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }})) Result = 0;
    return Result;
  };
  rtl.createClass($mod,"TDateTimeScanner",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FPattern = "";
      this.FText = "";
      this.FPatternOffset = 0;
      this.FLen = 0;
      this.FPatternLen = 0;
      this.FPatternPos = 0;
      this.FPos = 0;
      this.FY = 0;
      this.FM = 0;
      this.FD = 0;
      this.FTimeval = 0.0;
    };
    this.ArrayMatchError = function () {
      $impl.raiseexception(pas.SysUtils.Format($impl.SNoArrayMatch,[this.FPatternPos + 1,this.FPos]));
    };
    this.DoDateTime = function () {
      this.MatchPattern(pas.SysUtils.ShortDateFormat);
      this.MatchPattern("\t");
      this.MatchPattern(pas.SysUtils.LongTimeFormat);
      this.FPatternPos += 1;
    };
    this.SetPattern = function (AValue) {
      if (this.FPattern === AValue) return;
      this.FPattern = AValue;
      this.FPatternLen = this.FPattern.length;
    };
    this.SetText = function (AValue) {
      if (this.FText === AValue) return;
      this.FText = AValue;
      this.FLen = this.FText.length;
    };
    this.ScanFixedInt = function (maxv) {
      var Result = 0;
      var c = "";
      var n = "";
      var oi = 0;
      Result = 0;
      oi = this.FPos;
      c = this.FPattern.charAt(this.FPatternPos - 1);
      while ((this.FPatternPos <= this.FPatternLen) && (this.FPattern.charAt(this.FPatternPos - 1) === c)) this.FPatternPos += 1;
      n = this.FText.charAt(this.FPos - 1);
      while (((maxv > 0) && (this.FPos <= this.FLen)) && (n.charCodeAt() in rtl.createSet(null,48,57))) {
        Result = ((Result * 10) + n.charCodeAt()) - 48;
        this.FPos += 1;
        maxv -= 1;
        if (this.FPos <= this.FLen) n = this.FText.charAt(this.FPos - 1);
      };
      if (oi === this.FPos) $impl.raiseexception(pas.SysUtils.Format($impl.SPatternCharMismatch,[c,oi]));
      return Result;
    };
    this.ScanPatternLength = function () {
      var Result = 0;
      var c = "";
      var i = 0;
      Result = this.FPatternPos;
      i = this.FPatternPos;
      c = this.FPattern.charAt(i - 1);
      while ((i <= this.FPatternLen) && (this.FPattern.charAt(i - 1) === c)) i += 1;
      Result = i - Result;
      return Result;
    };
    this.MatchChar = function (c) {
      var N = "";
      if (this.FPos <= this.FLen) {
        N = this.FText.charAt(this.FPos - 1)}
       else N = "?";
      if (N !== c) $impl.raiseexception(pas.SysUtils.Format($impl.SNoCharMatch,[N,c,this.FPatternPos + this.FPatternOffset,this.FPos]));
      this.FPatternPos += 1;
      this.FPos += 1;
    };
    this.FindIMatch = function (values, aTerm) {
      var Result = 0;
      var l = 0;
      var i = 0;
      Result = -1;
      l = rtl.length(values) - 1;
      i = 0;
      while ((i <= l) && (Result === -1)) {
        if (pas.SysUtils.SameText(pas.System.Copy(aTerm,1,values[i].length),values[i])) Result = i;
        i += 1;
      };
      return Result;
    };
    this.FindMatch = function (Values) {
      var Result = 0;
      Result = this.FindIMatch(Values,pas.System.Copy(this.FText,this.FPos,(this.FLen - this.FPos) + 1));
      if (Result === -1) {
        this.ArrayMatchError()}
       else {
        this.FPos += Values[Result].length + 1;
        this.FPatternPos += Values[Result].length + 1;
        Result += 1;
      };
      return Result;
    };
    this.MatchPattern = function (aPattern) {
      var T = "";
      var cPos = 0;
      T = this.FPattern;
      cPos = this.FPatternPos;
      this.FPatternOffset = this.FPatternPos;
      this.FPattern = aPattern;
      this.FPatternLen = aPattern.length;
      try {
        this.Scan(-1);
      } finally {
        this.FPattern = T;
        this.FPatternLen = aPattern.length;
        this.FPatternPos = cPos;
        this.FPatternOffset = 0;
      };
    };
    this.DoYear = function () {
      var I = 0;
      var pivot = 0;
      I = this.ScanPatternLength();
      this.FY = this.ScanFixedInt(4);
      if (I <= 2) {
        pivot = $mod.YearOf(pas.SysUtils.Now()) - pas.SysUtils.TwoDigitYearCenturyWindow;
        this.FY += Math.floor(pivot / 100) * 100;
        if ((pas.SysUtils.TwoDigitYearCenturyWindow > 0) && (this.FY < pivot)) this.FY += 100;
      };
    };
    this.DoMonth = function () {
      var I = 0;
      I = this.ScanPatternLength();
      var $tmp1 = I;
      if (($tmp1 === 1) || ($tmp1 === 2)) {
        this.FM = this.ScanFixedInt(2)}
       else if ($tmp1 === 3) {
        this.FM = this.FindMatch(pas.SysUtils.ShortMonthNames)}
       else if ($tmp1 === 4) this.FM = this.FindMatch(pas.SysUtils.LongMonthNames);
    };
    this.DoDay = function () {
      var I = 0;
      I = this.ScanPatternLength();
      var $tmp1 = I;
      if (($tmp1 === 1) || ($tmp1 === 2)) {
        this.FD = this.ScanFixedInt(2)}
       else if ($tmp1 === 3) {
        this.FD = this.FindMatch(pas.SysUtils.ShortDayNames)}
       else if ($tmp1 === 4) {
        this.FD = this.FindMatch(pas.SysUtils.LongDayNames)}
       else if ($tmp1 === 5) {
        this.MatchPattern(pas.SysUtils.ShortDateFormat)}
       else if ($tmp1 === 6) this.MatchPattern(pas.SysUtils.LongDateFormat);
    };
    this.DoTime = function () {
      var I = 0;
      I = this.ScanPatternLength();
      var $tmp1 = I;
      if ($tmp1 === 1) {
        this.MatchPattern(pas.SysUtils.ShortTimeFormat)}
       else if ($tmp1 === 2) this.MatchPattern(pas.SysUtils.LongTimeFormat);
    };
    this.DoAMPM = function () {
      var I = 0;
      I = this.FindIMatch($impl.AMPMformatting,pas.System.Copy(this.FPattern,this.FPatternPos,5));
      var $tmp1 = I;
      if ($tmp1 === 0) {
        I = this.FindIMatch(["AM","PM"],pas.System.Copy(this.FText,this.FPos,2));
        var $tmp2 = I;
        if ($tmp2 === 0) {}
        else if ($tmp2 === 1) {
          this.FTimeval = this.FTimeval + (12 * 0.041666666666666664)}
         else {
          this.ArrayMatchError();
        };
        this.FPatternPos += $impl.AMPMformatting[0].length;
        this.FPos += 2;
      } else if ($tmp1 === 1) {
        var $tmp3 = pas.System.upcase(this.FText.charAt(this.FPos - 1));
        if ($tmp3 === "A") {}
        else if ($tmp3 === "P") {
          this.FTimeval = this.FTimeval + (12 * 0.041666666666666664)}
         else {
          this.ArrayMatchError();
        };
        this.FPatternPos += $impl.AMPMformatting[1].length;
        this.FPos += 1;
      } else if ($tmp1 === 2) {
        I = this.FindIMatch([pas.SysUtils.TimeAMString,pas.SysUtils.TimePMString],pas.System.Copy(this.FText,this.FPos,5));
        var $tmp4 = I;
        if ($tmp4 === 0) {
          this.FPos += pas.SysUtils.TimeAMString.length}
         else if ($tmp4 === 1) {
          this.FTimeval = this.FTimeval + (12 * 0.041666666666666664);
          this.FPos += pas.SysUtils.TimePMString.length;
        } else {
          this.ArrayMatchError();
        };
        this.FPatternPos += $impl.AMPMformatting[2].length;
        this.FPatternPos += 2;
        this.FPos += 2;
      } else {
        this.MatchChar(this.FPattern.charAt(this.FPatternPos - 1));
      };
    };
    this.Scan = function (StartPos) {
      var Result = 0.0;
      var lasttoken = "";
      var activequote = "";
      var lch = "";
      var i = 0;
      if (StartPos < 1) StartPos = 1;
      if (this.FPos < StartPos) this.FPos = StartPos;
      this.FPatternPos = 1;
      activequote = "\x00";
      lasttoken = " ";
      while ((this.FPos <= this.FLen) && (this.FPatternPos <= this.FPatternLen)) {
        lch = pas.System.upcase(this.FPattern.charAt(this.FPatternPos - 1));
        if (activequote !== "\x00") {
          if (activequote !== lch) {
            this.MatchChar(lch)}
           else {
            activequote = "\x00";
            this.FPatternPos += 1;
          };
        } else {
          if ((lch === "M") && (lasttoken === "H")) {
            i = this.ScanPatternLength();
            if (i > 2) $impl.raiseexception(pas.SysUtils.Format($impl.SHHMMError,[(this.FPatternOffset + this.FPatternPos) + 1]));
            this.FTimeval = this.FTimeval + (this.ScanFixedInt(2) * 0.00069444444444444447);
          } else {
            var $tmp1 = lch;
            if ($tmp1 === "Y") {
              this.DoYear()}
             else if ($tmp1 === "M") {
              this.DoMonth()}
             else if ($tmp1 === "D") {
              this.DoDay()}
             else if ($tmp1 === "T") {
              this.DoTime()}
             else if ($tmp1 === "H") {
              this.FTimeval = this.FTimeval + (this.ScanFixedInt(2) * 0.041666666666666664)}
             else if ($tmp1 === "N") {
              this.FTimeval = this.FTimeval + (this.ScanFixedInt(2) * 0.00069444444444444447)}
             else if ($tmp1 === "S") {
              this.FTimeval = this.FTimeval + (this.ScanFixedInt(2) * 0.000011574074074074073)}
             else if ($tmp1 === "Z") {
              this.FTimeval = this.FTimeval + (this.ScanFixedInt(3) * 1.1574074074074074E-8)}
             else if ($tmp1 === "A") {
              this.DoAMPM()}
             else if ($tmp1 === "\/") {
              this.MatchChar(pas.SysUtils.DateSeparator)}
             else if ($tmp1 === ":") {
              this.MatchChar(pas.SysUtils.TimeSeparator);
              lch = lasttoken;
            } else if (($tmp1 === "'") || ($tmp1 === '"')) {
              activequote = lch;
              this.FPatternPos += 1;
            } else if ($tmp1 === "C") {
              this.DoDateTime()}
             else if ($tmp1 === "?") {
              this.FPatternPos += 1;
              this.FPos += 1;
            } else if ($tmp1 === "\t") {
              while ((this.FPos <= this.FLen) && (this.FText.charCodeAt(this.FPos - 1) in $impl.whitespace)) this.FPos += 1;
              this.FPatternPos += 1;
            } else {
              this.MatchChar(this.FPattern.charAt(this.FPatternPos - 1));
            };
          };
          lasttoken = lch;
        };
      };
      Result = this.FTimeval;
      if (((this.FY > 0) && (this.FM > 0)) && (this.FD > 0)) Result = Result + pas.SysUtils.EncodeDate(this.FY,this.FM,this.FD);
      return Result;
    };
  });
  this.ScanDateTime = function (APattern, AValue, APos) {
    var Result = 0.0;
    var T = null;
    T = $mod.TDateTimeScanner.$create("Create");
    try {
      T.SetPattern(APattern);
      T.SetText(AValue);
      Result = T.Scan(APos);
    } finally {
      T = rtl.freeLoc(T);
    };
    return Result;
  };
},["JS","RTLConsts"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.TDateTimeEpsilon = 2.2204460493e-16;
  $impl.HalfMilliSecond = 1.1574074074074074E-8 / 2;
  $impl.IsValidMonth = function (AMonth) {
    var Result = false;
    Result = (AMonth >= 1) && (AMonth <= 12);
    return Result;
  };
  $impl.IsValidDayOfWeek = function (ADayOfWeek) {
    var Result = false;
    Result = (ADayOfWeek >= 1) && (ADayOfWeek <= 7);
    return Result;
  };
  $impl.IsValidWeekOfMonth = function (AWeekOfMonth) {
    var Result = false;
    Result = (AWeekOfMonth >= 1) && (AWeekOfMonth <= 5);
    return Result;
  };
  $impl.DOWMap = [7,1,2,3,4,5,6];
  $impl.DateTimeDiff = function (ANow, AThen) {
    var Result = 0.0;
    Result = ANow - AThen;
    if ((ANow > 0) && (AThen < 0)) {
      Result = Result - 0.5}
     else if ((ANow < -1.0) && (AThen > -1.0)) Result = Result + 0.5;
    return Result;
  };
  $impl.MaybeSkipTimeWarp = function (OldDate, NewDate) {
    if ((OldDate >= 0) && (NewDate.get() < -2.2204460493E-16)) {
      NewDate.set(pas.System.Int((NewDate.get() - 1.0) + 2.2204460493E-16) - pas.System.Frac(1.0 + pas.System.Frac(NewDate.get())))}
     else if ((OldDate <= -1.0) && (NewDate.get() > (-1.0 + 2.2204460493E-16))) NewDate.set(pas.System.Int((NewDate.get() + 1.0) - 2.2204460493E-16) + pas.System.Frac(1.0 - Math.abs(pas.System.Frac(1.0 + NewDate.get()))));
  };
  $impl.IncNegativeTime = function (AValue, Addend) {
    var Result = 0.0;
    var newtime = 0.0;
    newtime = -pas.System.Frac(AValue) + pas.System.Frac(Addend);
    if (pas.math.SameValue(newtime,pas.System.Int(newtime) + 1,2.2204460493E-16)) {
      newtime = pas.System.Int(newtime) + 1}
     else if (pas.math.SameValue(newtime,pas.System.Int(newtime),2.2204460493E-16)) newtime = pas.System.Int(newtime);
    if (newtime < -2.2204460493E-16) {
      newtime = 1.0 + newtime;
      AValue = pas.System.Int(AValue) - 1;
    } else if (newtime >= (1.0 - 2.2204460493E-16)) {
      newtime = newtime - 1.0;
      AValue = pas.System.Int(AValue) + 1;
    };
    Result = (pas.System.Int(AValue) + pas.System.Int(Addend)) - newtime;
    return Result;
  };
  $impl.LFAI = 65535;
  $impl.InternalNthDayOfWeek = function (DoM) {
    var Result = 0;
    Result = Math.floor((DoM - 1) / 7) + 1;
    return Result;
  };
  $impl.whitespace = rtl.createSet(32,13,10);
  $impl.hrfactor = 1 / 24;
  $impl.minfactor = 1 / (24 * 60);
  $impl.secfactor = 1 / ((24 * 60) * 60);
  $impl.mssecfactor = 1 / (((24 * 60) * 60) * 1000);
  $impl.AMPMformatting = ["am\/pm","a\/p","ampm"];
  $impl.raiseexception = function (s) {
    throw pas.SysUtils.EConvertError.$create("Create$1",[s]);
  };
  $impl.GetLocalTimeOffset = function () {
    var Result = 0;
    Result = (new Date()).getTimezoneOffset();
    return Result;
  };
  $impl.SPatternCharMismatch = 'Pattern mismatch char "%s" at position %d.';
  $impl.SNoCharMatch = 'Mismatch char "%s" <> "%s" at pattern position %d, string position %d.';
  $impl.SHHMMError = "mm in a sequence hh:mm is interpreted as minutes. No longer versions allowed! (Position : %d).";
  $impl.SNoArrayMatch = "Can't match any allowed value at pattern position %d, string position %d.";
});
rtl.module("DBConst",["System"],function () {
  "use strict";
  var $mod = this;
  $mod.$resourcestrings = {SActiveDataset: {org: "Operation cannot be performed on an active dataset"}, SBadParamFieldType: {org: 'Bad fieldtype for parameter "%s".'}, SCantSetAutoIncFields: {org: "AutoInc Fields are read-only"}, SConnected: {org: "Operation cannot be performed on a connected database"}, SDatasetReadOnly: {org: "Dataset is read-only."}, SDatasetRegistered: {org: 'Dataset already registered : "%s"'}, SDuplicateFieldName: {org: 'Duplicate fieldname : "%s"'}, SErrAssTransaction: {org: "Cannot assign transaction while old transaction active!"}, SErrColumnNotFound: {org: 'Column "%s" not found.'}, SErrDatabasenAssigned: {org: "Database not assigned!"}, SErrNoDatabaseAvailable: {org: "Invalid operation: Not attached to database"}, SErrNoDatabaseName: {org: "Database connect string (DatabaseName) not filled in!"}, SErrNoSelectStatement: {org: "Cannot open a non-select statement"}, SErrNoStatement: {org: "SQL statement not set"}, SErrTransAlreadyActive: {org: "Transaction already active"}, SErrTransactionnSet: {org: "Transaction not set"}, SErrIndexResultTooLong: {org: 'Index result for "%s" too long, >100 characters (%d).'}, SErrIndexBasedOnInvField: {org: 'Field "%s" has an invalid field type (%s) to base index on.'}, SErrIndexBasedOnUnkField: {org: 'Index based on unknown field "%s".'}, SErrConnTransactionnSet: {org: "Transaction of connection not set"}, SErrNotASQLConnection: {org: '"%s" is not a TSQLConnection'}, SErrNotASQLQuery: {org: '"%s" is not a TCustomSQLQuery'}, STransNotActive: {org: "Operation cannot be performed on an inactive transaction"}, STransActive: {org: "Operation cannot be performed on an active transaction"}, SFieldNotFound: {org: 'Field not found : "%s"'}, SInactiveDataset: {org: "Operation cannot be performed on an inactive dataset"}, SInvalidDisplayValues: {org: '"%s" are not valid boolean displayvalues'}, SInvalidFieldKind: {org: "%s : invalid field kind : "}, SInvalidBookmark: {org: "Invalid bookmark"}, SInvalidFieldSize: {org: "Invalid field size : %d"}, SInvalidTypeConversion: {org: "Invalid type conversion to %s in field %s"}, SNeedField: {org: "Field %s is required, but not supplied."}, SNeedFieldName: {org: "Field needs a name"}, SNoDataset: {org: 'No dataset asssigned for field : "%s"'}, SNoDatasetRegistered: {org: 'No such dataset registered : "%s"'}, SNoDatasets: {org: "No datasets are attached to the database"}, SNoSuchRecord: {org: "Could not find the requested record."}, SNoTransactionRegistered: {org: 'No such transaction registered : "%s"'}, SNoTransactions: {org: "No transactions are attached to the database"}, SNotABoolean: {org: '"%s" is not a valid boolean'}, SNotAFloat: {org: '"%s" is not a valid float'}, SNotAninteger: {org: '"%s" is not a valid integer'}, SNotConnected: {org: "Operation cannot be performed on an disconnected database"}, SNotEditing: {org: 'Operation not allowed, dataset "%s" is not in an edit or insert state.'}, SParameterNotFound: {org: 'Parameter "%s" not found'}, SRangeError: {org: "%f is not between %f and %f for %s"}, SReadOnlyField: {org: "Field %s cannot be modified, it is read-only."}, STransactionRegistered: {org: 'Transaction already registered : "%s"'}, SUniDirectional: {org: "Operation cannot be performed on an unidirectional dataset"}, SUnknownField: {org: 'No field named "%s" was found in dataset "%s"'}, SUnknownFieldType: {org: "Unknown field type : %s"}, SUnknownParamFieldType: {org: 'Unknown fieldtype for parameter "%s".'}, SMetadataUnavailable: {org: "The metadata is not available for this type of database."}, SDeletedRecord: {org: "The record is deleted."}, SIndexNotFound: {org: "Index '%s' not found"}, SParameterCountIncorrect: {org: "The number of parameters is incorrect."}, SUnsupportedParameter: {org: "Parameters of the type '%s' are not (yet) supported."}, SFieldValueError: {org: "Invalid value for field '%s'"}, SInvalidCalcType: {org: "Field '%s' cannot be a calculated or lookup field"}, SDuplicateName: {org: "Duplicate name '%s' in %s"}, SNoParseSQL: {org: "%s is only possible if ParseSQL is True"}, SLookupInfoError: {org: "Lookup information for field '%s' is incomplete"}, SUnsupportedFieldType: {org: "Fieldtype %s is not supported"}, SInvPacketRecordsValue: {org: "PacketRecords has to be larger then 0"}, SInvPacketRecordsValueFieldNames: {org: "PacketRecords must be -1 if IndexFieldNames is set"}, SInvalidSearchFieldType: {org: "Searching in fields of type %s is not supported"}, SDatasetEmpty: {org: "The dataset is empty"}, SFieldIsNull: {org: "The field is null"}, SOnUpdateError: {org: "An error occurred while applying the updates in a record: %s"}, SApplyRecNotSupported: {org: "Applying updates is not supported by this TDataset descendent"}, SNoWhereFields: {org: "No %s query specified and failed to generate one. (No fields for inclusion in where statement found)"}, SNoUpdateFields: {org: "No %s query specified and failed to generate one. (No fields found for insert- or update-statement found)"}, SNotSupported: {org: "Operation is not supported by this type of database"}, SDBCreateDropFailed: {org: "Creation or dropping of database failed"}, SMaxIndexes: {org: "The maximum amount of indexes is reached"}, SMinIndexes: {org: "The minimum amount of indexes is 1"}, STooManyFields: {org: "More fields specified then really exist"}, SFieldIndexError: {org: "Field index out of range"}, SIndexFieldMissing: {org: "Cannot access index field '%s'"}, SNoFieldIndexes: {org: "No index currently active"}, SNotIndexField: {org: "Field '%s' is not indexed and cannot be modified"}, SErrUnknownConnectorType: {org: 'Unknown connector type: "%s"'}, SNoIndexFieldNameGiven: {org: "There are no fields selected to base the index on"}, SStreamNotRecognised: {org: "The data-stream format is not recognized"}, SNoReaderClassRegistered: {org: "There is no TDatapacketReaderClass registered for this kind of data-stream"}, SErrCircularDataSourceReferenceNotAllowed: {org: "Circular datasource references are not allowed."}, SCommitting: {org: "Committing transaction"}, SRollingBack: {org: "Rolling back transaction"}, SCommitRetaining: {org: "Commit and retaining transaction"}, SRollBackRetaining: {org: "Rollback and retaining transaction"}, SErrNoFieldsDefined: {org: "Can not create a dataset when there are no fielddefinitions or fields defined"}, SErrApplyUpdBeforeRefresh: {org: "Must apply updates before refreshing data"}, SErrNoDataset: {org: "Missing (compatible) underlying dataset, can not open"}, SErrDisconnectedPacketRecords: {org: "For disconnected TSQLQuery instances, packetrecords must be -1"}, SErrImplicitNoRollBack: {org: "Implicit use of transactions does not allow rollback."}, SErrNoImplicitTransaction: {org: "Connection %s does not allow implicit transactions."}, SErrImplictTransactionStart: {org: 'Error: attempt to implicitly start a transaction on Connection "%s", transaction "%s".'}, SErrImplicitConnect: {org: 'Error: attempt to implicitly activate connection "%s".'}, SErrFailedToUpdateRecord: {org: "Failed to apply record updates: %d rows updated."}, SErrRefreshNotSingleton: {org: "Refresh SQL resulted in multiple records: %d."}, SErrRefreshEmptyResult: {org: "Refresh SQL resulted in empty result set."}, SErrNoKeyFieldForRefreshClause: {org: "No key field found to construct refresh SQL WHERE clause"}, SErrFailedToFetchReturningResult: {org: "Failed to fetch returning result"}, SLogParamValue: {org: 'Parameter "%s" value : "%s"'}, SErrInvalidDateTime: {org: 'Invalid date\/time value : "%s"'}, SatEOFInternalOnly: {org: "loAtEOF is for internal use only."}, SErrInsertingSameRecordtwice: {org: "Attempt to insert the same record twice."}, SErrDoApplyUpdatesNeedsProxy: {org: "Cannot apply updates without Data proxy"}};
});
rtl.module("TypInfo",["System","SysUtils","Types","RTLConsts","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.TTypeKind = {"0": "tkUnknown", tkUnknown: 0, "1": "tkInteger", tkInteger: 1, "2": "tkChar", tkChar: 2, "3": "tkString", tkString: 3, "4": "tkEnumeration", tkEnumeration: 4, "5": "tkSet", tkSet: 5, "6": "tkDouble", tkDouble: 6, "7": "tkBool", tkBool: 7, "8": "tkProcVar", tkProcVar: 8, "9": "tkMethod", tkMethod: 9, "10": "tkArray", tkArray: 10, "11": "tkDynArray", tkDynArray: 11, "12": "tkRecord", tkRecord: 12, "13": "tkClass", tkClass: 13, "14": "tkClassRef", tkClassRef: 14, "15": "tkPointer", tkPointer: 15, "16": "tkJSValue", tkJSValue: 16, "17": "tkRefToProcVar", tkRefToProcVar: 17, "18": "tkInterface", tkInterface: 18};
  $mod.$rtti.$Enum("TTypeKind",{minvalue: 0, maxvalue: 18, ordtype: 1, enumtype: this.TTypeKind});
  $mod.$rtti.$Set("TTypeKinds",{comptype: $mod.$rtti["TTypeKind"]});
  this.tkFloat = $mod.TTypeKind.tkDouble;
  this.tkProcedure = $mod.TTypeKind.tkProcVar;
  this.tkAny = rtl.createSet(null,$mod.TTypeKind.tkUnknown,$mod.TTypeKind.tkInterface);
  this.tkMethods = rtl.createSet($mod.TTypeKind.tkMethod);
  this.tkProperties = rtl.diffSet(rtl.diffSet($mod.tkAny,$mod.tkMethods),rtl.createSet($mod.TTypeKind.tkUnknown));
  $mod.$rtti.$ClassRef("TTypeInfoClassOf",{instancetype: $mod.$rtti["TTypeInfo"]});
  this.TOrdType = {"0": "otSByte", otSByte: 0, "1": "otUByte", otUByte: 1, "2": "otSWord", otSWord: 2, "3": "otUWord", otUWord: 3, "4": "otSLong", otSLong: 4, "5": "otULong", otULong: 5, "6": "otSIntDouble", otSIntDouble: 6, "7": "otUIntDouble", otUIntDouble: 7};
  $mod.$rtti.$Enum("TOrdType",{minvalue: 0, maxvalue: 7, ordtype: 1, enumtype: this.TOrdType});
  this.TParamFlag = {"0": "pfVar", pfVar: 0, "1": "pfConst", pfConst: 1, "2": "pfOut", pfOut: 2, "3": "pfArray", pfArray: 3};
  $mod.$rtti.$Enum("TParamFlag",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TParamFlag});
  $mod.$rtti.$Set("TParamFlags",{comptype: $mod.$rtti["TParamFlag"]});
  $mod.$rtti.$DynArray("TProcedureParams",{eltype: $mod.$rtti["TProcedureParam"]});
  this.TProcedureFlag = {"0": "pfStatic", pfStatic: 0, "1": "pfVarargs", pfVarargs: 1, "2": "pfExternal", pfExternal: 2};
  $mod.$rtti.$Enum("TProcedureFlag",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TProcedureFlag});
  $mod.$rtti.$Set("TProcedureFlags",{comptype: $mod.$rtti["TProcedureFlag"]});
  this.TMethodKind = {"0": "mkProcedure", mkProcedure: 0, "1": "mkFunction", mkFunction: 1, "2": "mkConstructor", mkConstructor: 2, "3": "mkDestructor", mkDestructor: 3, "4": "mkClassProcedure", mkClassProcedure: 4, "5": "mkClassFunction", mkClassFunction: 5};
  $mod.$rtti.$Enum("TMethodKind",{minvalue: 0, maxvalue: 5, ordtype: 1, enumtype: this.TMethodKind});
  $mod.$rtti.$Set("TMethodKinds",{comptype: $mod.$rtti["TMethodKind"]});
  this.TTypeMemberKind = {"0": "tmkUnknown", tmkUnknown: 0, "1": "tmkField", tmkField: 1, "2": "tmkMethod", tmkMethod: 2, "3": "tmkProperty", tmkProperty: 3};
  $mod.$rtti.$Enum("TTypeMemberKind",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TTypeMemberKind});
  $mod.$rtti.$Set("TTypeMemberKinds",{comptype: $mod.$rtti["TTypeMemberKind"]});
  $mod.$rtti.$DynArray("TTypeMemberDynArray",{eltype: $mod.$rtti["TTypeMember"]});
  $mod.$rtti.$DynArray("TTypeMemberMethodDynArray",{eltype: $mod.$rtti["TTypeMemberMethod"]});
  this.pfGetFunction = 1;
  this.pfSetProcedure = 2;
  this.pfStoredFalse = 4;
  this.pfStoredField = 8;
  this.pfStoredFunction = 12;
  this.pfHasIndex = 16;
  $mod.$rtti.$DynArray("TTypeMemberPropertyDynArray",{eltype: $mod.$rtti["TTypeMemberProperty"]});
  rtl.createClass($mod,"EPropertyError",pas.SysUtils.Exception,function () {
  });
  this.GetClassMembers = function (aTIClass) {
    var Result = [];
    var C = null;
    var i = 0;
    var PropName = "";
    var Names = null;
    Result = [];
    Names = new Object();
    C = aTIClass;
    while (C !== null) {
      for (var $l1 = 0, $end2 = rtl.length(C.names) - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        PropName = C.names[i];
        if (Names.hasOwnProperty(PropName)) continue;
        Result.push(C.members[PropName]);
        Names[PropName] = true;
      };
      C = C.ancestor;
    };
    return Result;
  };
  this.GetClassMember = function (aTIClass, aName) {
    var Result = null;
    var C = null;
    var i = 0;
    C = aTIClass;
    while (C !== null) {
      if (C.members.hasOwnProperty(aName)) return C.members[aName];
      C = C.ancestor;
    };
    C = aTIClass;
    while (C !== null) {
      for (var $l1 = 0, $end2 = rtl.length(C.names) - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        if (pas.SysUtils.CompareText(C.names[i],aName) === 0) return C.members[C.names[i]];
      };
      C = C.ancestor;
    };
    Result = null;
    return Result;
  };
  this.GetInstanceMethod = function (Instance, aName) {
    var Result = null;
    var TI = null;
    if (Instance === null) return null;
    TI = $mod.GetClassMember(Instance.$rtti,aName);
    if (!rtl.isExt(TI,rtl.tTypeMemberMethod)) return null;
    Result = rtl.createCallback(Instance,TI.name);
    return Result;
  };
  this.GetClassMethods = function (aTIClass) {
    var Result = [];
    var C = null;
    var i = 0;
    var Cnt = 0;
    var j = 0;
    Cnt = 0;
    C = aTIClass;
    while (C !== null) {
      Cnt += C.methods.length;
      C = C.ancestor;
    };
    Result = rtl.arraySetLength(Result,null,Cnt);
    C = aTIClass;
    i = 0;
    while (C !== null) {
      for (var $l1 = 0, $end2 = C.methods.length - 1; $l1 <= $end2; $l1++) {
        j = $l1;
        Result[i] = C.members[C.methods[j]];
        i += 1;
      };
      C = C.ancestor;
    };
    return Result;
  };
  this.GetInterfaceMembers = function (aTIInterface) {
    var Result = [];
    var Intf = null;
    var i = 0;
    var Cnt = 0;
    var j = 0;
    Cnt = 0;
    Intf = aTIInterface;
    while (Intf !== null) {
      Cnt += rtl.length(Intf.names);
      Intf = Intf.ancestor;
    };
    Result = rtl.arraySetLength(Result,null,Cnt);
    Intf = aTIInterface;
    i = 0;
    while (Intf !== null) {
      for (var $l1 = 0, $end2 = rtl.length(Intf.names) - 1; $l1 <= $end2; $l1++) {
        j = $l1;
        Result[i] = Intf.members[Intf.names[j]];
        i += 1;
      };
      Intf = Intf.ancestor;
    };
    return Result;
  };
  this.GetInterfaceMember = function (aTIInterface, aName) {
    var Result = null;
    var Intf = null;
    var i = 0;
    Intf = aTIInterface;
    while (Intf !== null) {
      if (Intf.members.hasOwnProperty(aName)) return Intf.members[aName];
      Intf = Intf.ancestor;
    };
    Intf = aTIInterface;
    while (Intf !== null) {
      for (var $l1 = 0, $end2 = rtl.length(Intf.names) - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        if (pas.SysUtils.CompareText(Intf.names[i],aName) === 0) return Intf.members[Intf.names[i]];
      };
      Intf = Intf.ancestor;
    };
    Result = null;
    return Result;
  };
  this.GetInterfaceMethods = function (aTIInterface) {
    var Result = [];
    var Intf = null;
    var i = 0;
    var Cnt = 0;
    var j = 0;
    Cnt = 0;
    Intf = aTIInterface;
    while (Intf !== null) {
      Cnt += Intf.methods.length;
      Intf = Intf.ancestor;
    };
    Result = rtl.arraySetLength(Result,null,Cnt);
    Intf = aTIInterface;
    i = 0;
    while (Intf !== null) {
      for (var $l1 = 0, $end2 = Intf.methods.length - 1; $l1 <= $end2; $l1++) {
        j = $l1;
        Result[i] = Intf.members[Intf.methods[j]];
        i += 1;
      };
      Intf = Intf.ancestor;
    };
    return Result;
  };
  this.GetPropInfos = function (aTIClass) {
    var Result = [];
    var C = null;
    var i = 0;
    var Names = null;
    var PropName = "";
    Result = [];
    C = aTIClass;
    Names = new Object();
    while (C !== null) {
      for (var $l1 = 0, $end2 = C.properties.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        PropName = C.properties[i];
        if (Names.hasOwnProperty(PropName)) continue;
        Result.push(C.members[PropName]);
        Names[PropName] = true;
      };
      C = C.ancestor;
    };
    return Result;
  };
  this.GetPropList = function (aTIClass, TypeKinds, Sorted) {
    var Result = [];
    function NameSort(a, b) {
      var Result = 0;
      if (rtl.getObject(a).name < rtl.getObject(b).name) {
        Result = -1}
       else if (rtl.getObject(a).name > rtl.getObject(b).name) {
        Result = 1}
       else Result = 0;
      return Result;
    };
    var C = null;
    var i = 0;
    var Names = null;
    var PropName = "";
    var Prop = null;
    Result = [];
    C = aTIClass;
    Names = new Object();
    while (C !== null) {
      for (var $l1 = 0, $end2 = C.properties.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        PropName = C.properties[i];
        if (Names.hasOwnProperty(PropName)) continue;
        Prop = C.members[PropName];
        if (!(Prop.typeinfo.kind in TypeKinds)) continue;
        Result.push(Prop);
        Names[PropName] = true;
      };
      C = C.ancestor;
    };
    if (Sorted) Result.sort(NameSort);
    return Result;
  };
  this.GetPropList$1 = function (aTIClass) {
    var Result = [];
    Result = $mod.GetPropInfos(aTIClass);
    return Result;
  };
  this.GetPropList$2 = function (AClass) {
    var Result = [];
    Result = $mod.GetPropInfos(AClass.$rtti);
    return Result;
  };
  this.GetPropList$3 = function (Instance) {
    var Result = [];
    Result = $mod.GetPropList$2(Instance.$class.ClassType());
    return Result;
  };
  this.GetPropInfo = function (TI, PropName) {
    var Result = null;
    var m = null;
    var i = 0;
    var C = null;
    C = TI;
    while (C !== null) {
      m = C.members[PropName];
      if (rtl.isExt(m,rtl.tTypeMemberProperty)) return m;
      C = C.ancestor;
    };
    Result = null;
    do {
      for (var $l1 = 0, $end2 = TI.properties.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        if (pas.SysUtils.CompareText(PropName,TI.properties[i]) === 0) {
          m = TI.members[TI.properties[i]];
          if (rtl.isExt(m,rtl.tTypeMemberProperty)) Result = m;
          return Result;
        };
      };
      TI = TI.ancestor;
    } while (!(TI === null));
    return Result;
  };
  this.GetPropInfo$1 = function (TI, PropName, Kinds) {
    var Result = null;
    Result = $mod.GetPropInfo(TI,PropName);
    if ((rtl.neSet(Kinds,{}) && (Result !== null)) && !(Result.typeinfo.kind in Kinds)) Result = null;
    return Result;
  };
  this.GetPropInfo$2 = function (Instance, PropName) {
    var Result = null;
    Result = $mod.GetPropInfo$1(Instance.$rtti,PropName,{});
    return Result;
  };
  this.GetPropInfo$3 = function (Instance, PropName, Kinds) {
    var Result = null;
    Result = $mod.GetPropInfo$1(Instance.$rtti,PropName,Kinds);
    return Result;
  };
  this.GetPropInfo$4 = function (aClass, PropName) {
    var Result = null;
    Result = $mod.GetPropInfo$1(aClass.$rtti,PropName,{});
    return Result;
  };
  this.GetPropInfo$5 = function (aClass, PropName, Kinds) {
    var Result = null;
    Result = $mod.GetPropInfo$1(aClass.$rtti,PropName,Kinds);
    return Result;
  };
  this.FindPropInfo = function (Instance, PropName) {
    var Result = null;
    Result = $mod.GetPropInfo(Instance.$rtti,PropName);
    if (Result === null) throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SErrPropertyNotFound,[PropName]]);
    return Result;
  };
  this.FindPropInfo$1 = function (Instance, PropName, Kinds) {
    var Result = null;
    Result = $mod.GetPropInfo$1(Instance.$rtti,PropName,Kinds);
    if (Result === null) throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SErrPropertyNotFound,[PropName]]);
    return Result;
  };
  this.FindPropInfo$2 = function (aClass, PropName) {
    var Result = null;
    Result = $mod.GetPropInfo(aClass.$rtti,PropName);
    if (Result === null) throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SErrPropertyNotFound,[PropName]]);
    return Result;
  };
  this.FindPropInfo$3 = function (aClass, PropName, Kinds) {
    var Result = null;
    Result = $mod.GetPropInfo$1(aClass.$rtti,PropName,Kinds);
    if (Result === null) throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SErrPropertyNotFound,[PropName]]);
    return Result;
  };
  this.IsStoredProp = function (Instance, PropInfo) {
    var Result = false;
    var $tmp1 = PropInfo.flags & 12;
    if ($tmp1 === 0) {
      Result = true}
     else if ($tmp1 === 4) {
      Result = false}
     else if ($tmp1 === 8) {
      Result = !(Instance[PropInfo.stored] == false)}
     else {
      Result = Instance[PropInfo.stored]();
    };
    return Result;
  };
  this.IsStoredProp$1 = function (Instance, PropName) {
    var Result = false;
    Result = $mod.IsStoredProp(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.IsPublishedProp = function (Instance, PropName) {
    var Result = false;
    Result = $mod.GetPropInfo$2(Instance,PropName) !== null;
    return Result;
  };
  this.IsPublishedProp$1 = function (aClass, PropName) {
    var Result = false;
    Result = $mod.GetPropInfo$4(aClass,PropName) !== null;
    return Result;
  };
  this.PropType = function (Instance, PropName) {
    var Result = 0;
    Result = $mod.FindPropInfo(Instance,PropName).typeinfo.kind;
    return Result;
  };
  this.PropType$1 = function (aClass, PropName) {
    var Result = 0;
    Result = $mod.FindPropInfo$2(aClass,PropName).typeinfo.kind;
    return Result;
  };
  this.PropIsType = function (Instance, PropName, TypeKind) {
    var Result = false;
    Result = $mod.PropType(Instance,PropName) === TypeKind;
    return Result;
  };
  this.PropIsType$1 = function (aClass, PropName, TypeKind) {
    var Result = false;
    Result = $mod.PropType$1(aClass,PropName) === TypeKind;
    return Result;
  };
  this.GetJSValueProp = function (Instance, PropName) {
    var Result = undefined;
    Result = $mod.GetJSValueProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetJSValueProp$1 = function (Instance, PropInfo) {
    var Result = undefined;
    var gk = 0;
    gk = $impl.GetPropGetterKind(PropInfo);
    var $tmp1 = gk;
    if ($tmp1 === $impl.TGetterKind.gkNone) {
      throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SCantReadPropertyS,[PropInfo.name]])}
     else if ($tmp1 === $impl.TGetterKind.gkField) {
      Result = Instance[PropInfo.getter]}
     else if ($tmp1 === $impl.TGetterKind.gkFunction) {
      if ((16 & PropInfo.flags) > 0) {
        Result = Instance[PropInfo.getter](PropInfo.index)}
       else Result = Instance[PropInfo.getter]()}
     else if ($tmp1 === $impl.TGetterKind.gkFunctionWithParams) throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SIndexedPropertyNeedsParams,[PropInfo.name]]);
    return Result;
  };
  this.SetJSValueProp = function (Instance, PropName, Value) {
    $mod.SetJSValueProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetJSValueProp$1 = function (Instance, PropInfo, Value) {
    var sk = 0;
    sk = $impl.GetPropSetterKind(PropInfo);
    var $tmp1 = sk;
    if ($tmp1 === $impl.TSetterKind.skNone) {
      throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SCantWritePropertyS,[PropInfo.name]])}
     else if ($tmp1 === $impl.TSetterKind.skField) {
      Instance[PropInfo.setter] = Value}
     else if ($tmp1 === $impl.TSetterKind.skProcedure) {
      if ((16 & PropInfo.flags) > 0) {
        Instance[PropInfo.setter](PropInfo.index,Value)}
       else Instance[PropInfo.setter](Value)}
     else if ($tmp1 === $impl.TSetterKind.skProcedureWithParams) throw $mod.EPropertyError.$create("CreateFmt",[pas.RTLConsts.SIndexedPropertyNeedsParams,[PropInfo.name]]);
  };
  this.GetNativeIntProp = function (Instance, PropName) {
    var Result = 0;
    Result = $mod.GetNativeIntProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetNativeIntProp$1 = function (Instance, PropInfo) {
    var Result = 0;
    Result = Math.floor($mod.GetJSValueProp$1(Instance,PropInfo));
    return Result;
  };
  this.SetNativeIntProp = function (Instance, PropName, Value) {
    $mod.SetJSValueProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetNativeIntProp$1 = function (Instance, PropInfo, Value) {
    $mod.SetJSValueProp$1(Instance,PropInfo,Value);
  };
  this.GetOrdProp = function (Instance, PropName) {
    var Result = 0;
    Result = $mod.GetOrdProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetOrdProp$1 = function (Instance, PropInfo) {
    var Result = 0;
    var o = null;
    var Key = "";
    var n = 0;
    if (PropInfo.typeinfo.kind === $mod.TTypeKind.tkSet) {
      o = rtl.getObject($mod.GetJSValueProp$1(Instance,PropInfo));
      Result = 0;
      for (Key in o) {
        n = parseInt(Key,10);
        if (n < 32) Result = Result + (1 << n);
      };
    } else Result = Math.floor($mod.GetJSValueProp$1(Instance,PropInfo));
    return Result;
  };
  this.SetOrdProp = function (Instance, PropName, Value) {
    $mod.SetOrdProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetOrdProp$1 = function (Instance, PropInfo, Value) {
    var o = null;
    var i = 0;
    if (PropInfo.typeinfo.kind === $mod.TTypeKind.tkSet) {
      o = new Object();
      for (i = 0; i <= 31; i++) if (((1 << i) & Value) > 0) o["" + i] = true;
      $mod.SetJSValueProp$1(Instance,PropInfo,o);
    } else $mod.SetJSValueProp$1(Instance,PropInfo,Value);
  };
  this.GetEnumProp = function (Instance, PropName) {
    var Result = "";
    Result = $mod.GetEnumProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetEnumProp$1 = function (Instance, PropInfo) {
    var Result = "";
    var n = 0;
    var TIEnum = null;
    TIEnum = rtl.asExt(PropInfo.typeinfo,rtl.tTypeInfoEnum);
    n = Math.floor($mod.GetJSValueProp$1(Instance,PropInfo));
    if ((n >= TIEnum.minvalue) && (n <= TIEnum.maxvalue)) {
      Result = TIEnum.enumtype[n]}
     else Result = "" + n;
    return Result;
  };
  this.SetEnumProp = function (Instance, PropName, Value) {
    $mod.SetEnumProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetEnumProp$1 = function (Instance, PropInfo, Value) {
    var TIEnum = null;
    var n = 0;
    TIEnum = rtl.asExt(PropInfo.typeinfo,rtl.tTypeInfoEnum);
    n = TIEnum.enumtype[Value];
    if (!pas.JS.isUndefined(n)) $mod.SetJSValueProp$1(Instance,PropInfo,n);
  };
  this.GetSetProp = function (Instance, PropName) {
    var Result = "";
    Result = $mod.GetSetProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetSetProp$1 = function (Instance, PropInfo) {
    var Result = "";
    var o = null;
    var key = "";
    var Value = "";
    var n = 0;
    var TIEnum = null;
    var TISet = null;
    Result = "";
    TISet = rtl.asExt(PropInfo.typeinfo,rtl.tTypeInfoSet);
    TIEnum = null;
    if (rtl.isExt(TISet.comptype,rtl.tTypeInfoEnum)) TIEnum = TISet.comptype;
    o = rtl.getObject($mod.GetJSValueProp$1(Instance,PropInfo));
    for (key in o) {
      n = parseInt(key,10);
      if (((TIEnum !== null) && (n >= TIEnum.minvalue)) && (n <= TIEnum.maxvalue)) {
        Value = TIEnum.enumtype[n]}
       else Value = "" + n;
      if (Result !== "") Result = Result + ",";
      Result = Result + Value;
    };
    Result = ("[" + Result) + "]";
    return Result;
  };
  this.GetSetPropArray = function (Instance, PropName) {
    var Result = [];
    Result = $mod.GetSetPropArray$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetSetPropArray$1 = function (Instance, PropInfo) {
    var Result = [];
    var o = null;
    var Key = "";
    Result = {};
    o = rtl.getObject($mod.GetJSValueProp$1(Instance,PropInfo));
    for (Key in o) Result.push(parseInt(Key,10));
    return Result;
  };
  this.SetSetPropArray = function (Instance, PropName, Arr) {
    $mod.SetSetPropArray$1(Instance,$mod.FindPropInfo(Instance,PropName),Arr);
  };
  this.SetSetPropArray$1 = function (Instance, PropInfo, Arr) {
    var o = null;
    var i = 0;
    o = new Object();
    for (var $in1 = Arr, $l2 = 0, $end3 = rtl.length($in1) - 1; $l2 <= $end3; $l2++) {
      i = $in1[$l2];
      o["" + i] = true;
    };
    $mod.SetJSValueProp$1(Instance,PropInfo,o);
  };
  this.GetStrProp = function (Instance, PropName) {
    var Result = "";
    Result = $mod.GetStrProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetStrProp$1 = function (Instance, PropInfo) {
    var Result = "";
    Result = "" + $mod.GetJSValueProp$1(Instance,PropInfo);
    return Result;
  };
  this.SetStrProp = function (Instance, PropName, Value) {
    $mod.SetStrProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetStrProp$1 = function (Instance, PropInfo, Value) {
    $mod.SetJSValueProp$1(Instance,PropInfo,Value);
  };
  this.GetStringProp = function (Instance, PropName) {
    var Result = "";
    Result = $mod.GetStrProp(Instance,PropName);
    return Result;
  };
  this.GetStringProp$1 = function (Instance, PropInfo) {
    var Result = "";
    Result = $mod.GetStrProp$1(Instance,PropInfo);
    return Result;
  };
  this.SetStringProp = function (Instance, PropName, Value) {
    $mod.SetStrProp(Instance,PropName,Value);
  };
  this.SetStringProp$1 = function (Instance, PropInfo, Value) {
    $mod.SetStrProp$1(Instance,PropInfo,Value);
  };
  this.GetBoolProp = function (Instance, PropName) {
    var Result = false;
    Result = $mod.GetBoolProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetBoolProp$1 = function (Instance, PropInfo) {
    var Result = false;
    Result = !($mod.GetJSValueProp$1(Instance,PropInfo) == false);
    return Result;
  };
  this.SetBoolProp = function (Instance, PropName, Value) {
    $mod.SetBoolProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetBoolProp$1 = function (Instance, PropInfo, Value) {
    $mod.SetJSValueProp$1(Instance,PropInfo,Value);
  };
  this.GetObjectProp = function (Instance, PropName) {
    var Result = null;
    Result = $mod.GetObjectProp$2(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetObjectProp$1 = function (Instance, PropName, MinClass) {
    var Result = null;
    Result = $mod.GetObjectProp$2(Instance,$mod.FindPropInfo(Instance,PropName));
    if ((MinClass !== null) && (Result !== null)) if (!Result.$class.InheritsFrom(MinClass)) Result = null;
    return Result;
  };
  this.GetObjectProp$2 = function (Instance, PropInfo) {
    var Result = null;
    Result = $mod.GetObjectProp$3(Instance,PropInfo,null);
    return Result;
  };
  this.GetObjectProp$3 = function (Instance, PropInfo, MinClass) {
    var Result = null;
    var O = null;
    O = rtl.getObject($mod.GetJSValueProp$1(Instance,PropInfo));
    if ((MinClass !== null) && !O.$class.InheritsFrom(MinClass)) {
      Result = null}
     else Result = O;
    return Result;
  };
  this.SetObjectProp = function (Instance, PropName, Value) {
    $mod.SetObjectProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetObjectProp$1 = function (Instance, PropInfo, Value) {
    $mod.SetJSValueProp$1(Instance,PropInfo,Value);
  };
  this.GetFloatProp = function (Instance, PropName) {
    var Result = 0.0;
    Result = $mod.GetFloatProp$1(Instance,$mod.FindPropInfo(Instance,PropName));
    return Result;
  };
  this.GetFloatProp$1 = function (Instance, PropInfo) {
    var Result = 0.0;
    Result = rtl.getNumber($mod.GetJSValueProp$1(Instance,PropInfo));
    return Result;
  };
  this.SetFloatProp = function (Instance, PropName, Value) {
    $mod.SetFloatProp$1(Instance,$mod.FindPropInfo(Instance,PropName),Value);
  };
  this.SetFloatProp$1 = function (Instance, PropInfo, Value) {
    $mod.SetJSValueProp$1(Instance,PropInfo,Value);
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.TGetterKind = {"0": "gkNone", gkNone: 0, "1": "gkField", gkField: 1, "2": "gkFunction", gkFunction: 2, "3": "gkFunctionWithParams", gkFunctionWithParams: 3};
  $mod.$rtti.$Enum("TGetterKind",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: $impl.TGetterKind});
  $impl.GetPropGetterKind = function (PropInfo) {
    var Result = 0;
    if (PropInfo.getter === "") {
      Result = $impl.TGetterKind.gkNone}
     else if ((1 & PropInfo.flags) > 0) {
      if (rtl.length(PropInfo.params) > 0) {
        Result = $impl.TGetterKind.gkFunctionWithParams}
       else Result = $impl.TGetterKind.gkFunction;
    } else Result = $impl.TGetterKind.gkField;
    return Result;
  };
  $impl.TSetterKind = {"0": "skNone", skNone: 0, "1": "skField", skField: 1, "2": "skProcedure", skProcedure: 2, "3": "skProcedureWithParams", skProcedureWithParams: 3};
  $mod.$rtti.$Enum("TSetterKind",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: $impl.TSetterKind});
  $impl.GetPropSetterKind = function (PropInfo) {
    var Result = 0;
    if (PropInfo.setter === "") {
      Result = $impl.TSetterKind.skNone}
     else if ((2 & PropInfo.flags) > 0) {
      if (rtl.length(PropInfo.params) > 0) {
        Result = $impl.TSetterKind.skProcedureWithParams}
       else Result = $impl.TSetterKind.skProcedure;
    } else Result = $impl.TSetterKind.skField;
    return Result;
  };
});
rtl.module("DB",["System","Classes","SysUtils","JS","Types","DateUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.dsMaxBufferCount = Math.floor(2147483647 / 8);
  this.dsMaxStringSize = 8192;
  this.YesNoChars = ["N","Y"];
  this.SQLDelimiterCharacters = rtl.createSet(59,44,32,40,41,13,10,9);
  this.TDataSetState = {"0": "dsInactive", dsInactive: 0, "1": "dsBrowse", dsBrowse: 1, "2": "dsEdit", dsEdit: 2, "3": "dsInsert", dsInsert: 3, "4": "dsSetKey", dsSetKey: 4, "5": "dsCalcFields", dsCalcFields: 5, "6": "dsFilter", dsFilter: 6, "7": "dsNewValue", dsNewValue: 7, "8": "dsOldValue", dsOldValue: 8, "9": "dsCurValue", dsCurValue: 9, "10": "dsBlockRead", dsBlockRead: 10, "11": "dsInternalCalc", dsInternalCalc: 11, "12": "dsOpening", dsOpening: 12, "13": "dsRefreshFields", dsRefreshFields: 13};
  $mod.$rtti.$Enum("TDataSetState",{minvalue: 0, maxvalue: 13, ordtype: 1, enumtype: this.TDataSetState});
  this.TDataEvent = {"0": "deFieldChange", deFieldChange: 0, "1": "deRecordChange", deRecordChange: 1, "2": "deDataSetChange", deDataSetChange: 2, "3": "deDataSetScroll", deDataSetScroll: 3, "4": "deLayoutChange", deLayoutChange: 4, "5": "deUpdateRecord", deUpdateRecord: 5, "6": "deUpdateState", deUpdateState: 6, "7": "deCheckBrowseMode", deCheckBrowseMode: 7, "8": "dePropertyChange", dePropertyChange: 8, "9": "deFieldListChange", deFieldListChange: 9, "10": "deFocusControl", deFocusControl: 10, "11": "deParentScroll", deParentScroll: 11, "12": "deConnectChange", deConnectChange: 12, "13": "deReconcileError", deReconcileError: 13, "14": "deDisabledStateChange", deDisabledStateChange: 14};
  $mod.$rtti.$Enum("TDataEvent",{minvalue: 0, maxvalue: 14, ordtype: 1, enumtype: this.TDataEvent});
  this.TUpdateStatus = {"0": "usUnmodified", usUnmodified: 0, "1": "usModified", usModified: 1, "2": "usInserted", usInserted: 2, "3": "usDeleted", usDeleted: 3, "4": "usResolved", usResolved: 4, "5": "usResolveFailed", usResolveFailed: 5};
  $mod.$rtti.$Enum("TUpdateStatus",{minvalue: 0, maxvalue: 5, ordtype: 1, enumtype: this.TUpdateStatus});
  $mod.$rtti.$Set("TUpdateStatusSet",{comptype: $mod.$rtti["TUpdateStatus"]});
  this.TUpdateMode = {"0": "upWhereAll", upWhereAll: 0, "1": "upWhereChanged", upWhereChanged: 1, "2": "upWhereKeyOnly", upWhereKeyOnly: 2};
  $mod.$rtti.$Enum("TUpdateMode",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TUpdateMode});
  this.TResolverResponse = {"0": "rrSkip", rrSkip: 0, "1": "rrAbort", rrAbort: 1, "2": "rrMerge", rrMerge: 2, "3": "rrApply", rrApply: 3, "4": "rrIgnore", rrIgnore: 4};
  $mod.$rtti.$Enum("TResolverResponse",{minvalue: 0, maxvalue: 4, ordtype: 1, enumtype: this.TResolverResponse});
  this.TProviderFlag = {"0": "pfInUpdate", pfInUpdate: 0, "1": "pfInWhere", pfInWhere: 1, "2": "pfInKey", pfInKey: 2, "3": "pfHidden", pfHidden: 3, "4": "pfRefreshOnInsert", pfRefreshOnInsert: 4, "5": "pfRefreshOnUpdate", pfRefreshOnUpdate: 5};
  $mod.$rtti.$Enum("TProviderFlag",{minvalue: 0, maxvalue: 5, ordtype: 1, enumtype: this.TProviderFlag});
  $mod.$rtti.$Set("TProviderFlags",{comptype: $mod.$rtti["TProviderFlag"]});
  $mod.$rtti.$Class("TFieldDef");
  $mod.$rtti.$Class("TFieldDefs");
  $mod.$rtti.$Class("TField");
  $mod.$rtti.$Class("TFields");
  $mod.$rtti.$Class("TDataSet");
  $mod.$rtti.$Class("TDataSource");
  $mod.$rtti.$Class("TDataLink");
  $mod.$rtti.$Class("TDataProxy");
  $mod.$rtti.$Class("TDataRequest");
  $mod.$rtti.$Class("TRecordUpdateDescriptor");
  $mod.$rtti.$Class("TRecordUpdateDescriptorList");
  $mod.$rtti.$Class("TRecordUpdateBatch");
  rtl.createClass($mod,"EDatabaseError",pas.SysUtils.Exception,function () {
  });
  rtl.createClass($mod,"EUpdateError",$mod.EDatabaseError,function () {
    this.$init = function () {
      $mod.EDatabaseError.$init.call(this);
      this.FContext = "";
      this.FErrorCode = 0;
      this.FOriginalException = null;
      this.FPreviousError = 0;
    };
    this.$final = function () {
      this.FOriginalException = undefined;
      $mod.EDatabaseError.$final.call(this);
    };
    this.Create$2 = function (NativeError, Context, ErrCode, PrevError, E) {
      pas.SysUtils.Exception.CreateFmt.call(this,NativeError,[Context]);
      this.FContext = Context;
      this.FErrorCode = ErrCode;
      this.FPreviousError = PrevError;
      this.FOriginalException = E;
    };
    this.Destroy = function () {
      rtl.free(this,"FOriginalException");
      pas.System.TObject.Destroy.apply(this,arguments);
    };
  });
  $mod.$rtti.$ClassRef("TFieldClass",{instancetype: $mod.$rtti["TField"]});
  this.TFieldType = {"0": "ftUnknown", ftUnknown: 0, "1": "ftString", ftString: 1, "2": "ftInteger", ftInteger: 2, "3": "ftLargeInt", ftLargeInt: 3, "4": "ftBoolean", ftBoolean: 4, "5": "ftFloat", ftFloat: 5, "6": "ftDate", ftDate: 6, "7": "ftTime", ftTime: 7, "8": "ftDateTime", ftDateTime: 8, "9": "ftAutoInc", ftAutoInc: 9, "10": "ftBlob", ftBlob: 10, "11": "ftMemo", ftMemo: 11, "12": "ftFixedChar", ftFixedChar: 12, "13": "ftVariant", ftVariant: 13, "14": "ftDataset", ftDataset: 14};
  $mod.$rtti.$Enum("TFieldType",{minvalue: 0, maxvalue: 14, ordtype: 1, enumtype: this.TFieldType});
  this.TFieldAttribute = {"0": "faHiddenCol", faHiddenCol: 0, "1": "faReadonly", faReadonly: 1, "2": "faRequired", faRequired: 2, "3": "faLink", faLink: 3, "4": "faUnNamed", faUnNamed: 4, "5": "faFixed", faFixed: 5};
  $mod.$rtti.$Enum("TFieldAttribute",{minvalue: 0, maxvalue: 5, ordtype: 1, enumtype: this.TFieldAttribute});
  $mod.$rtti.$Set("TFieldAttributes",{comptype: $mod.$rtti["TFieldAttribute"]});
  rtl.createClass($mod,"TNamedItem",pas.Classes.TCollectionItem,function () {
    this.$init = function () {
      pas.Classes.TCollectionItem.$init.call(this);
      this.FName = "";
    };
    this.GetDisplayName = function () {
      var Result = "";
      Result = this.FName;
      return Result;
    };
    this.SetDisplayName = function (Value) {
      var TmpInd = 0;
      if (this.FName === Value) return;
      if ((Value !== "") && $mod.TFieldDefs.isPrototypeOf(this.FCollection)) {
        TmpInd = this.FCollection.IndexOf(Value);
        if ((TmpInd >= 0) && (TmpInd !== this.GetIndex())) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SDuplicateName"),[Value,this.FCollection.$classname]);
      };
      this.FName = Value;
      pas.Classes.TCollectionItem.SetDisplayName.call(this,Value);
    };
    var $r = this.$rtti;
    $r.addProperty("Name",2,rtl.string,"FName","SetDisplayName");
  });
  rtl.createClass($mod,"TDefCollection",pas.Classes.TOwnedCollection,function () {
    this.$init = function () {
      pas.Classes.TOwnedCollection.$init.call(this);
      this.FDataset = null;
      this.FUpdated = false;
    };
    this.$final = function () {
      this.FDataset = undefined;
      pas.Classes.TOwnedCollection.$final.call(this);
    };
    this.SetItemName = function (Item) {
      var N = null;
      var TN = "";
      N = rtl.as(Item,$mod.TNamedItem);
      if (N.FName === "") {
        TN = pas.System.Copy(this.$classname,2,5) + pas.SysUtils.IntToStr(N.FID + 1);
        if (this.FDataset != null) TN = this.FDataset.FName + TN;
        N.SetDisplayName(TN);
      } else pas.Classes.TCollection.SetItemName.call(this,Item);
    };
    this.create$3 = function (ADataset, AOwner, AClass) {
      pas.Classes.TOwnedCollection.Create$2.call(this,AOwner,AClass);
      this.FDataset = ADataset;
    };
    this.Find = function (AName) {
      var Result = null;
      var i = 0;
      Result = null;
      for (var $l1 = 0, $end2 = this.GetCount() - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        if (pas.SysUtils.AnsiSameText(this.GetItem(i).FName,AName)) {
          Result = this.GetItem(i);
          break;
        };
      };
      return Result;
    };
    this.GetItemNames = function (List) {
      var i = 0;
      for (var $l1 = 0, $end2 = this.GetCount() - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        List.Add(this.GetItem(i).FName);
      };
    };
    this.IndexOf = function (AName) {
      var Result = 0;
      var i = 0;
      Result = -1;
      for (var $l1 = 0, $end2 = this.GetCount() - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        if (pas.SysUtils.AnsiSameText(this.GetItem(i).FName,AName)) {
          Result = i;
          break;
        };
      };
      return Result;
    };
  });
  rtl.createClass($mod,"TFieldDef",$mod.TNamedItem,function () {
    this.$init = function () {
      $mod.TNamedItem.$init.call(this);
      this.FAttributes = {};
      this.FDataType = 0;
      this.FFieldNo = 0;
      this.FInternalCalcField = false;
      this.FPrecision = 0;
      this.FRequired = false;
      this.FSize = 0;
    };
    this.$final = function () {
      this.FAttributes = undefined;
      $mod.TNamedItem.$final.call(this);
    };
    this.GetFieldClass = function () {
      var Result = null;
      if (((this.FCollection != null) && $mod.TFieldDefs.isPrototypeOf(this.FCollection)) && (this.FCollection.FDataset != null)) {
        Result = this.FCollection.FDataset.GetFieldClass(this.FDataType)}
       else Result = null;
      return Result;
    };
    this.SetAttributes = function (AValue) {
      this.FAttributes = rtl.refSet(AValue);
      this.Changed(false);
    };
    this.SetDataType = function (AValue) {
      this.FDataType = AValue;
      this.Changed(false);
    };
    this.SetPrecision = function (AValue) {
      this.FPrecision = AValue;
      this.Changed(false);
    };
    this.SetSize = function (AValue) {
      this.FSize = AValue;
      this.Changed(false);
    };
    this.SetRequired = function (AValue) {
      this.FRequired = AValue;
      this.Changed(false);
    };
    this.Create$1 = function (ACollection) {
      pas.Classes.TCollectionItem.Create$1.call(this,ACollection);
      this.FFieldNo = this.GetIndex() + 1;
    };
    this.Create$3 = function (AOwner, AName, ADataType, ASize, ARequired, AFieldNo) {
      pas.Classes.TCollectionItem.Create$1.call(this,AOwner);
      this.SetDisplayName(AName);
      this.FDataType = ADataType;
      this.FSize = ASize;
      this.FRequired = ARequired;
      this.FPrecision = -1;
      this.FFieldNo = AFieldNo;
    };
    this.Destroy = function () {
      pas.Classes.TCollectionItem.Destroy.call(this);
    };
    this.Assign = function (Source) {
      var fd = null;
      fd = null;
      if ($mod.TFieldDef.isPrototypeOf(Source)) fd = rtl.as(Source,$mod.TFieldDef);
      if (fd != null) {
        this.FCollection.BeginUpdate();
        try {
          this.SetDisplayName(fd.FName);
          this.SetDataType(fd.FDataType);
          this.SetSize(fd.FSize);
          this.SetPrecision(fd.FPrecision);
          this.FRequired = fd.FRequired;
        } finally {
          this.FCollection.EndUpdate();
        };
      } else pas.Classes.TPersistent.Assign.call(this,Source);
    };
    this.CreateField = function (AOwner) {
      var Result = null;
      var TheField = null;
      TheField = this.GetFieldClass();
      if (TheField === null) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SUnknownFieldType"),[this.FName]);
      Result = TheField.$create("Create$1",[AOwner]);
      try {
        Result.FFieldDef = this;
        Result.SetSize(this.FSize);
        Result.FRequired = this.FRequired;
        Result.FFieldName = this.FName;
        Result.FDisplayLabel = this.GetDisplayName();
        Result.FFieldNo = this.FFieldNo;
        Result.SetFieldType(this.FDataType);
        Result.FReadOnly = $mod.TFieldAttribute.faReadonly in this.FAttributes;
        Result.SetDataset(this.FCollection.FDataset);
        if ($mod.TFloatField.isPrototypeOf(Result)) Result.SetPrecision(this.FPrecision);
      } catch ($e) {
        Result = rtl.freeLoc(Result);
        throw $e;
      };
      return Result;
    };
    var $r = this.$rtti;
    $r.addProperty("Attributes",2,$mod.$rtti["TFieldAttributes"],"FAttributes","SetAttributes",{Default: {}});
    $r.addProperty("DataType",2,$mod.$rtti["TFieldType"],"FDataType","SetDataType");
    $r.addProperty("Precision",2,rtl.longint,"FPrecision","SetPrecision",{Default: 0});
    $r.addProperty("Size",2,rtl.longint,"FSize","SetSize",{Default: 0});
  });
  $mod.$rtti.$ClassRef("TFieldDefClass",{instancetype: $mod.$rtti["TFieldDef"]});
  rtl.createClass($mod,"TFieldDefs",$mod.TDefCollection,function () {
    this.$init = function () {
      $mod.TDefCollection.$init.call(this);
      this.FHiddenFields = false;
    };
    this.GetItem$1 = function (Index) {
      var Result = null;
      Result = this.GetItem(Index);
      return Result;
    };
    this.SetItem$1 = function (Index, AValue) {
      this.SetItem(Index,AValue);
    };
    this.FieldDefClass = function () {
      var Result = null;
      Result = $mod.TFieldDef;
      return Result;
    };
    this.Create$4 = function (ADataSet) {
      $mod.TDefCollection.create$3.call(this,ADataSet,this.Owner(),this.$class.FieldDefClass());
    };
    this.Add$1 = function (AName, ADataType, ASize, APrecision, ARequired, AReadOnly, AFieldNo) {
      var Result = null;
      Result = this.$class.FieldDefClass().$create("Create$3",[this,this.MakeNameUnique(AName),ADataType,ASize,ARequired,AFieldNo]);
      if (AReadOnly) Result.SetAttributes(rtl.unionSet(Result.FAttributes,rtl.createSet($mod.TFieldAttribute.faReadonly)));
      return Result;
    };
    this.Add$2 = function (AName, ADataType, ASize, ARequired, AFieldNo) {
      var Result = null;
      Result = this.$class.FieldDefClass().$create("Create$3",[this,AName,ADataType,ASize,ARequired,AFieldNo]);
      return Result;
    };
    this.Add$3 = function (AName, ADataType, ASize, ARequired) {
      if (AName.length === 0) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SNeedFieldName"),this.FDataset);
      this.BeginUpdate();
      try {
        this.Add$2(AName,ADataType,ASize,ARequired,this.GetCount() + 1);
      } finally {
        this.EndUpdate();
      };
    };
    this.Add$4 = function (AName, ADataType, ASize) {
      this.Add$3(AName,ADataType,ASize,false);
    };
    this.Add$5 = function (AName, ADataType) {
      this.Add$3(AName,ADataType,0,false);
    };
    this.AddFieldDef = function () {
      var Result = null;
      Result = this.$class.FieldDefClass().$create("Create$3",[this,"",$mod.TFieldType.ftUnknown,0,false,this.GetCount() + 1]);
      return Result;
    };
    this.Assign$2 = function (FieldDefs) {
      var I = 0;
      this.Clear();
      for (var $l1 = 0, $end2 = FieldDefs.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        var $with3 = FieldDefs.GetItem$1(I);
        this.Add$3($with3.FName,$with3.FDataType,$with3.FSize,$with3.FRequired);
      };
    };
    this.Find$1 = function (AName) {
      var Result = null;
      Result = rtl.as($mod.TDefCollection.Find.call(this,AName),$mod.TFieldDef);
      if (Result === null) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SFieldNotFound"),[AName],this.FDataset);
      return Result;
    };
    this.Update$1 = function () {
      if (!this.FUpdated) {
        if (this.FDataset != null) this.FDataset.InitFieldDefs();
        this.FUpdated = true;
      };
    };
    this.MakeNameUnique = function (AName) {
      var Result = "";
      var DblFieldCount = 0;
      DblFieldCount = 0;
      Result = AName;
      while ($mod.TDefCollection.Find.call(this,Result) != null) {
        DblFieldCount += 1;
        Result = (AName + "_") + pas.SysUtils.IntToStr(DblFieldCount);
      };
      return Result;
    };
  });
  $mod.$rtti.$ClassRef("TFieldDefsClass",{instancetype: $mod.$rtti["TFieldDefs"]});
  this.TFieldKind = {"0": "fkData", fkData: 0, "1": "fkCalculated", fkCalculated: 1, "2": "fkLookup", fkLookup: 2, "3": "fkInternalCalc", fkInternalCalc: 3};
  $mod.$rtti.$Enum("TFieldKind",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TFieldKind});
  $mod.$rtti.$Set("TFieldKinds",{comptype: $mod.$rtti["TFieldKind"]});
  $mod.$rtti.$MethodVar("TFieldNotifyEvent",{procsig: rtl.newTIProcSig([["Sender",$mod.$rtti["TField"]]]), methodkind: 0});
  $mod.$rtti.$MethodVar("TFieldGetTextEvent",{procsig: rtl.newTIProcSig([["Sender",$mod.$rtti["TField"]],["aText",rtl.string,1],["DisplayText",rtl.boolean]]), methodkind: 0});
  $mod.$rtti.$MethodVar("TFieldSetTextEvent",{procsig: rtl.newTIProcSig([["Sender",$mod.$rtti["TField"]],["aText",rtl.string,2]]), methodkind: 0});
  $mod.$rtti.$DynArray("TFieldChars",{eltype: rtl.char});
  rtl.createClass($mod,"TLookupList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function () {
      this.FList = pas.Classes.TFPList.$create("Create");
    };
    this.Destroy = function () {
      this.Clear();
      this.FList.$destroy("Destroy");
      pas.System.TObject.Destroy.call(this);
    };
    this.Add = function (AKey, AValue) {
      var LookupRec = null;
      LookupRec = pas.JS.New(["Key",AKey,"Value",AValue]);
      this.FList.Add(LookupRec);
    };
    this.Clear = function () {
      this.FList.Clear();
    };
    this.FirstKeyByValue = function (AValue) {
      var Result = undefined;
      var i = 0;
      for (var $l1 = 0, $end2 = this.FList.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        var $with3 = rtl.getObject(this.FList.Get(i));
        if ($with3["Value"] == AValue) {
          Result = $with3["Key"];
          return Result;
        };
      };
      Result = null;
      return Result;
    };
    this.ValueOfKey = function (AKey) {
      var Self = this;
      var Result = undefined;
      function VarArraySameValues(VarArray1, VarArray2) {
        var Result = false;
        var i = 0;
        Result = true;
        if (rtl.length(VarArray1) !== rtl.length(VarArray2)) return Result;
        for (var $l1 = 0, $end2 = rtl.length(VarArray1); $l1 <= $end2; $l1++) {
          i = $l1;
          if (VarArray1[i] != VarArray2[i]) {
            Result = false;
            return Result;
          };
        };
        return Result;
      };
      var I = 0;
      Result = null;
      if (pas.JS.isNull(AKey)) return Result;
      I = Self.FList.FCount - 1;
      if (rtl.isArray(AKey)) {
        while ((I >= 0) && !VarArraySameValues(rtl.getObject(Self.FList.Get(I))["Key"],AKey)) I -= 1}
       else while ((I >= 0) && (rtl.getObject(Self.FList.Get(I))["Key"] != AKey)) I -= 1;
      if (I >= 0) Result = rtl.getObject(Self.FList.Get(I))["Value"];
      return Result;
    };
    this.ValuesToStrings = function (AStrings) {
      var i = 0;
      var p = null;
      AStrings.Clear();
      for (var $l1 = 0, $end2 = this.FList.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        p = rtl.getObject(this.FList.Get(i));
        AStrings.AddObject("" + p["Value"],p);
      };
    };
  });
  rtl.createClass($mod,"TField",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.FAlignment = 0;
      this.FAttributeSet = "";
      this.FCalculated = false;
      this.FConstraintErrorMessage = "";
      this.FCustomConstraint = "";
      this.FDataSet = null;
      this.FDataType = 0;
      this.FDefaultExpression = "";
      this.FDisplayLabel = "";
      this.FDisplayWidth = 0;
      this.FFieldDef = null;
      this.FFieldKind = 0;
      this.FFieldName = "";
      this.FFieldNo = 0;
      this.FFields = null;
      this.FHasConstraints = false;
      this.FImportedConstraint = "";
      this.FIsIndexField = false;
      this.FKeyFields = "";
      this.FLookupCache = false;
      this.FLookupDataSet = null;
      this.FLookupKeyfields = "";
      this.FLookupresultField = "";
      this.FLookupList = null;
      this.FOffset = 0;
      this.FOnChange = null;
      this.FOnGetText = null;
      this.FOnSetText = null;
      this.FOnValidate = null;
      this.FOrigin = "";
      this.FReadOnly = false;
      this.FRequired = false;
      this.FSize = 0;
      this.FValidChars = [];
      this.FValueBuffer = undefined;
      this.FValidating = false;
      this.FVisible = false;
      this.FProviderFlags = {};
    };
    this.$final = function () {
      this.FDataSet = undefined;
      this.FFieldDef = undefined;
      this.FFields = undefined;
      this.FLookupDataSet = undefined;
      this.FLookupList = undefined;
      this.FOnChange = undefined;
      this.FOnGetText = undefined;
      this.FOnSetText = undefined;
      this.FOnValidate = undefined;
      this.FValidChars = undefined;
      this.FProviderFlags = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.GetIndex = function () {
      var Result = 0;
      if (this.FDataSet != null) {
        Result = this.FDataSet.FFieldList.IndexOf(this)}
       else Result = -1;
      return Result;
    };
    this.GetLookup = function () {
      var Result = false;
      Result = this.FFieldKind === $mod.TFieldKind.fkLookup;
      return Result;
    };
    this.SetAlignment = function (AValue) {
      if (this.FAlignment !== AValue) {
        this.FAlignment = AValue;
        this.PropertyChanged(false);
      };
    };
    this.SetIndex = function (AValue) {
      if (this.FFields !== null) this.FFields.SetFieldIndex(this,AValue);
    };
    this.GetDisplayText = function () {
      var Result = "";
      Result = rtl.strSetLength(Result,0);
      if (this.FOnGetText != null) {
        this.FOnGetText(this,{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},true)}
       else this.GetText({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},true);
      return Result;
    };
    this.GetEditText = function () {
      var Result = "";
      Result = rtl.strSetLength(Result,0);
      if (this.FOnGetText != null) {
        this.FOnGetText(this,{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},false)}
       else this.GetText({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},false);
      return Result;
    };
    this.SetEditText = function (AValue) {
      if (this.FOnSetText != null) {
        this.FOnSetText(this,AValue)}
       else this.SetText(AValue);
    };
    this.SetDisplayLabel = function (AValue) {
      if (this.FDisplayLabel !== AValue) {
        this.FDisplayLabel = AValue;
        this.PropertyChanged(true);
      };
    };
    this.SetDisplayWidth = function (AValue) {
      if (this.FDisplayWidth !== AValue) {
        this.FDisplayWidth = AValue;
        this.PropertyChanged(true);
      };
    };
    this.GetDisplayWidth = function () {
      var Result = 0;
      if (this.FDisplayWidth === 0) {
        Result = this.GetDefaultWidth()}
       else Result = this.FDisplayWidth;
      return Result;
    };
    var ValueToLookupMap = [$mod.TFieldKind.fkData,$mod.TFieldKind.fkLookup];
    this.SetLookup = function (AValue) {
      this.FFieldKind = ValueToLookupMap[+AValue];
    };
    this.SetReadOnly = function (AValue) {
      if (this.FReadOnly !== AValue) {
        this.FReadOnly = AValue;
        this.PropertyChanged(true);
      };
    };
    this.SetVisible = function (AValue) {
      if (this.FVisible !== AValue) {
        this.FVisible = AValue;
        this.PropertyChanged(true);
      };
    };
    this.IsDisplayLabelStored = function () {
      var Result = false;
      Result = this.GetDisplayName() !== this.FFieldName;
      return Result;
    };
    this.IsDisplayWidthStored = function () {
      var Result = false;
      Result = this.FDisplayWidth !== 0;
      return Result;
    };
    this.GetLookupList = function () {
      var Result = null;
      if (!(this.FLookupList != null)) this.FLookupList = $mod.TLookupList.$create("Create$1");
      Result = this.FLookupList;
      return Result;
    };
    this.CalcLookupValue = function () {
    };
    this.RaiseAccessError = function (TypeName) {
      var E = null;
      E = this.AccessError(TypeName);
      throw E;
    };
    this.AccessError = function (TypeName) {
      var Result = null;
      Result = $mod.EDatabaseError.$create("CreateFmt",[rtl.getResStr(pas.DBConst,"SInvalidTypeConversion"),[TypeName,this.FFieldName]]);
      return Result;
    };
    this.CheckInactive = function () {
      if (this.FDataSet != null) this.FDataSet.CheckInactive();
    };
    this.CheckTypeSize = function (AValue) {
      if ((AValue !== 0) && !this.IsBlob()) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SInvalidFieldSize"),[AValue]);
    };
    this.Change = function () {
      if (this.FOnChange != null) this.FOnChange(this);
    };
    this.Bind = function (Binding) {
      if (Binding && (this.FFieldKind === $mod.TFieldKind.fkLookup)) {
        if ((((this.FLookupDataSet === null) || (this.FLookupKeyfields === "")) || (this.FLookupresultField === "")) || (this.FKeyFields === "")) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SLookupInfoError"),[this.GetDisplayName()]);
        this.FFields.CheckFieldNames(this.FKeyFields);
        this.FLookupDataSet.Open();
        this.FLookupDataSet.FFieldList.CheckFieldNames(this.FLookupKeyfields);
        this.FLookupDataSet.FieldByName(this.FLookupresultField);
        if (this.FLookupCache) this.RefreshLookupList();
      };
    };
    this.DataChanged = function () {
      this.FDataSet.DataEvent($mod.TDataEvent.deFieldChange,this);
    };
    this.GetAsBoolean = function () {
      var Result = false;
      this.RaiseAccessError($impl.SBoolean);
      Result = false;
      return Result;
    };
    this.GetAsBytes = function () {
      var Result = [];
      this.RaiseAccessError($impl.SBytes);
      Result = [];
      return Result;
    };
    this.GetAsLargeInt = function () {
      var Result = 0;
      this.RaiseAccessError($impl.SLargeInt);
      Result = 0;
      return Result;
    };
    this.GetAsDateTime = function () {
      var Result = 0.0;
      this.RaiseAccessError($impl.SDateTime);
      Result = 0.0;
      return Result;
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      this.RaiseAccessError($impl.SDateTime);
      Result = 0.0;
      return Result;
    };
    this.GetAsLongint = function () {
      var Result = 0;
      Result = this.GetAsInteger();
      return Result;
    };
    this.GetAsInteger = function () {
      var Result = 0;
      this.RaiseAccessError($impl.SInteger);
      Result = 0;
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      Result = this.GetData();
      return Result;
    };
    this.GetOldValue = function () {
      var Result = undefined;
      var SaveState = 0;
      SaveState = this.FDataSet.FState;
      try {
        this.FDataSet.SetTempState($mod.TDataSetState.dsOldValue);
        Result = this.GetAsJSValue();
      } finally {
        this.FDataSet.RestoreState(SaveState);
      };
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      Result = this.GetClassDesc();
      return Result;
    };
    this.GetCanModify = function () {
      var Result = false;
      Result = !this.FReadOnly;
      if (Result) {
        Result = this.FFieldKind in rtl.createSet($mod.TFieldKind.fkData,$mod.TFieldKind.fkInternalCalc);
        if (Result) {
          Result = (this.FDataSet != null) && this.FDataSet.GetActive();
          if (Result) Result = this.FDataSet.GetCanModify();
        };
      };
      return Result;
    };
    this.GetClassDesc = function () {
      var Result = "";
      var ClassN = "";
      ClassN = pas.System.Copy(this.$classname,2,pas.System.Pos("Field",this.$classname) - 2);
      if (this.GetIsNull()) {
        Result = ("(" + pas.SysUtils.LowerCase(ClassN)) + ")"}
       else Result = ("(" + pas.SysUtils.UpperCase(ClassN)) + ")";
      return Result;
    };
    this.GetDataSize = function () {
      var Result = 0;
      Result = 0;
      return Result;
    };
    this.GetDefaultWidth = function () {
      var Result = 0;
      Result = 10;
      return Result;
    };
    this.GetDisplayName = function () {
      var Result = "";
      if (this.FDisplayLabel !== "") {
        Result = this.FDisplayLabel}
       else Result = this.FFieldName;
      return Result;
    };
    this.GetCurValue = function () {
      var Result = undefined;
      var SaveState = 0;
      SaveState = this.FDataSet.FState;
      try {
        this.FDataSet.SetTempState($mod.TDataSetState.dsCurValue);
        Result = this.GetAsJSValue();
      } finally {
        this.FDataSet.RestoreState(SaveState);
      };
      return Result;
    };
    this.GetNewValue = function () {
      var Result = undefined;
      var SaveState = 0;
      SaveState = this.FDataSet.FState;
      try {
        this.FDataSet.SetTempState($mod.TDataSetState.dsNewValue);
        Result = this.GetAsJSValue();
      } finally {
        this.FDataSet.RestoreState(SaveState);
      };
      return Result;
    };
    this.GetIsNull = function () {
      var Result = false;
      Result = pas.JS.isNull(this.GetData());
      return Result;
    };
    this.GetText = function (AText, ADisplayText) {
      AText.set(this.GetAsString());
    };
    this.Notification = function (AComponent, Operation) {
      pas.Classes.TComponent.Notification.call(this,AComponent,Operation);
      if ((Operation === pas.Classes.TOperation.opRemove) && (AComponent === this.FLookupDataSet)) this.FLookupDataSet = null;
    };
    this.PropertyChanged = function (LayoutAffected) {
      if ((this.FDataSet !== null) && this.FDataSet.GetActive()) if (LayoutAffected) {
        this.FDataSet.DataEvent($mod.TDataEvent.deLayoutChange,0)}
       else this.FDataSet.DataEvent($mod.TDataEvent.deDataSetChange,0);
    };
    this.SetAsBoolean = function (AValue) {
      this.RaiseAccessError($impl.SBoolean);
    };
    this.SetAsDateTime = function (AValue) {
      this.RaiseAccessError($impl.SDateTime);
    };
    this.SetAsFloat = function (AValue) {
      this.RaiseAccessError($impl.SFloat);
    };
    this.SetAsLongint = function (AValue) {
      this.SetAsInteger(AValue);
    };
    this.SetAsInteger = function (AValue) {
      this.RaiseAccessError($impl.SInteger);
    };
    this.SetAsLargeInt = function (AValue) {
      this.RaiseAccessError($impl.SLargeInt);
    };
    this.SetAsJSValue = function (AValue) {
      if (pas.JS.isNull(AValue)) {
        this.Clear()}
       else try {
        this.SetVarValue(AValue);
      } catch ($e) {
        if (pas.SysUtils.EVariantError.isPrototypeOf($e)) {
          $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SFieldValueError"),[this.GetDisplayName()])}
         else throw $e
      };
    };
    this.SetAsString = function (AValue) {
      this.RaiseAccessError($impl.SString);
    };
    this.SetDataset = function (AValue) {
      if (AValue === this.FDataSet) return;
      if (this.FDataSet != null) {
        this.FDataSet.CheckInactive();
        this.FDataSet.FFieldList.Remove(this);
      };
      if (AValue != null) {
        AValue.CheckInactive();
        AValue.FFieldList.Add(this);
      };
      this.FDataSet = AValue;
    };
    this.SetDataType = function (AValue) {
      this.FDataType = AValue;
    };
    this.SetNewValue = function (AValue) {
      var SaveState = 0;
      SaveState = this.FDataSet.FState;
      try {
        this.FDataSet.SetTempState($mod.TDataSetState.dsNewValue);
        this.SetAsJSValue(AValue);
      } finally {
        this.FDataSet.RestoreState(SaveState);
      };
    };
    this.SetSize = function (AValue) {
      this.CheckInactive();
      this.$class.CheckTypeSize(AValue);
      this.FSize = AValue;
    };
    this.SetParentComponent = function (Value) {
      if (!(pas.Classes.TComponentStateItem.csLoading in this.FComponentState)) this.SetDataset(rtl.as(Value,$mod.TDataSet));
    };
    this.SetText = function (AValue) {
      this.SetAsString(AValue);
    };
    this.SetVarValue = function (AValue) {
      this.RaiseAccessError($impl.SJSValue);
    };
    this.SetAsBytes = function (AValue) {
      this.RaiseAccessError($impl.SBytes);
    };
    this.Create$1 = function (AOwner) {
      pas.Classes.TComponent.Create$1.call(this,AOwner);
      this.FVisible = true;
      this.FValidChars = rtl.arraySetLength(this.FValidChars,"",255);
      this.FProviderFlags = rtl.createSet($mod.TProviderFlag.pfInUpdate,$mod.TProviderFlag.pfInWhere);
    };
    this.Destroy = function () {
      if (this.FDataSet != null) {
        this.FDataSet.SetActive(false);
        if (this.FFields != null) this.FFields.Remove(this);
      };
      rtl.free(this,"FLookupList");
      pas.Classes.TComponent.Destroy.call(this);
    };
    this.GetParentComponent = function () {
      var Result = null;
      Result = this.FDataSet;
      return Result;
    };
    this.HasParent = function () {
      var Result = false;
      Result = true;
      return Result;
    };
    this.Assign = function (Source) {
      if (Source === null) {
        this.Clear()}
       else if ($mod.TField.isPrototypeOf(Source)) {
        this.SetAsJSValue(Source.GetAsJSValue());
      } else pas.Classes.TPersistent.Assign.call(this,Source);
    };
    this.AssignValue = function (AValue) {
      var Self = this;
      function error() {
        $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SFieldValueError"),[Self.GetDisplayName()]);
      };
      var $tmp1 = pas.JS.GetValueType(AValue);
      if ($tmp1 === pas.JS.TJSValueType.jvtNull) {
        Self.Clear()}
       else if ($tmp1 === pas.JS.TJSValueType.jvtBoolean) {
        Self.SetAsBoolean(!(AValue == false))}
       else if ($tmp1 === pas.JS.TJSValueType.jvtInteger) {
        Self.SetAsLargeInt(Math.floor(AValue))}
       else if ($tmp1 === pas.JS.TJSValueType.jvtFloat) {
        Self.SetAsFloat(rtl.getNumber(AValue))}
       else if ($tmp1 === pas.JS.TJSValueType.jvtString) {
        Self.SetAsString("" + AValue)}
       else if ($tmp1 === pas.JS.TJSValueType.jvtArray) {
        Self.SetAsBytes(AValue)}
       else {
        error();
      };
    };
    this.Clear = function () {
      this.SetData(null);
    };
    this.FocusControl = function () {
      var Field1 = null;
      Field1 = this;
      this.FDataSet.DataEvent($mod.TDataEvent.deFocusControl,Field1);
    };
    this.GetData = function () {
      var Result = undefined;
      if (this.FDataSet === null) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SNoDataset"),[this.FFieldName]);
      if (this.FValidating) {
        Result = this.FValueBuffer}
       else Result = this.FDataSet.GetFieldData(this);
      return Result;
    };
    this.IsBlob = function () {
      var Result = false;
      Result = false;
      return Result;
    };
    this.IsValidChar = function (InputChar) {
      var Result = false;
      Result = pas.SysUtils.CharInSet(InputChar,this.FValidChars);
      return Result;
    };
    this.RefreshLookupList = function () {
      var tmpActive = false;
      if (((!(this.FLookupDataSet != null) || (this.FLookupKeyfields.length === 0)) || (this.FLookupresultField.length === 0)) || (this.FKeyFields.length === 0)) return;
      tmpActive = this.FLookupDataSet.GetActive();
      try {
        this.FLookupDataSet.SetActive(true);
        this.FFields.CheckFieldNames(this.FKeyFields);
        this.FLookupDataSet.FFieldList.CheckFieldNames(this.FLookupKeyfields);
        this.FLookupDataSet.FieldByName(this.FLookupresultField);
        this.GetLookupList().Clear();
        this.FLookupDataSet.DisableControls();
        try {
          this.FLookupDataSet.First();
          while (!this.FLookupDataSet.FEOF) {
            this.FLookupDataSet.Next();
          };
        } finally {
          this.FLookupDataSet.EnableControls();
        };
      } finally {
        this.FLookupDataSet.SetActive(tmpActive);
      };
    };
    this.SetData = function (Buffer) {
      if (!(this.FDataSet != null)) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SNoDataset"),[this.FFieldName]);
      this.FDataSet.SetFieldData(this,Buffer);
    };
    this.SetFieldType = function (AValue) {
    };
    this.Validate = function (Buffer) {
      if (this.FOnValidate != null) {
        this.FValueBuffer = Buffer;
        this.FValidating = true;
        try {
          this.FOnValidate(this);
        } finally {
          this.FValidating = false;
        };
      };
    };
    var $r = this.$rtti;
    $r.addProperty("Alignment",2,pas.Classes.$rtti["TAlignment"],"FAlignment","SetAlignment",{Default: pas.Classes.TAlignment.taLeftJustify});
    $r.addProperty("CustomConstraint",0,rtl.string,"FCustomConstraint","FCustomConstraint");
    $r.addProperty("ConstraintErrorMessage",0,rtl.string,"FConstraintErrorMessage","FConstraintErrorMessage");
    $r.addProperty("DefaultExpression",0,rtl.string,"FDefaultExpression","FDefaultExpression");
    $r.addProperty("DisplayLabel",15,rtl.string,"GetDisplayName","SetDisplayLabel",{stored: "IsDisplayLabelStored"});
    $r.addProperty("DisplayWidth",15,rtl.longint,"GetDisplayWidth","SetDisplayWidth",{stored: "IsDisplayWidthStored"});
    $r.addProperty("FieldKind",0,$mod.$rtti["TFieldKind"],"FFieldKind","FFieldKind");
    $r.addProperty("FieldName",0,rtl.string,"FFieldName","FFieldName");
    $r.addProperty("HasConstraints",0,rtl.boolean,"FHasConstraints","");
    $r.addProperty("Index",3,rtl.longint,"GetIndex","SetIndex");
    $r.addProperty("ImportedConstraint",0,rtl.string,"FImportedConstraint","FImportedConstraint");
    $r.addProperty("KeyFields",0,rtl.string,"FKeyFields","FKeyFields");
    $r.addProperty("LookupCache",0,rtl.boolean,"FLookupCache","FLookupCache");
    $r.addProperty("LookupDataSet",0,$mod.$rtti["TDataSet"],"FLookupDataSet","FLookupDataSet");
    $r.addProperty("LookupKeyFields",0,rtl.string,"FLookupKeyfields","FLookupKeyfields");
    $r.addProperty("LookupResultField",0,rtl.string,"FLookupresultField","FLookupresultField");
    $r.addProperty("Origin",0,rtl.string,"FOrigin","FOrigin");
    $r.addProperty("ProviderFlags",0,$mod.$rtti["TProviderFlags"],"FProviderFlags","FProviderFlags");
    $r.addProperty("ReadOnly",2,rtl.boolean,"FReadOnly","SetReadOnly");
    $r.addProperty("Required",0,rtl.boolean,"FRequired","FRequired");
    $r.addProperty("Visible",2,rtl.boolean,"FVisible","SetVisible",{Default: true});
    $r.addProperty("OnChange",0,$mod.$rtti["TFieldNotifyEvent"],"FOnChange","FOnChange");
    $r.addProperty("OnGetText",0,$mod.$rtti["TFieldGetTextEvent"],"FOnGetText","FOnGetText");
    $r.addProperty("OnSetText",0,$mod.$rtti["TFieldSetTextEvent"],"FOnSetText","FOnSetText");
    $r.addProperty("OnValidate",0,$mod.$rtti["TFieldNotifyEvent"],"FOnValidate","FOnValidate");
  });
  rtl.createClass($mod,"TStringField",$mod.TField,function () {
    this.$init = function () {
      $mod.TField.$init.call(this);
      this.FFixedChar = false;
      this.FTransliterate = false;
    };
    this.CheckTypeSize = function (AValue) {
      if (AValue < 0) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SInvalidFieldSize"),[AValue]);
    };
    this.GetAsBoolean = function () {
      var Result = false;
      var S = "";
      S = this.GetAsString();
      Result = (S.length > 0) && (pas.System.upcase(S.charAt(0)).charCodeAt() in rtl.createSet(84,$mod.YesNoChars[1].charCodeAt()));
      return Result;
    };
    this.GetAsDateTime = function () {
      var Result = 0.0;
      Result = pas.SysUtils.StrToDateTime(this.GetAsString());
      return Result;
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      Result = pas.SysUtils.StrToFloat(this.GetAsString());
      return Result;
    };
    this.GetAsInteger = function () {
      var Result = 0;
      Result = pas.SysUtils.StrToInt(this.GetAsString());
      return Result;
    };
    this.GetAsLargeInt = function () {
      var Result = 0;
      Result = pas.SysUtils.StrToInt64(this.GetAsString());
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      var V = undefined;
      V = this.GetData();
      if (rtl.isString(V)) {
        Result = "" + V}
       else Result = "";
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      Result = this.GetData();
      return Result;
    };
    this.GetDefaultWidth = function () {
      var Result = 0;
      Result = this.FSize;
      return Result;
    };
    this.GetText = function (AText, ADisplayText) {
      AText.set(this.GetAsString());
    };
    this.SetAsBoolean = function (AValue) {
      if (AValue) {
        this.SetAsString("T")}
       else this.SetAsString("F");
    };
    this.SetAsDateTime = function (AValue) {
      this.SetAsString(pas.SysUtils.DateTimeToStr(AValue,false));
    };
    this.SetAsFloat = function (AValue) {
      this.SetAsString(pas.SysUtils.FloatToStr(AValue));
    };
    this.SetAsInteger = function (AValue) {
      this.SetAsString(pas.SysUtils.IntToStr(AValue));
    };
    this.SetAsLargeInt = function (AValue) {
      this.SetAsString(pas.SysUtils.IntToStr(AValue));
    };
    this.SetAsString = function (AValue) {
      this.SetData(AValue);
    };
    this.SetVarValue = function (AValue) {
      if (rtl.isString(AValue)) {
        this.SetAsString("" + AValue)}
       else this.RaiseAccessError(rtl.getResStr(pas.DBConst,"SFieldValueError"));
    };
    this.Create$1 = function (AOwner) {
      $mod.TField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftString);
      this.FFixedChar = false;
      this.FTransliterate = false;
      this.FSize = 20;
    };
    this.SetFieldType = function (AValue) {
      if (AValue in rtl.createSet($mod.TFieldType.ftString,$mod.TFieldType.ftFixedChar)) this.SetDataType(AValue);
    };
    var $r = this.$rtti;
    $r.addProperty("Size",2,rtl.longint,"FSize","SetSize",{Default: 20});
  });
  rtl.createClass($mod,"TNumericField",$mod.TField,function () {
    this.$init = function () {
      $mod.TField.$init.call(this);
      this.FDisplayFormat = "";
      this.FEditFormat = "";
    };
    this.CheckTypeSize = function (AValue) {
      if (AValue > 16) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SInvalidFieldSize"),[AValue]);
    };
    this.rangeError = function (AValue, Min, Max) {
      $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SRangeError"),[AValue,Min,Max,this.FFieldName]);
    };
    this.SetDisplayFormat = function (AValue) {
      if (this.FDisplayFormat !== AValue) {
        this.FDisplayFormat = AValue;
        this.PropertyChanged(true);
      };
    };
    this.SetEditFormat = function (AValue) {
      if (this.FEditFormat !== AValue) {
        this.FEditFormat = AValue;
        this.PropertyChanged(true);
      };
    };
    this.GetAsBoolean = function () {
      var Result = false;
      Result = this.GetAsInteger() !== 0;
      return Result;
    };
    this.SetAsBoolean = function (AValue) {
      this.SetAsInteger(AValue + 0);
    };
    this.Create$1 = function (AOwner) {
      $mod.TField.Create$1.call(this,AOwner);
      this.SetAlignment(pas.Classes.TAlignment.taRightJustify);
    };
    var $r = this.$rtti;
    $r.addProperty("Alignment",2,pas.Classes.$rtti["TAlignment"],"FAlignment","SetAlignment",{Default: pas.Classes.TAlignment.taRightJustify});
    $r.addProperty("DisplayFormat",2,rtl.string,"FDisplayFormat","SetDisplayFormat");
    $r.addProperty("EditFormat",2,rtl.string,"FEditFormat","SetEditFormat");
  });
  rtl.createClass($mod,"TIntegerField",$mod.TNumericField,function () {
    this.$init = function () {
      $mod.TNumericField.$init.call(this);
      this.FMinValue = 0;
      this.FMaxValue = 0;
      this.FMinRange = 0;
      this.FMaxRange = 0;
    };
    this.SetMinValue = function (AValue) {
      if ((AValue >= this.FMinRange) && (AValue <= this.FMaxRange)) {
        this.FMinValue = AValue}
       else this.rangeError(AValue,this.FMinRange,this.FMaxRange);
    };
    this.SetMaxValue = function (AValue) {
      if ((AValue >= this.FMinRange) && (AValue <= this.FMaxRange)) {
        this.FMaxValue = AValue}
       else this.rangeError(AValue,this.FMinRange,this.FMaxRange);
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      Result = this.GetAsInteger();
      return Result;
    };
    this.GetAsInteger = function () {
      var Result = 0;
      if (!this.GetValue({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }})) Result = 0;
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      var L = 0;
      if (this.GetValue({get: function () {
          return L;
        }, set: function (v) {
          L = v;
        }})) {
        Result = pas.SysUtils.IntToStr(L)}
       else Result = "";
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      var L = 0;
      if (this.GetValue({get: function () {
          return L;
        }, set: function (v) {
          L = v;
        }})) {
        Result = L}
       else Result = null;
      return Result;
    };
    this.GetText = function (AText, ADisplayText) {
      var l = 0;
      var fmt = "";
      AText.set("");
      if (!this.GetValue({get: function () {
          return l;
        }, set: function (v) {
          l = v;
        }})) return;
      if (ADisplayText || (this.FEditFormat === "")) {
        fmt = this.FDisplayFormat}
       else fmt = this.FEditFormat;
      if (fmt.length !== 0) {
        AText.set(pas.SysUtils.FormatFloat(fmt,l))}
       else AText.set("" + l);
    };
    this.GetValue = function (AValue) {
      var Result = false;
      var V = undefined;
      V = this.GetData();
      Result = pas.JS.isInteger(V);
      if (Result) AValue.set(Math.floor(V));
      return Result;
    };
    this.SetAsFloat = function (AValue) {
      this.SetAsInteger(Math.round(AValue));
    };
    this.SetAsInteger = function (AValue) {
      if (this.CheckRange(AValue)) {
        this.SetData(AValue)}
       else if ((this.FMinValue !== 0) || (this.FMaxValue !== 0)) {
        this.rangeError(AValue,this.FMinValue,this.FMaxValue)}
       else this.rangeError(AValue,this.FMinRange,this.FMaxRange);
    };
    this.SetAsString = function (AValue) {
      var L = 0;
      var Code = 0;
      if (AValue.length === 0) {
        this.Clear()}
       else {
        pas.System.val$5(AValue,{get: function () {
            return L;
          }, set: function (v) {
            L = v;
          }},{get: function () {
            return Code;
          }, set: function (v) {
            Code = v;
          }});
        if (Code === 0) {
          this.SetAsInteger(L)}
         else $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SNotAninteger"),[AValue]);
      };
    };
    this.SetVarValue = function (AValue) {
      if (pas.JS.isInteger(AValue)) {
        this.SetAsInteger(Math.floor(AValue))}
       else this.RaiseAccessError($impl.SInteger);
    };
    this.GetAsLargeInt = function () {
      var Result = 0;
      Result = this.GetAsInteger();
      return Result;
    };
    this.SetAsLargeInt = function (AValue) {
      if ((AValue >= this.FMinRange) && (AValue <= this.FMaxRange)) {
        this.SetAsInteger(AValue)}
       else this.rangeError(AValue,this.FMinRange,this.FMaxRange);
    };
    this.Create$1 = function (AOwner) {
      $mod.TNumericField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftInteger);
      this.FMinRange = -2147483648;
      this.FMaxRange = 2147483647;
    };
    this.CheckRange = function (AValue) {
      var Result = false;
      if ((this.FMinValue !== 0) || (this.FMaxValue !== 0)) {
        Result = (AValue >= this.FMinValue) && (AValue <= this.FMaxValue)}
       else Result = (AValue >= this.FMinRange) && (AValue <= this.FMaxRange);
      return Result;
    };
    var $r = this.$rtti;
    $r.addProperty("MaxValue",2,rtl.longint,"FMaxValue","SetMaxValue",{Default: 0});
    $r.addProperty("MinValue",2,rtl.longint,"FMinValue","SetMinValue",{Default: 0});
  });
  rtl.createClass($mod,"TLargeintField",$mod.TNumericField,function () {
    this.$init = function () {
      $mod.TNumericField.$init.call(this);
      this.FMinValue = 0;
      this.FMaxValue = 0;
      this.FMinRange = 0;
      this.FMaxRange = 0;
    };
    this.SetMinValue = function (AValue) {
      if ((AValue >= this.FMinRange) && (AValue <= this.FMaxRange)) {
        this.FMinValue = AValue}
       else this.rangeError(AValue,this.FMinRange,this.FMaxRange);
    };
    this.SetMaxValue = function (AValue) {
      if ((AValue >= this.FMinRange) && (AValue <= this.FMaxRange)) {
        this.FMaxValue = AValue}
       else this.rangeError(AValue,this.FMinRange,this.FMaxRange);
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      Result = this.GetAsLargeInt();
      return Result;
    };
    this.GetAsInteger = function () {
      var Result = 0;
      Result = this.GetAsLargeInt();
      return Result;
    };
    this.GetAsLargeInt = function () {
      var Result = 0;
      if (!this.GetValue({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }})) Result = 0;
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      var L = 0;
      if (this.GetValue({get: function () {
          return L;
        }, set: function (v) {
          L = v;
        }})) {
        Result = pas.SysUtils.IntToStr(L)}
       else Result = "";
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      var L = 0;
      if (this.GetValue({get: function () {
          return L;
        }, set: function (v) {
          L = v;
        }})) {
        Result = L}
       else Result = null;
      return Result;
    };
    this.GetText = function (AText, ADisplayText) {
      var l = 0;
      var fmt = "";
      AText.set("");
      if (!this.GetValue({get: function () {
          return l;
        }, set: function (v) {
          l = v;
        }})) return;
      if (ADisplayText || (this.FEditFormat === "")) {
        fmt = this.FDisplayFormat}
       else fmt = this.FEditFormat;
      if (fmt.length !== 0) {
        AText.set(pas.SysUtils.FormatFloat(fmt,l))}
       else AText.set("" + l);
    };
    this.GetValue = function (AValue) {
      var Result = false;
      var P = undefined;
      P = this.GetData();
      Result = pas.JS.isInteger(P);
      if (Result) AValue.set(Math.floor(P));
      return Result;
    };
    this.SetAsFloat = function (AValue) {
      this.SetAsLargeInt(Math.round(AValue));
    };
    this.SetAsInteger = function (AValue) {
      this.SetAsLargeInt(AValue);
    };
    this.SetAsLargeInt = function (AValue) {
      if (this.CheckRange(AValue)) {
        this.SetData(AValue)}
       else this.rangeError(AValue,this.FMinValue,this.FMaxValue);
    };
    this.SetAsString = function (AValue) {
      var L = 0;
      var code = 0;
      if (AValue.length === 0) {
        this.Clear()}
       else {
        pas.System.val(AValue,{get: function () {
            return L;
          }, set: function (v) {
            L = v;
          }},{get: function () {
            return code;
          }, set: function (v) {
            code = v;
          }});
        if (code === 0) {
          this.SetAsLargeInt(L)}
         else $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SNotAninteger"),[AValue]);
      };
    };
    this.SetVarValue = function (AValue) {
      if (pas.JS.isInteger(AValue)) {
        this.SetAsLargeInt(Math.floor(AValue))}
       else this.RaiseAccessError($impl.SLargeInt);
    };
    this.Create$1 = function (AOwner) {
      $mod.TNumericField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftLargeInt);
      this.FMinRange = -4503599627370496;
      this.FMaxRange = 4503599627370495;
    };
    this.CheckRange = function (AValue) {
      var Result = false;
      if ((this.FMinValue !== 0) || (this.FMaxValue !== 0)) {
        Result = (AValue >= this.FMinValue) && (AValue <= this.FMaxValue)}
       else Result = (AValue >= this.FMinRange) && (AValue <= this.FMaxRange);
      return Result;
    };
    var $r = this.$rtti;
    $r.addProperty("MaxValue",2,rtl.nativeint,"FMaxValue","SetMaxValue",{Default: 0});
    $r.addProperty("MinValue",2,rtl.nativeint,"FMinValue","SetMinValue",{Default: 0});
  });
  rtl.createClass($mod,"TAutoIncField",$mod.TIntegerField,function () {
    this.SetAsInteger = function (AValue) {
      $mod.TIntegerField.SetAsInteger.apply(this,arguments);
    };
    this.Create$1 = function (AOwner) {
      $mod.TIntegerField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftAutoInc);
    };
  });
  rtl.createClass($mod,"TFloatField",$mod.TNumericField,function () {
    this.$init = function () {
      $mod.TNumericField.$init.call(this);
      this.FCurrency = false;
      this.FMaxValue = 0.0;
      this.FMinValue = 0.0;
      this.FPrecision = 0;
    };
    this.SetCurrency = function (AValue) {
      if (this.FCurrency === AValue) return;
      this.FCurrency = AValue;
    };
    this.SetPrecision = function (AValue) {
      if ((AValue === -1) || (AValue > 1)) {
        this.FPrecision = AValue}
       else this.FPrecision = 2;
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      var P = undefined;
      P = this.GetData();
      if (rtl.isNumber(P)) {
        Result = rtl.getNumber(P)}
       else Result = 0.0;
      return Result;
    };
    this.GetAsLargeInt = function () {
      var Result = 0;
      Result = Math.round(this.GetAsFloat());
      return Result;
    };
    this.GetAsInteger = function () {
      var Result = 0;
      Result = Math.round(this.GetAsFloat());
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      var P = undefined;
      P = this.GetData();
      if (rtl.isNumber(P)) {
        Result = P}
       else Result = null;
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      var P = undefined;
      P = this.GetData();
      if (rtl.isNumber(P)) {
        Result = pas.SysUtils.FloatToStr(rtl.getNumber(P))}
       else Result = "";
      return Result;
    };
    this.GetText = function (AText, ADisplayText) {
      var fmt = "";
      var E = 0.0;
      var Digits = 0;
      var ff = 0;
      var P = undefined;
      AText.set("");
      P = this.GetData();
      if (!rtl.isNumber(P)) return;
      E = rtl.getNumber(P);
      if (ADisplayText || (this.FEditFormat.length === 0)) {
        fmt = this.FDisplayFormat}
       else fmt = this.FEditFormat;
      Digits = 0;
      if (!this.FCurrency) {
        ff = pas.SysUtils.TFloatFormat.ffGeneral}
       else {
        Digits = 2;
        ff = pas.SysUtils.TFloatFormat.ffFixed;
      };
      if (fmt !== "") {
        AText.set(pas.SysUtils.FormatFloat(fmt,E))}
       else AText.set(pas.SysUtils.FloatToStrF(E,ff,this.FPrecision,Digits));
    };
    this.SetAsFloat = function (AValue) {
      if (this.CheckRange(AValue)) {
        this.SetData(AValue)}
       else this.rangeError(AValue,this.FMinValue,this.FMaxValue);
    };
    this.SetAsLargeInt = function (AValue) {
      this.SetAsFloat(AValue);
    };
    this.SetAsInteger = function (AValue) {
      this.SetAsFloat(AValue);
    };
    this.SetAsString = function (AValue) {
      var f = 0.0;
      if (AValue === "") {
        this.Clear()}
       else {
        if (!pas.SysUtils.TryStrToFloat(AValue,{get: function () {
            return f;
          }, set: function (v) {
            f = v;
          }})) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SNotAFloat"),[AValue]);
        this.SetAsFloat(f);
      };
    };
    this.SetVarValue = function (AValue) {
      if (rtl.isNumber(AValue)) {
        this.SetAsFloat(rtl.getNumber(AValue))}
       else this.RaiseAccessError("Float");
    };
    this.Create$1 = function (AOwner) {
      $mod.TNumericField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftFloat);
      this.FPrecision = 15;
    };
    this.CheckRange = function (AValue) {
      var Result = false;
      if ((this.FMinValue !== 0) || (this.FMaxValue !== 0)) {
        Result = (AValue >= this.FMinValue) && (AValue <= this.FMaxValue)}
       else Result = true;
      return Result;
    };
    var $r = this.$rtti;
    $r.addProperty("Currency",2,rtl.boolean,"FCurrency","SetCurrency",{Default: false});
    $r.addProperty("MaxValue",0,rtl.double,"FMaxValue","FMaxValue");
    $r.addProperty("MinValue",0,rtl.double,"FMinValue","FMinValue");
    $r.addProperty("Precision",2,rtl.longint,"FPrecision","SetPrecision",{Default: 15});
  });
  rtl.createClass($mod,"TBooleanField",$mod.TField,function () {
    this.$init = function () {
      $mod.TField.$init.call(this);
      this.FDisplayValues = "";
      this.FDisplays = rtl.arraySetLength(null,"",2,2);
    };
    this.$final = function () {
      this.FDisplays = undefined;
      $mod.TField.$final.call(this);
    };
    this.SetDisplayValues = function (AValue) {
      var I = 0;
      if (this.FDisplayValues !== AValue) {
        I = pas.System.Pos(";",AValue);
        if ((I < 2) || (I === AValue.length)) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SInvalidDisplayValues"),[AValue]);
        this.FDisplayValues = AValue;
        this.FDisplays[0][1] = pas.System.Copy(AValue,1,I - 1);
        this.FDisplays[1][1] = pas.SysUtils.UpperCase(this.FDisplays[0][1]);
        this.FDisplays[0][0] = pas.System.Copy(AValue,I + 1,AValue.length - I);
        this.FDisplays[1][0] = pas.SysUtils.UpperCase(this.FDisplays[0][0]);
        this.PropertyChanged(true);
      };
    };
    this.GetAsBoolean = function () {
      var Result = false;
      var P = undefined;
      P = this.GetData();
      if (pas.JS.isBoolean(P)) {
        Result = !(P == false)}
       else Result = false;
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      var P = undefined;
      P = this.GetData();
      if (pas.JS.isBoolean(P)) {
        Result = this.FDisplays[0][+!(P == false)]}
       else Result = "";
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      var P = undefined;
      P = this.GetData();
      if (pas.JS.isBoolean(P)) {
        Result = !(P == false)}
       else Result = null;
      return Result;
    };
    this.GetAsInteger = function () {
      var Result = 0;
      Result = this.GetAsBoolean() + 0;
      return Result;
    };
    this.GetDefaultWidth = function () {
      var Result = 0;
      Result = this.FDisplays[0][0].length;
      if (Result < this.FDisplays[0][1].length) Result = this.FDisplays[0][1].length;
      return Result;
    };
    this.SetAsBoolean = function (AValue) {
      this.SetData(AValue);
    };
    this.SetAsString = function (AValue) {
      var Temp = "";
      Temp = pas.SysUtils.UpperCase(AValue);
      if (Temp === "") {
        this.Clear()}
       else if (pas.System.Pos(Temp,this.FDisplays[1][1]) === 1) {
        this.SetAsBoolean(true)}
       else if (pas.System.Pos(Temp,this.FDisplays[1][0]) === 1) {
        this.SetAsBoolean(false)}
       else $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SNotABoolean"),[AValue]);
    };
    this.SetAsInteger = function (AValue) {
      this.SetAsBoolean(AValue !== 0);
    };
    this.SetVarValue = function (AValue) {
      if (pas.JS.isBoolean(AValue)) {
        this.SetAsBoolean(!(AValue == false))}
       else if (rtl.isNumber(AValue)) this.SetAsBoolean(rtl.getNumber(AValue) !== 0);
    };
    this.Create$1 = function (AOwner) {
      $mod.TField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftBoolean);
      this.SetDisplayValues("True;False");
    };
    var $r = this.$rtti;
    $r.addProperty("DisplayValues",2,rtl.string,"FDisplayValues","SetDisplayValues");
  });
  rtl.createClass($mod,"TDateTimeField",$mod.TField,function () {
    this.$init = function () {
      $mod.TField.$init.call(this);
      this.FDisplayFormat = "";
    };
    this.SetDisplayFormat = function (AValue) {
      if (this.FDisplayFormat !== AValue) {
        this.FDisplayFormat = AValue;
        this.PropertyChanged(true);
      };
    };
    this.ConvertToDateTime = function (aValue, aRaiseError) {
      var Result = 0.0;
      if (this.FDataSet != null) {
        Result = this.FDataSet.ConvertToDateTime(aValue,aRaiseError)}
       else Result = $mod.TDataSet.DefaultConvertToDateTime(aValue,aRaiseError);
      return Result;
    };
    this.DateTimeToNativeDateTime = function (aValue) {
      var Result = undefined;
      if (this.FDataSet != null) {
        Result = this.FDataSet.ConvertDateTimeToNative(aValue)}
       else Result = $mod.TDataSet.DefaultConvertDateTimeToNative(aValue);
      return Result;
    };
    this.GetAsDateTime = function () {
      var Result = 0.0;
      Result = this.ConvertToDateTime(this.GetData(),false);
      return Result;
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      Result = this.GetAsDateTime();
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      this.GetText({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},false);
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      Result = this.GetData();
      if (!rtl.isString(Result)) Result = null;
      return Result;
    };
    this.GetDataSize = function () {
      var Result = 0;
      Result = $mod.TField.GetDataSize.call(this);
      return Result;
    };
    this.GetText = function (AText, ADisplayText) {
      var R = 0.0;
      var F = "";
      R = this.ConvertToDateTime(this.GetData(),false);
      if (R === 0) {
        AText.set("")}
       else {
        if (ADisplayText && (this.FDisplayFormat.length !== 0)) {
          F = this.FDisplayFormat}
         else {
          var $tmp1 = this.FDataType;
          if ($tmp1 === $mod.TFieldType.ftTime) {
            F = pas.SysUtils.LongTimeFormat}
           else if ($tmp1 === $mod.TFieldType.ftDate) {
            F = pas.SysUtils.ShortDateFormat}
           else {
            F = "c";
          };
        };
        AText.set(pas.SysUtils.FormatDateTime(F,R));
      };
    };
    this.SetAsDateTime = function (AValue) {
      this.SetData(this.DateTimeToNativeDateTime(AValue));
    };
    this.SetAsFloat = function (AValue) {
      this.SetAsDateTime(AValue);
    };
    this.SetAsString = function (AValue) {
      var R = 0.0;
      if (AValue !== "") {
        R = pas.SysUtils.StrToDateTime(AValue);
        this.SetData(this.DateTimeToNativeDateTime(R));
      } else this.SetData(null);
    };
    this.SetVarValue = function (AValue) {
      this.SetAsDateTime(this.ConvertToDateTime(AValue,true));
    };
    this.Create$1 = function (AOwner) {
      $mod.TField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftDateTime);
    };
    var $r = this.$rtti;
    $r.addProperty("DisplayFormat",2,rtl.string,"FDisplayFormat","SetDisplayFormat");
  });
  rtl.createClass($mod,"TDateField",$mod.TDateTimeField,function () {
    this.Create$1 = function (AOwner) {
      $mod.TDateTimeField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftDate);
    };
  });
  rtl.createClass($mod,"TTimeField",$mod.TDateTimeField,function () {
    this.SetAsString = function (AValue) {
      var R = 0.0;
      if (AValue !== "") {
        R = pas.SysUtils.StrToTime(AValue);
        this.SetData(this.DateTimeToNativeDateTime(R));
      } else this.SetData(null);
    };
    this.Create$1 = function (AOwner) {
      $mod.TDateTimeField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftTime);
    };
  });
  rtl.createClass($mod,"TBinaryField",$mod.TField,function () {
    this.CheckTypeSize = function (AValue) {
      if (AValue < 1) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SInvalidFieldSize"),[AValue]);
    };
    this.BlobToBytes = function (aValue) {
      var Result = [];
      if (this.FDataSet != null) {
        Result = this.FDataSet.BlobDataToBytes(aValue)}
       else Result = $mod.TDataSet.DefaultBlobDataToBytes(aValue);
      return Result;
    };
    this.BytesToBlob = function (aValue) {
      var Result = undefined;
      if (this.FDataSet != null) {
        Result = this.FDataSet.BytesToBlobData(aValue)}
       else Result = $mod.TDataSet.DefaultBytesToBlobData(aValue);
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      var V = undefined;
      var S = [];
      var I = 0;
      Result = "";
      V = this.GetData();
      if (V != null) {
        S = this.BlobToBytes(V);
        for (var $l1 = 0, $end2 = rtl.length(S); $l1 <= $end2; $l1++) {
          I = $l1;
          Result.concat(String.fromCharCode(S[I]));
        };
      };
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      Result = this.GetData();
      return Result;
    };
    this.GetValue = function (AValue) {
      var Result = false;
      var V = undefined;
      V = this.GetData();
      Result = V != null;
      if (Result) {
        AValue.set(this.BlobToBytes(V))}
       else AValue.set(rtl.arraySetLength(AValue.get(),0,0));
      return Result;
    };
    this.SetAsString = function (AValue) {
      var B = [];
      var i = 0;
      B = rtl.arraySetLength(B,0,AValue.length);
      for (var $l1 = 1, $end2 = AValue.length; $l1 <= $end2; $l1++) {
        i = $l1;
        B[i - 1] = AValue.charCodeAt(i - 1);
      };
      this.SetAsBytes(B);
    };
    this.SetVarValue = function (AValue) {
      var B = [];
      var I = 0;
      var Len = 0;
      if (rtl.isArray(AValue)) {
        Len = rtl.length(AValue);
        B = rtl.arraySetLength(B,0,Len);
        for (var $l1 = 1, $end2 = Len - 1; $l1 <= $end2; $l1++) {
          I = $l1;
          B[I] = AValue[I];
        };
        this.SetAsBytes(B);
      } else if (rtl.isString(AValue)) {
        this.SetAsString("" + AValue)}
       else this.RaiseAccessError("Blob");
    };
    this.Create$1 = function (AOwner) {
      $mod.TField.Create$1.call(this,AOwner);
    };
    var $r = this.$rtti;
    $r.addProperty("Size",2,rtl.longint,"FSize","SetSize",{Default: 16});
  });
  this.TBlobStreamMode = {"0": "bmRead", bmRead: 0, "1": "bmWrite", bmWrite: 1, "2": "bmReadWrite", bmReadWrite: 2};
  $mod.$rtti.$Enum("TBlobStreamMode",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TBlobStreamMode});
  rtl.createClass($mod,"TBlobField",$mod.TBinaryField,function () {
    this.$init = function () {
      $mod.TBinaryField.$init.call(this);
      this.FModified = false;
    };
    this.GetBlobSize = function () {
      var Result = 0;
      var B = [];
      B = this.GetAsBytes();
      Result = rtl.length(B);
      return Result;
    };
    this.GetIsNull = function () {
      var Result = false;
      if (!this.FModified) {
        Result = $mod.TField.GetIsNull.call(this)}
       else Result = this.GetBlobSize() === 0;
      return Result;
    };
    this.GetText = function (AText, ADisplayText) {
      AText.set($mod.TBinaryField.GetAsString.call(this));
    };
    this.Create$1 = function (AOwner) {
      $mod.TBinaryField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftBlob);
    };
    this.Clear = function () {
      this.SetData(null);
    };
    this.IsBlob = function () {
      var Result = false;
      Result = true;
      return Result;
    };
    this.SetFieldType = function (AValue) {
      if (AValue in $mod.ftBlobTypes) this.SetDataType(AValue);
    };
    var $r = this.$rtti;
    $r.addProperty("Size",2,rtl.longint,"FSize","SetSize",{Default: 0});
  });
  rtl.createClass($mod,"TMemoField",$mod.TBlobField,function () {
    this.Create$1 = function (AOwner) {
      $mod.TBlobField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftMemo);
    };
  });
  rtl.createClass($mod,"TVariantField",$mod.TField,function () {
    this.CheckTypeSize = function (aValue) {
    };
    this.GetAsBoolean = function () {
      var Result = false;
      Result = this.GetAsJSValue() == true;
      return Result;
    };
    this.SetAsBoolean = function (aValue) {
      this.SetVarValue(aValue);
    };
    this.GetAsDateTime = function () {
      var Result = 0.0;
      var V = undefined;
      V = this.GetData();
      if (this.FDataSet != null) {
        Result = this.FDataSet.ConvertToDateTime(V,true)}
       else Result = $mod.TDataSet.DefaultConvertToDateTime(V,true);
      return Result;
    };
    this.SetAsDateTime = function (aValue) {
      this.SetVarValue(aValue);
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      var V = undefined;
      V = this.GetData();
      if (rtl.isNumber(V)) {
        Result = rtl.getNumber(V)}
       else if (rtl.isString(V)) {
        Result = parseFloat("" + V)}
       else this.RaiseAccessError("Variant");
      return Result;
    };
    this.SetAsFloat = function (aValue) {
      this.SetVarValue(aValue);
    };
    this.GetAsInteger = function () {
      var Result = 0;
      var V = undefined;
      V = this.GetData();
      if (pas.JS.isInteger(V)) {
        Result = Math.floor(V)}
       else if (rtl.isString(V)) {
        Result = parseInt("" + V)}
       else this.RaiseAccessError("Variant");
      return Result;
    };
    this.SetAsInteger = function (AValue) {
      this.SetVarValue(AValue);
    };
    this.GetAsString = function () {
      var Result = "";
      var V = undefined;
      V = this.GetData();
      if (pas.JS.isInteger(V)) {
        Result = pas.SysUtils.IntToStr(Math.floor(V))}
       else if (rtl.isNumber(V)) {
        Result = pas.SysUtils.FloatToStr(rtl.getNumber(V))}
       else if (rtl.isString(V)) {
        Result = "" + V}
       else this.RaiseAccessError("Variant");
      return Result;
    };
    this.SetAsString = function (aValue) {
      this.SetVarValue(aValue);
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      Result = this.GetData();
      return Result;
    };
    this.SetVarValue = function (aValue) {
      this.SetData(aValue);
    };
    this.Create$1 = function (AOwner) {
      $mod.TField.Create$1.call(this,AOwner);
      this.SetDataType($mod.TFieldType.ftVariant);
    };
  });
  $mod.$rtti.$Class("TIndexDefs");
  this.TIndexOption = {"0": "ixPrimary", ixPrimary: 0, "1": "ixUnique", ixUnique: 1, "2": "ixDescending", ixDescending: 2, "3": "ixCaseInsensitive", ixCaseInsensitive: 3, "4": "ixExpression", ixExpression: 4, "5": "ixNonMaintained", ixNonMaintained: 5};
  $mod.$rtti.$Enum("TIndexOption",{minvalue: 0, maxvalue: 5, ordtype: 1, enumtype: this.TIndexOption});
  $mod.$rtti.$Set("TIndexOptions",{comptype: $mod.$rtti["TIndexOption"]});
  rtl.createClass($mod,"TIndexDef",$mod.TNamedItem,function () {
    this.$init = function () {
      $mod.TNamedItem.$init.call(this);
      this.FCaseinsFields = "";
      this.FDescFields = "";
      this.FExpression = "";
      this.FFields = "";
      this.FOptions = {};
      this.FSource = "";
    };
    this.$final = function () {
      this.FOptions = undefined;
      $mod.TNamedItem.$final.call(this);
    };
    this.GetExpression = function () {
      var Result = "";
      Result = this.FExpression;
      return Result;
    };
    this.SetCaseInsFields = function (AValue) {
      if (this.FCaseinsFields === AValue) return;
      if (AValue !== "") this.FOptions = rtl.unionSet(this.FOptions,rtl.createSet($mod.TIndexOption.ixCaseInsensitive));
      this.FCaseinsFields = AValue;
    };
    this.SetDescFields = function (AValue) {
      if (this.FDescFields === AValue) return;
      if (AValue !== "") this.FOptions = rtl.unionSet(this.FOptions,rtl.createSet($mod.TIndexOption.ixDescending));
      this.FDescFields = AValue;
    };
    this.SetExpression = function (AValue) {
      this.FExpression = AValue;
    };
    this.Create$2 = function (Owner, AName, TheFields, TheOptions) {
      this.FName = AName;
      pas.Classes.TCollectionItem.Create$1.call(this,Owner);
      this.FFields = TheFields;
      this.FOptions = rtl.refSet(TheOptions);
    };
    this.Assign = function (Source) {
      var idef = null;
      idef = null;
      if ($mod.TIndexDef.isPrototypeOf(Source)) idef = rtl.as(Source,$mod.TIndexDef);
      if (idef != null) {
        this.FName = idef.FName;
        this.FFields = idef.FFields;
        this.FOptions = rtl.refSet(idef.FOptions);
        this.FCaseinsFields = idef.FCaseinsFields;
        this.FDescFields = idef.FDescFields;
        this.FSource = idef.FSource;
        this.FExpression = idef.GetExpression();
      } else pas.Classes.TPersistent.Assign.call(this,Source);
    };
    var $r = this.$rtti;
    $r.addProperty("Expression",3,rtl.string,"GetExpression","SetExpression");
    $r.addProperty("Fields",0,rtl.string,"FFields","FFields");
    $r.addProperty("CaseInsFields",2,rtl.string,"FCaseinsFields","SetCaseInsFields");
    $r.addProperty("DescFields",2,rtl.string,"FDescFields","SetDescFields");
    $r.addProperty("Options",0,$mod.$rtti["TIndexOptions"],"FOptions","FOptions");
    $r.addProperty("Source",0,rtl.string,"FSource","FSource");
  });
  rtl.createClass($mod,"TIndexDefs",$mod.TDefCollection,function () {
    this.GetItem$1 = function (Index) {
      var Result = null;
      Result = rtl.as(pas.Classes.TCollection.GetItem.call(this,Index),$mod.TIndexDef);
      return Result;
    };
    this.SetItem$1 = function (Index, Value) {
      pas.Classes.TCollection.SetItem.call(this,Index,Value);
    };
    this.Create$4 = function (ADataSet) {
      $mod.TDefCollection.create$3.call(this,ADataSet,this.Owner(),$mod.TIndexDef);
    };
    this.Add$1 = function (Name, Fields, Options) {
      $mod.TIndexDef.$create("Create$2",[this,Name,Fields,rtl.refSet(Options)]);
    };
    this.AddIndexDef = function () {
      var Result = null;
      Result = $mod.TIndexDef.$create("Create$2",[this,"","",{}]);
      return Result;
    };
    this.Find$1 = function (IndexName) {
      var Result = null;
      Result = rtl.as($mod.TDefCollection.Find.call(this,IndexName),$mod.TIndexDef);
      if (Result === null) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SIndexNotFound"),[IndexName],this.FDataset);
      return Result;
    };
    this.FindIndexForFields = function (Fields) {
      var Result = null;
      Result = null;
      return Result;
    };
    this.GetIndexForFields = function (Fields, CaseInsensitive) {
      var Result = null;
      var i = 0;
      var FieldsLen = 0;
      var Last = null;
      Last = null;
      FieldsLen = Fields.length;
      for (var $l1 = 0, $end2 = this.GetCount() - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        Result = this.GetItem$1(i);
        if ((rtl.eqSet(rtl.intersectSet(Result.FOptions,rtl.createSet($mod.TIndexOption.ixDescending,$mod.TIndexOption.ixExpression)),{}) && (!CaseInsensitive || ($mod.TIndexOption.ixCaseInsensitive in Result.FOptions))) && pas.SysUtils.AnsiSameText(Fields,Result.FFields)) {
          return Result;
        } else if (pas.SysUtils.AnsiSameText(Fields,pas.System.Copy(Result.FFields,1,FieldsLen)) && ((Result.FFields.length === FieldsLen) || (Result.FFields.charAt((FieldsLen + 1) - 1) === ";"))) {
          if ((Last === null) || ((Last !== null) && (Last.FFields.length > Result.FFields.length))) Last = Result;
        };
      };
      Result = Last;
      return Result;
    };
    this.Update$1 = function () {
      if (!this.FUpdated && (this.FDataset != null)) {
        this.FDataset.UpdateIndexDefs();
        this.FUpdated = true;
      };
    };
  });
  rtl.createClass($mod,"TCheckConstraint",pas.Classes.TCollectionItem,function () {
    this.$init = function () {
      pas.Classes.TCollectionItem.$init.call(this);
      this.FCustomConstraint = "";
      this.FErrorMessage = "";
      this.FFromDictionary = false;
      this.FImportedConstraint = "";
    };
    this.Assign = function (Source) {
    };
    var $r = this.$rtti;
    $r.addProperty("CustomConstraint",0,rtl.string,"FCustomConstraint","FCustomConstraint");
    $r.addProperty("ErrorMessage",0,rtl.string,"FErrorMessage","FErrorMessage");
    $r.addProperty("FromDictionary",0,rtl.boolean,"FFromDictionary","FFromDictionary");
    $r.addProperty("ImportedConstraint",0,rtl.string,"FImportedConstraint","FImportedConstraint");
  });
  rtl.createClass($mod,"TCheckConstraints",pas.Classes.TCollection,function () {
    this.GetItem$1 = function (Index) {
      var Result = null;
      Result = null;
      return Result;
    };
    this.SetItem$1 = function (index, Value) {
    };
    this.GetOwner = function () {
      var Result = null;
      Result = null;
      return Result;
    };
    this.Create$2 = function (AOwner) {
      pas.Classes.TCollection.Create$1.call(this,$mod.TCheckConstraint);
    };
    this.Add$1 = function () {
      var Result = null;
      Result = null;
      return Result;
    };
  });
  rtl.createClass($mod,"TFieldsEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FPosition = 0;
      this.FFields = null;
    };
    this.$final = function () {
      this.FFields = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetCurrent = function () {
      var Result = null;
      Result = this.FFields.GetField(this.FPosition);
      return Result;
    };
    this.Create$1 = function (AFields) {
      pas.System.TObject.Create.call(this);
      this.FFields = AFields;
      this.FPosition = -1;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FFields.GetCount();
      return Result;
    };
  });
  rtl.createClass($mod,"TFields",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FDataset = null;
      this.FFieldList = null;
      this.FOnChange = null;
      this.FValidFieldKinds = {};
    };
    this.$final = function () {
      this.FDataset = undefined;
      this.FFieldList = undefined;
      this.FOnChange = undefined;
      this.FValidFieldKinds = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.ClearFieldDefs = function () {
      var i = 0;
      for (var $l1 = 0, $end2 = this.GetCount() - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        this.GetField(i).FFieldDef = null;
      };
    };
    this.Changed = function () {
      if ((this.FDataset !== null) && !(pas.Classes.TComponentStateItem.csDestroying in this.FDataset.FComponentState)) this.FDataset.DataEvent($mod.TDataEvent.deFieldListChange,0);
      if (this.FOnChange != null) this.FOnChange(this);
    };
    this.CheckfieldKind = function (Fieldkind, Field) {
      if (!(Fieldkind in this.FValidFieldKinds)) $mod.DatabaseErrorFmt(rtl.getResStr(pas.DBConst,"SInvalidFieldKind"),[Field.FFieldName]);
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FFieldList.FCount;
      return Result;
    };
    this.GetField = function (Index) {
      var Result = null;
      Result = rtl.getObject(this.FFieldList.Get(Index));
      return Result;
    };
    this.SetField = function (Index, Value) {
      this.GetField(Index).Assign(Value);
    };
    this.SetFieldIndex = function (Field, Value) {
      var Old = 0;
      Old = this.FFieldList.IndexOf(Field);
      if (Old === -1) return;
      if (Value < 0) Value = 0;
      if (Value >= this.GetCount()) Value = this.GetCount() - 1;
      if (Value !== Old) {
        this.FFieldList.Delete(Old);
        this.FFieldList.Insert(Value,Field);
        Field.PropertyChanged(true);
        this.Changed();
      };
    };
    this.Create$1 = function (ADataset) {
      this.FDataset = ADataset;
      this.FFieldList = pas.Classes.TFPList.$create("Create");
      this.FValidFieldKinds = rtl.createSet(null,$mod.TFieldKind.fkData,$mod.TFieldKind.fkInternalCalc);
    };
    this.Destroy = function () {
      if (this.FFieldList != null) this.Clear();
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FFieldList;
        }, set: function (v) {
          this.p.FFieldList = v;
        }});
      pas.System.TObject.Destroy.call(this);
    };
    this.Add = function (Field) {
      this.CheckFieldName(Field.FFieldName);
      this.FFieldList.Add(Field);
      Field.FFields = this;
      this.Changed();
    };
    this.CheckFieldName = function (Value) {
      if (this.FindField(Value) !== null) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SDuplicateFieldName"),[Value],this.FDataset);
    };
    this.CheckFieldNames = function (Value) {
      var N = "";
      var StrPos = 0;
      if (Value === "") return;
      StrPos = 1;
      do {
        N = $mod.ExtractFieldName(Value,{get: function () {
            return StrPos;
          }, set: function (v) {
            StrPos = v;
          }});
        this.FieldByName(N);
      } while (!(StrPos > Value.length));
    };
    this.Clear = function () {
      var AField = null;
      while (this.FFieldList.FCount > 0) {
        AField = rtl.getObject(this.FFieldList.Last());
        AField.FDataSet = null;
        AField = rtl.freeLoc(AField);
        this.FFieldList.Delete(this.FFieldList.FCount - 1);
      };
      this.Changed();
    };
    this.FindField = function (Value) {
      var Result = null;
      var S = "";
      var I = 0;
      S = pas.SysUtils.UpperCase(Value);
      for (var $l1 = 0, $end2 = this.FFieldList.FCount - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        Result = rtl.getObject(this.FFieldList.Get(I));
        if (S === pas.SysUtils.UpperCase(Result.FFieldName)) {
          return Result;
        };
      };
      Result = null;
      return Result;
    };
    this.FieldByName = function (Value) {
      var Result = null;
      Result = this.FindField(Value);
      if (Result === null) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SFieldNotFound"),[Value],this.FDataset);
      return Result;
    };
    this.FieldByNumber = function (FieldNo) {
      var Result = null;
      var i = 0;
      for (var $l1 = 0, $end2 = this.FFieldList.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        Result = rtl.getObject(this.FFieldList.Get(i));
        if (FieldNo === Result.FFieldNo) return Result;
      };
      Result = null;
      return Result;
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TFieldsEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.GetFieldNames = function (Values) {
      var i = 0;
      Values.Clear();
      for (var $l1 = 0, $end2 = this.FFieldList.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        Values.Add(rtl.getObject(this.FFieldList.Get(i)).FFieldName);
      };
    };
    this.IndexOf = function (Field) {
      var Result = 0;
      Result = this.FFieldList.IndexOf(Field);
      return Result;
    };
    this.Remove = function (Value) {
      this.FFieldList.Remove(Value);
      Value.FFields = null;
      this.Changed();
    };
  });
  $mod.$rtti.$ClassRef("TFieldsClass",{instancetype: $mod.$rtti["TFields"]});
  $mod.$rtti.$DynArray("TParamBinding",{eltype: rtl.longint});
  this.TParamType = {"0": "ptUnknown", ptUnknown: 0, "1": "ptInput", ptInput: 1, "2": "ptOutput", ptOutput: 2, "3": "ptInputOutput", ptInputOutput: 3, "4": "ptResult", ptResult: 4};
  $mod.$rtti.$Enum("TParamType",{minvalue: 0, maxvalue: 4, ordtype: 1, enumtype: this.TParamType});
  $mod.$rtti.$Set("TParamTypes",{comptype: $mod.$rtti["TParamType"]});
  this.TParamStyle = {"0": "psInterbase", psInterbase: 0, "1": "psPostgreSQL", psPostgreSQL: 1, "2": "psSimulated", psSimulated: 2};
  $mod.$rtti.$Enum("TParamStyle",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TParamStyle});
  $mod.$rtti.$Class("TParams");
  rtl.createClass($mod,"TParam",pas.Classes.TCollectionItem,function () {
    this.$init = function () {
      pas.Classes.TCollectionItem.$init.call(this);
      this.FValue = undefined;
      this.FPrecision = 0;
      this.FNumericScale = 0;
      this.FName = "";
      this.FDataType = 0;
      this.FBound = false;
      this.FParamType = 0;
      this.FSize = 0;
    };
    this.GetDataSet = function () {
      var Result = null;
      if ((this.FCollection != null) && $mod.TParams.isPrototypeOf(this.FCollection)) {
        Result = this.FCollection.GetDataSet()}
       else Result = null;
      return Result;
    };
    this.IsParamStored = function () {
      var Result = false;
      Result = this.FBound;
      return Result;
    };
    this.AssignParam = function (Param) {
      if (!(Param != null)) {
        this.Clear();
        this.FDataType = $mod.TFieldType.ftUnknown;
        this.FParamType = $mod.TParamType.ptUnknown;
        this.FName = "";
        this.FSize = 0;
        this.FPrecision = 0;
        this.FNumericScale = 0;
      } else {
        this.FDataType = Param.FDataType;
        if (Param.GetIsNull()) {
          this.Clear()}
         else this.FValue = Param.FValue;
        this.FBound = Param.FBound;
        this.FName = Param.FName;
        if (this.FParamType === $mod.TParamType.ptUnknown) this.FParamType = Param.FParamType;
        this.FSize = Param.FSize;
        this.FPrecision = Param.FPrecision;
        this.FNumericScale = Param.FNumericScale;
      };
    };
    this.AssignTo = function (Dest) {
      if ($mod.TField.isPrototypeOf(Dest)) {
        this.AssignToField(Dest)}
       else pas.Classes.TPersistent.AssignTo.call(this,Dest);
    };
    this.GetAsBoolean = function () {
      var Result = false;
      if (this.GetIsNull()) {
        Result = false}
       else Result = this.FValue == true;
      return Result;
    };
    this.GetAsBytes = function () {
      var Result = [];
      if (this.GetIsNull()) {
        Result = []}
       else if (rtl.isArray(this.FValue)) Result = this.FValue;
      return Result;
    };
    this.GetAsDateTime = function () {
      var Result = 0.0;
      if (this.GetIsNull()) {
        Result = 0.0}
       else Result = rtl.getNumber(this.FValue);
      return Result;
    };
    this.GetAsFloat = function () {
      var Result = 0.0;
      if (this.GetIsNull()) {
        Result = 0.0}
       else Result = rtl.getNumber(this.FValue);
      return Result;
    };
    this.GetAsInteger = function () {
      var Result = 0;
      if (this.GetIsNull() || !pas.JS.isInteger(this.FValue)) {
        Result = 0}
       else Result = Math.floor(this.FValue);
      return Result;
    };
    this.GetAsLargeInt = function () {
      var Result = 0;
      if (this.GetIsNull() || !pas.JS.isInteger(this.FValue)) {
        Result = 0}
       else Result = Math.floor(this.FValue);
      return Result;
    };
    this.GetAsMemo = function () {
      var Result = "";
      if (this.GetIsNull() || !rtl.isString(this.FValue)) {
        Result = ""}
       else Result = "" + this.FValue;
      return Result;
    };
    this.GetAsString = function () {
      var Result = "";
      if (this.GetIsNull() || !rtl.isString(this.FValue)) {
        Result = ""}
       else Result = "" + this.FValue;
      return Result;
    };
    this.GetAsJSValue = function () {
      var Result = undefined;
      if (this.GetIsNull()) {
        Result = null}
       else Result = this.FValue;
      return Result;
    };
    this.GetDisplayName = function () {
      var Result = "";
      if (this.FName !== "") {
        Result = this.FName}
       else Result = pas.Classes.TCollectionItem.GetDisplayName.call(this);
      return Result;
    };
    this.GetIsNull = function () {
      var Result = false;
      Result = pas.JS.isNull(this.FValue);
      return Result;
    };
    this.IsEqual = function (AValue) {
      var Result = false;
      Result = ((((((this.FName === AValue.FName) && (this.GetIsNull() === AValue.GetIsNull())) && (this.FBound === AValue.FBound)) && (this.FDataType === AValue.FDataType)) && (this.FParamType === AValue.FParamType)) && (pas.JS.GetValueType(this.FValue) === pas.JS.GetValueType(AValue.FValue))) && (this.FValue == AValue.FValue);
      return Result;
    };
    this.SetAsBlob = function (AValue) {
      this.FDataType = $mod.TFieldType.ftBlob;
      this.SetAsJSValue(AValue);
    };
    this.SetAsBoolean = function (AValue) {
      this.FDataType = $mod.TFieldType.ftBoolean;
      this.SetAsJSValue(AValue);
    };
    this.SetAsBytes = function (AValue) {
    };
    this.SetAsDate = function (AValue) {
      this.FDataType = $mod.TFieldType.ftDate;
      this.SetAsJSValue(AValue);
    };
    this.SetAsDateTime = function (AValue) {
      this.FDataType = $mod.TFieldType.ftDateTime;
      this.SetAsJSValue(AValue);
    };
    this.SetAsFloat = function (AValue) {
      this.FDataType = $mod.TFieldType.ftFloat;
      this.SetAsJSValue(AValue);
    };
    this.SetAsInteger = function (AValue) {
      this.FDataType = $mod.TFieldType.ftInteger;
      this.SetAsJSValue(AValue);
    };
    this.SetAsLargeInt = function (AValue) {
      this.FDataType = $mod.TFieldType.ftLargeInt;
      this.SetAsJSValue(AValue);
    };
    this.SetAsMemo = function (AValue) {
      this.FDataType = $mod.TFieldType.ftMemo;
      this.SetAsJSValue(AValue);
    };
    this.SetAsString = function (AValue) {
      if (this.FDataType !== $mod.TFieldType.ftFixedChar) this.FDataType = $mod.TFieldType.ftString;
      this.SetAsJSValue(AValue);
    };
    this.SetAsTime = function (AValue) {
      this.FDataType = $mod.TFieldType.ftTime;
      this.SetAsJSValue(AValue);
    };
    this.SetAsJSValue = function (AValue) {
      this.FValue = AValue;
      this.FBound = !pas.JS.isNull(AValue);
      if (this.FBound) {
        var $tmp1 = pas.JS.GetValueType(AValue);
        if ($tmp1 === pas.JS.TJSValueType.jvtBoolean) {
          this.FDataType = $mod.TFieldType.ftBoolean}
         else if ($tmp1 === pas.JS.TJSValueType.jvtInteger) {
          this.FDataType = $mod.TFieldType.ftInteger}
         else if ($tmp1 === pas.JS.TJSValueType.jvtFloat) {
          this.FDataType = $mod.TFieldType.ftFloat}
         else if (($tmp1 === pas.JS.TJSValueType.jvtObject) || ($tmp1 === pas.JS.TJSValueType.jvtArray)) this.FDataType = $mod.TFieldType.ftBlob;
      };
    };
    this.SetDataType = function (AValue) {
      this.FDataType = AValue;
    };
    this.SetText = function (AValue) {
      this.SetAsJSValue(AValue);
    };
    this.Create$1 = function (ACollection) {
      pas.Classes.TCollectionItem.Create$1.call(this,ACollection);
      this.FParamType = $mod.TParamType.ptUnknown;
      this.SetDataType($mod.TFieldType.ftUnknown);
      this.FValue = null;
    };
    this.Create$3 = function (AParams, AParamType) {
      this.Create$1(AParams);
      this.FParamType = AParamType;
    };
    this.Assign = function (Source) {
      if ($mod.TParam.isPrototypeOf(Source)) {
        this.AssignParam(Source)}
       else if ($mod.TField.isPrototypeOf(Source)) {
        this.AssignField(Source)}
       else if (pas.Classes.TStrings.isPrototypeOf(Source)) {
        this.SetAsMemo(Source.GetTextStr())}
       else pas.Classes.TPersistent.Assign.call(this,Source);
    };
    this.AssignField = function (Field) {
      if (Field != null) {
        this.AssignFieldValue(Field,Field.GetAsJSValue());
        this.FName = Field.FFieldName;
      } else {
        this.Clear();
        this.FName = "";
      };
    };
    this.AssignToField = function (Field) {
      if (Field != null) {
        var $tmp1 = this.FDataType;
        if ($tmp1 === $mod.TFieldType.ftUnknown) {
          $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SUnknownParamFieldType"),[this.FName],this.GetDataSet())}
         else if (($tmp1 === $mod.TFieldType.ftInteger) || ($tmp1 === $mod.TFieldType.ftAutoInc)) {
          Field.SetAsInteger(this.GetAsInteger())}
         else if ($tmp1 === $mod.TFieldType.ftFloat) {
          Field.SetAsFloat(this.GetAsFloat())}
         else if ($tmp1 === $mod.TFieldType.ftBoolean) {
          Field.SetAsBoolean(this.GetAsBoolean())}
         else if (((($tmp1 === $mod.TFieldType.ftBlob) || ($tmp1 === $mod.TFieldType.ftString)) || ($tmp1 === $mod.TFieldType.ftMemo)) || ($tmp1 === $mod.TFieldType.ftFixedChar)) {
          Field.SetAsString(this.GetAsString())}
         else if ((($tmp1 === $mod.TFieldType.ftTime) || ($tmp1 === $mod.TFieldType.ftDate)) || ($tmp1 === $mod.TFieldType.ftDateTime)) Field.SetAsDateTime(this.GetAsDateTime());
      };
    };
    this.AssignFieldValue = function (Field, AValue) {
      if (Field != null) {
        if ((Field.FDataType === $mod.TFieldType.ftString) && Field.FFixedChar) {
          this.FDataType = $mod.TFieldType.ftFixedChar}
         else if ((Field.FDataType === $mod.TFieldType.ftMemo) && (Field.FSize > 255)) {
          this.FDataType = $mod.TFieldType.ftString}
         else this.FDataType = Field.FDataType;
        if (pas.JS.isNull(AValue)) {
          this.Clear()}
         else this.SetAsJSValue(AValue);
        this.FSize = Field.GetDataSize();
        this.FBound = true;
      };
    };
    this.AssignFromField = function (Field) {
      if (Field != null) {
        this.FDataType = Field.FDataType;
        var $tmp1 = Field.FDataType;
        if ($tmp1 === $mod.TFieldType.ftUnknown) {
          $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SUnknownParamFieldType"),[this.FName],this.GetDataSet())}
         else if (($tmp1 === $mod.TFieldType.ftInteger) || ($tmp1 === $mod.TFieldType.ftAutoInc)) {
          this.SetAsInteger(Field.GetAsInteger())}
         else if ($tmp1 === $mod.TFieldType.ftFloat) {
          this.SetAsFloat(Field.GetAsFloat())}
         else if ($tmp1 === $mod.TFieldType.ftBoolean) {
          this.SetAsBoolean(Field.GetAsBoolean())}
         else if (((($tmp1 === $mod.TFieldType.ftBlob) || ($tmp1 === $mod.TFieldType.ftString)) || ($tmp1 === $mod.TFieldType.ftMemo)) || ($tmp1 === $mod.TFieldType.ftFixedChar)) {
          this.SetAsString(Field.GetAsString())}
         else if ((($tmp1 === $mod.TFieldType.ftTime) || ($tmp1 === $mod.TFieldType.ftDate)) || ($tmp1 === $mod.TFieldType.ftDateTime)) this.SetAsDateTime(Field.GetAsDateTime());
      };
    };
    this.Clear = function () {
      this.FValue = null;
    };
    var $r = this.$rtti;
    $r.addProperty("DataType",2,$mod.$rtti["TFieldType"],"FDataType","SetDataType");
    $r.addProperty("Name",0,rtl.string,"FName","FName");
    $r.addProperty("NumericScale",0,rtl.longint,"FNumericScale","FNumericScale",{Default: 0});
    $r.addProperty("ParamType",0,$mod.$rtti["TParamType"],"FParamType","FParamType");
    $r.addProperty("Precision",0,rtl.longint,"FPrecision","FPrecision",{Default: 0});
    $r.addProperty("Size",0,rtl.longint,"FSize","FSize",{Default: 0});
    $r.addProperty("Value",15,rtl.jsvalue,"GetAsJSValue","SetAsJSValue",{stored: "IsParamStored"});
  });
  $mod.$rtti.$ClassRef("TParamClass",{instancetype: $mod.$rtti["TParam"]});
  rtl.createClass($mod,"TParams",pas.Classes.TCollection,function () {
    this.$init = function () {
      pas.Classes.TCollection.$init.call(this);
      this.FOwner = null;
    };
    this.$final = function () {
      this.FOwner = undefined;
      pas.Classes.TCollection.$final.call(this);
    };
    this.GetItem$1 = function (Index) {
      var Result = null;
      Result = rtl.as(pas.Classes.TCollection.GetItem.call(this,Index),$mod.TParam);
      return Result;
    };
    this.GetParamValue = function (ParamName) {
      var Result = undefined;
      Result = this.ParamByName(ParamName).GetAsJSValue();
      return Result;
    };
    this.SetItem$1 = function (Index, Value) {
      pas.Classes.TCollection.SetItem.call(this,Index,Value);
    };
    this.SetParamValue = function (ParamName, Value) {
      this.ParamByName(ParamName).SetAsJSValue(Value);
    };
    this.AssignTo = function (Dest) {
      if ($mod.TParams.isPrototypeOf(Dest)) {
        Dest.Assign(this)}
       else pas.Classes.TPersistent.AssignTo.call(this,Dest);
    };
    this.GetDataSet = function () {
      var Result = null;
      if ($mod.TDataSet.isPrototypeOf(this.FOwner)) {
        Result = this.FOwner}
       else Result = null;
      return Result;
    };
    this.GetOwner = function () {
      var Result = null;
      Result = this.FOwner;
      return Result;
    };
    this.ParamClass = function () {
      var Result = null;
      Result = $mod.TParam;
      return Result;
    };
    this.Create$2 = function (AOwner, AItemClass) {
      pas.Classes.TCollection.Create$1.call(this,AItemClass);
      this.FOwner = AOwner;
    };
    this.Create$3 = function (AOwner) {
      this.Create$2(AOwner,this.$class.ParamClass());
    };
    this.Create$4 = function () {
      this.Create$3(null);
    };
    this.AddParam = function (Value) {
      Value.SetCollection(this);
    };
    this.AssignValues = function (Value) {
      var I = 0;
      var P = null;
      var PS = null;
      for (var $l1 = 0, $end2 = Value.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        PS = Value.GetItem$1(I);
        P = this.FindParam(PS.FName);
        if (P != null) P.Assign(PS);
      };
    };
    this.CreateParam = function (FldType, ParamName, ParamType) {
      var Result = null;
      Result = rtl.as(this.Add(),$mod.TParam);
      Result.FName = ParamName;
      Result.SetDataType(FldType);
      Result.FParamType = ParamType;
      return Result;
    };
    this.FindParam = function (Value) {
      var Result = null;
      var I = 0;
      Result = null;
      I = this.GetCount() - 1;
      while ((Result === null) && (I >= 0)) if (pas.SysUtils.CompareText(Value,this.GetItem$1(I).FName) === 0) {
        Result = this.GetItem$1(I)}
       else I -= 1;
      return Result;
    };
    this.GetParamList = function (List, ParamNames) {
      var P = null;
      var N = "";
      var StrPos = 0;
      if ((ParamNames === "") || (List === null)) return;
      StrPos = 1;
      do {
        N = $mod.ExtractFieldName(ParamNames,{get: function () {
            return StrPos;
          }, set: function (v) {
            StrPos = v;
          }});
        P = this.ParamByName(N);
        List.Add(P);
      } while (!(StrPos > ParamNames.length));
    };
    this.IsEqual = function (Value) {
      var Result = false;
      var I = 0;
      Result = Value.GetCount() === this.GetCount();
      I = this.GetCount() - 1;
      while (Result && (I >= 0)) {
        Result = this.GetItem$1(I).IsEqual(Value.GetItem$1(I));
        I -= 1;
      };
      return Result;
    };
    this.ParamByName = function (Value) {
      var Result = null;
      Result = this.FindParam(Value);
      if (Result === null) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SParameterNotFound"),[Value],this.GetDataSet());
      return Result;
    };
    this.ParseSQL = function (SQL, DoCreate) {
      var Result = "";
      var pb = [];
      var rs = "";
      Result = this.ParseSQL$3(SQL,DoCreate,true,true,$mod.TParamStyle.psInterbase,{get: function () {
          return pb;
        }, set: function (v) {
          pb = v;
        }},{get: function () {
          return rs;
        }, set: function (v) {
          rs = v;
        }});
      return Result;
    };
    this.ParseSQL$1 = function (SQL, DoCreate, EscapeSlash, EscapeRepeat, ParameterStyle) {
      var Result = "";
      var pb = [];
      var rs = "";
      Result = this.ParseSQL$3(SQL,DoCreate,EscapeSlash,EscapeRepeat,ParameterStyle,{get: function () {
          return pb;
        }, set: function (v) {
          pb = v;
        }},{get: function () {
          return rs;
        }, set: function (v) {
          rs = v;
        }});
      return Result;
    };
    this.ParseSQL$2 = function (SQL, DoCreate, EscapeSlash, EscapeRepeat, ParameterStyle, ParamBinding) {
      var Result = "";
      var rs = "";
      Result = this.ParseSQL$3(SQL,DoCreate,EscapeSlash,EscapeRepeat,ParameterStyle,ParamBinding,{get: function () {
          return rs;
        }, set: function (v) {
          rs = v;
        }});
      return Result;
    };
    var ParamAllocStepSize = 8;
    var PAramDelimiters = [";",","," ","(",")","\r","\n","\t","\x00","=","+","-","*","\\","\/","[","]","|"];
    this.ParseSQL$3 = function (SQL, DoCreate, EscapeSlash, EscapeRepeat, ParameterStyle, ParamBinding, ReplaceString) {
      var Result = "";
      this.TStringPart = function (s) {
        if (s) {
          this.Start = s.Start;
          this.Stop = s.Stop;
        } else {
          this.Start = 0;
          this.Stop = 0;
        };
        this.$equal = function (b) {
          return (this.Start === b.Start) && (this.Stop === b.Stop);
        };
      };
      var IgnorePart = false;
      var p = 0;
      var ParamNameStart = 0;
      var BufStart = 0;
      var ParamName = "";
      var QuestionMarkParamCount = 0;
      var ParameterIndex = 0;
      var NewLength = 0;
      var ParamCount = 0;
      var ParamPart = [];
      var NewQueryLength = 0;
      var NewQuery = "";
      var NewQueryIndex = 0;
      var BufIndex = 0;
      var CopyLen = 0;
      var i = 0;
      var tmpParam = null;
      if (DoCreate) this.Clear();
      ParamCount = 0;
      NewQueryLength = SQL.length;
      ParamPart = rtl.arraySetLength(ParamPart,TStringPart,8);
      ParamBinding.set(rtl.arraySetLength(ParamBinding.get(),0,8));
      QuestionMarkParamCount = 0;
      ReplaceString.set("$");
      if (ParameterStyle === $mod.TParamStyle.psSimulated) while (pas.System.Pos(ReplaceString.get(),SQL) > 0) ReplaceString.set(ReplaceString.get() + "$");
      p = 1;
      BufStart = p;
      do {
        while ($impl.SkipComments(SQL,{get: function () {
            return p;
          }, set: function (v) {
            p = v;
          }},EscapeSlash,EscapeRepeat)) {
        };
        var $tmp1 = SQL.charAt(p - 1);
        if (($tmp1 === ":") || ($tmp1 === "?")) {
          IgnorePart = false;
          if (SQL.charAt(p - 1) === ":") {
            p += 1;
            if (pas.SysUtils.CharInSet(SQL.charAt(p - 1),[":","="," "])) {
              IgnorePart = true;
              p += 1;
            } else {
              if (SQL.charAt(p - 1) === '"') {
                ParamNameStart = p;
                $impl.SkipQuotesString(SQL,{get: function () {
                    return p;
                  }, set: function (v) {
                    p = v;
                  }},'"',EscapeSlash,EscapeRepeat);
                ParamName = pas.System.Copy(SQL,ParamNameStart + 1,(p - ParamNameStart) - 2);
              } else {
                ParamNameStart = p;
                while (!pas.SysUtils.CharInSet(SQL.charAt(p - 1),PAramDelimiters)) p += 1;
                ParamName = pas.System.Copy(SQL,ParamNameStart,p - ParamNameStart);
              };
            };
          } else {
            p += 1;
            ParamNameStart = p;
            ParamName = "";
          };
          if (!IgnorePart) {
            ParamCount += 1;
            if (ParamCount > rtl.length(ParamPart)) {
              NewLength = rtl.length(ParamPart) + 8;
              ParamPart = rtl.arraySetLength(ParamPart,TStringPart,NewLength);
              ParamBinding.set(rtl.arraySetLength(ParamBinding.get(),0,NewLength));
            };
            if (DoCreate) {
              tmpParam = this.FindParam(ParamName);
              if (!(tmpParam != null)) {
                ParameterIndex = this.CreateParam($mod.TFieldType.ftUnknown,ParamName,$mod.TParamType.ptInput).GetIndex()}
               else ParameterIndex = tmpParam.GetIndex();
            } else {
              if (ParamName !== "") {
                ParameterIndex = this.ParamByName(ParamName).GetIndex()}
               else {
                ParameterIndex = QuestionMarkParamCount;
                QuestionMarkParamCount += 1;
              };
            };
            if (ParameterStyle in rtl.createSet($mod.TParamStyle.psPostgreSQL,$mod.TParamStyle.psSimulated)) {
              i = ParameterIndex + 1;
              do {
                NewQueryLength += 1;
                i = Math.floor(i / 10);
              } while (!(i === 0));
            };
            ParamBinding.get()[ParamCount - 1] = ParameterIndex;
            ParamPart[ParamCount - 1].Start = ParamNameStart - BufStart;
            ParamPart[ParamCount - 1].Stop = (p - BufStart) + 1;
            NewQueryLength -= p - ParamNameStart;
          };
        } else if ($tmp1 === "\x00") {
          break}
         else {
          p += 1;
        };
      } while (!false);
      ParamPart = rtl.arraySetLength(ParamPart,TStringPart,ParamCount);
      ParamBinding.set(rtl.arraySetLength(ParamBinding.get(),0,ParamCount));
      if (ParamCount <= 0) {
        NewQuery = SQL}
       else {
        if ((ParameterStyle === $mod.TParamStyle.psSimulated) && (ReplaceString.get().length > 1)) NewQueryLength += ParamCount * (ReplaceString.get().length - 1);
        NewQuery = rtl.strSetLength(NewQuery,NewQueryLength);
        NewQueryIndex = 1;
        BufIndex = 1;
        for (var $l2 = 0, $end3 = rtl.length(ParamPart) - 1; $l2 <= $end3; $l2++) {
          i = $l2;
          CopyLen = ParamPart[i].Start - BufIndex;
          NewQuery = NewQuery + pas.System.Copy(SQL,BufIndex,CopyLen);
          NewQueryIndex += CopyLen;
          var $tmp4 = ParameterStyle;
          if ($tmp4 === $mod.TParamStyle.psInterbase) {
            NewQuery = NewQuery + "?";
            NewQueryIndex += 1;
          } else if (($tmp4 === $mod.TParamStyle.psPostgreSQL) || ($tmp4 === $mod.TParamStyle.psSimulated)) {
            ParamName = pas.SysUtils.IntToStr(ParamBinding.get()[i] + 1);
            NewQuery = pas.System.StringOfChar("$",ReplaceString.get().length);
            NewQuery = NewQuery + ParamName;
          };
          BufIndex = ParamPart[i].Stop;
        };
        CopyLen = (SQL.length + 1) - BufIndex;
        if (CopyLen > 0) NewQuery = NewQuery + pas.System.Copy(SQL,BufIndex,CopyLen);
      };
      Result = NewQuery;
      return Result;
    };
    this.RemoveParam = function (Value) {
      Value.SetCollection(null);
    };
    this.CopyParamValuesFromDataset = function (ADataset, CopyBound) {
      var I = 0;
      var P = null;
      var F = null;
      if (ADataset != null) for (var $l1 = 0, $end2 = this.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        P = this.GetItem$1(I);
        if (CopyBound || !P.FBound) {
          F = ADataset.FieldByName(P.FName);
          P.AssignField(F);
          if (!CopyBound) P.FBound = false;
        };
      };
    };
  });
  this.TBookmarkFlag = {"0": "bfCurrent", bfCurrent: 0, "1": "bfBOF", bfBOF: 1, "2": "bfEOF", bfEOF: 2, "3": "bfInserted", bfInserted: 3};
  $mod.$rtti.$Enum("TBookmarkFlag",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TBookmarkFlag});
  this.TBookmark = function (s) {
    if (s) {
      this.Data = s.Data;
      this.Flag = s.Flag;
    } else {
      this.Data = undefined;
      this.Flag = 0;
    };
    this.$equal = function (b) {
      return (this.Data === b.Data) && (this.Flag === b.Flag);
    };
  };
  $mod.$rtti.$Record("TBookmark",{}).addFields("Data",rtl.jsvalue,"Flag",$mod.$rtti["TBookmarkFlag"]);
  this.TGetMode = {"0": "gmCurrent", gmCurrent: 0, "1": "gmNext", gmNext: 1, "2": "gmPrior", gmPrior: 2};
  $mod.$rtti.$Enum("TGetMode",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TGetMode});
  this.TGetResult = {"0": "grOK", grOK: 0, "1": "grBOF", grBOF: 1, "2": "grEOF", grEOF: 2, "3": "grError", grError: 3};
  $mod.$rtti.$Enum("TGetResult",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TGetResult});
  this.TResyncMode$a = {"0": "rmExact", rmExact: 0, "1": "rmCenter", rmCenter: 1};
  $mod.$rtti.$Enum("TResyncMode$a",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TResyncMode$a});
  $mod.$rtti.$Set("TResyncMode",{comptype: $mod.$rtti["TResyncMode$a"]});
  this.TDataAction = {"0": "daFail", daFail: 0, "1": "daAbort", daAbort: 1, "2": "daRetry", daRetry: 2};
  $mod.$rtti.$Enum("TDataAction",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TDataAction});
  this.TUpdateAction = {"0": "uaFail", uaFail: 0, "1": "uaAbort", uaAbort: 1, "2": "uaSkip", uaSkip: 2, "3": "uaRetry", uaRetry: 3, "4": "uaApplied", uaApplied: 4};
  $mod.$rtti.$Enum("TUpdateAction",{minvalue: 0, maxvalue: 4, ordtype: 1, enumtype: this.TUpdateAction});
  this.TUpdateKind = {"0": "ukModify", ukModify: 0, "1": "ukInsert", ukInsert: 1, "2": "ukDelete", ukDelete: 2};
  $mod.$rtti.$Enum("TUpdateKind",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TUpdateKind});
  this.TLocateOption = {"0": "loCaseInsensitive", loCaseInsensitive: 0, "1": "loPartialKey", loPartialKey: 1};
  $mod.$rtti.$Enum("TLocateOption",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TLocateOption});
  $mod.$rtti.$Set("TLocateOptions",{comptype: $mod.$rtti["TLocateOption"]});
  $mod.$rtti.$MethodVar("TDataOperation",{procsig: rtl.newTIProcSig(null), methodkind: 0});
  $mod.$rtti.$MethodVar("TDataSetNotifyEvent",{procsig: rtl.newTIProcSig([["DataSet",$mod.$rtti["TDataSet"]]]), methodkind: 0});
  $mod.$rtti.$MethodVar("TDataSetErrorEvent",{procsig: rtl.newTIProcSig([["DataSet",$mod.$rtti["TDataSet"]],["E",$mod.$rtti["EDatabaseError"]],["DataAction",$mod.$rtti["TDataAction"],1]]), methodkind: 0});
  this.TFilterOption = {"0": "foCaseInsensitive", foCaseInsensitive: 0, "1": "foNoPartialCompare", foNoPartialCompare: 1};
  $mod.$rtti.$Enum("TFilterOption",{minvalue: 0, maxvalue: 1, ordtype: 1, enumtype: this.TFilterOption});
  $mod.$rtti.$Set("TFilterOptions",{comptype: $mod.$rtti["TFilterOption"]});
  this.TLoadOption = {"0": "loNoOpen", loNoOpen: 0, "1": "loNoEvents", loNoEvents: 1, "2": "loAtEOF", loAtEOF: 2};
  $mod.$rtti.$Enum("TLoadOption",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TLoadOption});
  $mod.$rtti.$Set("TLoadOptions",{comptype: $mod.$rtti["TLoadOption"]});
  $mod.$rtti.$MethodVar("TDatasetLoadEvent",{procsig: rtl.newTIProcSig([["DataSet",$mod.$rtti["TDataSet"]],["Data",rtl.jsvalue]]), methodkind: 0});
  $mod.$rtti.$MethodVar("TDatasetLoadFailEvent",{procsig: rtl.newTIProcSig([["DataSet",$mod.$rtti["TDataSet"]],["ID",rtl.longint],["ErrorMsg",rtl.string,2]]), methodkind: 0});
  $mod.$rtti.$MethodVar("TFilterRecordEvent",{procsig: rtl.newTIProcSig([["DataSet",$mod.$rtti["TDataSet"]],["Accept",rtl.boolean,1]]), methodkind: 0});
  $mod.$rtti.$ClassRef("TDatasetClass",{instancetype: $mod.$rtti["TDataSet"]});
  this.TRecordState = {"0": "rsNew", rsNew: 0, "1": "rsClean", rsClean: 1, "2": "rsUpdate", rsUpdate: 2, "3": "rsDelete", rsDelete: 3};
  $mod.$rtti.$Enum("TRecordState",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TRecordState});
  this.TDataRecord = function (s) {
    if (s) {
      this.data = s.data;
      this.state = s.state;
      this.bookmark = s.bookmark;
      this.bookmarkFlag = s.bookmarkFlag;
    } else {
      this.data = undefined;
      this.state = 0;
      this.bookmark = undefined;
      this.bookmarkFlag = 0;
    };
    this.$equal = function (b) {
      return (this.data === b.data) && ((this.state === b.state) && ((this.bookmark === b.bookmark) && (this.bookmarkFlag === b.bookmarkFlag)));
    };
  };
  $mod.$rtti.$Record("TDataRecord",{}).addFields("data",rtl.jsvalue,"state",$mod.$rtti["TRecordState"],"bookmark",rtl.jsvalue,"bookmarkFlag",$mod.$rtti["TBookmarkFlag"]);
  $mod.$rtti.$DynArray("TBuffers",{eltype: $mod.$rtti["TDataRecord"]});
  this.TResolveInfo = function (s) {
    if (s) {
      this.Data = s.Data;
      this.Status = s.Status;
      this.error = s.error;
      this.BookMark = new $mod.TBookmark(s.BookMark);
      this._private = s._private;
    } else {
      this.Data = undefined;
      this.Status = 0;
      this.error = "";
      this.BookMark = new $mod.TBookmark();
      this._private = undefined;
    };
    this.$equal = function (b) {
      return (this.Data === b.Data) && ((this.Status === b.Status) && ((this.error === b.error) && (this.BookMark.$equal(b.BookMark) && (this._private === b._private))));
    };
  };
  $mod.$rtti.$Record("TResolveInfo",{}).addFields("Data",rtl.jsvalue,"Status",$mod.$rtti["TUpdateStatus"],"error",rtl.string,"BookMark",$mod.$rtti["TBookmark"],"_private",rtl.jsvalue);
  $mod.$rtti.$DynArray("TResolveInfoArray",{eltype: $mod.$rtti["TResolveInfo"]});
  $mod.$rtti.$ProcVar("TOnRecordResolveEvent",{procsig: rtl.newTIProcSig([["Sender",$mod.$rtti["TDataSet"]],["info",$mod.$rtti["TResolveInfo"]]])});
  rtl.createClass($mod,"TDataSet",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.FAfterApplyUpdates = null;
      this.FAfterLoad = null;
      this.FBeforeApplyUpdates = null;
      this.FBeforeLoad = null;
      this.FBlockReadSize = 0;
      this.FCalcBuffer = new $mod.TDataRecord();
      this.FCalcFieldsSize = 0;
      this.FOnLoadFail = null;
      this.FOnRecordResolved = null;
      this.FOpenAfterRead = false;
      this.FActiveRecord = 0;
      this.FAfterCancel = null;
      this.FAfterClose = null;
      this.FAfterDelete = null;
      this.FAfterEdit = null;
      this.FAfterInsert = null;
      this.FAfterOpen = null;
      this.FAfterPost = null;
      this.FAfterRefresh = null;
      this.FAfterScroll = null;
      this.FAutoCalcFields = false;
      this.FBOF = false;
      this.FBeforeCancel = null;
      this.FBeforeClose = null;
      this.FBeforeDelete = null;
      this.FBeforeEdit = null;
      this.FBeforeInsert = null;
      this.FBeforeOpen = null;
      this.FBeforePost = null;
      this.FBeforeRefresh = null;
      this.FBeforeScroll = null;
      this.FBlobFieldCount = 0;
      this.FBuffers = [];
      this.FBufferCount = 0;
      this.FConstraints = null;
      this.FDisableControlsCount = 0;
      this.FDisableControlsState = 0;
      this.FCurrentRecord = 0;
      this.FDataSources = null;
      this.FDefaultFields = false;
      this.FEOF = false;
      this.FEnableControlsEvent = 0;
      this.FFieldList = null;
      this.FFieldDefs = null;
      this.FFilterOptions = {};
      this.FFilterText = "";
      this.FFiltered = false;
      this.FFound = false;
      this.FInternalCalcFields = false;
      this.FModified = false;
      this.FOnCalcFields = null;
      this.FOnDeleteError = null;
      this.FOnEditError = null;
      this.FOnFilterRecord = null;
      this.FOnNewRecord = null;
      this.FOnPostError = null;
      this.FRecordCount = 0;
      this.FIsUniDirectional = false;
      this.FState = 0;
      this.FInternalOpenComplete = false;
      this.FDataProxy = null;
      this.FDataRequestID = 0;
      this.FUpdateBatchID = 0;
      this.FChangeList = null;
      this.FBatchList = null;
    };
    this.$final = function () {
      this.FAfterApplyUpdates = undefined;
      this.FAfterLoad = undefined;
      this.FBeforeApplyUpdates = undefined;
      this.FBeforeLoad = undefined;
      this.FCalcBuffer = undefined;
      this.FOnLoadFail = undefined;
      this.FOnRecordResolved = undefined;
      this.FAfterCancel = undefined;
      this.FAfterClose = undefined;
      this.FAfterDelete = undefined;
      this.FAfterEdit = undefined;
      this.FAfterInsert = undefined;
      this.FAfterOpen = undefined;
      this.FAfterPost = undefined;
      this.FAfterRefresh = undefined;
      this.FAfterScroll = undefined;
      this.FBeforeCancel = undefined;
      this.FBeforeClose = undefined;
      this.FBeforeDelete = undefined;
      this.FBeforeEdit = undefined;
      this.FBeforeInsert = undefined;
      this.FBeforeOpen = undefined;
      this.FBeforePost = undefined;
      this.FBeforeRefresh = undefined;
      this.FBeforeScroll = undefined;
      this.FBuffers = undefined;
      this.FConstraints = undefined;
      this.FDataSources = undefined;
      this.FFieldList = undefined;
      this.FFieldDefs = undefined;
      this.FFilterOptions = undefined;
      this.FOnCalcFields = undefined;
      this.FOnDeleteError = undefined;
      this.FOnEditError = undefined;
      this.FOnFilterRecord = undefined;
      this.FOnNewRecord = undefined;
      this.FOnPostError = undefined;
      this.FDataProxy = undefined;
      this.FChangeList = undefined;
      this.FBatchList = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.DoInsertAppend = function (DoAppend) {
      var Self = this;
      function DoInsert(DoAppend) {
        var BookBeforeInsert = new $mod.TBookmark();
        var TempBuf = new $mod.TDataRecord();
        var I = 0;
        if (Self.FRecordCount > 0) BookBeforeInsert = new $mod.TBookmark(Self.GetBookmark());
        if (!DoAppend) {
          if (Self.FRecordCount > 0) {
            TempBuf = new $mod.TDataRecord(Self.FBuffers[Self.FBufferCount]);
            for (var $l1 = Self.FBufferCount, $end2 = Self.FActiveRecord + 1; $l1 >= $end2; $l1--) {
              I = $l1;
              Self.FBuffers[I] = new $mod.TDataRecord(Self.FBuffers[I - 1]);
            };
            Self.FBuffers[Self.FActiveRecord] = new $mod.TDataRecord(TempBuf);
          };
        } else if (Self.FRecordCount === Self.FBufferCount) {
          Self.ShiftBuffersBackward()}
         else {
          if (Self.FRecordCount > 0) Self.FActiveRecord += 1;
        };
        Self.InitRecord({a: Self.FActiveRecord, p: Self.FBuffers, get: function () {
            return this.p[this.a];
          }, set: function (v) {
            this.p[this.a] = v;
          }});
        Self.CursorPosChanged();
        if (Self.FRecordCount === 0) {
          Self.SetBookmarkFlag({a: Self.FActiveRecord, p: Self.FBuffers, get: function () {
              return this.p[this.a];
            }, set: function (v) {
              this.p[this.a] = v;
            }},$mod.TBookmarkFlag.bfEOF)}
         else {
          Self.FBOF = false;
          if (Self.FRecordCount > 0) {
            Self.SetBookmarkData({a: Self.FActiveRecord, p: Self.FBuffers, get: function () {
                return this.p[this.a];
              }, set: function (v) {
                this.p[this.a] = v;
              }},new $mod.TBookmark(BookBeforeInsert));
            Self.FreeBookmark(new $mod.TBookmark(BookBeforeInsert));
          };
        };
        Self.InternalInsert();
        if (Self.FRecordCount < Self.FBufferCount) Self.FRecordCount += 1;
      };
      Self.CheckBrowseMode();
      if (!Self.GetCanModify()) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SDatasetReadOnly"),Self);
      Self.DoBeforeInsert();
      Self.DoBeforeScroll();
      if (!DoAppend) {
        DoInsert(false);
      } else {
        Self.ClearBuffers();
        Self.InternalLast();
        Self.GetPriorRecords();
        if (Self.FRecordCount > 0) Self.FActiveRecord = Self.FRecordCount - 1;
        DoInsert(true);
        Self.SetBookmarkFlag({a: Self.FActiveRecord, p: Self.FBuffers, get: function () {
            return this.p[this.a];
          }, set: function (v) {
            this.p[this.a] = v;
          }},$mod.TBookmarkFlag.bfEOF);
        Self.FBOF = false;
        Self.FEOF = true;
      };
      Self.SetState($mod.TDataSetState.dsInsert);
      try {
        Self.DoOnNewRecord();
      } catch ($e) {
        Self.SetCurrentRecord(Self.FActiveRecord);
        Self.Resync({});
        throw $e;
      };
      Self.FModified = false;
      Self.DataEvent($mod.TDataEvent.deDataSetChange,0);
      Self.DoAfterInsert();
      Self.DoAfterScroll();
    };
    this.DoInternalOpen = function () {
      this.InternalOpen();
      this.FInternalOpenComplete = true;
      this.FRecordCount = 0;
      this.RecalcBufListSize();
      this.FBOF = true;
      this.FEOF = this.FRecordCount === 0;
      if (this.GetDataProxy() != null) this.InitChangeList();
    };
    this.GetBuffer = function (Index) {
      var Result = new $mod.TDataRecord();
      Result = new $mod.TDataRecord(this.FBuffers[Index]);
      return Result;
    };
    this.GetBufferCount = function () {
      var Result = 0;
      Result = rtl.length(this.FBuffers);
      return Result;
    };
    this.GetDataProxy = function () {
      var Result = null;
      if (this.FDataProxy === null) this.SetDataProxy(this.DoGetDataProxy());
      Result = this.FDataProxy;
      return Result;
    };
    this.RegisterDataSource = function (ADataSource) {
      this.FDataSources.Add(ADataSource);
      this.RecalcBufListSize();
    };
    this.SetConstraints = function (Value) {
      this.FConstraints.Assign(Value);
    };
    this.SetDataProxy = function (AValue) {
      if (AValue === this.FDataProxy) return;
      if (this.FDataProxy != null) this.FDataProxy.RemoveFreeNotification(this);
      this.FDataProxy = AValue;
      if (this.FDataProxy != null) this.FDataProxy.FreeNotification(this);
    };
    this.ShiftBuffersForward = function () {
      var TempBuf = new $mod.TDataRecord();
      var I = 0;
      TempBuf = new $mod.TDataRecord(this.FBuffers[this.FBufferCount]);
      for (var $l1 = this.FBufferCount; $l1 >= 1; $l1--) {
        I = $l1;
        this.FBuffers[I] = new $mod.TDataRecord(this.FBuffers[I - 1]);
      };
      this.FBuffers[0] = new $mod.TDataRecord(TempBuf);
    };
    this.ShiftBuffersBackward = function () {
      var TempBuf = new $mod.TDataRecord();
      var I = 0;
      TempBuf = new $mod.TDataRecord(this.FBuffers[0]);
      for (var $l1 = 1, $end2 = this.FBufferCount; $l1 <= $end2; $l1++) {
        I = $l1;
        this.FBuffers[I - 1] = new $mod.TDataRecord(this.FBuffers[I]);
      };
      this.FBuffers[this.GetBufferCount()] = new $mod.TDataRecord(TempBuf);
    };
    this.TryDoing = function (P, Ev) {
      var Result = false;
      var Retry = 0;
      Result = true;
      Retry = $mod.TDataAction.daRetry;
      while (Retry === $mod.TDataAction.daRetry) try {
        this.UpdateCursorPos();
        P();
        return Result;
      } catch ($e) {
        if ($mod.EDatabaseError.isPrototypeOf($e)) {
          var E = $e;
          Retry = $mod.TDataAction.daFail;
          if (Ev != null) Ev(this,E,{get: function () {
              return Retry;
            }, set: function (v) {
              Retry = v;
            }});
          var $tmp1 = Retry;
          if ($tmp1 === $mod.TDataAction.daFail) {
            throw $e}
           else if ($tmp1 === $mod.TDataAction.daAbort) pas.SysUtils.Abort();
        } else {
          throw $e;
        }
      };
      return Result;
    };
    this.GetActive = function () {
      var Result = false;
      Result = (this.FState !== $mod.TDataSetState.dsInactive) && (this.FState !== $mod.TDataSetState.dsOpening);
      return Result;
    };
    this.UnRegisterDataSource = function (ADataSource) {
      this.FDataSources.Remove(ADataSource);
    };
    this.SetBlockReadSize = function (AValue) {
      this.FBlockReadSize = AValue;
      if (AValue > 0) {
        this.CheckActive();
        this.SetState($mod.TDataSetState.dsBlockRead);
      } else {
        if (this.FState === $mod.TDataSetState.dsBlockRead) this.SetState($mod.TDataSetState.dsBrowse);
      };
    };
    this.SetFieldDefs = function (AFieldDefs) {
      this.FFieldList.ClearFieldDefs();
      this.FFieldDefs.Assign$2(AFieldDefs);
    };
    this.DoInsertAppendRecord = function (Values, DoAppend) {
      var i = 0;
      var ValuesSize = 0;
      ValuesSize = rtl.length(Values);
      if (ValuesSize > this.GetfieldCount()) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"STooManyFields"),this);
      if (DoAppend) {
        this.Append()}
       else this.Insert$1();
      for (var $l1 = 0, $end2 = ValuesSize - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        this.FFieldList.GetField(i).AssignValue(Values[i]);
      };
      this.Post();
    };
    this.ResolveRecordUpdate = function (anUpdate) {
      var Result = false;
      try {
        Result = this.DoResolveRecordUpdate(anUpdate);
        if (!Result) anUpdate.FStatus = $mod.TUpdateStatus.usResolveFailed;
      } catch ($e) {
        if (pas.SysUtils.Exception.isPrototypeOf($e)) {
          var E = $e;
          anUpdate.ResolveFailed((E.$classname + ": ") + E.fMessage);
          Result = false;
        } else throw $e
      };
      this.DoOnRecordResolved(anUpdate);
      return Result;
    };
    this.HandleRequestresponse = function (ARequest) {
      var DataAdded = false;
      if (!(ARequest != null)) return;
      var $tmp1 = ARequest.FSuccess;
      if ($tmp1 === $mod.TDataRequestResult.rrFail) {
        if (this.FOnLoadFail != null) this.FOnLoadFail(this,ARequest.FRequestID,ARequest.FErrorMsg);
      } else if (($tmp1 === $mod.TDataRequestResult.rrEOF) || ($tmp1 === $mod.TDataRequestResult.rrOK)) {
        DataAdded = false;
        if (ARequest.FEvent != null) ARequest.FEvent(this,ARequest.FData);
        if (ARequest.FSuccess !== $mod.TDataRequestResult.rrEOF) DataAdded = this.DataPacketReceived(ARequest);
        if (!(this.GetActive() || ($mod.TLoadOption.loNoOpen in ARequest.FLoadOptions))) {
          if (!($mod.TLoadOption.loNoEvents in ARequest.FLoadOptions)) this.DoAfterLoad();
          this.Open();
        } else {
          if (($mod.TLoadOption.loAtEOF in ARequest.FLoadOptions) && DataAdded) this.FEOF = false;
          if (!($mod.TLoadOption.loNoEvents in ARequest.FLoadOptions)) this.DoAfterLoad();
        };
      };
      ARequest.$destroy("Destroy");
    };
    this.DoOnRecordResolved = function (anUpdate) {
      var Info = new $mod.TResolveInfo();
      if (!(this.FOnRecordResolved != null)) return;
      Info = new $mod.TResolveInfo(this.RecordUpdateDescriptorToResolveInfo(anUpdate));
      this.FOnRecordResolved(this,new $mod.TResolveInfo(Info));
    };
    this.RecordUpdateDescriptorToResolveInfo = function (anUpdate) {
      var Result = new $mod.TResolveInfo();
      Result.BookMark = new $mod.TBookmark(anUpdate.FBookmark);
      Result.Data = anUpdate.FData;
      Result.Status = anUpdate.FStatus;
      Result.error = anUpdate.FResolveError;
      return Result;
    };
    this.DoResolveRecordUpdate = function (anUpdate) {
      var Result = false;
      Result = true;
      return Result;
    };
    this.GetRecordUpdates = function (AList) {
      var Result = 0;
      var I = 0;
      var MinIndex = 0;
      MinIndex = 0;
      for (var $l1 = MinIndex, $end2 = this.FChangeList.FCount - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        AList.Add(this.FChangeList.Get(I));
      };
      Result = this.FChangeList.FCount;
      return Result;
    };
    this.ResolveUpdateBatch = function (Sender, aBatch) {
      var BI = 0;
      var RI = 0;
      var Idx = 0;
      var RUD = null;
      var doRemove = false;
      if ((this.FBatchList != null) && (aBatch.FDataset === this)) {
        BI = this.FBatchList.IndexOf(aBatch)}
       else BI = -1;
      if (BI === -1) return;
      this.FBatchList.Delete(BI);
      for (var $l1 = 0, $end2 = aBatch.FList.FCount - 1; $l1 <= $end2; $l1++) {
        RI = $l1;
        RUD = aBatch.FList.GetUpdate(RI);
        aBatch.FList.Put(RI,null);
        Idx = this.IndexInChangeList(new $mod.TBookmark(RUD.FBookmark));
        if (Idx !== -1) {
          doRemove = false;
          if (RUD.FStatus === $mod.TUpdateStatus.usResolved) {
            doRemove = this.ResolveRecordUpdate(RUD)}
           else doRemove = RUD.FStatus in rtl.createSet($mod.TUpdateStatus.usUnmodified);
          if (doRemove) {
            RUD = rtl.freeLoc(RUD);
            this.FChangeList.Delete(Idx);
          } else RUD.Reset();
        };
      };
      if (this.FBatchList.FCount === 0) pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FBatchList;
        }, set: function (v) {
          this.p.FBatchList = v;
        }});
      this.DoAfterApplyUpdates();
    };
    this.DataPacketReceived = function (ARequest) {
      var Result = false;
      Result = false;
      return Result;
    };
    this.DoLoad = function (aOptions, aAfterLoad) {
      var Result = false;
      var Request = null;
      if (!($mod.TLoadOption.loNoEvents in aOptions)) this.DoBeforeLoad();
      Result = this.GetDataProxy() !== null;
      if (!Result) return Result;
      Request = this.GetDataProxy().GetDataRequest(rtl.refSet(aOptions),rtl.createCallback(this,"HandleRequestresponse"),aAfterLoad);
      Request.FDataset = this;
      if (this.GetActive()) Request.FBookmark = new $mod.TBookmark(this.GetBookmark());
      this.FDataRequestID += 1;
      Request.FRequestID = this.FDataRequestID;
      this.GetDataProxy().DoGetData(Request);
      return Result;
    };
    this.DoGetDataProxy = function () {
      var Result = null;
      Result = null;
      return Result;
    };
    this.InitChangeList = function () {
      this.DoneChangeList();
      this.FChangeList = pas.Classes.TFPList.$create("Create");
    };
    this.DoneChangeList = function () {
      this.ClearChangeList();
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FChangeList;
        }, set: function (v) {
          this.p.FChangeList = v;
        }});
    };
    this.ClearChangeList = function () {
      var I = 0;
      if (!(this.FChangeList != null)) return;
      for (var $l1 = 0, $end2 = this.FChangeList.FCount - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        rtl.getObject(this.FChangeList.Get(I)).$destroy("Destroy");
        this.FChangeList.Put(I,null);
      };
    };
    this.IndexInChangeList = function (aBookmark) {
      var Result = 0;
      Result = -1;
      if (!(this.FChangeList != null)) return Result;
      Result = this.FChangeList.FCount - 1;
      while ((Result >= 0) && (this.CompareBookmarks(new $mod.TBookmark(aBookmark),new $mod.TBookmark(rtl.getObject(this.FChangeList.Get(Result)).FBookmark)) !== 0)) Result -= 1;
      return Result;
    };
    this.AddToChangeList = function (aChange) {
      var Result = null;
      var B = new $mod.TBookmark();
      var I = 0;
      Result = null;
      if (!(this.FChangeList != null)) return Result;
      B = new $mod.TBookmark(this.GetBookmark());
      I = this.IndexInChangeList(new $mod.TBookmark(B));
      if (I === -1) {
        if (this.GetDataProxy() != null) {
          Result = this.GetDataProxy().GetUpdateDescriptor(this,new $mod.TBookmark(B),this.ActiveBuffer().data,aChange)}
         else Result = $mod.TRecordUpdateDescriptor.$create("Create$1",[null,this,new $mod.TBookmark(B),this.ActiveBuffer().data,aChange]);
        this.FChangeList.Add(Result);
      } else {
        Result = rtl.getObject(this.FChangeList.Get(I));
        var $tmp1 = aChange;
        if ($tmp1 === $mod.TUpdateStatus.usDeleted) {
          Result.FStatus = $mod.TUpdateStatus.usDeleted}
         else if ($tmp1 === $mod.TUpdateStatus.usInserted) {
          $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SErrInsertingSameRecordtwice"),this)}
         else if ($tmp1 === $mod.TUpdateStatus.usModified) Result.FData = this.ActiveBuffer().data;
      };
      return Result;
    };
    this.RemoveFromChangeList = function (R) {
      if (!((R != null) && (this.FChangeList != null))) return;
    };
    this.DoApplyUpdates = function () {
      var B = null;
      var l = null;
      var I = 0;
      if (!(this.GetDataProxy() != null)) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SErrDoApplyUpdatesNeedsProxy"),this);
      if (!((this.FChangeList != null) && (this.FChangeList.FCount > 0))) return;
      l = $mod.TRecordUpdateDescriptorList.$create("Create");
      try {
        I = this.GetRecordUpdates(l);
      } catch ($e) {
        l = rtl.freeLoc(l);
        throw $e;
      };
      this.FUpdateBatchID += 1;
      B = this.GetDataProxy().GetRecordUpdateBatch(this.FUpdateBatchID,l,true);
      B.FDataset = this;
      B.FLastChangeIndex = I;
      B.FOnResolve = rtl.createCallback(this,"ResolveUpdateBatch");
      if (!(this.FBatchList != null)) this.FBatchList = pas.Classes.TFPList.$create("Create");
      this.FBatchList.Add(B);
      this.GetDataProxy().ProcessUpdateBatch(B);
    };
    this.RecalcBufListSize = function () {
      var i = 0;
      var j = 0;
      var ABufferCount = 0;
      var DataLink = null;
      if (!this.IsCursorOpen()) return;
      if (this.FIsUniDirectional) {
        ABufferCount = 1}
       else ABufferCount = 10;
      for (var $l1 = 0, $end2 = this.FDataSources.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        for (var $l3 = 0, $end4 = rtl.getObject(this.FDataSources.Get(i)).FDataLinks.GetCount() - 1; $l3 <= $end4; $l3++) {
          j = $l3;
          DataLink = rtl.getObject(rtl.getObject(this.FDataSources.Get(i)).FDataLinks.Get(j));
          if (ABufferCount < DataLink.GetBufferCount()) ABufferCount = DataLink.GetBufferCount();
        };
      };
      if (this.FBufferCount === ABufferCount) return;
      this.SetBufListSize(ABufferCount);
      this.GetNextRecords();
      if ((this.FRecordCount < this.FBufferCount) && !this.FIsUniDirectional) {
        this.FActiveRecord = this.FActiveRecord + this.GetPriorRecords();
        this.CursorPosChanged();
      };
    };
    this.ActivateBuffers = function () {
      this.FBOF = false;
      this.FEOF = false;
      this.FActiveRecord = 0;
    };
    this.BindFields = function (Binding) {
      var i = 0;
      var FieldIndex = 0;
      var FieldDef = null;
      var Field = null;
      this.FCalcFieldsSize = 0;
      this.FBlobFieldCount = 0;
      for (var $l1 = 0, $end2 = this.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        Field = this.FFieldList.GetField(i);
        Field.FFieldDef = null;
        if (!Binding) {
          Field.FFieldNo = 0}
         else if (Field.FFieldKind in rtl.createSet($mod.TFieldKind.fkCalculated,$mod.TFieldKind.fkLookup)) {
          Field.FFieldNo = -1;
          Field.FOffset = this.FCalcFieldsSize;
          this.FCalcFieldsSize += Field.GetDataSize() + 1;
        } else {
          FieldIndex = this.FFieldDefs.IndexOf(Field.FFieldName);
          if (FieldIndex === -1) {
            $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SFieldNotFound"),[Field.FFieldName],this)}
           else {
            FieldDef = this.FFieldDefs.GetItem$1(FieldIndex);
            Field.FFieldDef = FieldDef;
            Field.FFieldNo = FieldDef.FFieldNo;
            if (FieldDef.FInternalCalcField) this.FInternalCalcFields = true;
            if (Field.$class.IsBlob()) {
              Field.FSize = FieldDef.FSize;
              Field.FOffset = this.FBlobFieldCount;
              this.FBlobFieldCount += 1;
            };
          };
        };
        Field.Bind(Binding);
      };
    };
    this.BlockReadNext = function () {
      this.MoveBy(1);
    };
    var BookmarkStates = rtl.createSet($mod.TDataSetState.dsBrowse,$mod.TDataSetState.dsEdit,$mod.TDataSetState.dsInsert);
    this.BookmarkAvailable = function () {
      var Result = false;
      Result = ((!this.IsEmpty() && !this.FIsUniDirectional) && (this.FState in BookmarkStates)) && (this.GetBookmarkFlag(new $mod.TDataRecord(this.ActiveBuffer())) === $mod.TBookmarkFlag.bfCurrent);
      return Result;
    };
    this.CalculateFields = function (Buffer) {
      var i = 0;
      var OldState = 0;
      this.FCalcBuffer = new $mod.TDataRecord(Buffer.get());
      if (this.FState !== $mod.TDataSetState.dsInternalCalc) {
        OldState = this.FState;
        this.FState = $mod.TDataSetState.dsCalcFields;
        try {
          this.ClearCalcFields({p: this, get: function () {
              return this.p.FCalcBuffer;
            }, set: function (v) {
              this.p.FCalcBuffer = v;
            }});
          if (!this.FIsUniDirectional) for (var $l1 = 0, $end2 = this.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
            i = $l1;
            if (this.FFieldList.GetField(i).FFieldKind === $mod.TFieldKind.fkLookup) this.FFieldList.GetField(i).CalcLookupValue();
          };
        } finally {
          this.DoOnCalcFields();
          this.FState = OldState;
        };
      };
    };
    this.CheckActive = function () {
      if (!this.GetActive()) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SInactiveDataset"),this);
    };
    this.CheckInactive = function () {
      if (this.GetActive()) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SActiveDataset"),this);
    };
    this.CheckBiDirectional = function () {
      if (this.FIsUniDirectional) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SUniDirectional"),this);
    };
    this.Loaded = function () {
      pas.Classes.TComponent.Loaded.apply(this,arguments);
      try {
        if (this.FOpenAfterRead) this.SetActive(true);
      } catch ($e) {
        if (pas.SysUtils.Exception.isPrototypeOf($e)) {
          var E = $e;
          if (pas.Classes.TComponentStateItem.csDesigning in this.FComponentState) this.InternalHandleException(E);
        } else {
          throw $e;
        }
      };
    };
    this.ClearBuffers = function () {
      this.FRecordCount = 0;
      this.FActiveRecord = 0;
      this.FCurrentRecord = -1;
      this.FBOF = true;
      this.FEOF = true;
    };
    this.ClearCalcFields = function (Buffer) {
    };
    this.CloseBlob = function (Field) {
    };
    this.CloseCursor = function () {
      this.ClearBuffers();
      this.SetBufListSize(0);
      this.FFieldList.ClearFieldDefs();
      this.InternalClose();
      this.FInternalOpenComplete = false;
    };
    this.CreateFields = function () {
      var I = 0;
      for (var $l1 = 0, $end2 = this.FFieldDefs.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        var $with3 = this.FFieldDefs.GetItem$1(I);
        if ($with3.FDataType !== $mod.TFieldType.ftUnknown) {
          $with3.CreateField(this);
        };
      };
    };
    this.DataEvent = function (Event, Info) {
      var Self = this;
      function HandleFieldChange(aField) {
        if (aField.FFieldKind in rtl.createSet($mod.TFieldKind.fkData,$mod.TFieldKind.fkInternalCalc)) Self.SetModified(true);
        if (Self.FState !== $mod.TDataSetState.dsSetKey) {
          if (aField.FFieldKind === $mod.TFieldKind.fkData) {
            if (Self.FInternalCalcFields) {
              Self.RefreshInternalCalcFields({a: Self.FActiveRecord, p: Self.FBuffers, get: function () {
                  return this.p[this.a];
                }, set: function (v) {
                  this.p[this.a] = v;
                }})}
             else if (Self.FAutoCalcFields && (Self.FCalcFieldsSize !== 0)) Self.CalculateFields({a: Self.FActiveRecord, p: Self.FBuffers, get: function () {
                return this.p[this.a];
              }, set: function (v) {
                this.p[this.a] = v;
              }});
          };
          aField.Change();
        };
      };
      function HandleScrollOrChange() {
        if (Self.FState !== $mod.TDataSetState.dsInsert) Self.UpdateCursorPos();
      };
      var i = 0;
      var $tmp1 = Event;
      if ($tmp1 === $mod.TDataEvent.deFieldChange) {
        HandleFieldChange(rtl.getObject(Info))}
       else if (($tmp1 === $mod.TDataEvent.deDataSetChange) || ($tmp1 === $mod.TDataEvent.deDataSetScroll)) {
        HandleScrollOrChange()}
       else if ($tmp1 === $mod.TDataEvent.deLayoutChange) Self.FEnableControlsEvent = $mod.TDataEvent.deLayoutChange;
      if (!Self.ControlsDisabled() && (Self.FState !== $mod.TDataSetState.dsBlockRead)) {
        for (var $l2 = 0, $end3 = Self.FDataSources.FCount - 1; $l2 <= $end3; $l2++) {
          i = $l2;
          rtl.getObject(Self.FDataSources.Get(i)).ProcessEvent(Event,Info);
        };
      };
    };
    this.DestroyFields = function () {
      this.FFieldList.Clear();
    };
    this.DoAfterCancel = function () {
      if (this.FAfterCancel != null) this.FAfterCancel(this);
    };
    this.DoAfterClose = function () {
      if ((this.FAfterClose != null) && !(pas.Classes.TComponentStateItem.csDestroying in this.FComponentState)) this.FAfterClose(this);
    };
    this.DoAfterDelete = function () {
      if (this.FAfterDelete != null) this.FAfterDelete(this);
    };
    this.DoAfterEdit = function () {
      if (this.FAfterEdit != null) this.FAfterEdit(this);
    };
    this.DoAfterInsert = function () {
      if (this.FAfterInsert != null) this.FAfterInsert(this);
    };
    this.DoAfterOpen = function () {
      if (this.FAfterOpen != null) this.FAfterOpen(this);
    };
    this.DoAfterPost = function () {
      if (this.FAfterPost != null) this.FAfterPost(this);
    };
    this.DoAfterScroll = function () {
      if (this.FAfterScroll != null) this.FAfterScroll(this);
    };
    this.DoAfterRefresh = function () {
      if (this.FAfterRefresh != null) this.FAfterRefresh(this);
    };
    this.DoBeforeCancel = function () {
      if (this.FBeforeCancel != null) this.FBeforeCancel(this);
    };
    this.DoBeforeClose = function () {
      if ((this.FBeforeClose != null) && !(pas.Classes.TComponentStateItem.csDestroying in this.FComponentState)) this.FBeforeClose(this);
    };
    this.DoBeforeDelete = function () {
      if (this.FBeforeDelete != null) this.FBeforeDelete(this);
    };
    this.DoBeforeEdit = function () {
      if (this.FBeforeEdit != null) this.FBeforeEdit(this);
    };
    this.DoBeforeInsert = function () {
      if (this.FBeforeInsert != null) this.FBeforeInsert(this);
    };
    this.DoBeforeOpen = function () {
      if (this.FBeforeOpen != null) this.FBeforeOpen(this);
    };
    this.DoBeforePost = function () {
      if (this.FBeforePost != null) this.FBeforePost(this);
    };
    this.DoBeforeScroll = function () {
      if (this.FBeforeScroll != null) this.FBeforeScroll(this);
    };
    this.DoBeforeRefresh = function () {
      if (this.FBeforeRefresh != null) this.FBeforeRefresh(this);
    };
    this.DoOnCalcFields = function () {
      if (this.FOnCalcFields != null) this.FOnCalcFields(this);
    };
    this.DoOnNewRecord = function () {
      if (this.FOnNewRecord != null) this.FOnNewRecord(this);
    };
    this.DoBeforeLoad = function () {
      if (this.FBeforeLoad != null) this.FBeforeLoad(this);
    };
    this.DoAfterLoad = function () {
      if (this.FAfterLoad != null) this.FAfterLoad(this);
    };
    this.DoBeforeApplyUpdates = function () {
      if (this.FBeforeApplyUpdates != null) this.FBeforeApplyUpdates(this);
    };
    this.DoAfterApplyUpdates = function () {
      if (this.FAfterApplyUpdates != null) this.FAfterApplyUpdates(this);
    };
    this.FieldByNumber = function (FieldNo) {
      var Result = null;
      Result = this.FFieldList.FieldByNumber(FieldNo);
      return Result;
    };
    this.FindRecord = function (Restart, GoForward) {
      var Result = false;
      Result = false;
      return Result;
    };
    this.GetBookmarkStr = function () {
      var Result = "";
      var B = new $mod.TBookmark();
      Result = "";
      if (this.BookmarkAvailable()) {
        this.GetBookmarkData(new $mod.TDataRecord(this.ActiveBuffer()),{get: function () {
            return B;
          }, set: function (v) {
            B = v;
          }});
        Result = JSON.stringify(new $mod.TBookmark(B));
      };
      return Result;
    };
    this.GetCalcFields = function (Buffer) {
      if ((this.FCalcFieldsSize > 0) || this.FInternalCalcFields) this.CalculateFields(Buffer);
    };
    this.GetCanModify = function () {
      var Result = false;
      Result = !this.FIsUniDirectional;
      return Result;
    };
    this.GetChildren = function (Proc, Root) {
      var I = 0;
      var Field = null;
      for (var $l1 = 0, $end2 = this.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        Field = this.FFieldList.GetField(I);
        if (Field.FOwner === Root) Proc(Field);
      };
    };
    this.GetFieldClass = function (FieldType) {
      var Result = null;
      Result = $mod.DefaultFieldClasses[FieldType];
      return Result;
    };
    this.GetfieldCount = function () {
      var Result = 0;
      Result = this.FFieldList.GetCount();
      return Result;
    };
    this.GetFieldValues = function (FieldName) {
      var Result = undefined;
      var i = 0;
      var FieldList = null;
      var A = [];
      FieldList = pas.Classes.TList.$create("Create$1");
      try {
        this.GetFieldList(FieldList,FieldName);
        if (FieldList.GetCount() > 1) {
          A = rtl.arraySetLength(A,undefined,FieldList.GetCount());
          for (var $l1 = 0, $end2 = FieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
            i = $l1;
            A[i] = rtl.getObject(FieldList.Get(i)).GetAsJSValue();
          };
          Result = A;
        } else Result = this.FieldByName(FieldName).GetAsJSValue();
      } finally {
        FieldList = rtl.freeLoc(FieldList);
      };
      return Result;
    };
    this.GetIsIndexField = function (Field) {
      var Result = false;
      Result = false;
      return Result;
    };
    this.GetIndexDefs = function (IndexDefs, IndexTypes) {
      var Result = null;
      var i = 0;
      var f = 0;
      var IndexFields = null;
      IndexDefs.Update$1();
      Result = $mod.TIndexDefs.$create("Create$4",[this]);
      Result.Assign(IndexDefs);
      i = 0;
      IndexFields = pas.Classes.TStringList.$create("Create$1");
      while (i < Result.GetCount()) {
        if (!(rtl.eqSet(IndexTypes,{}) && rtl.eqSet(Result.GetItem$1(i).FOptions,{})) && rtl.eqSet(rtl.intersectSet(IndexTypes,Result.GetItem$1(i).FOptions),{})) {
          Result.Delete(i);
          i -= 1;
        } else {
          for (var $l1 = 0, $end2 = IndexFields.GetCount() - 1; $l1 <= $end2; $l1++) {
            f = $l1;
            if (this.FindField(IndexFields.Get(f)) === null) {
              Result.Delete(i);
              i -= 1;
              break;
            };
          };
        };
        i += 1;
      };
      IndexFields = rtl.freeLoc(IndexFields);
      return Result;
    };
    this.GetNextRecords = function () {
      var Result = 0;
      Result = 0;
      while ((this.FRecordCount < this.FBufferCount) && this.GetNextRecord()) Result += 1;
      return Result;
    };
    this.GetNextRecord = function () {
      var Result = false;
      var T = new $mod.TDataRecord();
      if (this.FRecordCount > 0) this.SetCurrentRecord(this.FRecordCount - 1);
      Result = this.GetRecord({a: this.FBufferCount, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},$mod.TGetMode.gmNext,true) === $mod.TGetResult.grOK;
      if (Result) {
        if (this.FRecordCount === 0) this.ActivateBuffers();
        if (this.FRecordCount === this.FBufferCount) {
          this.ShiftBuffersBackward()}
         else {
          this.FRecordCount += 1;
          this.FCurrentRecord = this.FRecordCount - 1;
          T = new $mod.TDataRecord(this.FBuffers[this.FCurrentRecord]);
          this.FBuffers[this.FCurrentRecord] = new $mod.TDataRecord(this.FBuffers[this.FBufferCount]);
          this.FBuffers[this.FBufferCount] = new $mod.TDataRecord(T);
        };
      } else this.CursorPosChanged();
      return Result;
    };
    this.GetPriorRecords = function () {
      var Result = 0;
      Result = 0;
      while ((this.FRecordCount < this.FBufferCount) && this.GetPriorRecord()) Result += 1;
      return Result;
    };
    this.GetPriorRecord = function () {
      var Result = false;
      this.CheckBiDirectional();
      if (this.FRecordCount > 0) this.SetCurrentRecord(0);
      Result = this.GetRecord({a: this.FBufferCount, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},$mod.TGetMode.gmPrior,true) === $mod.TGetResult.grOK;
      if (Result) {
        if (this.FRecordCount === 0) this.ActivateBuffers();
        this.ShiftBuffersForward();
        if (this.FRecordCount < this.FBufferCount) this.FRecordCount += 1;
      } else this.CursorPosChanged();
      return Result;
    };
    this.GetRecordCount = function () {
      var Result = 0;
      Result = -1;
      return Result;
    };
    this.GetRecNo = function () {
      var Result = 0;
      Result = -1;
      return Result;
    };
    this.InitFieldDefs = function () {
      if (this.IsCursorOpen()) {
        this.InternalInitFieldDefs()}
       else {
        try {
          this.OpenCursor(true);
        } finally {
          this.CloseCursor();
        };
      };
    };
    this.InitFieldDefsFromfields = function () {
      var i = 0;
      if (this.FFieldDefs.GetCount() === 0) {
        this.FFieldDefs.BeginUpdate();
        try {
          for (var $l1 = 0, $end2 = this.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
            i = $l1;
            var $with3 = this.FFieldList.GetField(i);
            if (!($with3.FFieldKind in rtl.createSet($mod.TFieldKind.fkCalculated,$mod.TFieldKind.fkLookup))) {
              $with3.FFieldDef = this.FFieldDefs.$class.FieldDefClass().$create("Create$3",[this.FFieldDefs,$with3.FFieldName,$with3.FDataType,$with3.FSize,$with3.FRequired,this.FFieldDefs.GetCount() + 1]);
              var $with4 = $with3.FFieldDef;
              if ($with4.FRequired) $with4.SetAttributes(rtl.unionSet($with4.FAttributes,rtl.createSet($mod.TFieldAttribute.faRequired)));
              if ($with3.FReadOnly) $with4.SetAttributes(rtl.unionSet($with4.FAttributes,rtl.createSet($mod.TFieldAttribute.faReadonly)));
            };
          };
        } finally {
          this.FFieldDefs.EndUpdate();
        };
      };
    };
    this.InitRecord = function (Buffer) {
      this.InternalInitRecord(Buffer);
      this.ClearCalcFields(Buffer);
    };
    this.InternalCancel = function () {
    };
    this.InternalEdit = function () {
    };
    this.InternalInsert = function () {
    };
    this.InternalRefresh = function () {
    };
    this.OpenCursor = function (InfoQuery) {
      if (InfoQuery) {
        this.InternalInitFieldDefs()}
       else if (this.FState !== $mod.TDataSetState.dsOpening) this.DoInternalOpen();
    };
    this.OpenCursorcomplete = function () {
      try {
        if (this.FState === $mod.TDataSetState.dsOpening) this.DoInternalOpen();
      } finally {
        if (this.FInternalOpenComplete) {
          this.SetState($mod.TDataSetState.dsBrowse);
          this.DoAfterOpen();
          if (!this.IsEmpty()) this.DoAfterScroll();
        } else {
          this.SetState($mod.TDataSetState.dsInactive);
          this.CloseCursor();
        };
      };
    };
    this.RefreshInternalCalcFields = function (Buffer) {
    };
    this.RestoreState = function (Value) {
      this.FState = Value;
      this.FDisableControlsCount -= 1;
    };
    this.SetActive = function (Value) {
      if (Value && (this.FState === $mod.TDataSetState.dsInactive)) {
        if (pas.Classes.TComponentStateItem.csLoading in this.FComponentState) {
          this.FOpenAfterRead = true;
          return;
        } else {
          this.DoBeforeOpen();
          this.FEnableControlsEvent = $mod.TDataEvent.deLayoutChange;
          this.FInternalCalcFields = false;
          try {
            this.FDefaultFields = this.GetfieldCount() === 0;
            this.OpenCursor(false);
          } finally {
            if (this.FState !== $mod.TDataSetState.dsOpening) this.OpenCursorcomplete();
          };
        };
        this.FModified = false;
      } else if (!Value && (this.FState !== $mod.TDataSetState.dsInactive)) {
        this.DoBeforeClose();
        this.SetState($mod.TDataSetState.dsInactive);
        this.FDataRequestID = 0;
        this.DoneChangeList();
        this.CloseCursor();
        this.DoAfterClose();
        this.FModified = false;
      };
    };
    this.SetBookmarkStr = function (Value) {
      var O = null;
      var B = new $mod.TBookmark();
      O = JSON.parse(Value);
      B.Flag = O["flag"];
      B.Data = O["Index"];
      this.GotoBookmark(B);
    };
    this.SetBufListSize = function (Value) {
      var I = 0;
      if (Value < 0) Value = 0;
      if (Value === this.FBufferCount) return;
      if (Value > this.GetBufferCount()) {
        for (var $l1 = this.FBufferCount, $end2 = Value; $l1 <= $end2; $l1++) {
          I = $l1;
          this.FBuffers[I] = new $mod.TDataRecord(this.AllocRecordBuffer());
        };
      } else if (Value < this.GetBufferCount()) if ((Value >= 0) && (this.FActiveRecord > (Value - 1))) {
        for (var $l3 = 0, $end4 = this.FActiveRecord - Value; $l3 <= $end4; $l3++) {
          I = $l3;
          this.ShiftBuffersBackward();
        };
        this.FActiveRecord = Value - 1;
      };
      this.FBuffers = rtl.arraySetLength(this.FBuffers,$mod.TDataRecord,Value + 1);
      this.FBufferCount = Value;
      if (this.FRecordCount > this.FBufferCount) this.FRecordCount = this.FBufferCount;
    };
    this.SetChildOrder = function (Child, Order) {
      var Field = null;
      Field = rtl.as(Child,$mod.TField);
      if (this.FFieldList.IndexOf(Field) >= 0) Field.SetIndex(Order);
    };
    this.SetCurrentRecord = function (Index) {
      if (this.FCurrentRecord !== Index) {
        if (!this.FIsUniDirectional) {
          var $tmp1 = this.GetBookmarkFlag(new $mod.TDataRecord(this.FBuffers[Index]));
          if ($tmp1 === $mod.TBookmarkFlag.bfCurrent) {
            this.InternalSetToRecord(new $mod.TDataRecord(this.FBuffers[Index]))}
           else if ($tmp1 === $mod.TBookmarkFlag.bfBOF) {
            this.InternalFirst()}
           else if ($tmp1 === $mod.TBookmarkFlag.bfEOF) this.InternalLast();
        };
        this.FCurrentRecord = Index;
      };
    };
    this.SetDefaultFields = function (Value) {
      this.FDefaultFields = Value;
    };
    this.SetFiltered = function (Value) {
      if (Value) this.CheckBiDirectional();
      this.FFiltered = Value;
    };
    this.SetFilterOptions = function (Value) {
      this.CheckBiDirectional();
      this.FFilterOptions = rtl.refSet(Value);
    };
    this.SetFilterText = function (Value) {
      this.FFilterText = Value;
    };
    this.SetFieldValues = function (FieldName, Value) {
      var i = 0;
      var FieldList = null;
      var A = [];
      if (rtl.isArray(Value)) {
        FieldList = pas.Classes.TList.$create("Create$1");
        try {
          this.GetFieldList(FieldList,FieldName);
          A = Value;
          if ((FieldList.GetCount() === 1) && (rtl.length(A) > 0)) {
            this.FieldByName(FieldName).SetAsJSValue(Value)}
           else for (var $l1 = 0, $end2 = FieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
            i = $l1;
            rtl.getObject(FieldList.Get(i)).SetAsJSValue(A[i]);
          };
        } finally {
          FieldList = rtl.freeLoc(FieldList);
        };
      } else this.FieldByName(FieldName).SetAsJSValue(Value);
    };
    this.SetFound = function (Value) {
      this.FFound = Value;
    };
    this.SetModified = function (Value) {
      this.FModified = Value;
    };
    this.SetName = function (NewName) {
      var Self = this;
      function CheckName(FieldName) {
        var Result = "";
        var i = 0;
        var j = 0;
        Result = FieldName;
        i = 0;
        j = 0;
        while (i < Self.FFieldList.GetCount()) {
          if (Result === Self.FFieldList.GetField(i).FFieldName) {
            j += 1;
            Result = FieldName + pas.SysUtils.IntToStr(j);
          } else i += 1;
        };
        return Result;
      };
      var i = 0;
      var nm = "";
      var old = "";
      if (Self.FName === NewName) return;
      old = Self.FName;
      pas.Classes.TComponent.SetName.call(Self,NewName);
      if (pas.Classes.TComponentStateItem.csDesigning in Self.FComponentState) for (var $l1 = 0, $end2 = Self.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        nm = old + Self.FFieldList.GetField(i).FFieldName;
        if (pas.System.Copy(Self.FFieldList.GetField(i).FName,1,nm.length) === nm) Self.FFieldList.GetField(i).SetName(CheckName(NewName + Self.FFieldList.GetField(i).FFieldName));
      };
    };
    this.SetOnFilterRecord = function (Value) {
      this.CheckBiDirectional();
      this.FOnFilterRecord = Value;
    };
    this.SetRecNo = function (Value) {
    };
    this.SetState = function (Value) {
      if (Value !== this.FState) {
        this.FState = Value;
        if (Value === $mod.TDataSetState.dsBrowse) this.FModified = false;
        this.DataEvent($mod.TDataEvent.deUpdateState,0);
      };
    };
    this.SetTempState = function (Value) {
      var Result = 0;
      Result = this.FState;
      this.FState = Value;
      this.FDisableControlsCount += 1;
      return Result;
    };
    this.TempBuffer = function () {
      var Result = new $mod.TDataRecord();
      Result = new $mod.TDataRecord(this.FBuffers[this.FRecordCount]);
      return Result;
    };
    this.UpdateIndexDefs = function () {
    };
    this.AllocRecordBuffer = function () {
      var Result = new $mod.TDataRecord();
      Result.data = null;
      Result.state = $mod.TRecordState.rsNew;
      return Result;
    };
    this.FreeRecordBuffer = function (Buffer) {
    };
    this.GetBookmarkData = function (Buffer, Data) {
    };
    this.GetBookmarkFlag = function (Buffer) {
      var Result = 0;
      Result = $mod.TBookmarkFlag.bfCurrent;
      return Result;
    };
    this.GetDataSource = function () {
      var Result = null;
      Result = null;
      return Result;
    };
    this.GetRecordSize = function () {
      var Result = 0;
      Result = 0;
      return Result;
    };
    this.InternalAddRecord = function (Buffer, AAppend) {
    };
    this.InternalDelete = function () {
    };
    this.InternalFirst = function () {
    };
    this.InternalGotoBookmark = function (ABookmark) {
    };
    this.InternalHandleException = function (E) {
      pas.SysUtils.ShowException(E,null);
    };
    this.InternalInitRecord = function (Buffer) {
    };
    this.InternalLast = function () {
    };
    this.InternalPost = function () {
      var Self = this;
      function CheckRequiredFields() {
        var I = 0;
        for (var $l1 = 0, $end2 = Self.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
          I = $l1;
          var $with3 = Self.FFieldList.GetField(I);
          if (((($with3.FRequired && !$with3.FReadOnly) && ($with3.FFieldKind === $mod.TFieldKind.fkData)) && !($with3.FDataType === $mod.TFieldType.ftAutoInc)) && $with3.GetIsNull()) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SNeedField"),[$with3.GetDisplayName()],Self);
        };
      };
      CheckRequiredFields();
    };
    this.InternalSetToRecord = function (Buffer) {
    };
    this.SetBookmarkFlag = function (Buffer, Value) {
    };
    this.SetBookmarkData = function (Buffer, Data) {
    };
    this.SetUniDirectional = function (Value) {
      this.FIsUniDirectional = Value;
    };
    this.Notification = function (AComponent, Operation) {
      pas.Classes.TComponent.Notification.call(this,AComponent,Operation);
      if ((Operation === pas.Classes.TOperation.opRemove) && (AComponent === this.FDataProxy)) this.FDataProxy = null;
    };
    this.GetFieldData = function (Field) {
      var Result = undefined;
      Result = this.GetFieldData$1(Field,new $mod.TDataRecord(this.ActiveBuffer()));
      return Result;
    };
    this.SetFieldData = function (Field, AValue) {
      this.SetFieldData$1(Field,{a: this.FActiveRecord, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},AValue);
    };
    this.GetFieldData$1 = function (Field, Buffer) {
      var Result = undefined;
      Result = rtl.getObject(Buffer.data)[Field.FFieldName];
      return Result;
    };
    this.SetFieldData$1 = function (Field, Buffer, AValue) {
      rtl.getObject(Buffer.get().data)[Field.FFieldName] = AValue;
    };
    this.FieldDefsClass = function () {
      var Result = null;
      Result = $mod.TFieldDefs;
      return Result;
    };
    this.FieldsClass = function () {
      var Result = null;
      Result = $mod.TFields;
      return Result;
    };
    this.Create$1 = function (AOwner) {
      pas.Classes.TComponent.Create$1.call(this,AOwner);
      this.FFieldDefs = this.$class.FieldDefsClass().$create("Create$4",[this]);
      this.FFieldList = this.$class.FieldsClass().$create("Create$1",[this]);
      this.FDataSources = pas.Classes.TFPList.$create("Create");
      this.FConstraints = $mod.TCheckConstraints.$create("Create$2",[this]);
      this.FBuffers = rtl.arraySetLength(this.FBuffers,$mod.TDataRecord,1);
      this.FActiveRecord = 0;
      this.FEOF = true;
      this.FBOF = true;
      this.FIsUniDirectional = false;
      this.FAutoCalcFields = true;
      this.FDataRequestID = 0;
    };
    this.Destroy = function () {
      var i = 0;
      this.SetActive(false);
      rtl.free(this,"FFieldDefs");
      rtl.free(this,"FFieldList");
      var $with1 = this.FDataSources;
      while ($with1.FCount > 0) rtl.getObject($with1.Get($with1.FCount - 1)).SetDataSet(null);
      $with1.$destroy("Destroy");
      for (var $l2 = 0, $end3 = this.FBufferCount; $l2 <= $end3; $l2++) {
        i = $l2;
        this.FreeRecordBuffer({a: i, p: this.FBuffers, get: function () {
            return this.p[this.a];
          }, set: function (v) {
            this.p[this.a] = v;
          }});
      };
      rtl.free(this,"FConstraints");
      this.FBuffers = rtl.arraySetLength(this.FBuffers,$mod.TDataRecord,1);
      pas.Classes.TComponent.Destroy.call(this);
    };
    this.ActiveBuffer = function () {
      var Result = new $mod.TDataRecord();
      Result = new $mod.TDataRecord(this.FBuffers[this.FActiveRecord]);
      return Result;
    };
    this.Append = function () {
      this.DoInsertAppend(true);
    };
    this.AppendRecord = function (Values) {
      this.DoInsertAppendRecord(Values,true);
    };
    this.BookmarkValid = function (ABookmark) {
      var Result = false;
      Result = false;
      return Result;
    };
    this.ConvertToDateTime = function (aValue, ARaiseException) {
      var Result = 0.0;
      Result = this.$class.DefaultConvertToDateTime(aValue,ARaiseException);
      return Result;
    };
    this.ConvertDateTimeToNative = function (aValue) {
      var Result = undefined;
      Result = this.$class.DefaultConvertDateTimeToNative(aValue);
      return Result;
    };
    this.DefaultConvertToDateTime = function (aValue, ARaiseException) {
      var Result = 0.0;
      Result = 0;
      if (rtl.isString(aValue)) {
        if (!pas.DateUtils.TryRFC3339ToDateTime("" + aValue,{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }})) throw pas.SysUtils.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.DBConst,"SErrInvalidDateTime"),["" + aValue]]);
      } else if (rtl.isNumber(aValue)) Result = rtl.getNumber(aValue);
      return Result;
    };
    this.DefaultConvertDateTimeToNative = function (aValue) {
      var Result = undefined;
      Result = pas.DateUtils.DateTimeToRFC3339(aValue);
      return Result;
    };
    this.BlobDataToBytes = function (aValue) {
      var Result = [];
      Result = this.$class.DefaultBlobDataToBytes(aValue);
      return Result;
    };
    this.DefaultBlobDataToBytes = function (aValue) {
      var Result = [];
      var S = "";
      var I = 0;
      var J = 0;
      var L = 0;
      Result = rtl.arraySetLength(Result,0,0);
      if (rtl.isString(aValue)) {
        S = "" + aValue;
        L = S.length;
        Result = rtl.arraySetLength(Result,0,Math.floor((L + 1) / 2));
        I = 1;
        J = 0;
        while (I < L) {
          Result[J] = pas.SysUtils.StrToInt("$" + pas.System.Copy(S,I,2));
          I += 2;
          J += 1;
        };
      };
      return Result;
    };
    this.BytesToBlobData = function (aValue) {
      var Result = undefined;
      Result = this.$class.DefaultBytesToBlobData(aValue);
      return Result;
    };
    this.DefaultBytesToBlobData = function (aValue) {
      var Result = undefined;
      var S = "";
      var I = 0;
      if (rtl.length(aValue) === 0) {
        Result = null}
       else {
        S = "";
        for (var $l1 = 0, $end2 = rtl.length(aValue); $l1 <= $end2; $l1++) {
          I = $l1;
          S.concat(pas.SysUtils.IntToHex(aValue[I],2));
        };
      };
      return Result;
    };
    this.Cancel = function () {
      if (this.FState in rtl.createSet($mod.TDataSetState.dsEdit,$mod.TDataSetState.dsInsert)) {
        this.DataEvent($mod.TDataEvent.deCheckBrowseMode,0);
        this.DoBeforeCancel();
        this.UpdateCursorPos();
        this.InternalCancel();
        if ((this.FState === $mod.TDataSetState.dsInsert) && (this.FRecordCount === 1)) {
          this.FEOF = true;
          this.FBOF = true;
          this.FRecordCount = 0;
          this.InitRecord({a: this.FActiveRecord, p: this.FBuffers, get: function () {
              return this.p[this.a];
            }, set: function (v) {
              this.p[this.a] = v;
            }});
          this.SetState($mod.TDataSetState.dsBrowse);
          this.DataEvent($mod.TDataEvent.deDataSetChange,0);
        } else {
          this.SetState($mod.TDataSetState.dsBrowse);
          this.SetCurrentRecord(this.FActiveRecord);
          this.Resync({});
        };
        this.DoAfterCancel();
      };
    };
    this.CheckBrowseMode = function () {
      this.CheckActive();
      this.DataEvent($mod.TDataEvent.deCheckBrowseMode,0);
      var $tmp1 = this.FState;
      if (($tmp1 === $mod.TDataSetState.dsEdit) || ($tmp1 === $mod.TDataSetState.dsInsert)) {
        this.UpdateRecord();
        if (this.FModified) {
          this.Post()}
         else this.Cancel();
      } else if ($tmp1 === $mod.TDataSetState.dsSetKey) this.Post();
    };
    this.ClearFields = function () {
      this.DataEvent($mod.TDataEvent.deCheckBrowseMode,0);
      this.InternalInitRecord({a: this.FActiveRecord, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }});
      if (this.FState !== $mod.TDataSetState.dsSetKey) this.GetCalcFields({a: this.FActiveRecord, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }});
      this.DataEvent($mod.TDataEvent.deRecordChange,0);
    };
    this.Close = function () {
      this.SetActive(false);
    };
    this.ApplyUpdates = function () {
      this.DoBeforeApplyUpdates();
      this.DoApplyUpdates();
    };
    this.ControlsDisabled = function () {
      var Result = false;
      Result = this.FDisableControlsCount > 0;
      return Result;
    };
    this.CompareBookmarks = function (Bookmark1, Bookmark2) {
      var Result = 0;
      Result = 0;
      return Result;
    };
    this.CursorPosChanged = function () {
      this.FCurrentRecord = -1;
    };
    this.Delete = function () {
      var R = null;
      if (!this.GetCanModify()) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SDatasetReadOnly"),this);
      if (this.IsEmpty()) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SDatasetEmpty"),this);
      if (this.FState in rtl.createSet($mod.TDataSetState.dsInsert)) {
        this.Cancel();
      } else {
        this.DataEvent($mod.TDataEvent.deCheckBrowseMode,0);
        this.DoBeforeDelete();
        this.DoBeforeScroll();
        R = this.AddToChangeList($mod.TUpdateStatus.usDeleted);
        if (!this.TryDoing(rtl.createCallback(this,"InternalDelete"),this.FOnDeleteError)) {
          if (R != null) this.RemoveFromChangeList(R);
          return;
        };
        this.SetState($mod.TDataSetState.dsBrowse);
        this.SetCurrentRecord(this.FActiveRecord);
        this.Resync({});
        this.DoAfterDelete();
        this.DoAfterScroll();
      };
    };
    this.DisableControls = function () {
      if (this.FDisableControlsCount === 0) {
        this.FDisableControlsState = this.FState;
        this.FEnableControlsEvent = $mod.TDataEvent.deDataSetChange;
      };
      this.FDisableControlsCount += 1;
    };
    this.Edit = function () {
      if (this.FState in rtl.createSet($mod.TDataSetState.dsEdit,$mod.TDataSetState.dsInsert)) return;
      this.CheckBrowseMode();
      if (!this.GetCanModify()) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SDatasetReadOnly"),this);
      if (this.FRecordCount === 0) {
        this.Append();
        return;
      };
      this.DoBeforeEdit();
      if (!this.TryDoing(rtl.createCallback(this,"InternalEdit"),this.FOnEditError)) return;
      this.GetCalcFields({a: this.FActiveRecord, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }});
      this.SetState($mod.TDataSetState.dsEdit);
      this.DataEvent($mod.TDataEvent.deRecordChange,0);
      this.DoAfterEdit();
    };
    this.EnableControls = function () {
      if (this.FDisableControlsCount > 0) this.FDisableControlsCount -= 1;
      if (this.FDisableControlsCount === 0) {
        if (this.FState !== this.FDisableControlsState) this.DataEvent($mod.TDataEvent.deUpdateState,0);
        if ((this.FState !== $mod.TDataSetState.dsInactive) && (this.FDisableControlsState !== $mod.TDataSetState.dsInactive)) this.DataEvent(this.FEnableControlsEvent,0);
      };
    };
    this.FieldByName = function (FieldName) {
      var Result = null;
      Result = this.FindField(FieldName);
      if (Result === null) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SFieldNotFound"),[FieldName],this);
      return Result;
    };
    this.FindField = function (FieldName) {
      var Result = null;
      Result = this.FFieldList.FindField(FieldName);
      return Result;
    };
    this.FindFirst = function () {
      var Result = false;
      Result = false;
      return Result;
    };
    this.FindLast = function () {
      var Result = false;
      Result = false;
      return Result;
    };
    this.FindNext = function () {
      var Result = false;
      Result = false;
      return Result;
    };
    this.FindPrior = function () {
      var Result = false;
      Result = false;
      return Result;
    };
    this.First = function () {
      this.CheckBrowseMode();
      this.DoBeforeScroll();
      if (!this.FIsUniDirectional) {
        this.ClearBuffers()}
       else if (!this.FBOF) {
        this.SetActive(false);
        this.SetActive(true);
      };
      try {
        this.InternalFirst();
        if (!this.FIsUniDirectional) this.GetNextRecords();
      } finally {
        this.FBOF = true;
        this.DataEvent($mod.TDataEvent.deDataSetChange,0);
        this.DoAfterScroll();
      };
    };
    this.FreeBookmark = function (ABookmark) {
    };
    this.GetBookmark = function () {
      var Result = new $mod.TBookmark();
      if (this.BookmarkAvailable()) {
        this.GetBookmarkData(new $mod.TDataRecord(this.ActiveBuffer()),{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }})}
       else Result.Data = null;
      return Result;
    };
    this.GetCurrentRecord = function (Buffer) {
      var Result = false;
      Result = false;
      return Result;
    };
    this.GetFieldList = function (List, FieldNames) {
      var F = null;
      var N = "";
      var StrPos = 0;
      if ((FieldNames === "") || (List === null)) return;
      StrPos = 1;
      do {
        N = $mod.ExtractFieldName(FieldNames,{get: function () {
            return StrPos;
          }, set: function (v) {
            StrPos = v;
          }});
        F = this.FieldByName(N);
        List.Add(F);
      } while (!(StrPos > FieldNames.length));
    };
    this.GetFieldNames = function (List) {
      this.FFieldList.GetFieldNames(List);
    };
    this.GotoBookmark = function (ABookmark) {
      if (pas.System.Assigned(ABookmark)) {
        this.CheckBrowseMode();
        this.DoBeforeScroll();
        this.InternalGotoBookmark(new $mod.TBookmark(ABookmark));
        this.Resync(rtl.createSet($mod.TResyncMode$a.rmExact,$mod.TResyncMode$a.rmCenter));
        this.DoAfterScroll();
      };
    };
    this.Insert$1 = function () {
      this.DoInsertAppend(false);
    };
    this.InsertRecord = function (Values) {
      this.DoInsertAppendRecord(Values,false);
    };
    this.IsEmpty = function () {
      var Result = false;
      Result = (this.FBOF && this.FEOF) && !(this.FState === $mod.TDataSetState.dsInsert);
      return Result;
    };
    this.IsLinkedTo = function (ADataSource) {
      var Result = false;
      if ((ADataSource === null) || (ADataSource.FDataSet === null)) {
        Result = false;
      } else if (ADataSource.FDataSet === this) {
        Result = true;
      } else {
        Result = ADataSource.FDataSet.IsLinkedTo(ADataSource.FDataSet.GetDataSource());
      };
      return Result;
    };
    this.IsSequenced = function () {
      var Result = false;
      Result = true;
      return Result;
    };
    this.Last = function () {
      this.CheckBiDirectional();
      this.CheckBrowseMode();
      this.DoBeforeScroll();
      this.ClearBuffers();
      try {
        this.InternalLast();
        this.GetPriorRecords();
        if (this.FRecordCount > 0) this.FActiveRecord = this.FRecordCount - 1;
      } finally {
        this.FEOF = true;
        this.DataEvent($mod.TDataEvent.deDataSetChange,0);
        this.DoAfterScroll();
      };
    };
    this.Load = function (aOptions, aAfterLoad) {
      var Result = false;
      if ($mod.TLoadOption.loAtEOF in aOptions) $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SatEOFInternalOnly"),this);
      Result = this.DoLoad(rtl.refSet(aOptions),aAfterLoad);
      return Result;
    };
    this.Locate = function (KeyFields, KeyValues, Options) {
      var Result = false;
      this.CheckBiDirectional();
      Result = false;
      return Result;
    };
    this.Lookup = function (KeyFields, KeyValues, ResultFields) {
      var Result = undefined;
      this.CheckBiDirectional();
      Result = null;
      return Result;
    };
    this.MoveBy = function (Distance) {
      var Self = this;
      var Result = 0;
      var TheResult = 0;
      function ScrollForward() {
        var Result = 0;
        Result = 0;
        Self.FBOF = false;
        while ((Distance > 0) && !Self.FEOF) {
          if (Self.FActiveRecord < (Self.FRecordCount - 1)) {
            Self.FActiveRecord += 1;
            Distance -= 1;
            TheResult += 1;
          } else {
            if (Self.GetNextRecord()) {
              Distance -= 1;
              Result -= 1;
              TheResult += 1;
            } else {
              Self.FEOF = true;
              Self.DoLoad(rtl.createSet($mod.TLoadOption.loNoOpen,$mod.TLoadOption.loAtEOF),null);
            };
          };
        };
        return Result;
      };
      function ScrollBackward() {
        var Result = 0;
        Self.CheckBiDirectional();
        Result = 0;
        Self.FEOF = false;
        while ((Distance < 0) && !Self.FBOF) {
          if (Self.FActiveRecord > 0) {
            Self.FActiveRecord -= 1;
            Distance += 1;
            TheResult -= 1;
          } else {
            if (Self.GetPriorRecord()) {
              Distance += 1;
              Result += 1;
              TheResult -= 1;
            } else Self.FBOF = true;
          };
        };
        return Result;
      };
      var Scrolled = 0;
      Self.CheckBrowseMode();
      Result = 0;
      TheResult = 0;
      Self.DoBeforeScroll();
      if (((Distance === 0) || ((Distance > 0) && Self.FEOF)) || ((Distance < 0) && Self.FBOF)) return Result;
      try {
        Scrolled = 0;
        if (Distance > 0) {
          Scrolled = ScrollForward()}
         else Scrolled = ScrollBackward();
      } finally {
        Self.DataEvent($mod.TDataEvent.deDataSetScroll,Scrolled);
        Self.DoAfterScroll();
        Result = TheResult;
      };
      return Result;
    };
    this.Next = function () {
      if (this.FBlockReadSize > 0) {
        this.BlockReadNext()}
       else this.MoveBy(1);
    };
    this.Open = function () {
      this.SetActive(true);
    };
    var UpdateStates = [$mod.TUpdateStatus.usModified,$mod.TUpdateStatus.usInserted];
    this.Post = function () {
      var R = null;
      var WasInsert = false;
      this.UpdateRecord();
      if (this.FState in rtl.createSet($mod.TDataSetState.dsEdit,$mod.TDataSetState.dsInsert)) {
        this.DataEvent($mod.TDataEvent.deCheckBrowseMode,0);
        this.DoBeforePost();
        WasInsert = this.FState === $mod.TDataSetState.dsInsert;
        if (!this.TryDoing(rtl.createCallback(this,"InternalPost"),this.FOnPostError)) return;
        this.CursorPosChanged();
        this.SetState($mod.TDataSetState.dsBrowse);
        this.Resync({});
        R = this.AddToChangeList(UpdateStates[+WasInsert]);
        if (R != null) R.FBookmark = new $mod.TBookmark(this.GetBookmark());
        this.DoAfterPost();
      } else if (this.FState !== $mod.TDataSetState.dsSetKey) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SNotEditing"),[this.FName],this);
    };
    this.Prior = function () {
      this.MoveBy(-1);
    };
    this.Refresh = function () {
      this.CheckBrowseMode();
      this.DoBeforeRefresh();
      this.UpdateCursorPos();
      this.InternalRefresh();
      this.Resync({});
      this.DoAfterRefresh();
    };
    this.Resync = function (Mode) {
      var i = 0;
      var count = 0;
      if (this.FIsUniDirectional) return;
      if (this.GetRecord({a: 0, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},$mod.TGetMode.gmCurrent,false) !== $mod.TGetResult.grOK) if ($mod.TResyncMode$a.rmExact in Mode) {
        $mod.DatabaseError$1(rtl.getResStr(pas.DBConst,"SNoSuchRecord"),this)}
       else if ((this.GetRecord({a: 0, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},$mod.TGetMode.gmNext,true) !== $mod.TGetResult.grOK) && (this.GetRecord({a: 0, p: this.FBuffers, get: function () {
          return this.p[this.a];
        }, set: function (v) {
          this.p[this.a] = v;
        }},$mod.TGetMode.gmPrior,true) !== $mod.TGetResult.grOK)) {
        this.ClearBuffers();
        this.InternalInitRecord({a: this.FActiveRecord, p: this.FBuffers, get: function () {
            return this.p[this.a];
          }, set: function (v) {
            this.p[this.a] = v;
          }});
        this.DataEvent($mod.TDataEvent.deDataSetChange,0);
        return;
      };
      this.FCurrentRecord = 0;
      this.FEOF = false;
      this.FBOF = false;
      if ($mod.TResyncMode$a.rmCenter in Mode) {
        count = Math.floor(this.FRecordCount / 2)}
       else count = this.FActiveRecord;
      i = 0;
      this.FRecordCount = 1;
      this.FActiveRecord = 0;
      while ((i < count) && this.GetPriorRecord()) i += 1;
      this.FActiveRecord = i;
      this.GetNextRecords();
      if (this.FRecordCount < this.FBufferCount) this.FActiveRecord = this.FActiveRecord + this.GetPriorRecords();
      this.DataEvent($mod.TDataEvent.deDataSetChange,0);
    };
    this.SetFields = function (Values) {
      var I = 0;
      for (var $l1 = 0, $end2 = rtl.length(Values) - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        this.FFieldList.GetField(I).AssignValue(Values[I]);
      };
    };
    this.UpdateCursorPos = function () {
      if (this.FRecordCount > 0) this.SetCurrentRecord(this.FActiveRecord);
    };
    this.UpdateRecord = function () {
      if (!(this.FState in $mod.dsEditModes)) $mod.DatabaseErrorFmt$1(rtl.getResStr(pas.DBConst,"SNotEditing"),[this.FName],this);
      this.DataEvent($mod.TDataEvent.deUpdateRecord,0);
    };
    this.GetPendingUpdates = function () {
      var Result = [];
      var L = null;
      var I = 0;
      L = $mod.TRecordUpdateDescriptorList.$create("Create");
      try {
        Result = rtl.arraySetLength(Result,$mod.TResolveInfo,this.GetRecordUpdates(L));
        for (var $l1 = 0, $end2 = L.FCount - 1; $l1 <= $end2; $l1++) {
          I = $l1;
          Result[I] = new $mod.TResolveInfo(this.RecordUpdateDescriptorToResolveInfo(L.GetUpdate(I)));
        };
      } finally {
        L = rtl.freeLoc(L);
      };
      return Result;
    };
    this.UpdateStatus = function () {
      var Result = 0;
      Result = $mod.TUpdateStatus.usUnmodified;
      return Result;
    };
  });
  rtl.createClass($mod,"TDataLink",pas.Classes.TPersistent,function () {
    this.$init = function () {
      pas.Classes.TPersistent.$init.call(this);
      this.FFirstRecord = 0;
      this.FBufferCount = 0;
      this.FActive = false;
      this.FDataSourceFixed = false;
      this.FEditing = false;
      this.FReadOnly = false;
      this.FUpdatingRecord = false;
      this.FVisualControl = false;
      this.FDataSource = null;
    };
    this.$final = function () {
      this.FDataSource = undefined;
      pas.Classes.TPersistent.$final.call(this);
    };
    this.CalcFirstRecord = function (Index) {
      var Result = 0;
      if (this.FDataSource.FDataSet.FActiveRecord > (((this.FFirstRecord + Index) + this.FBufferCount) - 1)) {
        Result = this.FDataSource.FDataSet.FActiveRecord - (((this.FFirstRecord + Index) + this.FBufferCount) - 1)}
       else if (this.FDataSource.FDataSet.FActiveRecord < (this.FFirstRecord + Index)) {
        Result = this.FDataSource.FDataSet.FActiveRecord - (this.FFirstRecord + Index)}
       else Result = 0;
      this.FFirstRecord += Index + Result;
      return Result;
    };
    this.CalcRange = function () {
      var aMax = 0;
      var aMin = 0;
      aMin = (this.GetDataset().FActiveRecord - this.FBufferCount) + 1;
      if (aMin < 0) aMin = 0;
      aMax = this.GetDataset().FBufferCount - this.FBufferCount;
      if (aMax < 0) aMax = 0;
      if (aMax > this.GetDataset().FActiveRecord) aMax = this.GetDataset().FActiveRecord;
      if (this.FFirstRecord < aMin) this.FFirstRecord = aMin;
      if (this.FFirstRecord > aMax) this.FFirstRecord = aMax;
      if ((this.FFirstRecord !== 0) && ((this.GetDataset().FActiveRecord - this.FFirstRecord) < (this.FBufferCount - 1))) this.FFirstRecord -= 1;
    };
    this.CheckActiveAndEditing = function () {
      var B = false;
      B = (this.FDataSource != null) && !(this.FDataSource.FState in rtl.createSet($mod.TDataSetState.dsInactive,$mod.TDataSetState.dsOpening));
      if (B !== this.FActive) {
        this.FActive = B;
        this.ActiveChanged();
      };
      B = ((this.FDataSource != null) && (this.FDataSource.FState in $mod.dsEditModes)) && !this.FReadOnly;
      if (B !== this.FEditing) {
        this.FEditing = B;
        this.EditingChanged();
      };
    };
    this.GetDataset = function () {
      var Result = null;
      if (this.FDataSource != null) {
        Result = this.FDataSource.FDataSet}
       else Result = null;
      return Result;
    };
    this.SetActive = function (AActive) {
      if (this.FActive !== AActive) {
        this.FActive = AActive;
        this.ActiveChanged();
      };
    };
    this.SetDataSource = function (Value) {
      if (this.FDataSource === Value) return;
      if (!this.FDataSourceFixed) {
        if (this.FDataSource != null) {
          this.FDataSource.UnregisterDataLink(this);
          this.FDataSource = null;
          this.CheckActiveAndEditing();
        };
        this.FDataSource = Value;
        if (this.FDataSource != null) {
          this.FDataSource.RegisterDataLink(this);
          this.CheckActiveAndEditing();
        };
      };
    };
    this.SetReadOnly = function (Value) {
      if (this.FReadOnly !== Value) {
        this.FReadOnly = Value;
        this.CheckActiveAndEditing();
      };
    };
    this.ActiveChanged = function () {
      this.FFirstRecord = 0;
    };
    this.CheckBrowseMode = function () {
    };
    this.DataEvent = function (Event, Info) {
      var $tmp1 = Event;
      if (($tmp1 === $mod.TDataEvent.deFieldChange) || ($tmp1 === $mod.TDataEvent.deRecordChange)) {
        if (!this.FUpdatingRecord) this.RecordChanged(rtl.getObject(Info))}
       else if ($tmp1 === $mod.TDataEvent.deDataSetChange) {
        this.SetActive(this.FDataSource.FDataSet.GetActive());
        this.CalcRange();
        this.CalcFirstRecord(Math.floor(Info));
        this.DataSetChanged();
      } else if ($tmp1 === $mod.TDataEvent.deDataSetScroll) {
        this.DataSetScrolled(this.CalcFirstRecord(Math.floor(Info)))}
       else if ($tmp1 === $mod.TDataEvent.deLayoutChange) {
        this.CalcFirstRecord(Math.floor(Info));
        this.LayoutChanged();
      } else if ($tmp1 === $mod.TDataEvent.deUpdateRecord) {
        this.UpdateRecord()}
       else if ($tmp1 === $mod.TDataEvent.deUpdateState) {
        this.CheckActiveAndEditing()}
       else if ($tmp1 === $mod.TDataEvent.deCheckBrowseMode) {
        this.CheckBrowseMode()}
       else if ($tmp1 === $mod.TDataEvent.deFocusControl) this.FocusControl(Info);
    };
    this.DataSetChanged = function () {
      this.RecordChanged(null);
    };
    this.DataSetScrolled = function (Distance) {
      this.DataSetChanged();
    };
    this.EditingChanged = function () {
    };
    this.FocusControl = function (Field) {
    };
    this.GetActiveRecord = function () {
      var Result = 0;
      Result = this.GetDataset().FActiveRecord - this.FFirstRecord;
      return Result;
    };
    this.GetBOF = function () {
      var Result = false;
      Result = this.GetDataset().FBOF;
      return Result;
    };
    this.GetBufferCount = function () {
      var Result = 0;
      Result = this.FBufferCount;
      return Result;
    };
    this.GetEOF = function () {
      var Result = false;
      Result = this.GetDataset().FEOF;
      return Result;
    };
    this.GetRecordCount = function () {
      var Result = 0;
      Result = this.GetDataset().FRecordCount;
      if (Result > this.GetBufferCount()) Result = this.GetBufferCount();
      return Result;
    };
    this.LayoutChanged = function () {
      this.DataSetChanged();
    };
    this.MoveBy = function (Distance) {
      var Result = 0;
      Result = this.GetDataset().MoveBy(Distance);
      return Result;
    };
    this.RecordChanged = function (Field) {
    };
    this.SetActiveRecord = function (Value) {
      this.GetDataset().FActiveRecord = Value + this.FFirstRecord;
    };
    this.SetBufferCount = function (Value) {
      if (this.FBufferCount !== Value) {
        this.FBufferCount = Value;
        if (this.FActive) {
          this.GetDataset().RecalcBufListSize();
          this.CalcRange();
        };
      };
    };
    this.UpdateData = function () {
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.FBufferCount = 1;
      this.FFirstRecord = 0;
      this.FDataSource = null;
      this.FDataSourceFixed = false;
    };
    this.Destroy = function () {
      this.FActive = false;
      this.FEditing = false;
      this.FDataSourceFixed = false;
      this.SetDataSource(null);
      pas.System.TObject.Destroy.call(this);
    };
    this.Edit = function () {
      var Result = false;
      if (!this.FReadOnly) this.FDataSource.Edit();
      Result = this.FEditing;
      return Result;
    };
    this.UpdateRecord = function () {
      this.FUpdatingRecord = true;
      try {
        this.UpdateData();
      } finally {
        this.FUpdatingRecord = false;
      };
    };
  });
  rtl.createClass($mod,"TDetailDataLink",$mod.TDataLink,function () {
    this.GetDetailDataSet = function () {
      var Result = null;
      Result = null;
      return Result;
    };
  });
  rtl.createClass($mod,"TMasterDataLink",$mod.TDetailDataLink,function () {
    this.$init = function () {
      $mod.TDetailDataLink.$init.call(this);
      this.FDetailDataSet = null;
      this.FFieldNames = "";
      this.FFields = null;
      this.FOnMasterChange = null;
      this.FOnMasterDisable = null;
    };
    this.$final = function () {
      this.FDetailDataSet = undefined;
      this.FFields = undefined;
      this.FOnMasterChange = undefined;
      this.FOnMasterDisable = undefined;
      $mod.TDetailDataLink.$final.call(this);
    };
    this.SetFieldNames = function (Value) {
      if (this.FFieldNames !== Value) {
        this.FFieldNames = Value;
        this.ActiveChanged();
      };
    };
    this.ActiveChanged = function () {
      this.FFields.Clear();
      if (this.FActive) try {
        this.GetDataset().GetFieldList(this.FFields,this.FFieldNames);
      } catch ($e) {
        this.FFields.Clear();
        throw $e;
      };
      if (this.FDetailDataSet.GetActive() && !(pas.Classes.TComponentStateItem.csDestroying in this.FDetailDataSet.FComponentState)) if (this.FActive && (this.FFields.GetCount() > 0)) {
        this.DoMasterChange()}
       else this.DoMasterDisable();
    };
    this.CheckBrowseMode = function () {
      if (this.FDetailDataSet.GetActive()) this.FDetailDataSet.CheckBrowseMode();
    };
    this.GetDetailDataSet = function () {
      var Result = null;
      Result = this.FDetailDataSet;
      return Result;
    };
    this.LayoutChanged = function () {
      this.ActiveChanged();
    };
    this.RecordChanged = function (Field) {
      if ((((this.FDataSource.FState !== $mod.TDataSetState.dsSetKey) && this.FDetailDataSet.GetActive()) && (this.FFields.GetCount() > 0)) && ((Field === null) || (this.FFields.IndexOf(Field) >= 0))) this.DoMasterChange();
    };
    this.DoMasterDisable = function () {
      if (this.FOnMasterDisable != null) this.FOnMasterDisable(this);
    };
    this.DoMasterChange = function () {
      if (this.FOnMasterChange != null) this.FOnMasterChange(this);
    };
    this.Create$2 = function (ADataSet) {
      $mod.TDataLink.Create$1.call(this);
      this.FDetailDataSet = ADataSet;
      this.FFields = pas.Classes.TList.$create("Create$1");
    };
    this.Destroy = function () {
      rtl.free(this,"FFields");
      $mod.TDataLink.Destroy.call(this);
    };
  });
  rtl.createClass($mod,"TMasterParamsDataLink",$mod.TMasterDataLink,function () {
    this.$init = function () {
      $mod.TMasterDataLink.$init.call(this);
      this.FParams = null;
    };
    this.$final = function () {
      this.FParams = undefined;
      $mod.TMasterDataLink.$final.call(this);
    };
    this.SetParams = function (AValue) {
      this.FParams = AValue;
      if (AValue !== null) this.RefreshParamNames();
    };
    this.DoMasterDisable = function () {
      $mod.TMasterDataLink.DoMasterDisable.apply(this,arguments);
    };
    this.DoMasterChange = function () {
      $mod.TMasterDataLink.DoMasterChange.apply(this,arguments);
      if (((this.FParams != null) && (this.GetDetailDataSet() != null)) && this.GetDetailDataSet().GetActive()) {
        this.GetDetailDataSet().CheckBrowseMode();
        this.GetDetailDataSet().Close();
        this.GetDetailDataSet().Open();
      };
    };
    this.Create$2 = function (ADataSet) {
      var P = null;
      $mod.TMasterDataLink.Create$2.call(this,ADataSet);
      if (ADataSet !== null) {
        P = pas.TypInfo.GetObjectProp$1(ADataSet,"Params",$mod.TParams);
        if (P !== null) this.SetParams(P);
      };
    };
    this.RefreshParamNames = function () {
      var FN = "";
      var DS = null;
      var F = null;
      var I = 0;
      var P = null;
      FN = "";
      DS = this.GetDataset();
      if (this.FParams != null) {
        F = null;
        for (var $l1 = 0, $end2 = this.FParams.GetCount() - 1; $l1 <= $end2; $l1++) {
          I = $l1;
          P = this.FParams.GetItem$1(I);
          if (!P.FBound) {
            if (DS != null) F = DS.FindField(P.FName);
            if ((!(DS != null) || !DS.GetActive()) || (F !== null)) {
              if (FN !== "") FN = FN + ";";
              FN = FN + P.FName;
            };
          };
        };
      };
      this.SetFieldNames(FN);
    };
    this.CopyParamsFromMaster = function (CopyBound) {
      if (this.FParams != null) this.FParams.CopyParamValuesFromDataset(this.GetDataset(),CopyBound);
    };
  });
  $mod.$rtti.$MethodVar("TDataChangeEvent",{procsig: rtl.newTIProcSig([["Sender",pas.System.$rtti["TObject"]],["Field",$mod.$rtti["TField"]]]), methodkind: 0});
  rtl.createClass($mod,"TDataSource",pas.Classes.TComponent,function () {
    this.$init = function () {
      pas.Classes.TComponent.$init.call(this);
      this.FDataSet = null;
      this.FDataLinks = null;
      this.FEnabled = false;
      this.FAutoEdit = false;
      this.FState = 0;
      this.FOnStateChange = null;
      this.FOnDataChange = null;
      this.FOnUpdateData = null;
    };
    this.$final = function () {
      this.FDataSet = undefined;
      this.FDataLinks = undefined;
      this.FOnStateChange = undefined;
      this.FOnDataChange = undefined;
      this.FOnUpdateData = undefined;
      pas.Classes.TComponent.$final.call(this);
    };
    this.DistributeEvent = function (Event, Info) {
      var i = 0;
      var $with1 = this.FDataLinks;
      for (var $l2 = 0, $end3 = $with1.GetCount() - 1; $l2 <= $end3; $l2++) {
        i = $l2;
        var $with4 = rtl.getObject($with1.Get(i));
        if (!$with4.FVisualControl) $with4.DataEvent(Event,Info);
      };
      for (var $l5 = 0, $end6 = $with1.GetCount() - 1; $l5 <= $end6; $l5++) {
        i = $l5;
        var $with7 = rtl.getObject($with1.Get(i));
        if ($with7.FVisualControl) $with7.DataEvent(Event,Info);
      };
    };
    this.RegisterDataLink = function (DataLink) {
      this.FDataLinks.Add(DataLink);
      if (this.FDataSet != null) this.FDataSet.RecalcBufListSize();
    };
    var OnDataChangeEvents = rtl.createSet($mod.TDataEvent.deRecordChange,$mod.TDataEvent.deDataSetChange,$mod.TDataEvent.deDataSetScroll,$mod.TDataEvent.deLayoutChange,$mod.TDataEvent.deUpdateState);
    this.ProcessEvent = function (Event, Info) {
      var NeedDataChange = false;
      var FLastState = 0;
      if (Event === $mod.TDataEvent.deUpdateState) {
        NeedDataChange = this.FState === $mod.TDataSetState.dsInactive;
        FLastState = this.FState;
        if (this.FDataSet != null) {
          this.FState = this.FDataSet.FState}
         else this.FState = $mod.TDataSetState.dsInactive;
        if (this.FState === FLastState) return;
      } else NeedDataChange = true;
      this.DistributeEvent(Event,Info);
      if (!(pas.Classes.TComponentStateItem.csDestroying in this.FComponentState)) {
        if (Event === $mod.TDataEvent.deUpdateState) this.DoStateChange();
        if ((Event in OnDataChangeEvents) && NeedDataChange) this.DoDataChange(null);
        if (Event === $mod.TDataEvent.deFieldChange) this.DoDataChange(Info);
        if (Event === $mod.TDataEvent.deUpdateRecord) this.DoUpdateData();
      };
    };
    this.SetDataSet = function (ADataSet) {
      if (this.FDataSet !== null) {
        this.FDataSet.UnRegisterDataSource(this);
        this.FDataSet = null;
        this.ProcessEvent($mod.TDataEvent.deUpdateState,0);
      };
      if (ADataSet !== null) {
        ADataSet.RegisterDataSource(this);
        this.FDataSet = ADataSet;
        this.ProcessEvent($mod.TDataEvent.deUpdateState,0);
      };
    };
    this.SetEnabled = function (Value) {
      this.FEnabled = Value;
    };
    this.UnregisterDataLink = function (DataLink) {
      this.FDataLinks.Remove(DataLink);
      if (this.FDataSet !== null) this.FDataSet.RecalcBufListSize();
    };
    this.DoDataChange = function (Info) {
      if (this.FOnDataChange != null) this.FOnDataChange(this,Info);
    };
    this.DoStateChange = function () {
      if (this.FOnStateChange != null) this.FOnStateChange(this);
    };
    this.DoUpdateData = function () {
      if (this.FOnUpdateData != null) this.FOnUpdateData(this);
    };
    this.Create$1 = function (AOwner) {
      pas.Classes.TComponent.Create$1.call(this,AOwner);
      this.FDataLinks = pas.Classes.TList.$create("Create$1");
      this.FEnabled = true;
      this.FAutoEdit = true;
    };
    this.Destroy = function () {
      this.FOnStateChange = null;
      this.SetDataSet(null);
      var $with1 = this.FDataLinks;
      while ($with1.GetCount() > 0) rtl.getObject($with1.Get($with1.GetCount() - 1)).SetDataSource(null);
      rtl.free(this,"FDataLinks");
      pas.Classes.TComponent.Destroy.call(this);
    };
    this.Edit = function () {
      if ((this.FState === $mod.TDataSetState.dsBrowse) && this.FAutoEdit) this.FDataSet.Edit();
    };
    this.IsLinkedTo = function (ADataSet) {
      var Result = false;
      Result = false;
      return Result;
    };
    var $r = this.$rtti;
    $r.addProperty("AutoEdit",0,rtl.boolean,"FAutoEdit","FAutoEdit",{Default: true});
    $r.addProperty("DataSet",2,$mod.$rtti["TDataSet"],"FDataSet","SetDataSet");
    $r.addProperty("Enabled",2,rtl.boolean,"FEnabled","SetEnabled",{Default: true});
    $r.addProperty("OnStateChange",0,pas.Classes.$rtti["TNotifyEvent"],"FOnStateChange","FOnStateChange");
    $r.addProperty("OnDataChange",0,$mod.$rtti["TDataChangeEvent"],"FOnDataChange","FOnDataChange");
    $r.addProperty("OnUpdateData",0,pas.Classes.$rtti["TNotifyEvent"],"FOnUpdateData","FOnUpdateData");
  });
  this.TDataRequestResult = {"0": "rrFail", rrFail: 0, "1": "rrEOF", rrEOF: 1, "2": "rrOK", rrOK: 2};
  $mod.$rtti.$Enum("TDataRequestResult",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TDataRequestResult});
  $mod.$rtti.$MethodVar("TDataRequestEvent",{procsig: rtl.newTIProcSig([["ARequest",$mod.$rtti["TDataRequest"]]]), methodkind: 0});
  rtl.createClass($mod,"TDataRequest",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FBookmark = new $mod.TBookmark();
      this.FCurrent = new $mod.TBookmark();
      this.FDataset = null;
      this.FErrorMsg = "";
      this.FEvent = null;
      this.FLoadOptions = {};
      this.FRequestID = 0;
      this.FSuccess = 0;
      this.FData = undefined;
      this.FAfterRequest = null;
      this.FDataProxy = null;
    };
    this.$final = function () {
      this.FBookmark = undefined;
      this.FCurrent = undefined;
      this.FDataset = undefined;
      this.FEvent = undefined;
      this.FLoadOptions = undefined;
      this.FAfterRequest = undefined;
      this.FDataProxy = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.DoAfterRequest = function () {
      if (this.FAfterRequest != null) this.FAfterRequest(this);
    };
    this.Create$1 = function (aDataProxy, aOptions, aAfterRequest, aAfterLoad) {
      this.FDataProxy = aDataProxy;
      this.FLoadOptions = rtl.refSet(aOptions);
      this.FEvent = aAfterLoad;
      this.FAfterRequest = aAfterRequest;
    };
  });
  $mod.$rtti.$ClassRef("TDataRequestClass",{instancetype: $mod.$rtti["TDataRequest"]});
  rtl.createClass($mod,"TRecordUpdateDescriptor",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FBookmark = new $mod.TBookmark();
      this.FData = undefined;
      this.FDataset = null;
      this.FProxy = null;
      this.FResolveError = "";
      this.FServerData = undefined;
      this.FStatus = 0;
      this.FOriginalStatus = 0;
    };
    this.$final = function () {
      this.FBookmark = undefined;
      this.FDataset = undefined;
      this.FProxy = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.SetStatus = function (aValue) {
      this.FStatus = aValue;
    };
    this.Reset = function () {
      this.FStatus = this.FOriginalStatus;
      this.FResolveError = "";
      this.FServerData = null;
    };
    this.Create$1 = function (aProxy, aDataset, aBookmark, AData, AStatus) {
      this.FDataset = aDataset;
      this.FBookmark = new $mod.TBookmark(aBookmark);
      this.FData = AData;
      this.FStatus = AStatus;
      this.FOriginalStatus = AStatus;
      this.FProxy = aProxy;
    };
    this.Resolve = function (aData) {
      this.FStatus = $mod.TUpdateStatus.usResolved;
      this.FServerData = aData;
    };
    this.ResolveFailed = function (aError) {
      this.SetStatus($mod.TUpdateStatus.usResolveFailed);
      this.FResolveError = aError;
    };
  });
  $mod.$rtti.$ClassRef("TRecordUpdateDescriptorClass",{instancetype: $mod.$rtti["TRecordUpdateDescriptor"]});
  rtl.createClass($mod,"TRecordUpdateDescriptorList",pas.Classes.TFPList,function () {
    this.GetUpdate = function (AIndex) {
      var Result = null;
      Result = rtl.getObject(this.Get(AIndex));
      return Result;
    };
  });
  this.TUpdateBatchStatus = {"0": "ubsPending", ubsPending: 0, "1": "ubsProcessing", ubsProcessing: 1, "2": "ubsProcessed", ubsProcessed: 2, "3": "ubsResolved", ubsResolved: 3};
  $mod.$rtti.$Enum("TUpdateBatchStatus",{minvalue: 0, maxvalue: 3, ordtype: 1, enumtype: this.TUpdateBatchStatus});
  $mod.$rtti.$MethodVar("TResolveBatchEvent",{procsig: rtl.newTIProcSig([["Sender",pas.System.$rtti["TObject"]],["ARequest",$mod.$rtti["TRecordUpdateBatch"]]]), methodkind: 0});
  rtl.createClass($mod,"TRecordUpdateBatch",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FBatchID = 0;
      this.FDataset = null;
      this.FLastChangeIndex = 0;
      this.FList = null;
      this.FOnResolve = null;
      this.FOwnsList = false;
      this.FStatus = 0;
    };
    this.$final = function () {
      this.FDataset = undefined;
      this.FList = undefined;
      this.FOnResolve = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (aBatchID, AList, AOwnsList) {
      this.FBatchID = aBatchID;
      this.FList = AList;
      this.FOwnsList = AOwnsList;
      this.FStatus = $mod.TUpdateBatchStatus.ubsPending;
    };
    this.Destroy = function () {
      if (this.FOwnsList) this.FreeList();
      pas.System.TObject.Destroy.call(this);
    };
    this.FreeList = function () {
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FList;
        }, set: function (v) {
          this.p.FList = v;
        }});
    };
  });
  $mod.$rtti.$ClassRef("TRecordUpdateBatchClass",{instancetype: $mod.$rtti["TRecordUpdateBatch"]});
  rtl.createClass($mod,"TDataProxy",pas.Classes.TComponent,function () {
    this.GetDataRequestClass = function () {
      var Result = null;
      Result = $mod.TDataRequest;
      return Result;
    };
    this.GetUpdateDescriptorClass = function () {
      var Result = null;
      Result = $mod.TRecordUpdateDescriptor;
      return Result;
    };
    this.GetUpdateBatchClass = function () {
      var Result = null;
      Result = $mod.TRecordUpdateBatch;
      return Result;
    };
    this.ResolveBatch = function (aBatch) {
      try {
        if (aBatch.FOnResolve != null) aBatch.FOnResolve(this,aBatch);
      } finally {
        aBatch = rtl.freeLoc(aBatch);
      };
    };
    this.GetDataRequest = function (aOptions, aAfterRequest, aAfterLoad) {
      var Result = null;
      Result = this.GetDataRequestClass().$create("Create$1",[this,rtl.refSet(aOptions),aAfterRequest,aAfterLoad]);
      return Result;
    };
    this.GetUpdateDescriptor = function (aDataset, aBookmark, AData, AStatus) {
      var Result = null;
      Result = this.GetUpdateDescriptorClass().$create("Create$1",[this,aDataset,new $mod.TBookmark(aBookmark),AData,AStatus]);
      return Result;
    };
    this.GetRecordUpdateBatch = function (aBatchID, AList, AOwnsList) {
      var Result = null;
      Result = this.GetUpdateBatchClass().$create("Create$1",[aBatchID,AList,AOwnsList]);
      return Result;
    };
  });
  this.Fieldtypenames = ["Unknown","String","Integer","NativeInt","Boolean","Float","Date","Time","DateTime","AutoInc","Blob","Memo","FixedChar","Variant","Dataset"];
  this.DefaultFieldClasses = [$mod.TField,$mod.TStringField,$mod.TIntegerField,$mod.TLargeintField,$mod.TBooleanField,$mod.TFloatField,$mod.TDateField,$mod.TTimeField,$mod.TDateTimeField,$mod.TAutoIncField,$mod.TBlobField,$mod.TMemoField,$mod.TStringField,$mod.TVariantField,null];
  this.dsEditModes = rtl.createSet($mod.TDataSetState.dsEdit,$mod.TDataSetState.dsInsert,$mod.TDataSetState.dsSetKey);
  this.dsWriteModes = rtl.createSet($mod.TDataSetState.dsEdit,$mod.TDataSetState.dsInsert,$mod.TDataSetState.dsSetKey,$mod.TDataSetState.dsCalcFields,$mod.TDataSetState.dsFilter,$mod.TDataSetState.dsNewValue,$mod.TDataSetState.dsInternalCalc,$mod.TDataSetState.dsRefreshFields);
  this.ftBlobTypes = rtl.createSet($mod.TFieldType.ftBlob,$mod.TFieldType.ftMemo);
  this.DatabaseError = function (Msg) {
    throw $mod.EDatabaseError.$create("Create$1",[Msg]);
  };
  this.DatabaseError$1 = function (Msg, Comp) {
    if ((Comp != null) && (Comp.FName !== "")) throw $mod.EDatabaseError.$create("CreateFmt",["%s : %s",[Comp.FName,Msg]]);
  };
  this.DatabaseErrorFmt = function (Fmt, Args) {
    throw $mod.EDatabaseError.$create("CreateFmt",[Fmt,Args]);
  };
  this.DatabaseErrorFmt$1 = function (Fmt, Args, Comp) {
    if (Comp != null) throw $mod.EDatabaseError.$create("CreateFmt",[pas.SysUtils.Format("%s : %s",[Comp.FName,Fmt]),Args]);
  };
  this.ExtractFieldName = function (Fields, Pos) {
    var Result = "";
    var i = 0;
    var FieldsLength = 0;
    i = Pos.get();
    FieldsLength = Fields.length;
    while ((i <= FieldsLength) && (Fields.charAt(i - 1) !== ";")) i += 1;
    Result = pas.SysUtils.Trim(pas.System.Copy(Fields,Pos.get(),i - Pos.get()));
    if ((i <= FieldsLength) && (Fields.charAt(i - 1) === ";")) i += 1;
    Pos.set(i);
    return Result;
  };
  $mod.$init = function () {
  };
},["DBConst","TypInfo"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.DefaultBufferCount = 10;
  $impl.SBoolean = "Boolean";
  $impl.SDateTime = "TDateTime";
  $impl.SFloat = "Float";
  $impl.SInteger = "Integer";
  $impl.SLargeInt = "NativeInt";
  $impl.SJSValue = "JSValue";
  $impl.SString = "String";
  $impl.SBytes = "Bytes";
  $impl.SkipQuotesString = function (S, p, QuoteChar, EscapeSlash, EscapeRepeat) {
    var notRepeatEscaped = false;
    p.set(p.get() + 1);
    do {
      notRepeatEscaped = true;
      while (!pas.SysUtils.CharInSet(S.charAt(p.get() - 1),["\x00",QuoteChar])) {
        if ((EscapeSlash && (S.charAt(p.get() - 1) === "\\")) && (p.get() < S.length)) {
          p.set(p.get() + 2)}
         else p.set(p.get() + 1);
      };
      if (S.charAt(p.get() - 1) === QuoteChar) {
        p.set(p.get() + 1);
        if ((S.charAt(p.get() - 1) === QuoteChar) && EscapeRepeat) {
          notRepeatEscaped = false;
          p.set(p.get() + 1);
        };
      };
    } while (!notRepeatEscaped);
  };
  $impl.SkipComments = function (S, p, EscapeSlash, EscapeRepeat) {
    var Result = false;
    Result = false;
    var $tmp1 = S.charAt(p.get() - 1);
    if ((($tmp1 === "'") || ($tmp1 === '"')) || ($tmp1 === "`")) {
      Result = true;
      $impl.SkipQuotesString(S,p,S.charAt(p.get() - 1),EscapeSlash,EscapeRepeat);
    } else if ($tmp1 === "-") {
      p.set(p.get() + 1);
      if (S.charAt(p.get() - 1) === "-") {
        Result = true;
        do {
          p.set(p.get() + 1);
        } while (!pas.SysUtils.CharInSet(S.charAt(p.get() - 1),["\n","\r","\x00"]));
        while (pas.SysUtils.CharInSet(S.charAt(p.get() - 1),["\n","\r"])) p.set(p.get() + 1);
      };
    } else if ($tmp1 === "\/") {
      p.set(p.get() + 1);
      if (S.charAt(p.get() - 1) === "*") {
        Result = true;
        p.set(p.get() + 1);
        while (p.get() <= S.length) {
          if (S.charAt(p.get() - 1) === "*") {
            p.set(p.get() + 1);
            if (S.charAt(p.get() - 1) === "\/") break;
          } else p.set(p.get() + 1);
        };
        if ((p.get() <= S.length) && (S.charAt(p.get() - 1) === "\/")) p.set(p.get() + 1);
      };
    };
    return Result;
  };
});
rtl.module("JSONDataset",["System","Types","JS","DB","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TJSONFieldMapper",pas.System.TObject,function () {
    this.GetJSONDataForField$1 = function (F, Row) {
      var Result = undefined;
      Result = this.GetJSONDataForField(F.FFieldName,F.GetIndex(),Row);
      return Result;
    };
    this.SetJSONDataForField$1 = function (F, Row, Data) {
      this.SetJSONDataForField(F.FFieldName,F.GetIndex(),Row,Data);
    };
  });
  rtl.createClass($mod,"TJSONDateField",pas.DB.TDateField,function () {
    this.$init = function () {
      pas.DB.TDateField.$init.call(this);
      this.FDateFormat = "";
    };
    var $r = this.$rtti;
    $r.addProperty("DateFormat",0,rtl.string,"FDateFormat","FDateFormat");
  });
  rtl.createClass($mod,"TJSONTimeField",pas.DB.TTimeField,function () {
    this.$init = function () {
      pas.DB.TTimeField.$init.call(this);
      this.FTimeFormat = "";
    };
    var $r = this.$rtti;
    $r.addProperty("TimeFormat",0,rtl.string,"FTimeFormat","FTimeFormat");
  });
  rtl.createClass($mod,"TJSONDateTimeField",pas.DB.TDateTimeField,function () {
    this.$init = function () {
      pas.DB.TDateTimeField.$init.call(this);
      this.FDateTimeFormat = "";
    };
    var $r = this.$rtti;
    $r.addProperty("DateTimeFormat",0,rtl.string,"FDateTimeFormat","FDateTimeFormat");
  });
  rtl.createClass($mod,"TJSONIndex",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
      this.FRows = null;
      this.FDataset = null;
    };
    this.$final = function () {
      this.FList = undefined;
      this.FRows = undefined;
      this.FDataset = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetRecordIndex = function (aListIndex) {
      var Result = 0;
      if (pas.JS.isUndefined(this.FList[aListIndex])) {
        Result = -1}
       else Result = Math.floor(this.FList[aListIndex]);
      return Result;
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FList.length;
      return Result;
    };
    this.Create$1 = function (aDataset, aRows) {
      this.FRows = aRows;
      this.FList = new Array(this.FRows.length);
      this.FDataset = aDataset;
      this.CreateIndex();
    };
    this.Delete = function (aListIndex) {
      var Result = 0;
      var a = null;
      a = this.FList.splice(aListIndex,1);
      if (a.length > 0) {
        Result = Math.floor(a[0])}
       else Result = -1;
      return Result;
    };
    this.Insert = function (aCurrentIndex, aRecordIndex) {
      var Result = 0;
      Result = this.Append(aRecordIndex);
      return Result;
    };
  });
  rtl.createClass($mod,"TDefaultJSONIndex",$mod.TJSONIndex,function () {
    this.CreateIndex = function () {
      var I = 0;
      for (var $l1 = 0, $end2 = this.FRows.length - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        this.FList[I] = I;
      };
    };
    this.AppendToIndex = function () {
      var I = 0;
      var L = 0;
      L = this.FList.length;
      this.FList.length = this.FRows.length;
      for (var $l1 = L, $end2 = this.FRows.length - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        this.FList[I] = I;
      };
    };
    this.Append = function (aRecordIndex) {
      var Result = 0;
      Result = this.FList.push(aRecordIndex) - 1;
      return Result;
    };
    this.Insert = function (aCurrentIndex, aRecordIndex) {
      var Result = 0;
      this.FList.splice(aCurrentIndex,0,aRecordIndex);
      Result = aCurrentIndex;
      return Result;
    };
    this.FindRecord = function (aRecordIndex) {
      var Result = 0;
      Result = this.FList.indexOf(aRecordIndex);
      return Result;
    };
    this.Update = function (aCurrentIndex, aRecordIndex) {
      var Result = 0;
      Result = 0;
      if (this.GetRecordIndex(aCurrentIndex) !== aRecordIndex) pas.DB.DatabaseErrorFmt$1("Inconsistent record index in default index, expected %d, got %d.",[aCurrentIndex,this.GetRecordIndex(aCurrentIndex)],this.FDataset);
      return Result;
    };
  });
  rtl.createClass($mod,"TBaseJSONDataSet",pas.DB.TDataSet,function () {
    this.$init = function () {
      pas.DB.TDataSet.$init.call(this);
      this.FMUS = false;
      this.FOwnsData = false;
      this.FDefaultIndex = null;
      this.FCurrentIndex = null;
      this.FCurrent = 0;
      this.FMetaData = null;
      this.FRows = null;
      this.FDeletedRows = null;
      this.FFieldMapper = null;
      this.FEditIdx = 0;
      this.FEditRow = undefined;
      this.FUseDateTimeFormatFields = false;
    };
    this.$final = function () {
      this.FDefaultIndex = undefined;
      this.FCurrentIndex = undefined;
      this.FMetaData = undefined;
      this.FRows = undefined;
      this.FDeletedRows = undefined;
      this.FFieldMapper = undefined;
      pas.DB.TDataSet.$final.call(this);
    };
    this.SetMetaData = function (AValue) {
      this.CheckInactive();
      this.FMetaData = AValue;
    };
    this.SetRows = function (AValue) {
      if (AValue === this.FRows) return;
      this.CheckInactive();
      this.FRows = null;
      this.AddToRows(AValue);
    };
    this.AllocRecordBuffer = function () {
      var Result = new pas.DB.TDataRecord();
      Result.data = new Object();
      Result.bookmark = null;
      Result.state = pas.DB.TRecordState.rsNew;
      return Result;
    };
    this.FreeRecordBuffer = function (Buffer) {
      Buffer.get().data = null;
      Buffer.get().bookmark = null;
      Buffer.get().state = pas.DB.TRecordState.rsNew;
    };
    this.InternalInitRecord = function (Buffer) {
      Buffer.get().data = this.FFieldMapper.CreateRow();
      Buffer.get().bookmark = null;
      Buffer.get().state = pas.DB.TRecordState.rsNew;
    };
    this.GetRecord = function (Buffer, GetMode, DoCheck) {
      var Result = 0;
      var BkmIdx = 0;
      Result = pas.DB.TGetResult.grOK;
      var $tmp1 = GetMode;
      if ($tmp1 === pas.DB.TGetMode.gmNext) {
        if (this.FCurrent < (this.FCurrentIndex.GetCount() - 1)) {
          this.FCurrent += 1}
         else Result = pas.DB.TGetResult.grEOF}
       else if ($tmp1 === pas.DB.TGetMode.gmPrior) {
        if (this.FCurrent > 0) {
          this.FCurrent -= 1}
         else Result = pas.DB.TGetResult.grBOF}
       else if ($tmp1 === pas.DB.TGetMode.gmCurrent) if (this.FCurrent >= this.FCurrentIndex.GetCount()) Result = pas.DB.TGetResult.grEOF;
      if (Result === pas.DB.TGetResult.grOK) {
        BkmIdx = this.FCurrentIndex.GetRecordIndex(this.FCurrent);
        Buffer.get().data = this.FRows[BkmIdx];
        Buffer.get().bookmarkFlag = pas.DB.TBookmarkFlag.bfCurrent;
        Buffer.get().bookmark = BkmIdx;
      };
      return Result;
    };
    this.GetRecordSize = function () {
      var Result = 0;
      Result = 0;
      return Result;
    };
    this.AddToRows = function (AValue) {
      if (this.FRows === null) {
        this.FRows = AValue}
       else {
        this.FRows = this.FRows.concat(AValue);
        this.AppendToIndexes();
      };
    };
    this.InternalClose = function () {
      this.BindFields(false);
      if (this.FDefaultFields) this.DestroyFields();
      this.FreeData();
    };
    this.InternalDelete = function () {
      var Idx = 0;
      Idx = this.FCurrentIndex.Delete(this.FCurrent);
      if (Idx !== -1) {
        if (!(this.FDeletedRows != null)) {
          this.FDeletedRows = new Array(this.FRows[Idx])}
         else this.FDeletedRows.push(this.FRows[Idx]);
        this.FRows[Idx] = undefined;
      };
    };
    this.InternalFirst = function () {
      this.FCurrent = -1;
    };
    this.InternalLast = function () {
      this.FCurrent = this.FCurrentIndex.GetCount();
    };
    this.InternalOpen = function () {
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FFieldMapper;
        }, set: function (v) {
          this.p.FFieldMapper = v;
        }});
      this.FFieldMapper = this.CreateFieldMapper();
      if (this.FRows === null) {
        this.FRows = new Array();
        this.FOwnsData = true;
      };
      this.CreateIndexes();
      this.InternalInitFieldDefs();
      if (this.FDefaultFields) this.CreateFields();
      this.BindFields(true);
      this.InitDateTimeFields();
      this.FCurrent = -1;
    };
    this.InternalPost = function () {
      var Idx = 0;
      var B = new pas.DB.TBookmark();
      this.GetBookmarkData(new pas.DB.TDataRecord(this.ActiveBuffer()),{get: function () {
          return B;
        }, set: function (v) {
          B = v;
        }});
      if (this.FState === pas.DB.TDataSetState.dsInsert) {
        Idx = this.FRows.push(this.FEditRow) - 1;
        if (this.GetBookmarkFlag(new pas.DB.TDataRecord(this.ActiveBuffer())) === pas.DB.TBookmarkFlag.bfEOF) {
          this.FDefaultIndex.Append(Idx);
          if (this.FCurrentIndex !== this.FDefaultIndex) this.FCurrentIndex.Append(Idx);
        } else {
          this.FCurrent = this.FDefaultIndex.Insert(this.FCurrent,Idx);
          if (this.FCurrentIndex !== this.FDefaultIndex) this.FCurrent = this.FCurrentIndex.Insert(this.FCurrent,Idx);
        };
      } else {
        if (this.FEditIdx === -1) pas.DB.DatabaseErrorFmt("Failed to retrieve record index for record %d",[this.FCurrent]);
        Idx = this.FEditIdx;
        this.FRows[Idx] = this.FEditRow;
        this.FDefaultIndex.Update(this.FCurrent,Idx);
        if (this.FCurrentIndex !== this.FDefaultIndex) this.FCurrentIndex.Update(this.FCurrent,Idx);
      };
      this.FEditIdx = -1;
      this.FEditRow = null;
    };
    this.InternalInsert = function () {
      var I = 0;
      var D = null;
      this.FEditRow = this.ActiveBuffer().data;
      for (var $l1 = 0, $end2 = this.FFieldDefs.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        D = this.FFieldDefs.GetItem$1(I);
        this.FFieldMapper.SetJSONDataForField(D.FName,D.GetIndex(),this.FEditRow,null);
      };
    };
    this.InternalEdit = function () {
      this.FEditIdx = this.FCurrentIndex.GetRecordIndex(this.FCurrent);
      if (!pas.JS.isUndefined(this.FRows[this.FEditIdx])) {
        this.FEditRow = JSON.parse(JSON.stringify(this.FRows[this.FEditIdx]))}
       else this.FEditRow = new Object();
    };
    this.InternalCancel = function () {
      this.FEditIdx = -1;
      this.FEditRow = null;
    };
    this.InternalInitFieldDefs = function () {
      if (this.FMetaData != null) this.MetaDataToFieldDefs();
      if (this.FFieldDefs.GetCount() === 0) throw $mod.EJSONDataset.$create("Create$1",["No fields found"]);
    };
    this.InternalSetToRecord = function (Buffer) {
      this.FCurrent = this.FCurrentIndex.FindRecord(Math.floor(Buffer.bookmark));
    };
    this.GetFieldClass = function (FieldType) {
      var Result = null;
      if (this.FUseDateTimeFormatFields && (FieldType in rtl.createSet(pas.DB.TFieldType.ftDate,pas.DB.TFieldType.ftDateTime,pas.DB.TFieldType.ftTime))) {
        var $tmp1 = FieldType;
        if ($tmp1 === pas.DB.TFieldType.ftDate) {
          Result = $mod.TJSONDateField}
         else if ($tmp1 === pas.DB.TFieldType.ftDateTime) {
          Result = $mod.TJSONDateTimeField}
         else if ($tmp1 === pas.DB.TFieldType.ftTime) Result = $mod.TJSONTimeField;
      } else Result = pas.DB.TDataSet.GetFieldClass.call(this,FieldType);
      return Result;
    };
    this.IsCursorOpen = function () {
      var Result = false;
      Result = this.FDefaultIndex != null;
      return Result;
    };
    this.GetBookmarkData = function (Buffer, Data) {
      Data.get().Data = Buffer.bookmark;
    };
    this.GetBookmarkFlag = function (Buffer) {
      var Result = 0;
      Result = Buffer.bookmarkFlag;
      return Result;
    };
    this.InternalGotoBookmark = function (ABookmark) {
      if (rtl.isNumber(ABookmark.Data)) this.FCurrent = this.FCurrentIndex.FindRecord(Math.floor(ABookmark.Data));
    };
    this.SetBookmarkFlag = function (Buffer, Value) {
      Buffer.get().bookmarkFlag = Value;
    };
    this.SetBookmarkData = function (Buffer, Data) {
      Buffer.get().bookmark = Data.Data;
    };
    this.GetRecordCount = function () {
      var Result = 0;
      Result = this.FCurrentIndex.GetCount();
      return Result;
    };
    this.SetRecNo = function (Value) {
      if ((Value < 1) || (Value > this.FCurrentIndex.GetCount())) throw $mod.EJSONDataset.$create("CreateFmt",["%s: SetRecNo: index %d out of range",[this.FName,Value]]);
      this.FCurrent = Value - 1;
      this.Resync({});
      this.DoAfterScroll();
    };
    this.GetRecNo = function () {
      var Result = 0;
      var bkmIdx = 0;
      bkmIdx = Math.floor(this.ActiveBuffer().bookmark);
      Result = this.FCurrentIndex.FindRecord(bkmIdx) + 1;
      return Result;
    };
    this.FreeData = function () {
      if (this.FOwnsData) {
        this.FRows = null;
        this.FMetaData = null;
      };
      if (this.FCurrentIndex !== this.FDefaultIndex) {
        pas.SysUtils.FreeAndNil({p: this, get: function () {
            return this.p.FCurrentIndex;
          }, set: function (v) {
            this.p.FCurrentIndex = v;
          }})}
       else this.FCurrentIndex = null;
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FDefaultIndex;
        }, set: function (v) {
          this.p.FDefaultIndex = v;
        }});
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FFieldMapper;
        }, set: function (v) {
          this.p.FFieldMapper = v;
        }});
      this.FCurrentIndex = null;
      this.FDeletedRows = null;
    };
    this.AppendToIndexes = function () {
      this.FDefaultIndex.AppendToIndex();
    };
    this.CreateIndexes = function () {
      this.FDefaultIndex = $mod.TDefaultJSONIndex.$create("Create$1",[this,this.FRows]);
      this.AppendToIndexes();
      this.FCurrentIndex = this.FDefaultIndex;
    };
    this.InitDateTimeFields = function () {
    };
    this.ConvertDateTimeField = function (S, F) {
      var Result = 0.0;
      var Ptrn = "";
      Result = 0;
      var $tmp1 = F.FDataType;
      if ($tmp1 === pas.DB.TFieldType.ftDate) {
        Ptrn = F.FDateFormat}
       else if ($tmp1 === pas.DB.TFieldType.ftTime) {
        Ptrn = F.FTimeFormat}
       else if ($tmp1 === pas.DB.TFieldType.ftDateTime) Ptrn = F.FDateTimeFormat;
      if (Ptrn === "") {
        var $tmp2 = F.FDataType;
        if ($tmp2 === pas.DB.TFieldType.ftDate) {
          Result = pas.SysUtils.StrToDate(S)}
         else if ($tmp2 === pas.DB.TFieldType.ftTime) {
          Result = pas.SysUtils.StrToTime(S)}
         else if ($tmp2 === pas.DB.TFieldType.ftDateTime) Result = pas.SysUtils.StrToDateTime(S);
      } else {
        Result = pas.DateUtils.ScanDateTime(Ptrn,S,1);
      };
      return Result;
    };
    this.FormatDateTimeField = function (DT, F) {
      var Result = "";
      var Ptrn = "";
      Result = "";
      var $tmp1 = F.FDataType;
      if ($tmp1 === pas.DB.TFieldType.ftDate) {
        Ptrn = F.FDateFormat}
       else if ($tmp1 === pas.DB.TFieldType.ftTime) {
        Ptrn = F.FTimeFormat}
       else if ($tmp1 === pas.DB.TFieldType.ftDateTime) Ptrn = F.FDateTimeFormat;
      if (Ptrn === "") {
        var $tmp2 = F.FDataType;
        if ($tmp2 === pas.DB.TFieldType.ftDate) {
          Result = pas.SysUtils.DateToStr(DT)}
         else if ($tmp2 === pas.DB.TFieldType.ftTime) {
          Result = pas.SysUtils.TimeToStr(DT)}
         else if ($tmp2 === pas.DB.TFieldType.ftDateTime) Result = pas.SysUtils.DateTimeToStr(DT,false);
      } else Result = pas.SysUtils.FormatDateTime(Ptrn,DT);
      return Result;
    };
    this.Create$1 = function (AOwner) {
      pas.DB.TDataSet.Create$1.apply(this,arguments);
      this.FOwnsData = true;
      this.FUseDateTimeFormatFields = false;
      this.FEditIdx = -1;
    };
    this.Destroy = function () {
      this.FEditIdx = -1;
      this.FreeData();
      pas.DB.TDataSet.Destroy.apply(this,arguments);
    };
    this.GetFieldData$1 = function (Field, Buffer) {
      var Result = undefined;
      var R = undefined;
      if (this.FEditIdx == Buffer.bookmark) {
        if (this.FState === pas.DB.TDataSetState.dsOldValue) {
          R = Buffer.data}
         else R = this.FEditRow;
      } else {
        if (this.FState === pas.DB.TDataSetState.dsOldValue) {
          return null}
         else R = Buffer.data;
      };
      Result = this.FFieldMapper.GetJSONDataForField$1(Field,R);
      return Result;
    };
    this.SetFieldData$1 = function (Field, Buffer, AValue) {
      this.FFieldMapper.SetJSONDataForField$1(Field,this.FEditRow,AValue);
      this.SetModified(true);
    };
    this.BookmarkValid = function (ABookmark) {
      var Result = false;
      Result = rtl.isNumber(ABookmark.Data);
      return Result;
    };
    this.CompareBookmarks = function (Bookmark1, Bookmark2) {
      var Result = 0;
      if (rtl.isNumber(Bookmark1.Data) && rtl.isNumber(Bookmark2.Data)) {
        Result = Math.floor(Bookmark2.Data) - Math.floor(Bookmark1.Data)}
       else {
        if (rtl.isNumber(Bookmark1.Data)) {
          Result = -1}
         else if (rtl.isNumber(Bookmark2.Data)) {
          Result = 1}
         else Result = 0;
      };
      return Result;
    };
  });
  rtl.createClass($mod,"TJSONDataset",$mod.TBaseJSONDataSet,function () {
    var $r = this.$rtti;
    $r.addProperty("FieldDefs",2,pas.DB.$rtti["TFieldDefs"],"FFieldDefs","SetFieldDefs");
    $r.addProperty("Active",3,rtl.boolean,"GetActive","SetActive",{Default: false});
    $r.addProperty("BeforeOpen",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeOpen","FBeforeOpen");
    $r.addProperty("AfterOpen",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterOpen","FAfterOpen");
    $r.addProperty("BeforeClose",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeClose","FBeforeClose");
    $r.addProperty("AfterClose",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterClose","FAfterClose");
    $r.addProperty("BeforeInsert",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeInsert","FBeforeInsert");
    $r.addProperty("AfterInsert",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterInsert","FAfterInsert");
    $r.addProperty("BeforeEdit",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeEdit","FBeforeEdit");
    $r.addProperty("AfterEdit",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterEdit","FAfterEdit");
    $r.addProperty("BeforePost",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforePost","FBeforePost");
    $r.addProperty("AfterPost",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterPost","FAfterPost");
    $r.addProperty("BeforeCancel",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeCancel","FBeforeCancel");
    $r.addProperty("AfterCancel",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterCancel","FAfterCancel");
    $r.addProperty("BeforeDelete",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeDelete","FBeforeDelete");
    $r.addProperty("AfterDelete",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterDelete","FAfterDelete");
    $r.addProperty("BeforeScroll",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeScroll","FBeforeScroll");
    $r.addProperty("AfterScroll",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterScroll","FAfterScroll");
    $r.addProperty("OnCalcFields",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FOnCalcFields","FOnCalcFields");
    $r.addProperty("OnDeleteError",0,pas.DB.$rtti["TDataSetErrorEvent"],"FOnDeleteError","FOnDeleteError");
    $r.addProperty("OnEditError",0,pas.DB.$rtti["TDataSetErrorEvent"],"FOnEditError","FOnEditError");
    $r.addProperty("OnFilterRecord",2,pas.DB.$rtti["TFilterRecordEvent"],"FOnFilterRecord","SetOnFilterRecord");
    $r.addProperty("OnNewRecord",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FOnNewRecord","FOnNewRecord");
    $r.addProperty("OnPostError",0,pas.DB.$rtti["TDataSetErrorEvent"],"FOnPostError","FOnPostError");
  });
  rtl.createClass($mod,"TJSONObjectFieldMapper",$mod.TJSONFieldMapper,function () {
    this.SetJSONDataForField = function (FieldName, FieldIndex, Row, Data) {
      rtl.getObject(Row)[FieldName] = Data;
    };
    this.GetJSONDataForField = function (FieldName, FieldIndex, Row) {
      var Result = undefined;
      Result = rtl.getObject(Row)[FieldName];
      return Result;
    };
    this.CreateRow = function () {
      var Result = undefined;
      Result = new Object();
      return Result;
    };
  });
  rtl.createClass($mod,"TJSONArrayFieldMapper",$mod.TJSONFieldMapper,function () {
    this.SetJSONDataForField = function (FieldName, FieldIndex, Row, Data) {
      Row[FieldIndex] = Data;
    };
    this.GetJSONDataForField = function (FieldName, FieldIndex, Row) {
      var Result = undefined;
      Result = Row[FieldIndex];
      return Result;
    };
    this.CreateRow = function () {
      var Result = undefined;
      Result = new Array();
      return Result;
    };
  });
  rtl.createClass($mod,"EJSONDataset",pas.DB.EDatabaseError,function () {
  });
},["DateUtils"]);
rtl.module("ExtJSDataset",["System","Classes","SysUtils","DB","JS","JSONDataset"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TExtJSJSONDataSet",pas.JSONDataset.TBaseJSONDataSet,function () {
    this.$init = function () {
      pas.JSONDataset.TBaseJSONDataSet.$init.call(this);
      this.FFields = null;
      this.FIDField = "";
      this.FRoot = "";
    };
    this.$final = function () {
      this.FFields = undefined;
      pas.JSONDataset.TBaseJSONDataSet.$final.call(this);
    };
    this.InternalOpen = function () {
      var I = 0;
      pas.JSONDataset.TBaseJSONDataSet.InternalOpen.call(this);
      pas.System.Writeln("Checking ID field ",this.FIDField," as key field");
      for (var $l1 = 0, $end2 = this.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        if (pas.SysUtils.SameText(this.FFieldList.GetField(I).FFieldName,this.FIDField)) {
          this.FFieldList.GetField(I).FProviderFlags = rtl.unionSet(this.FFieldList.GetField(I).FProviderFlags,rtl.createSet(pas.DB.TProviderFlag.pfInKey));
          pas.System.Writeln("Setting ID field ",this.FIDField," as key field");
        };
      };
    };
    this.DoResolveRecordUpdate = function (anUpdate) {
      var Result = false;
      var D = undefined;
      var O = null;
      var A = null;
      var I = 0;
      var RecordIndex = 0;
      var FN = "";
      Result = true;
      if (anUpdate.FOriginalStatus === pas.DB.TUpdateStatus.usDeleted) return Result;
      D = anUpdate.FServerData;
      if (pas.JS.isNull(D)) return Result;
      if (!rtl.isNumber(anUpdate.FBookmark.Data)) return false;
      RecordIndex = Math.floor(anUpdate.FBookmark.Data);
      if (rtl.isString(D)) {
        O = rtl.getObject(JSON.parse("" + D))}
       else if (rtl.isObject(D)) {
        O = rtl.getObject(D)}
       else return false;
      if (!rtl.isArray(O[this.FRoot])) return false;
      A = rtl.getObject(O[this.FRoot]);
      if (A.length === 1) {
        O = rtl.getObject(A[0]);
        for (var $l1 = 0, $end2 = this.FFieldList.GetCount() - 1; $l1 <= $end2; $l1++) {
          I = $l1;
          if (O.hasOwnProperty(this.FFieldList.GetField(I).FFieldName)) this.FFieldMapper.SetJSONDataForField$1(this.FFieldList.GetField(I),this.FRows[RecordIndex],O[FN]);
        };
      };
      return Result;
    };
    this.DataPacketReceived = function (ARequest) {
      var Result = false;
      var O = null;
      var A = null;
      Result = false;
      if (pas.JS.isNull(ARequest.FData)) return Result;
      if (rtl.isString(ARequest.FData)) {
        O = rtl.getObject(JSON.parse("" + ARequest.FData))}
       else if (rtl.isObject(ARequest.FData)) {
        O = rtl.getObject(ARequest.FData)}
       else pas.DB.DatabaseError("Cannot handle data packet");
      if (this.FRoot === "") this.FRoot = "rows";
      if (this.FIDField === "") this.FIDField = "id";
      if (O.hasOwnProperty("metaData") && rtl.isObject(O["metaData"])) {
        if (!this.GetActive()) this.SetMetaData(rtl.getObject(O["metaData"]));
        if (this.FMetaData.hasOwnProperty("root") && rtl.isString(this.FMetaData["root"])) this.FRoot = "" + this.FMetaData["root"];
        if (this.FMetaData.hasOwnProperty("idField") && rtl.isString(this.FMetaData["idField"])) this.FIDField = "" + this.FMetaData["idField"];
      };
      if (O.hasOwnProperty(this.FRoot) && rtl.isArray(O[this.FRoot])) {
        A = rtl.getObject(O[this.FRoot]);
        Result = A.length > 0;
        this.AddToRows(A);
      };
      return Result;
    };
    this.GenerateMetaData = function () {
      var Result = null;
      var F = null;
      var O = null;
      var I = 0;
      var M = 0;
      var T = "";
      Result = new Object();
      F = new Array();
      Result["fields"] = F;
      for (var $l1 = 0, $end2 = this.FFieldDefs.GetCount() - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        O = pas.JS.New(["name",this.FFieldDefs.GetItem$1(I).FName]);
        F.push(O);
        M = 0;
        var $tmp3 = this.FFieldDefs.GetItem$1(I).FDataType;
        if (($tmp3 === pas.DB.TFieldType.ftFixedChar) || ($tmp3 === pas.DB.TFieldType.ftString)) {
          T = "string";
          M = this.FFieldDefs.GetItem$1(I).FSize;
        } else if ($tmp3 === pas.DB.TFieldType.ftBoolean) {
          T = "boolean"}
         else if ((($tmp3 === pas.DB.TFieldType.ftDate) || ($tmp3 === pas.DB.TFieldType.ftTime)) || ($tmp3 === pas.DB.TFieldType.ftDateTime)) {
          T = "date"}
         else if ($tmp3 === pas.DB.TFieldType.ftFloat) {
          T = "float"}
         else if ((($tmp3 === pas.DB.TFieldType.ftInteger) || ($tmp3 === pas.DB.TFieldType.ftAutoInc)) || ($tmp3 === pas.DB.TFieldType.ftLargeInt)) {
          T = "int"}
         else {
          throw pas.JSONDataset.EJSONDataset.$create("CreateFmt",["Unsupported field type : %s",[this.FFieldDefs.GetItem$1(I).FDataType]]);
        };
        O["type"] = T;
        if (M !== 0) O["maxlen"] = M;
      };
      Result["root"] = "rows";
      return Result;
    };
    this.ConvertDateFormat = function (S) {
      var Result = "";
      Result = pas.SysUtils.StringReplace(S,"y","yy",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"Y","yyyy",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"g","h",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"G","hh",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"F","mmmm",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"M","mmm",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"n","m",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"D","ddd",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"j","d",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"l","dddd",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"i","nn",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"u","zzz",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
      Result = pas.SysUtils.StringReplace(Result,"a","am\/pm",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll,pas.SysUtils.TStringReplaceFlag.rfIgnoreCase));
      Result = pas.SysUtils.LowerCase(Result);
      return Result;
    };
    this.MetaDataToFieldDefs = function () {
      var A = null;
      var F = null;
      var I = 0;
      var FS = 0;
      var N = "";
      var ft = 0;
      var D = undefined;
      this.FFieldDefs.Clear();
      D = this.FMetaData["fields"];
      if (!rtl.isArray(D)) throw pas.JSONDataset.EJSONDataset.$create("Create$1",["Invalid metadata object"]);
      A = rtl.getObject(D);
      for (var $l1 = 0, $end2 = A.length - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        if (!rtl.isObject(A[I])) throw pas.JSONDataset.EJSONDataset.$create("CreateFmt",["Field definition %d in metadata is not an object",[I]]);
        F = rtl.getObject(A[I]);
        D = F["name"];
        if (!rtl.isString(D)) throw pas.JSONDataset.EJSONDataset.$create("CreateFmt",["Field definition %d in has no or invalid name property",[I]]);
        N = "" + D;
        D = F["type"];
        if (pas.JS.isNull(D) || pas.JS.isUndefined(D)) {
          ft = pas.DB.TFieldType.ftString}
         else if (!rtl.isString(D)) {
          throw pas.JSONDataset.EJSONDataset.$create("CreateFmt",["Field definition %d in has invalid type property",[I]]);
        } else {
          ft = this.StringToFieldType("" + D);
        };
        if (ft === pas.DB.TFieldType.ftString) {
          FS = this.GetStringFieldLength(F,N,I)}
         else FS = 0;
        this.FFieldDefs.Add$4(N,ft,FS);
      };
      this.FFields = A;
    };
    this.InitDateTimeFields = function () {
      var F = null;
      var FF = null;
      var I = 0;
      var Fmt = "";
      var D = undefined;
      if (this.FFields === null) return;
      for (var $l1 = 0, $end2 = this.FFields.length - 1; $l1 <= $end2; $l1++) {
        I = $l1;
        F = rtl.getObject(this.FFields[I]);
        D = F["type"];
        if (rtl.isString(D) && (("" + D) === "date")) {
          D = F["dateFormat"];
          if (rtl.isString(D)) {
            Fmt = this.ConvertDateFormat("" + D);
            FF = this.FindField("" + F["name"]);
            if (((FF !== null) && (FF.FDataType in rtl.createSet(pas.DB.TFieldType.ftDate,pas.DB.TFieldType.ftTime,pas.DB.TFieldType.ftDateTime))) && (FF.FFieldKind === pas.DB.TFieldKind.fkData)) {
              if (pas.JSONDataset.TJSONDateField.isPrototypeOf(FF)) {
                FF.FDateFormat = Fmt}
               else if (pas.JSONDataset.TJSONTimeField.isPrototypeOf(FF)) {
                FF.FTimeFormat = Fmt}
               else if (pas.JSONDataset.TJSONDateTimeField.isPrototypeOf(FF)) FF.FDateTimeFormat = Fmt;
            };
          };
        };
      };
    };
    this.StringToFieldType = function (S) {
      var Result = 0;
      if (S === "int") {
        Result = pas.DB.TFieldType.ftLargeInt}
       else if (S === "float") {
        Result = pas.DB.TFieldType.ftFloat}
       else if (S === "boolean") {
        Result = pas.DB.TFieldType.ftBoolean}
       else if (S === "date") {
        Result = pas.DB.TFieldType.ftDateTime}
       else if (((S === "string") || (S === "auto")) || (S === "")) {
        Result = pas.DB.TFieldType.ftString}
       else if (this.FMUS) {
        Result = pas.DB.TFieldType.ftString}
       else throw pas.JSONDataset.EJSONDataset.$create("CreateFmt",["Unknown JSON data type : %s",[S]]);
      return Result;
    };
    this.GetStringFieldLength = function (F, AName, AIndex) {
      var Result = 0;
      var I = 0;
      var L = 0;
      var D = undefined;
      Result = 0;
      D = F["maxlen"];
      if (!isNaN(pas.JS.toNumber(D))) {
        Result = pas.System.Trunc(pas.JS.toNumber(D));
        if (Result <= 0) throw pas.JSONDataset.EJSONDataset.$create("CreateFmt",["Invalid maximum length specifier for field %s",[AName]]);
      } else {
        for (var $l1 = 0, $end2 = this.FRows.length - 1; $l1 <= $end2; $l1++) {
          I = $l1;
          D = this.FFieldMapper.GetJSONDataForField(AName,AIndex,this.FRows[I]);
          if (rtl.isString(D)) {
            L = ("" + D).length;
            if (L > Result) Result = L;
          };
        };
      };
      if (Result === 0) Result = 20;
      return Result;
    };
    this.Create$1 = function (AOwner) {
      pas.JSONDataset.TBaseJSONDataSet.Create$1.call(this,AOwner);
      this.FUseDateTimeFormatFields = true;
    };
    var $r = this.$rtti;
    $r.addProperty("FieldDefs",2,pas.DB.$rtti["TFieldDefs"],"FFieldDefs","SetFieldDefs");
    $r.addProperty("Active",3,rtl.boolean,"GetActive","SetActive",{Default: false});
    $r.addProperty("BeforeOpen",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeOpen","FBeforeOpen");
    $r.addProperty("AfterOpen",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterOpen","FAfterOpen");
    $r.addProperty("BeforeClose",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeClose","FBeforeClose");
    $r.addProperty("AfterClose",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterClose","FAfterClose");
    $r.addProperty("BeforeInsert",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeInsert","FBeforeInsert");
    $r.addProperty("AfterInsert",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterInsert","FAfterInsert");
    $r.addProperty("BeforeEdit",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeEdit","FBeforeEdit");
    $r.addProperty("AfterEdit",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterEdit","FAfterEdit");
    $r.addProperty("BeforePost",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforePost","FBeforePost");
    $r.addProperty("AfterPost",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterPost","FAfterPost");
    $r.addProperty("BeforeCancel",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeCancel","FBeforeCancel");
    $r.addProperty("AfterCancel",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterCancel","FAfterCancel");
    $r.addProperty("BeforeDelete",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeDelete","FBeforeDelete");
    $r.addProperty("AfterDelete",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterDelete","FAfterDelete");
    $r.addProperty("BeforeScroll",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FBeforeScroll","FBeforeScroll");
    $r.addProperty("AfterScroll",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FAfterScroll","FAfterScroll");
    $r.addProperty("OnCalcFields",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FOnCalcFields","FOnCalcFields");
    $r.addProperty("OnDeleteError",0,pas.DB.$rtti["TDataSetErrorEvent"],"FOnDeleteError","FOnDeleteError");
    $r.addProperty("OnEditError",0,pas.DB.$rtti["TDataSetErrorEvent"],"FOnEditError","FOnEditError");
    $r.addProperty("OnFilterRecord",2,pas.DB.$rtti["TFilterRecordEvent"],"FOnFilterRecord","SetOnFilterRecord");
    $r.addProperty("OnNewRecord",0,pas.DB.$rtti["TDataSetNotifyEvent"],"FOnNewRecord","FOnNewRecord");
    $r.addProperty("OnPostError",0,pas.DB.$rtti["TDataSetErrorEvent"],"FOnPostError","FOnPostError");
  });
  rtl.createClass($mod,"TExtJSJSONObjectDataSet",$mod.TExtJSJSONDataSet,function () {
    this.CreateFieldMapper = function () {
      var Result = null;
      Result = pas.JSONDataset.TJSONObjectFieldMapper.$create("Create");
      return Result;
    };
  });
  rtl.createClass($mod,"TExtJSJSONArrayDataSet",$mod.TExtJSJSONDataSet,function () {
    this.CreateFieldMapper = function () {
      var Result = null;
      Result = pas.JSONDataset.TJSONArrayFieldMapper.$create("Create");
      return Result;
    };
  });
});
rtl.module("AvammDB",["System","Classes","SysUtils","DB","ExtJSDataset","Avamm","JS","Web","Types"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TAvammDataset",pas.ExtJSDataset.TExtJSJSONObjectDataSet,function () {
    this.$init = function () {
      pas.ExtJSDataset.TExtJSJSONObjectDataSet.$init.call(this);
      this.FDataSetName = "";
      this.FDataProxy$1 = null;
      this.FFieldDefsLoaded = null;
      this.FSFilter = "";
    };
    this.$final = function () {
      this.FDataProxy$1 = undefined;
      this.FFieldDefsLoaded = undefined;
      pas.ExtJSDataset.TExtJSJSONObjectDataSet.$final.call(this);
    };
    this.GetUrl = function () {
      var Result = "";
      Result = ((pas.Avamm.GetBaseUrl() + "\/") + this.FDataSetName) + "\/list.json?mode=extjs";
      if (this.FSFilter !== "") Result = (Result + "&filter=") + encodeURIComponent(this.FSFilter);
      Result = Result + "&dhxr=none";
      return Result;
    };
    this.SetFilter = function (AValue) {
      if (this.FSFilter === AValue) return;
      this.FSFilter = AValue;
      this.DisableControls();
      this.Close();
      this.SetRows(null);
      this.EnableControls();
    };
    this.DoGetDataProxy = function () {
      var Result = null;
      Result = this.FDataProxy$1;
      return Result;
    };
    this.InitDateTimeFields = function () {
      pas.ExtJSDataset.TExtJSJSONDataSet.InitDateTimeFields.call(this);
      if (this.FFieldDefsLoaded != null) this.FFieldDefsLoaded(this);
    };
    this.DoResolveRecordUpdate = function (anUpdate) {
      var Result = false;
      Result = true;
      return Result;
    };
    this.Create$5 = function (AOwner, aDataSet) {
      pas.ExtJSDataset.TExtJSJSONDataSet.Create$1.call(this,AOwner);
      this.FDataSetName = aDataSet;
      this.FDataProxy$1 = $mod.TAvammDataProxy.$create("Create$1",[this]);
    };
    this.Locate = function (KeyFields, KeyValues, Options) {
      var Result = false;
      Result = pas.DB.TDataSet.Locate.call(this,KeyFields,KeyValues,rtl.refSet(Options));
      if (this.FState in rtl.createSet(pas.DB.TDataSetState.dsInsert,pas.DB.TDataSetState.dsEdit)) return Result;
      this.DisableControls();
      try {
        this.First();
        while (!this.FEOF) {
          if (this.FFieldDefs.IndexOf(KeyFields) === -1) return Result;
          if (this.FieldByName(KeyFields).GetAsJSValue() == KeyValues) {
            Result = true;
            return Result;
          };
          this.Next();
        };
      } finally {
        this.EnableControls();
      };
      return Result;
    };
    var $r = this.$rtti;
    $r.addProperty("OnFieldDefsLoaded",0,pas.Classes.$rtti["TNotifyEvent"],"FFieldDefsLoaded","FFieldDefsLoaded");
  });
  rtl.createClass($mod,"TAvammDataProxy",pas.DB.TDataProxy,function () {
    this.CheckBatchComplete = function (aBatch) {
      var BatchOK = false;
      var I = 0;
      BatchOK = true;
      I = aBatch.FList.FCount - 1;
      while (BatchOK && (I >= 0)) {
        BatchOK = aBatch.FList.GetUpdate(I).FStatus in rtl.createSet(pas.DB.TUpdateStatus.usResolved);
        if (aBatch.FList.GetUpdate(I).FStatus in rtl.createSet(pas.DB.TUpdateStatus.usResolveFailed)) throw pas.SysUtils.Exception.$create("Create$1",[pas.SysUtils.Format(rtl.getResStr(pas.AvammDB,"strFailedToSaveToDB"),[aBatch.FList.GetUpdate(I).FResolveError])]);
        I -= 1;
      };
      if (BatchOK && (aBatch.FOnResolve != null)) aBatch.FOnResolve(this,aBatch);
    };
    this.Create$1 = function (AOwner) {
      pas.Classes.TComponent.Create$1.call(this,AOwner);
    };
    this.DoGetData = function (aRequest) {
      var Result = false;
      var URL = "";
      var R = null;
      Result = false;
      R = aRequest;
      R.FXHR = new XMLHttpRequest();
      R.FXHR.addEventListener("load",rtl.createCallback(R,"onLoad"));
      URL = this.FOwner.GetUrl();
      if (URL === "") {
        R.FSuccess = pas.DB.TDataRequestResult.rrFail;
        R.FErrorMsg = "No URL to get data";
        R.DoAfterRequest();
      } else {
        R.FXHR.open("GET",URL,true);
        if (pas.Avamm.AvammLogin !== "") {
          R.FXHR.setRequestHeader("Authorization","Basic " + pas.Avamm.AvammLogin);
        };
        R.FXHR.send();
        Result = true;
      };
      return Result;
    };
    this.GetDataRequest = function (aOptions, aAfterRequest, aAfterLoad) {
      var Result = null;
      Result = $mod.TAvammDataRequest.$create("Create$1",[this,rtl.refSet(aOptions),aAfterRequest,aAfterLoad]);
      return Result;
    };
    this.GetUpdateDescriptorClass = function () {
      var Result = null;
      Result = $mod.TAvammUpdateDescriptor;
      return Result;
    };
    this.ProcessUpdateBatch = function (aBatch) {
      var Result = false;
      var aDesc = null;
      var i = 0;
      var Arr = null;
      var FXHR = null;
      var URL = "";
      Arr = new Array();
      FXHR = new XMLHttpRequest();
      for (var $l1 = 0, $end2 = aBatch.FList.FCount - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        aDesc = rtl.getObject(aBatch.FList.Get(i));
        aDesc.FBatch = aBatch;
        aDesc.FXHR = FXHR;
        Arr.push(aDesc.FData);
        FXHR.addEventListener("load",rtl.createCallback(aDesc,"onLoad"));
      };
      URL = this.FOwner.GetUrl();
      if (URL === "") {
        Result = false;
      } else {
        FXHR.open("POST",URL,true);
        if (pas.Avamm.AvammLogin !== "") {
          FXHR.setRequestHeader("Authorization","Basic " + pas.Avamm.AvammLogin);
        };
        FXHR.send(JSON.stringify(Arr));
        Result = true;
      };
      return Result;
    };
  });
  rtl.createClass($mod,"TAvammDataRequest",pas.DB.TDataRequest,function () {
    this.$init = function () {
      pas.DB.TDataRequest.$init.call(this);
      this.FXHR = null;
    };
    this.$final = function () {
      this.FXHR = undefined;
      pas.DB.TDataRequest.$final.call(this);
    };
    this.onLoad = function (Event) {
      var Result = false;
      var aarr = undefined;
      if (!(this != null)) return Result;
      if (Math.floor(this.FXHR.status / 100) === 2) {
        this.FData = this.TransformResult();
        this.FSuccess = pas.DB.TDataRequestResult.rrOK;
      } else {
        this.FData = null;
        if ((pas.DB.TLoadOption.loAtEOF in this.FLoadOptions) && (this.FXHR.status === 404)) {
          this.FSuccess = pas.DB.TDataRequestResult.rrEOF}
         else {
          this.FSuccess = pas.DB.TDataRequestResult.rrFail;
          if (this.FXHR.responseText !== "") {
            this.FErrorMsg = this.FXHR.responseText}
           else this.FErrorMsg = this.FXHR.statusText;
        };
      };
      try {
        this.DoAfterRequest();
      } catch ($e) {
      };
      Result = true;
      return Result;
    };
    this.TransformResult = function () {
      var Result = undefined;
      Result = this.FXHR.responseText;
      return Result;
    };
  });
  rtl.createClass($mod,"TAvammUpdateDescriptor",pas.DB.TRecordUpdateDescriptor,function () {
    this.$init = function () {
      pas.DB.TRecordUpdateDescriptor.$init.call(this);
      this.FXHR = null;
      this.FBatch = null;
    };
    this.$final = function () {
      this.FXHR = undefined;
      this.FBatch = undefined;
      pas.DB.TRecordUpdateDescriptor.$final.call(this);
    };
    this.onLoad = function (Event) {
      var Result = false;
      if (Math.floor(this.FXHR.status / 100) === 2) {
        this.Resolve(this.FXHR.response);
        Result = true;
      } else this.ResolveFailed(this.FXHR.responseText);
      rtl.as(this.FProxy,$mod.TAvammDataProxy).CheckBatchComplete(this.FBatch);
      return Result;
    };
  });
  $mod.$resourcestrings = {strFailedToSaveToDB: {org: "Fehler beim speichern: %s"}};
});
rtl.module("dhtmlx_toolbar",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_grid",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_popup",["System","JS","Web","dhtmlx_base"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_dataprocessor",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_datastore",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_db",["System","Classes","SysUtils","DB","dhtmlx_dataprocessor","JS","Types","dhtmlx_datastore"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TDHTMLXDataLink",pas.DB.TDataLink,function () {
    this.$init = function () {
      pas.DB.TDataLink.$init.call(this);
      this.FDataprocessor = null;
      this.FDatastore = null;
      this.FIdField = "";
      this.FInCheckForDeletions = false;
    };
    this.$final = function () {
      this.FDataprocessor = undefined;
      this.FDatastore = undefined;
      pas.DB.TDataLink.$final.call(this);
    };
    this.AddRows = function () {
      var i = 0;
      var a = 0;
      var aObj = null;
      var aRec = new pas.DB.TBookmark();
      var aId = undefined;
      this.GetDataset().DisableControls();
      aRec = new pas.DB.TBookmark(this.GetDataset().GetBookmark());
      this.GetDataset().First();
      while (!this.GetDataset().FEOF) {
        aObj = new Object();
        for (var $l1 = 0, $end2 = this.GetDataset().GetfieldCount() - 1; $l1 <= $end2; $l1++) {
          a = $l1;
          if (this.GetDataset().FFieldList.GetField(a).FFieldName === this.FIdField) {
            aObj["id"] = this.GetDataset().FFieldList.GetField(a).GetAsJSValue();
            aId = this.GetDataset().FFieldList.GetField(a).GetAsJSValue();
          } else if (pas.DB.TDateField.isPrototypeOf(this.GetDataset().FFieldList.GetField(a)) || pas.DB.TDateTimeField.isPrototypeOf(this.GetDataset().FFieldList.GetField(a))) {
            aObj[this.GetDataset().FFieldList.GetField(a).FFieldName] = this.GetDataset().FFieldList.GetField(a).GetAsJSValue()}
           else aObj[this.GetDataset().FFieldList.GetField(a).FFieldName] = this.GetDataset().FFieldList.GetField(a).GetDisplayText();
        };
        try {
          if (this.FDatastore.item(aId) == null) this.FDatastore.add(aObj);
        } catch ($e) {
        };
        this.GetDataset().Next();
      };
      this.GetDataset().GotoBookmark(aRec);
      this.GetDataset().EnableControls();
    };
    this.ResetDataProcessor = function () {
      this.FDataprocessor.cleanUpdate();
    };
    this.DataStoreCursorChanged = function (id) {
      pas.System.Writeln("DataStoreCursorChange ",id);
      this.GetDataset().Locate(this.FIdField,id,{});
    };
    this.DataStoreCursorChanging = function (id) {
      pas.System.Writeln("DataStoreCursorChanguing ",id);
      this.GetDataset().Locate(this.FIdField,id,{});
    };
    this.DataStoreUpdated = function (id, obj, mode) {
      pas.System.Writeln("DatastoreUpdated ",id);
    };
    this.DataStoreDeleteItem = function (id) {
      var Result = false;
      pas.System.Writeln("DataStoreDeleteItem ",id);
      this.GetDataset().DisableControls();
      if ((this.GetDataset().FState === pas.DB.TDataSetState.dsInsert) && (this.GetDataset().FieldByName(this.FIdField).GetAsJSValue() == id)) {
        this.GetDataset().Cancel();
        Result = true;
      } else if (this.GetDataset().FState === pas.DB.TDataSetState.dsEdit) this.GetDataset().Post();
      Result = this.GetDataset().Locate(this.FIdField,id,{});
      if (Result) {
        this.GetDataset().Delete()}
       else pas.System.Writeln("Record to delete not found !",id);
      this.GetDataset().EnableControls();
      return Result;
    };
    this.DataProcessorDataUpdated = function (id, state, data) {
      var Result = false;
      var aProps = [];
      var i = 0;
      var aField = null;
      var aPropType = "";
      this.GetDataset().DisableControls();
      try {
        Result = false;
        if ((this.GetDataset().FieldByName(this.FIdField).GetAsJSValue() == null) && (this.GetDataset().FState === pas.DB.TDataSetState.dsInsert)) this.GetDataset().FieldByName(this.FIdField).SetAsJSValue(id);
        if (id != this.GetDataset().FieldByName(this.FIdField).GetAsJSValue()) {
          if ((this.GetDataset().FState === pas.DB.TDataSetState.dsInsert) || (this.GetDataset().FState === pas.DB.TDataSetState.dsEdit)) this.GetDataset().Post();
          if (!this.GetDataset().Locate(this.FIdField,id,{})) {
            pas.System.Writeln("Failed to find ROW ! ",id," ",this.GetDataset().FState);
            return Result;
          };
        };
        if (!(this.GetDataset().FState in rtl.createSet(pas.DB.TDataSetState.dsEdit,pas.DB.TDataSetState.dsInsert))) this.GetDataset().Edit();
        aProps = Object.getOwnPropertyNames(data);
        for (var $l1 = 0, $end2 = rtl.length(aProps) - 1; $l1 <= $end2; $l1++) {
          i = $l1;
          aField = this.GetDataset().FFieldList.FindField(aProps[i]);
          if (aField != null) {
            if ((data[aProps[i]] != aField.GetAsJSValue()) && !((data[aProps[i]] == "") && aField.GetIsNull())) {
              aPropType = typeof(data[aProps[i]]);
              if ((aField.FFieldDef.FDataType === pas.DB.TFieldType.ftString) || (aPropType === "string")) {
                aField.SetEditText("" + data[aProps[i]])}
               else aField.SetAsJSValue(data[aProps[i]]);
            };
          } else pas.System.Writeln(("Field " + aProps[i]) + " not found !");
        };
      } finally {
        this.GetDataset().EnableControls();
      };
      this.FDataprocessor.setUpdated(id);
      return Result;
    };
    this.Delete = function (id) {
      if (id == undefined) return;
      pas.System.Writeln("deleting ",id);
      this.FDataprocessor.setUpdated(id);
      this.FDatastore.remove(id);
    };
    this.CheckforDeletions = function () {
      var aId = undefined;
      var aRec = new pas.DB.TBookmark();
      if (this.FInCheckForDeletions) return;
      this.FInCheckForDeletions = true;
      this.GetDataset().DisableControls();
      aRec = new pas.DB.TBookmark(this.GetDataset().GetBookmark());
      aId = this.FDatastore.first();
      do {
        try {
          if ((aId != undefined) && !this.GetDataset().Locate(this.FIdField,aId,{})) {
            aId = this.FDatastore.next(aId);
            this.Delete(aId);
          } else aId = this.FDatastore.next(aId);
        } catch ($e) {
          aId = this.FDatastore.next(aId);
        };
      } while (!(aId == this.FDatastore.last()));
      this.GetDataset().GotoBookmark(aRec);
      this.GetDataset().EnableControls();
      this.FInCheckForDeletions = false;
    };
    this.ClearData = function () {
      var aId = undefined;
      var tmp = "";
      aId = this.FDatastore.first();
      while (aId != this.FDatastore.last()) {
        try {
          this.FDataprocessor.setUpdated(aId);
        } catch ($e) {
        };
        aId = this.FDatastore.next(aId);
      };
      this.FDatastore.clearAll();
    };
    this.UpdateData = function () {
      pas.System.Writeln("UpdateData");
    };
    this.RecordChanged = function (Field) {
      pas.System.Writeln("RecordChanged ",Field);
      pas.DB.TDataLink.RecordChanged.call(this,Field);
    };
    this.ActiveChanged = function () {
      var aId = undefined;
      pas.DB.TDataLink.ActiveChanged.call(this);
      pas.System.Writeln("ActiveChanged");
      this.ClearData();
      if (this.FActive) this.FDataprocessor.ignore(rtl.createCallback(this,"AddRows"));
    };
    this.GetRecordCount = function () {
      var Result = 0;
      Result = this.GetDataset().GetRecordCount();
      return Result;
    };
    this.DataEvent = function (Event, Info) {
      var Self = this;
      var tmp = undefined;
      function SetId() {
        Self.GetDataset().FieldByName(Self.FIdField).SetAsJSValue(tmp);
      };
      var $tmp1 = Event;
      if ($tmp1 === pas.DB.TDataEvent.deFieldChange) {
        pas.System.Writeln("DataEvent ","deFieldChange")}
       else if ($tmp1 === pas.DB.TDataEvent.deRecordChange) {
        pas.System.Writeln("DataEvent ","deRecordChange")}
       else if ($tmp1 === pas.DB.TDataEvent.deDataSetChange) {
        pas.System.Writeln("DataEvent ","deDataSetChange");
      } else if ($tmp1 === pas.DB.TDataEvent.deDataSetScroll) {
        pas.System.Writeln("DataEvent ","deDataSetScroll");
        Self.FDatastore.setCursor(Self.GetDataset().FieldByName(Self.FIdField).GetAsJSValue());
      } else if ($tmp1 === pas.DB.TDataEvent.deLayoutChange) {
        pas.System.Writeln("DataEvent ","deLayoutChange")}
       else if ($tmp1 === pas.DB.TDataEvent.deUpdateRecord) {
        pas.System.Writeln("DataEvent ","deUpdateRecord")}
       else if ($tmp1 === pas.DB.TDataEvent.deUpdateState) {
        pas.System.Writeln("DataEvent ","deUpdateState");
        if (Self.GetDataset().FState === pas.DB.TDataSetState.dsInsert) {
          tmp = Self.FDatastore.add(new Object());
          pas.System.Writeln("Row ",tmp," inserted ",Self.GetDataset().GetRecordCount());
          Self.FDataprocessor.ignore(SetId);
          Self.FDatastore.setCursor(tmp);
        };
      } else if ($tmp1 === pas.DB.TDataEvent.deCheckBrowseMode) {
        pas.System.Writeln("DataEvent ","deCheckBrowseMode");
        Self.GetDataset().DisableControls();
        if ((Self.GetDataset().FState === pas.DB.TDataSetState.dsInsert) || (Self.GetDataset().FState === pas.DB.TDataSetState.dsEdit)) {
          pas.System.Writeln("Posting Dataset before Row Change ",Self.GetDataset().FieldByName(Self.FIdField).GetAsJSValue()," ",Self.GetDataset().FState);
          Self.GetDataset().Post();
        };
        Self.GetDataset().EnableControls();
      } else if ($tmp1 === pas.DB.TDataEvent.dePropertyChange) {
        pas.System.Writeln("DataEvent ","dePropertyChange")}
       else if ($tmp1 === pas.DB.TDataEvent.deFieldListChange) {
        pas.System.Writeln("DataEvent ","deFieldListChange")}
       else if ($tmp1 === pas.DB.TDataEvent.deFocusControl) {
        pas.System.Writeln("DataEvent ","deFocusControl")}
       else if ($tmp1 === pas.DB.TDataEvent.deParentScroll) {
        pas.System.Writeln("DataEvent ","deParentScroll")}
       else if ($tmp1 === pas.DB.TDataEvent.deConnectChange) {
        pas.System.Writeln("DataEvent ","deConnectChange")}
       else if ($tmp1 === pas.DB.TDataEvent.deReconcileError) {
        pas.System.Writeln("DataEvent ","deReconcileError")}
       else if ($tmp1 === pas.DB.TDataEvent.deDisabledStateChange) pas.System.Writeln("DataEvent ","deDisabledStateChange");
      pas.DB.TDataLink.DataEvent.apply(Self,arguments);
    };
    this.Create$2 = function () {
      pas.DB.TDataLink.Create$1.call(this);
      this.FInCheckForDeletions = false;
      this.FDatastore = new dhtmlXDataStore("");
      this.FDatastore.attachEvent("onAfterCursorChange",rtl.createCallback(this,"DataStoreCursorChanged"));
      this.FDatastore.attachEvent("onBeforeCursorChange",rtl.createCallback(this,"DataStoreCursorChanging"));
      this.FDatastore.attachEvent("onStoreUpdated",rtl.createCallback(this,"DataStoreUpdated"));
      this.FDatastore.attachEvent("onBeforeDelete",rtl.createCallback(this,"DataStoreDeleteItem"));
      this.FDataprocessor = new dataProcessor("");
      this.FDataprocessor.attachEvent("onBeforeUpdate",rtl.createCallback(this,"DataProcessorDataUpdated"));
      this.FDataprocessor.enablePartialDataSend(false);
      this.FDataprocessor.enableDataNames(true);
    };
  });
});
rtl.module("dhtmlx_tabbar",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("AvammWiki",["System","Classes","SysUtils","JS","Web","Types","dhtmlx_layout","dhtmlx_base","Avamm"],function () {
  "use strict";
  var $mod = this;
  this.Layout = null;
  this.Content = null;
  this.ShowStartpage = function () {
    function DoShowStartpage(aValue) {
      var Result = undefined;
      var FParent = undefined;
      var i = 0;
      if ($mod.Layout === null) {
        FParent = pas.Avamm.GetAvammContainer();
        $mod.Layout = new dhtmlXLayoutObject(pas.JS.New(["parent",FParent,"pattern","1C"]));
        $mod.Layout.cells("a").hideHeader();
        $mod.Content = document.createElement("div");
        $mod.Layout.cells("a").appendObject($mod.Content);
      };
      for (var $l1 = 0, $end2 = rtl.getObject(pas.Avamm.GetAvammContainer()).childNodes.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        rtl.getObject(pas.Avamm.GetAvammContainer()).childNodes.item(i).style.setProperty("display","none");
      };
      $mod.Layout.cont.style.setProperty("display","block");
      $mod.Layout.cells("a").progressOn();
      return Result;
    };
    pas.dhtmlx_base.WidgetsetLoaded.then(DoShowStartpage);
    $mod.Refresh();
  };
  this.Refresh = function () {
    function FillWiki(aValue) {
      var Result = undefined;
      $mod.Content.innerHTML = aValue.responseText;
      $mod.FixWikiContent($mod.Content,null);
      $mod.Layout.cells("a").progressOff();
      return Result;
    };
    var DataLoaded = null;
    pas.Avamm.LoadData("\/wiki\/" + ("" + pas.Avamm.UserOptions["startpage"]),false,"",6000).then(FillWiki);
  };
  this.FixWikiContent = function (elem, aForm) {
    var anchors = null;
    var images = null;
    var oldLink = "";
    var aTable = "";
    var aId = "";
    var aParams = "";
    var aHref = "";
    var i = 0;
    var a = 0;
    var jtmp = null;
    var aParam = [];
    try {
      if (elem.style.fontFamily!="Arial") {
        elem.style.fontFamily = "Arial";
        elem.style.fontSizeAdjust = 0.5;
      };
    } catch ($e) {
    };
    images = elem.getElementsByTagName("img");
    for (var $l1 = 0, $end2 = images.length - 1; $l1 <= $end2; $l1++) {
      i = $l1;
      try {
        aHref = images.item(i).getAttribute("src");
        aHref = pas.System.Copy(aHref,pas.System.Pos("(",aHref) + 1,aHref.length);
        aHref = pas.System.Copy(aHref,0,pas.System.Pos(")",aHref) - 1);
        aHref = ((pas.Avamm.GetBaseUrl() + "\/icons\/") + aHref) + ".png";
        images.item(i).setAttribute("src",aHref);
      } catch ($e) {
      };
    };
    anchors = elem.getElementsByTagName("a");
    for (var $l3 = 0, $end4 = anchors.length - 1; $l3 <= $end4; $l3++) {
      i = $l3;
      try {
        aHref = anchors[i].href;
        if ((pas.System.Pos("@",aHref) > 0) && ((pas.System.Copy(aHref,0,4) === "http") || (pas.System.Copy(aHref,0,4) === "file"))) {
          oldLink = decodeURI(anchors[i].href.substring(anchors[i].href.lastIndexOf('/')+1));
          aTable = oldLink.substring(0,oldLink.indexOf('@')).toLowerCase();
          if (pas.System.Pos("{",oldLink) > 0) {
            aId = pas.System.Copy(oldLink,0,pas.System.Pos("{",oldLink) - 1)}
           else aId = oldLink;
          aId = pas.System.Copy(aId,pas.System.Pos("@",aId) + 1,aId.length);
          if (pas.System.Pos("(",aId) > 0) {
            aParams = pas.System.Copy(aId,pas.System.Pos("(",aId) + 1,aId.length);
            aParams = pas.System.Copy(aParams,0,pas.System.Pos(")",aParams) - 1);
            jtmp = new String(aParams);
            aParam = jtmp.split(",");
            aId = pas.System.Copy(aId,0,pas.System.Pos("(",aId) - 1);
            aParams = "";
            for (var $l5 = 0, $end6 = rtl.length(aParam) - 1; $l5 <= $end6; $l5++) {
              a = $l5;
              aParams = (aParams + aParam[a]) + "&";
            };
            aParams = pas.System.Copy(aParams,0,aParams.length - 1);
          };
          if (aForm != null) {
            aParams = pas.SysUtils.StringReplace(aParams,"@VARIABLES.ID@","" + rtl.getObject(aForm)["BaseId"],rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
            aParams = pas.SysUtils.StringReplace(aParams,"@VARIABLES.SQL_ID@","" + rtl.getObject(aForm)["Id"],rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
          };
          if (aParams !== "") {
            anchors.item(i).setAttribute("href",(((("#" + aTable) + "\/by-id\/") + aId) + "\/") + aParams)}
           else anchors.item(i).setAttribute("href",((("#" + aTable) + "\/by-id\/") + aId) + "\/");
          anchors.item(i).setAttribute("AvammTable",aTable);
          anchors.item(i).setAttribute("AvammId",aId);
          anchors.item(i).setAttribute("AvammParams",aParams);
        };
      } catch ($e) {
      };
    };
  };
});
rtl.module("AvammForms",["System","Classes","SysUtils","JS","Web","AvammDB","dhtmlx_form","dhtmlx_toolbar","dhtmlx_grid","dhtmlx_layout","dhtmlx_popup","dhtmlx_db","dhtmlx_base","dhtmlx_windows","dhtmlx_tabbar","AvammRouter","webrouter","DB","Avamm"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TAvammContentForm",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FParent = null;
      this.FContainer = null;
    };
    this.$final = function () {
      this.FParent = undefined;
      this.FContainer = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.DoShow = function () {
      var i = 0;
      for (var $l1 = 0, $end2 = this.FParent.childNodes.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        this.FParent.childNodes.item(i).style.setProperty("display","none");
      };
      this.FContainer.style.setProperty("display","block");
    };
    this.Create$1 = function (aParent) {
      this.FParent = aParent;
      this.FContainer = document.createElement("div");
      this.FContainer.style.setProperty("height","100%");
      this.FContainer.style.setProperty("width","100%");
      aParent.appendChild(this.FContainer);
    };
    this.Show = function () {
      this.DoShow();
    };
  });
  rtl.createClass($mod,"TAvammListForm",$mod.TAvammContentForm,function () {
    this.$init = function () {
      $mod.TAvammContentForm.$init.call(this);
      this.FFilterHeader = "";
      this.FOldFilter = "";
      this.FDataSource = null;
      this.FDataLink = null;
      this.FDataSet = null;
      this.FTableName = "";
      this.Page = null;
      this.Toolbar = null;
      this.Grid = null;
    };
    this.$final = function () {
      this.FDataSource = undefined;
      this.FDataLink = undefined;
      this.FDataSet = undefined;
      this.Page = undefined;
      this.Toolbar = undefined;
      this.Grid = undefined;
      $mod.TAvammContentForm.$final.call(this);
    };
    this.FDataSetLoadFail = function (DataSet, ID, ErrorMsg) {
      this.Page.progressOff();
      dhtmlx.message(pas.JS.New(["type","error","text",(rtl.getResStr(pas.AvammForms,"strLoadingFailed") + " ") + ErrorMsg]));
    };
    this.SetFilterHeader = function (AValue) {
      if (this.FFilterHeader === AValue) return;
      this.FFilterHeader = AValue;
      if (AValue !== "") {
        this.Toolbar.addButtonTwoState("filter",0,"","fa fa-filter","fa fa-filter");
        this.Toolbar.setItemToolTip("filter",rtl.getResStr(pas.AvammForms,"strFilterTT"));
      } else this.Toolbar.removeItem("filter");
    };
    this.SwitchProgressOff = function (DataSet, Data) {
      this.Page.progressOff();
    };
    this.DoRowDblClick = function () {
      var Result = false;
      Result = false;
      pas.webrouter.Router().Push(((this.FTableName + "\/by-id\/") + ("" + this.Grid.getSelectedRowId())) + "\/");
      return Result;
    };
    this.ToolbarButtonClick = function (id) {
      if (id === "new") {}
      else if (id === "refresh") this.RefreshList();
    };
    this.Create$2 = function (aParent, aDataSet, aPattern) {
      var Self = this;
      function FilterStart(indexes, values) {
        var i = 0;
        Self.FOldFilter = "";
        if (indexes != null) for (var $l1 = 0, $end2 = indexes.length; $l1 <= $end2; $l1++) {
          i = $l1;
          if (values[i]) Self.FOldFilter = (((((Self.FOldFilter + ' AND lower("') + ("" + Self.Grid.getColumnId(Math.floor(indexes[i])))) + '")') + " like lower('%") + ("" + values[i])) + "%')";
        };
        Self.FOldFilter = pas.System.Copy(Self.FOldFilter,6,Self.FOldFilter.length);
        pas.System.Writeln("Filter:" + Self.FOldFilter);
        Self.Page.progressOn();
        try {
          window.console.log("Setting Server Filter");
          Self.FDataSet.SetFilter(Self.FOldFilter);
          Self.FDataSet.FOnLoadFail = rtl.createCallback(Self,"FDataSetLoadFail");
          window.console.log("Loading Data");
          Self.FDataSet.Load({},rtl.createCallback(Self,"SwitchProgressOff"));
        } catch ($e) {
          Self.Page.progressOff();
        };
      };
      function StateChange(id, state) {
        if (id === "filter") {
          if (state) {
            Self.Grid.attachHeader(Self.FFilterHeader);
            Self.Grid.setSizes();
          } else {
            Self.Grid.detachHeader(1);
            FilterStart(rtl.getObject(null),rtl.getObject(null));
          };
        };
      };
      function DoResizeLayout() {
        Self.Page.setSizes();
      };
      $mod.TAvammContentForm.Create$1.call(Self,aParent);
      pas.System.Writeln(("Loading " + aDataSet) + " as List...");
      window.addEventListener("ContainerResized",DoResizeLayout);
      Self.Page = new dhtmlXLayoutObject(pas.JS.New(["parent",Self.FContainer,"pattern",aPattern]));
      Self.Page.cont.style.setProperty("border-width","0");
      Self.Page.cells("a").hideHeader();
      Self.Toolbar = rtl.getObject(Self.Page.cells("a").attachToolbar(pas.JS.New(["parent",Self.Page,"iconset","awesome"])));
      Self.Toolbar.addButton("refresh",0,"","fa fa-refresh","fa fa-refresh");
      Self.Toolbar.setItemToolTip("refresh",rtl.getResStr(pas.AvammForms,"strRefresh"));
      Self.Toolbar.attachEvent("onClick",rtl.createCallback(Self,"ToolbarButtonClick"));
      Self.Toolbar.attachEvent("onStateChange",StateChange);
      Self.FTableName = aDataSet;
      Self.Grid = rtl.getObject(Self.Page.cells("a").attachGrid(pas.JS.New([])));
      Self.Grid.setImagesPath("codebase\/imgs\/");
      Self.Grid.setSizes();
      Self.Grid.enableAlterCss("even","uneven");
      Self.Grid.setEditable(false);
      Self.Grid.attachEvent("onFilterStart",FilterStart);
      Self.Grid.init();
      Self.FDataSource = pas.DB.TDataSource.$create("Create$1",[null]);
      Self.FDataLink = pas.dhtmlx_db.TDHTMLXDataLink.$create("Create$2");
      Self.FDataLink.FIdField = "sql_id";
      Self.FDataSet = pas.AvammDB.TAvammDataset.$create("Create$5",[null,aDataSet]);
      Self.FDataSource.SetDataSet(Self.FDataSet);
      Self.FDataLink.SetDataSource(Self.FDataSource);
      Self.Grid.attachEvent("onRowDblClicked",rtl.createCallback(Self,"DoRowDblClick"));
      Self.Grid.sync(Self.FDataLink.FDatastore);
    };
    this.RefreshList = function () {
      try {
        this.Page.progressOn();
        this.FDataSet.Load({},rtl.createCallback(this,"SwitchProgressOff"));
      } catch ($e) {
        if (pas.SysUtils.Exception.isPrototypeOf($e)) {
          var e = $e;
          pas.System.Writeln("Refresh Exception:" + e.fMessage);
          this.Page.progressOff();
        } else throw $e
      };
    };
    this.Show = function () {
      this.DoShow();
      this.Page.setSizes();
      this.RefreshList();
    };
  });
  this.TAvammFormMode = {"0": "fmTab", fmTab: 0, "1": "fmWindow", fmWindow: 1, "2": "fmInlineWindow", fmInlineWindow: 2};
  $mod.$rtti.$Enum("TAvammFormMode",{minvalue: 0, maxvalue: 2, ordtype: 1, enumtype: this.TAvammFormMode});
  rtl.createClass($mod,"TAvammForm",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FID = undefined;
      this.FParams = null;
      this.FTablename = "";
      this.FWindow = undefined;
      this.FParent = undefined;
      this.FData = null;
      this.FRawData = null;
      this.Layout = null;
      this.Form = null;
      this.gHistory = null;
      this.Toolbar = null;
      this.Tabs = null;
      this.ReportsLoaded = null;
      this.WikiLoaded = null;
      this.BaseId = undefined;
      this.Reports = null;
    };
    this.$final = function () {
      this.FParams = undefined;
      this.FData = undefined;
      this.FRawData = undefined;
      this.Layout = undefined;
      this.Form = undefined;
      this.gHistory = undefined;
      this.Toolbar = undefined;
      this.Tabs = undefined;
      this.ReportsLoaded = undefined;
      this.WikiLoaded = undefined;
      this.Reports = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.DoLoadData = function () {
      this.DoLoadHistory();
      this.Layout.cells("a").setHeight(90);
    };
    this.DoLoadHistory = function () {
      var i = 0;
      var History = null;
      var nEntry = null;
      History = rtl.getObject(rtl.getObject(this.FData["HISTORY"])["Data"]);
      this.gHistory.clearAll();
      for (var $l1 = 0, $end2 = History.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        nEntry = new Array();
        nEntry.push(((pas.Avamm.GetBaseUrl() + "\/icons\/") + ("" + rtl.getObject(History[i])["ACTIONICON"])) + ".png");
        nEntry.push(pas.SysUtils.StringReplace("" + rtl.getObject(History[i])["ACTION"],"\r","<br>",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll)));
        nEntry.push(rtl.getObject(History[i])["REFERENCE"]);
        nEntry.push(rtl.getObject(History[i])["CHANGEDBY"]);
        nEntry.push(rtl.getObject(History[i])["DATE"]);
        this.gHistory.addRow(rtl.getObject(History[i])["sql_id"],nEntry);
      };
    };
    this.SetTitle = function (aTitle) {
      if (rtl.isExt(this.FWindow,Window,1)) {
        rtl.getObject(this.FWindow).document.title = aTitle}
       else rtl.getObject(this.FWindow).setText(aTitle);
    };
    this.DoClose = function () {
      var Self = this;
      var Result = false;
      var tmp = "";
      function IntDoSave(aValue) {
        var Result = undefined;
        Self.DoSave();
        return Result;
      };
      function IntDoNothing(aValue) {
        var Result = undefined;
        return Result;
      };
      $mod.CheckSaved(Self.Toolbar).then(IntDoSave).catch(IntDoNothing);
      try {
        if (pas.System.Pos("" + Self.FID,pas.webrouter.Router().GetHistory().$class.getHash()) > 0) {
          tmp = pas.System.Copy(pas.webrouter.Router().GetHistory().$class.getHash(),0,pas.System.Pos("\/",pas.System.Copy(pas.webrouter.Router().GetHistory().$class.getHash(),2,255)) + 1);
          pas.webrouter.Router().GetHistory().$class.replaceHash("");
        };
      } catch ($e) {
      };
      Result = true;
      return Result;
    };
    this.Refresh = function () {
      var Self = this;
      function AddReports(aValue) {
        var Result = undefined;
        var i = 0;
        var aName = "";
        var aExt = "";
        Self.Reports = rtl.getObject(JSON.parse(aValue.responseText));
        Self.Toolbar.addButtonSelect("print",3,rtl.getResStr(pas.AvammForms,"strPrint"),new Array(),"fa fa-print","fa fa-print");
        for (var $l1 = 0, $end2 = Self.Reports.length - 1; $l1 <= $end2; $l1++) {
          i = $l1;
          aName = "" + rtl.getObject(Self.Reports[i])["name"];
          aExt = pas.System.Copy(aName,pas.System.Pos(".",aName) + 1,aName.length);
          aName = pas.System.Copy(aName,0,pas.System.Pos(".",aName) - 1);
          if (aExt === "pdf") ;
        };
        return Result;
      };
      function ReportsCouldntbeLoaded(aValue) {
        var Result = undefined;
        pas.System.Writeln("error loading report");
        return Result;
      };
      function WikiFormLoaded(aValue) {
        var Result = undefined;
        var aName = "";
        var aFrame = null;
        var cDiv = null;
        aName = aValue.responseURL;
        while (pas.System.Pos("\/",aName) > 0) aName = pas.System.Copy(aName,pas.System.Pos("\/",aName) + 1,aName.length);
        aName = pas.System.Copy(aName,0,pas.System.Pos(".",aName) - 1);
        if (pas.System.Pos("<body><\/body>",aValue.responseText) === 0) {
          cDiv = document.createElement("div");
          cDiv.innerHTML = aValue.responseText;
          pas.AvammWiki.FixWikiContent(cDiv,Self);
          try {
            if (aName === "overview") {
              Self.Tabs.addTab(aName,aName,null,0,true,false)}
             else Self.Tabs.addTab(aName,aName,null,5,false,false);
            Self.Tabs.cells(aName).appendObject(cDiv);
            if (cDiv.querySelector("title") != null) Self.Tabs.cells(aName).setText(cDiv.querySelector("title").innerText);
          } catch ($e) {
          };
        };
        return Result;
      };
      function AddWiki(aValue) {
        var Result = undefined;
        var Wiki = null;
        var aName = "";
        var aExt = "";
        var i = 0;
        Wiki = rtl.getObject(JSON.parse(aValue.responseText));
        for (var $l1 = 0, $end2 = Wiki.length - 1; $l1 <= $end2; $l1++) {
          i = $l1;
          aName = "" + rtl.getObject(Wiki[i])["name"];
          aExt = pas.System.Copy(aName,pas.System.Pos(".",aName) + 1,aName.length);
          if (aExt === "html") {
            pas.Avamm.LoadData((((("\/" + Self.FTablename) + "\/by-id\/") + ("" + Self.FID)) + "\/") + aName,false,"text\/html",7000).then(WikiFormLoaded);
          };
        };
        return Result;
      };
      function WikiCouldntbeLoaded(aValue) {
        var Result = undefined;
        return Result;
      };
      function ItemLoaded2(aValue) {
        var Result = undefined;
        Self.WikiLoaded = pas.Avamm.LoadData(((("\/" + Self.FTablename) + "\/by-id\/") + ("" + Self.FID)) + "\/.json",false,"",6000).then(AddWiki).catch(WikiCouldntbeLoaded);
        Self.ReportsLoaded = pas.Avamm.LoadData(((("\/" + Self.FTablename) + "\/by-id\/") + ("" + Self.FID)) + "\/reports\/.json",false,"",6000).then(AddReports).catch(ReportsCouldntbeLoaded);
        try {
          Self.DoLoadData();
        } catch ($e) {
        };
        return Result;
      };
      function ItemLoaded(aValue) {
        var Result = undefined;
        var Fields = null;
        Self.FRawData = rtl.getObject(JSON.parse(rtl.getObject(aValue).responseText));
        Self.FData = rtl.getObject(Self.FRawData[pas.SysUtils.UpperCase(Self.FTablename)]);
        Self.FData = rtl.getObject(rtl.getObject(Self.FData["Data"])[0]);
        Fields = Self.FData;
        if (Fields["NAME"] != null) {
          Self.Form.setItemValue("eShorttext","" + Fields["NAME"])}
         else if (Fields["SHORTTEXT"] != null) {
          Self.Form.setItemValue("eShorttext","" + Fields["SHORTTEXT"])}
         else if (Fields["SUBJECT"] != null) {
          Self.Form.setItemValue("eShorttext","" + Fields["SUBJECT"])}
         else if (Fields["SUMMARY"] != null) Self.Form.setItemValue("eShorttext","" + Fields["SUMMARY"]);
        if (Fields["ID"] != null) {
          Self.Form.setItemValue("eId","" + Fields["ID"]);
          Self.Form.showItem("eId");
        } else Self.Form.hideItem("eId");
        Self.BaseId = Self.Form.getItemValue("eId");
        if (("" + Self.Form.getItemValue("eShorttext")) !== "") Self.Form.showItem("eShorttext");
        Self.SetTitle("" + Self.Form.getItemValue("eShorttext"));
        Self.Layout.progressOff();
        return Result;
      };
      function ItemLoadError(aValue) {
        var Result = undefined;
        Self.Layout.progressOff();
        dhtmlx.message(pas.JS.New(["type","error","text",rtl.getResStr(pas.AvammForms,"strItemNotFound")]));
        if (rtl.isExt(Self.FWindow,Window,1)) {
          rtl.getObject(Self.FWindow).close()}
         else rtl.getObject(Self.FWindow).close();
        return Result;
      };
      pas.Avamm.LoadData(((("\/" + Self.FTablename) + "\/by-id\/") + ("" + Self.FID)) + "\/item.json?mode=extjs",false,"",6000).then(ItemLoaded).catch(ItemLoadError).then(ItemLoaded2);
    };
    this.DoSave = function () {
    };
    this.Create$1 = function (mode, aDataSet, Id, Params) {
      var Self = this;
      function ToolbarButtonClick(id) {
        if (id === "save") {
          Self.DoSave();
        } else if (id === "abort") {
          Self.Refresh();
        };
      };
      function WindowCreated(Event) {
        var Result = false;
        var a = null;
        var b = null;
        if (rtl.isExt(Self.FWindow,Window,1)) {
          Self.FWindow.pas.Avamm.AvammLogin = pas.Avamm.AvammLogin;
        };
        pas.System.Writeln("new Window loaded");
        Self.Layout = new dhtmlXLayoutObject(pas.JS.New(["parent",Self.FParent,"pattern","2E"]));
        a = Self.Layout.cells("a");
        a.hideHeader();
        b = Self.Layout.cells("b");
        b.hideHeader();
        Self.Layout.setSeparatorSize(0,5);
        Self.Layout.setOffsets(pas.JS.New(["left",0,"top",0,"right",0,"bottom",0]));
        Self.Toolbar = rtl.getObject(a.attachToolbar(pas.JS.New(["iconset","awesome"])));
        Self.Toolbar.addButton("save",0,rtl.getResStr(pas.AvammForms,"strSave"),"fa fa-save","fa fa-save");
        Self.Toolbar.addButton("abort",0,rtl.getResStr(pas.AvammForms,"strAbort"),"fa fa-cancel","fa fa-cancel");
        Self.Toolbar.attachEvent("onClick",ToolbarButtonClick);
        Self.Toolbar.disableItem("save");
        Self.Toolbar.disableItem("abort");
        Self.Form = rtl.getObject(a.attachForm(pas.JS.New([])));
        Self.Form.addItem(null,pas.JS.New(["type","block","width","auto","name","aBlock"]));
        Self.Form.addItem("aBlock",pas.JS.New(["type","input","label",rtl.getResStr(pas.AvammForms,"strNumber"),"name","eId","readonly",true,"hidden",true,"inputWidth",100,"note",rtl.getResStr(pas.AvammForms,"strNumberNote"),"tooltip",rtl.getResStr(pas.AvammForms,"strNumberTooltip")]));
        Self.Form.addItem("aBlock",pas.JS.New(["type","newcolumn"]));
        Self.Form.addItem("aBlock",pas.JS.New(["type","input","label",rtl.getResStr(pas.AvammForms,"strShorttext"),"name","eShorttext","readonly",true,"hidden",true,"inputWidth",400,"note",rtl.getResStr(pas.AvammForms,"strShorttextNote"),"tooltip",rtl.getResStr(pas.AvammForms,"strShorttextTooltip")]));
        a.setHeight(0);
        Self.Tabs = rtl.getObject(b.attachTabbar(pas.JS.New(["mode","top","align","left","close_button","true","content_zone","true","arrows_mode","auto"])));
        Self.Tabs.setSizes();
        Self.Tabs.addTab("history",rtl.getResStr(pas.AvammForms,"strHistory"),null,1,true,false);
        Self.gHistory = rtl.getObject(Self.Tabs.cells("history").attachGrid(pas.JS.New([])));
        Self.gHistory.setHeader("Icon,Eintrag,Referenz,ersteller,Datum");
        Self.gHistory.setColumnIds("ACTIONICON,ACTION,REFERENCE,CHANGEDDBY,DATE");
        Self.gHistory.setImagesPath("\/images\/");
        Self.gHistory.setColTypes("img,txt,txt,txt,txt");
        Self.gHistory.setInitWidths("30,*,100,80,120");
        Self.gHistory.enableMultiline(true);
        Self.gHistory.enableAutoWidth(true);
        Self.gHistory.enableKeyboardSupport(true);
        Self.gHistory.init();
        Self.Layout.progressOn();
        Self.Refresh();
        return Result;
      };
      Self.FWindow = null;
      Self.FParams = pas.Classes.TStringList.$create("Create$1");
      Self.FParams.SetDelimiter("&");
      if (Params !== "") Self.FParams.SetDelimitedText(Params);
      Self.FID = Id;
      Self.FTablename = aDataSet;
      if ((mode === $mod.TAvammFormMode.fmTab) || (mode === $mod.TAvammFormMode.fmWindow)) {
        if (!window.dhx.isChrome && !window.dhx.isIE) {
          var $tmp1 = mode;
          if ($tmp1 === $mod.TAvammFormMode.fmTab) {
            Self.FWindow = window.open((((((window.location.protocol + window.location.pathname) + "#\/") + Self.FTablename) + "\/by-id\/") + ("" + Id)) + "\/","_blank")}
           else if ($tmp1 === $mod.TAvammFormMode.fmWindow) Self.FWindow = window.open((((((window.location.protocol + window.location.pathname) + "#\/") + Self.FTablename) + "\/by-id\/") + ("" + Id)) + "\/","_top");
          if (Self.FWindow != null) {
            Self.FParent = rtl.getObject(Self.FWindow).document.body;
            rtl.getObject(Self.FWindow).onload = WindowCreated;
          };
        };
      };
      if (Self.FWindow == null) {
        Self.FWindow = pas.dhtmlx_windows.Windows.createWindow(Id,10,10,810,610);
        var $with2 = rtl.getObject(Self.FWindow);
        $with2.attachEvent("onClose",rtl.createCallback(Self,"DoClose"));
        $with2.maximize();
        $with2.setText("...");
        Self.FParent = Self.FWindow;
        WindowCreated(rtl.getObject(null));
      };
    };
  });
  rtl.createClass($mod,"TAvammAutoComplete",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FDataSource = null;
      this.FDataLink = null;
      this.FDataSet = null;
      this.aTimer = 0;
      this.FDblClick = null;
      this.FFilter = "";
      this.IsLoading = false;
      this.FSelect = false;
      this.FPopupParams = undefined;
      this.Grid = null;
      this.Popup = null;
    };
    this.$final = function () {
      this.FDataSource = undefined;
      this.FDataLink = undefined;
      this.FDataSet = undefined;
      this.FDblClick = undefined;
      this.Grid = undefined;
      this.Popup = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.FDataSourceStateChange = function (Sender) {
      if (this.FDataSet.GetActive()) if (this.FDataSet.GetRecordCount() > 0) {
        this.DoShowPopup();
      };
    };
    this.GridDblClicked = function () {
      if (this.FDblClick != null) {
        this.FDblClick(this);
        this.Popup.hide();
      };
    };
    this.Create$1 = function (aPopupParams, aTable, aRow, aHeader, aColIDs, aFilter) {
      var Self = this;
      var ppId = 0;
      function PopupShowed() {
        Self.Grid.attachEvent("onRowDblClicked",rtl.createCallback(Self,"GridDblClicked"));
        Self.Popup.detachEvent(ppId);
      };
      Self.IsLoading = false;
      Self.Popup = new dhtmlXPopup (aPopupParams);
      Self.Grid = rtl.getObject(Self.Popup.attachGrid(300,200));
      Self.FPopupParams = aPopupParams;
      var $with1 = Self.Grid;
      $with1.setSizes();
      $with1.enableAlterCss("even","uneven");
      $with1.setHeader(aHeader);
      $with1.setColumnIds(aColIDs);
      $with1.init();
      Self.FDataSource = pas.DB.TDataSource.$create("Create$1",[null]);
      Self.FDataLink = pas.dhtmlx_db.TDHTMLXDataLink.$create("Create$2");
      Self.FDataLink.FIdField = "sql_id";
      Self.FDataSet = pas.AvammDB.TAvammDataset.$create("Create$5",[null,aTable]);
      Self.FDataSource.SetDataSet(Self.FDataSet);
      Self.FDataSource.FOnStateChange = rtl.createCallback(Self,"FDataSourceStateChange");
      Self.FDataLink.SetDataSource(Self.FDataSource);
      Self.FFilter = aFilter;
      Self.Grid.sync(Self.FDataLink.FDatastore);
      ppId = Self.Popup.attachEvent("onShow",PopupShowed);
    };
    this.DoFilter = function (aFilter, DoSelect) {
      var Self = this;
      function DataLoaded(DataSet, Data) {
        Self.IsLoading = false;
      };
      function ResetInput() {
        var nFilter = "";
        if (Self.IsLoading) {
          window.clearTimeout(Self.aTimer);
          Self.aTimer = window.setTimeout(ResetInput,600);
        } else {
          nFilter = pas.SysUtils.StringReplace(Self.FFilter,"FILTERVALUE",aFilter,rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll,pas.SysUtils.TStringReplaceFlag.rfIgnoreCase));
          if (nFilter !== Self.FDataSet.FSFilter) {
            Self.FDataSet.SetFilter(nFilter);
            Self.FDataSet.Load({},DataLoaded);
            Self.IsLoading = true;
          };
        };
      };
      window.clearTimeout(Self.aTimer);
      Self.aTimer = window.setTimeout(ResetInput,600);
      Self.FSelect = DoSelect;
    };
    this.DoShowPopup = function () {
      if (!this.Popup.isVisible()) {
        this.Popup.show(rtl.getObject(rtl.getObject(this.FPopupParams)["id"])[0]);
        if (this.FSelect) this.Grid.selectRow(0);
      };
    };
  });
  this.CheckSaved = function (Toolbar) {
    var Result = null;
    function CheckPromise(resolve, reject) {
      function DoCheckIt(par) {
        if (par) {
          resolve(true)}
         else reject(false);
      };
      if (Toolbar.isEnabled("save")) {
        dhtmlx.message(pas.JS.New(["type","confirm","text",rtl.getResStr(pas.AvammForms,"strReallyCancel"),"cancel",rtl.getResStr(pas.AvammForms,"strNo"),"ok",rtl.getResStr(pas.AvammForms,"strYes"),"callback",DoCheckIt]));
      } else resolve(true);
    };
    Result = new Promise(CheckPromise);
    return Result;
  };
  $mod.$resourcestrings = {strRefresh: {org: "Aktualisieren"}, strLoadingFailed: {org: "Fehler beim laden von Daten vom Server"}, strSave: {org: "Speichern"}, strAbort: {org: "Abbrechen"}, strNumber: {org: "Nummer"}, strNumberNote: {org: "Die Nummer des Eintrages"}, strNumberTooltip: {org: "geben Sie hier die Id ein."}, strShorttext: {org: "Kurztext"}, strShorttextNote: {org: "Der Kurztext des Eintrages"}, strShorttextTooltip: {org: "geben Sie hier den Kurztext ein."}, strItemNotFound: {org: "Der gewünschte Eintrag wurde nicht gefunden, oder Sie benötigen das Recht diesen zu sehen"}, strPrint: {org: "Drucken"}, strFilterTT: {org: "Filter an\/auschalten"}, strHistory: {org: "Verlauf"}, strReallyCancel: {org: "Änderungen verwerfen ?"}, strYes: {org: "Ja"}, strNo: {org: "Nein"}, strNew: {org: "Neu"}, strDelete: {org: "Löschen"}};
},["AvammWiki"]);
rtl.module("dhtmlx_calendar",["System","JS","Web","SysUtils"],function () {
  "use strict";
  var $mod = this;
  this.DateFormatToDHTMLX = function (aDate) {
    var Result = "";
    Result = aDate;
    Result = pas.SysUtils.StringReplace(Result,"yyyy","%Y",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
    Result = pas.SysUtils.StringReplace(Result,"mm","%m",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
    Result = pas.SysUtils.StringReplace(Result,"dd","%d",rtl.createSet(pas.SysUtils.TStringReplaceFlag.rfReplaceAll));
    return Result;
  };
});
rtl.module("dhtmlx_carousel",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("program",["System","JS","Web","Classes","SysUtils","AvammRouter","webrouter","dhtmlx_form","Avamm","promet_dhtmlx","dhtmlx_treeview","dhtmlx_layout","dhtmlx_sidebar","dhtmlx_base","AvammForms","dhtmlx_calendar","dhtmlx_carousel"],function () {
  "use strict";
  var $mod = this;
  this.MobileCellWidth = 700;
  this.LoadEnviroment = true;
  this.Treeview = null;
  this.Layout = null;
  this.InitRouteFound = false;
  this.TreeviewSelectionChanged = undefined;
  this.FContainer = null;
  this.FInitialized = false;
  this.RouterBeforeRequest = function (Sender, ARouteURL) {
    $mod.Layout.progressOn();
  };
  this.RouterAfterRequest = function (Sender, ARouteURL) {
    var aRoute = null;
    $mod.Layout.progressOff();
  };
  this.AddToSidebar = function (Name, Route, Icon) {
    $mod.Treeview.addItem(Route.FID,Name);
    $mod.Treeview.setUserData(Route.FID,"route",Route);
    $mod.Treeview.setItemIcons(Route.FID,pas.JS.New(["file",Icon,"folder-opened",Icon,"folder-closed",Icon]));
  };
  this.TreeviewItemSelected = function (aItem) {
    var aData = null;
    aData = rtl.getObject($mod.Treeview.getUserData(aItem,"route"));
    if (pas.webrouter.Router().GetHistory().$class.getHash() !== aData.FURLPattern) pas.webrouter.Router().Push(aData.FURLPattern);
    if (window.document.body.clientWidth <= 700) $mod.Layout.cells("a").collapse();
  };
  this.OnReady = function (Sender, aLocation, aRoute) {
    try {
      if (pas.System.Pos("\/by-id\/",aLocation) === 0) $mod.Treeview.selectItem(aRoute.FID);
    } catch ($e) {
    };
  };
  this.DoHandleException = function (aName) {
    function ShowError(aValue) {
      var Result = undefined;
      if (aName.error) aName = aName.error;
      if (aName.reason) aName = aName.reason;
      if ((aName.fMessage)) aName = aName.fMessage;
      if (rtl.isExt(aName,XMLHttpRequest,1)) {
        if (rtl.getObject(aName).status !== 4) aName = rtl.getResStr(pas.program,"strRequestTimeout");
      };
      dhtmlx.message(pas.JS.New(["type","error","text",aName]));
      return Result;
    };
    pas.dhtmlx_base.WidgetsetLoaded.then(ShowError);
  };
  var Timeout = 5000;
  this.FillEnviroment = function (aValue) {
    var Result = undefined;
    var i = 0;
    var aCell = null;
    var tmp = "";
    var aId = "";
    var MainDiv = null;
    var aDiv = null;
    var FindRouteLast = 0;
    function SetStatusHintText(text) {
      document.getElementById("lStatusHint").innerHTML = text;
    };
    function RemoveStatusTextText(aValue) {
      var Result = undefined;
      aDiv.style.setProperty("display","none");
      return Result;
    };
    function FillEnviromentAfterLogin(aValue) {
      var Result = undefined;
      function FindInitRoute() {
        if (!$mod.InitRouteFound) if (pas.webrouter.Router().GetHistory().$class.getHash() !== "") if (pas.webrouter.Router().FindHTTPRoute(pas.webrouter.Router().GetHistory().$class.getHash(),null) !== null) $mod.InitRouteFound = pas.webrouter.Router().Push(pas.webrouter.Router().GetHistory().$class.getHash()) === pas.webrouter.TTransitionResult.trOK;
      };
      function ModuleLoaded(aObj) {
        if (!$mod.InitRouteFound) if (pas.webrouter.Router().GetHistory().$class.getHash() !== "") if (pas.webrouter.Router().FindHTTPRoute(pas.webrouter.Router().GetHistory().$class.getHash(),null) !== null) $mod.InitRouteFound = pas.webrouter.Router().Push(pas.webrouter.Router().GetHistory().$class.getHash()) === pas.webrouter.TTransitionResult.trOK;
        window.clearTimeout(FindRouteLast);
        if (!$mod.InitRouteFound) FindRouteLast = window.setTimeout(FindInitRoute,100);
      };
      var aRights = null;
      var aRight = "";
      if ($mod.FInitialized) return Result;
      $mod.FInitialized = true;
      aRights = rtl.getObject(pas.Avamm.UserOptions["rights"]);
      for (var $l1 = 0, $end2 = aRights.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        aRight = Object.getOwnPropertyNames(rtl.getObject(aRights[i]))[0];
        try {
          if (Math.floor(rtl.getObject(aRights[i])[aRight]) >= 0) pas.Avamm.LoadModule(pas.SysUtils.LowerCase(aRight),ModuleLoaded);
        } catch ($e) {
        };
      };
      FindRouteLast = window.setTimeout(FindInitRoute,100);
      if (window.document.body.clientWidth > 700) $mod.Layout.cells("a").expand();
      return Result;
    };
    function LoginFailed(aValueE) {
      var Result = undefined;
      function DoShowError(aValue) {
        var Result = undefined;
        if (!rtl.isExt(aValue,Error,1)) {
          dhtmlx.message(pas.JS.New(["type","error","text",rtl.getResStr(pas.Avamm,"strLoginFailed")]))}
         else dhtmlx.message(pas.JS.New(["type","error","text",aValue]));
        pas.Avamm.deleteCookie("login");
        pas.Avamm.CheckLogin();
        return Result;
      };
      pas.dhtmlx_base.WidgetsetLoaded.then(DoShowError);
      return Result;
    };
    function TryReconnect(aValueE) {
      var Result = undefined;
      function Reconnect(aValue) {
        var Result = undefined;
        function DoCheckLogin(aValue) {
          var Result = undefined;
          pas.Avamm.CheckLogin();
          return Result;
        };
        SetStatusHintText(rtl.getResStr(pas.program,"strReconnecting"));
        pas.Avamm.Wait(5000 - 50).then(DoCheckLogin);
        return Result;
      };
      pas.dhtmlx_base.WidgetsetLoaded.then(Reconnect);
      return Result;
    };
    function AddLoadingHint() {
      var aSide = null;
      var aSides = null;
      try {
        aSides = document.getElementsByClassName("dhx_cell_cont_layout");
        aSide = aSides.item(1);
        if (aSide != null) {
          aDiv = document.createElement("div");
          aDiv.id = "pStatusHint";
          aSide.appendChild(aDiv);
          aDiv.innerHTML = '<font face="verdana"><p id="lStatusHint" align="center"><\/p><\/font>';
        };
        SetStatusHintText(rtl.getResStr(pas.program,"strApplicationLoading"));
      } catch ($e) {
      };
    };
    pas.Avamm.OnException = $mod.DoHandleException;
    pas.Avamm.OnAddToSidebar = $mod.AddToSidebar;
    MainDiv = document.getElementById("AvammMainDiv");
    if (!(MainDiv != null)) MainDiv = window.document.body;
    $mod.Layout = new dhtmlXLayoutObject(pas.JS.New(["parent",MainDiv,"pattern","2U"]));
    $mod.Layout.cells("a").setWidth(200);
    $mod.Layout.cells("a").setText(rtl.getResStr(pas.program,"strMenu"));
    $mod.Layout.cells("a").setCollapsedText(rtl.getResStr(pas.program,"strMenu"));
    $mod.Layout.cells("a").collapse();
    $mod.Layout.cells("b").hideHeader();
    try {
      $mod.Layout.cells("b").cell.childNodes.item(1).style.setProperty("border-width","0px");
      $mod.Layout.cells("b").cell.childNodes.item(0).style.setProperty("border-width","0px");
    } catch ($e) {
    };
    $mod.Layout.setSeparatorSize(0,5);
    $mod.Layout.setSeparatorSize(1,5);
    $mod.Layout.cont.style.setProperty("border-width","0");
    $mod.Layout.setOffsets(pas.JS.New(["left",3,"top",3,"right",3,"bottom",3]));
    $mod.Treeview = rtl.getObject($mod.Layout.cells("a").attachTreeView());
    $mod.Treeview.setIconset("font_awesome");
    $mod.TreeviewSelectionChanged = $mod.Treeview.attachEvent("onClick",$mod.TreeviewItemSelected);
    window.addEventListener("BeforeLogin",RemoveStatusTextText);
    window.addEventListener("AfterLogin",FillEnviromentAfterLogin);
    window.addEventListener("AfterLogout",LoginFailed);
    window.addEventListener("ConnectionError",TryReconnect);
    pas.Avamm.CheckLogin().then(RemoveStatusTextText);
    pas.webrouter.Router().FBeforeRequest = $mod.RouterBeforeRequest;
    pas.webrouter.Router().FAfterRequest = $mod.RouterAfterRequest;
    pas.webrouter.Router().GetHistory().FOnReady = $mod.OnReady;
    AddLoadingHint();
    return Result;
  };
  this.DoGetAvammContainer = function () {
    var Result = undefined;
    function ResizePanelsLater() {
      window.dispatchEvent(pas.Avamm.ContainerResizedEvent);
    };
    function DoResizePanels() {
      window.setTimeout(ResizePanelsLater,10);
    };
    if ($mod.FContainer === null) {
      $mod.FContainer = document.createElement("div");
      $mod.FContainer.style.setProperty("height","100%");
      $mod.FContainer.style.setProperty("width","100%");
      $mod.Layout.cells("b").appendObject($mod.FContainer);
    };
    Result = $mod.FContainer;
    $mod.Layout.attachEvent("onResizeFinish",DoResizePanels);
    $mod.Layout.attachEvent("onCollapse",DoResizePanels);
    $mod.Layout.attachEvent("onExpand",DoResizePanels);
    $mod.Layout.attachEvent("onPanelResizeFinish",DoResizePanels);
    return Result;
  };
  $mod.$resourcestrings = {strMenu: {org: "Menü"}, strStartpage: {org: "Startseite"}, strReconnecting: {org: "Verbindung zum Server fehlgeschlagen,\n\rVerbindung wird automatisch wiederhergestellt"}, strApplicationLoading: {org: "Verbindung wird hergestellt..."}, strRequestTimeout: {org: "Es ist eine Zeitüberschreitung beim Abrufen von Daten aufgetreten !"}};
  $mod.$main = function () {
    $mod.FInitialized = false;
    pas.Avamm.GetAvammContainer = $mod.DoGetAvammContainer;
    pas.dhtmlx_base.AppendCSS("index.css",null,null);
    if ($mod.LoadEnviroment) pas.dhtmlx_base.WidgetsetLoaded.then($mod.FillEnviroment);
    if (pas.webrouter.Router().GetHistory().$class.getHash() !== "") {
      if (pas.webrouter.Router().FindHTTPRoute(pas.webrouter.Router().GetHistory().$class.getHash(),null) !== null) $mod.InitRouteFound = pas.webrouter.Router().Push(pas.webrouter.Router().GetHistory().$class.getHash()) === pas.webrouter.TTransitionResult.trOK;
    };
  };
});
