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
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" proc='+typeof(fn));
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
    if (typeof item === 'function') return item.call(obj); // COM: contains _AddRef
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
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null'));
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
        if (this.hasOwnProperty(id)) this[id]._Release;
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

  arrayClone: function(type,src,srcpos,end,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if (rtl.isFunction(type)){
      for (; srcpos<end; srcpos++) dst[dstpos++] = new type(src[srcpos]); // clone record
    } else if((typeof(type)==="string") && (type === 'refSet')) {
      for (; srcpos<end; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    }  else {
      for (; srcpos<end; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++) l+=arguments[i].length;
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src == null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray == null) return [];
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
    var $r = this.$rtti;
    $r.addProperty("Name",6,rtl.string,"FName","SetName");
    $r.addProperty("Tag",0,rtl.nativeint,"FTag","FTag");
  });
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
rtl.module("dhtmlx_form",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("dhtmlx_base",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.WidgetsetLoaded = null;
  $mod.$init = function () {
    $impl.LoadDHTMLX();
  };
},null,function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.LoadDHTMLX = function () {
    function AppendCSS(url, onLoad, onError) {
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
    function AppendJS(url, onLoad, onError) {
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
    function DoLoadDHTMLX(resolve, reject) {
      function ScriptLoaded() {
        window.dhx4.skin = 'material';
        pas.System.Writeln("DHTMLX loaded...");
        resolve(true);
      };
      function ScriptError() {
        AppendJS("https:\/\/cdn.dhtmlx.com\/edge\/dhtmlx.js",ScriptLoaded,null);
      };
      pas.System.Writeln("Loading DHTMLX...");
      AppendJS("appbase\/dhtmlx\/dhtmlx.js",ScriptLoaded,ScriptError);
    };
    function DoLoadCSS(resolve, reject) {
      function ScriptLoaded() {
        AppendCSS("https:\/\/cdn.dhtmlx.com\/edge\/fonts\/font_awesome\/css\/font-awesome.min.css",null,null);
        resolve(true);
      };
      function ScriptLoaded2() {
        AppendCSS("appbase\/dhtmlx\/font-awesome.min.css",null,null);
        resolve(true);
      };
      function ScriptError() {
        AppendCSS("https:\/\/cdn.dhtmlx.com\/edge\/dhtmlx.css",ScriptLoaded,null);
      };
      AppendCSS("appbase\/dhtmlx\/dhtmlx.css",ScriptLoaded2,ScriptError);
    };
    $mod.WidgetsetLoaded = Promise.all([new Promise(DoLoadDHTMLX),new Promise(DoLoadCSS)]);
  };
});
rtl.module("Avamm",["System","JS","Web","webrouter","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $mod.$rtti.$ProcVar("TJSValueCallback",{procsig: rtl.newTIProcSig([["aName",rtl.jsvalue]])});
  this.RegisterSidebarRoute = function (aName, Route, Event) {
    var aRoute = null;
    aRoute = pas.webrouter.Router().RegisterRoute(Route,Event,false);
    if ($mod.OnAddToSidebar !== null) {
      $mod.OnAddToSidebar(aName,aRoute);
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
      req.open("get",$impl.GetBaseUrl() + url,true);
      if ($mod.AvammLogin !== "") {
        req.setRequestHeader("Authorization","Basic " + $mod.AvammLogin);
      };
      req.overrideMimeType(Datatype);
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
          if ($tmp1 === 403) {
            resolve(true)}
           else if ($tmp1 === 200) {
            reject(new Error(rtl.getResStr(pas.Avamm,"strServerMustbeConfigured")));
            window.location.href = "config\/install.html";
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
            if ($mod.OnLoginForm === null) {
              reject(new Error(rtl.getResStr(pas.Avamm,"strNoLoginFormA")))}
             else {
              $mod.OnLoginForm().then(LoginSuccessful);
            };
          };
          Result = new Promise(DoIntGetLoginData);
          return Result;
        };
        pas.System.Writeln("GetLoginData:");
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
          $mod.LoadData("\/configuration\/userstatus",false,"text\/json",4000).then(CheckRightsData);
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
      Result = Promise.all([$mod.LoadData("\/configuration\/status",false,"text\/json",4000).then(CheckStatus).then(GetLoginData).then(GetRights)]);
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
  $mod.$rtti.$ProcVar("TPromiseFunction",{procsig: rtl.newTIProcSig(null,pas.JS.$rtti["TJSPromise"])});
  $mod.$rtti.$ProcVar("TRegisterToSidebarEvent",{procsig: rtl.newTIProcSig([["Name",rtl.string],["Route",pas.webrouter.$rtti["TRoute"]]])});
  $mod.$rtti.$ProcVar("TJSValueFunction",{procsig: rtl.newTIProcSig(null,rtl.jsvalue)});
  this.AfterLoginEvent = null;
  this.AfterLogoutEvent = null;
  this.ConnectionErrorEvent = null;
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
    window.onerror = $impl.WindowError;
    pas.webrouter.Router().InitHistory(pas.webrouter.THistoryKind.hkHash,"");
    $impl.InitAvammApp();
  };
},["dhtmlx_base"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  $impl.GetBaseUrl = function () {
    var Result = "";
    if (!(($mod.AvammServer === "") && (new RegExp("\/^h\/")).test(document.location.href))) $mod.AvammServer = "http:\/\/localhost:8085";
    Result = $mod.AvammServer;
    return Result;
  };
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
      pas.Avamm.AfterLoginEvent = createNewEvent('AfterLogin');
      pas.Avamm.AfterLogoutEvent = createNewEvent('AfterLogout');
      pas.Avamm.ConnectionErrorEvent = createNewEvent('ConnectionError');
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
rtl.module("AvammForms",["System","Classes","SysUtils","JS","Web","dhtmlx_form","dhtmlx_toolbar","dhtmlx_grid","dhtmlx_layout","dhtmlx_popup","webrouter"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass($mod,"TAvammForm",pas.System.TObject,function () {
  });
  rtl.createClass($mod,"TAvammListForm",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.OldFilter = "";
      this.Page = null;
      this.Toolbar = null;
      this.Grid = null;
    };
    this.$final = function () {
      this.Page = undefined;
      this.Toolbar = undefined;
      this.Grid = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.SwitchProgressOff = function () {
      this.Page.progressOff();
    };
    this.Create$1 = function (aParent, aDataSet) {
      var Self = this;
      function ButtonClick(id) {
        if (id === "new") {}
        else if (id === "refresh") Self.RefreshList();
      };
      function FilterStart(indexes, values) {
        var i = 0;
        Self.OldFilter = "";
        for (var $l1 = 0, $end2 = indexes.length; $l1 <= $end2; $l1++) {
          i = $l1;
          if (values[i] != "") Self.OldFilter = (((((Self.OldFilter + ' AND lower("') + ("" + Self.Grid.getColumnId(Math.floor(indexes[i])))) + '")') + " like lower(\\%") + ("" + values[i])) + "%\\)";
        };
        Self.OldFilter = Self.OldFilter.subString(5,Self.OldFilter.length);
        Self.Page.progressOn();
        try {} catch ($e) {
          Self.Page.progressOff();
        };
      };
      function RowDblClick() {
        Self.Grid.getSelectedRowId();
      };
      pas.System.Writeln(("Loading " + aDataSet) + " as List...");
      Self.Page = new dhtmlXLayoutObject(pas.JS.New(["parent",document.body,"pattern","1U"]));
      Self.Toolbar = rtl.getObject(Self.Page.attachToolbar(pas.JS.New(["parent",Self.Page,"iconset","awesome"])));
      Self.Toolbar.attachEvent("onClick",ButtonClick);
      Self.Grid = rtl.getObject(Self.Page.cells("a").attachGrid(pas.JS.New([])));
      Self.Grid.setImagesPath("codebase\/imgs\/");
      Self.Grid.setSizes();
      Self.Grid.enableAlterCss("even","uneven");
      Self.Grid.setEditable(false);
      Self.Grid.attachEvent("onFilterStart",FilterStart);
      Self.Grid.init();
      Self.Grid.attachEvent("onRowDblClicked",RowDblClick);
    };
    this.RefreshList = function () {
      try {
        this.Page.progressOn();
      } catch ($e) {
        if (pas.SysUtils.Exception.isPrototypeOf($e)) {
          var e = $e;
          pas.System.Writeln("Refresh Exception:" + e.fMessage);
          this.Page.progressOff();
        } else throw $e
      };
    };
  });
  rtl.createClass($mod,"TAvammAutoComplete",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.Grid = null;
      this.Popup = null;
    };
    this.$final = function () {
      this.Grid = undefined;
      this.Popup = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (aPopupParams, aTable, aRow, aHeader, aColIDs, Filter, aDblClick) {
    };
    this.DoFilter = function (aFilter, DoSelect) {
      var Self = this;
      function ShowPopup() {
        if (Self.Grid.getRowsNum() > 0) {
          if (!Self.Popup.isVisible()) Self.Popup.show("eProduct");
          if (DoSelect) Self.Grid.selectRow(0);
        };
      };
    };
  });
  $mod.$resourcestrings = {strRefresh: {org: "Aktualisieren"}};
});
rtl.module("program",["System","JS","Web","Classes","SysUtils","webrouter","dhtmlx_form","Avamm","promet_dhtmlx","dhtmlx_treeview","dhtmlx_layout","dhtmlx_sidebar","dhtmlx_base","AvammForms"],function () {
  "use strict";
  var $mod = this;
  this.LoadEnviroment = true;
  this.Treeview = null;
  this.Layout = null;
  this.InitRouteFound = false;
  this.TreeviewSelectionChanged = undefined;
  this.LoadStartpage = function (URl, aRoute, Params) {
    pas.System.Writeln("Startpage should be shown ...");
  };
  this.RouterBeforeRequest = function (Sender, ARouteURL) {
    $mod.Layout.progressOn();
  };
  this.RouterAfterRequest = function (Sender, ARouteURL) {
    var aRoute = null;
    $mod.Layout.progressOff();
  };
  this.AddToSidebar = function (Name, Route) {
    $mod.Treeview.addItem(Route.FID,Name);
    $mod.Treeview.setUserData(Route.FID,"route",Route);
  };
  this.TreeviewItemSelected = function (aItem) {
    var aData = null;
    aData = rtl.getObject($mod.Treeview.getUserData(aItem,"route"));
    if (pas.webrouter.Router().GetHistory().$class.getHash() !== aData.FURLPattern) pas.webrouter.Router().Push(aData.FURLPattern);
  };
  this.OnReady = function (Sender, aLocation, aRoute) {
    $mod.Treeview.selectItem(aRoute.FID);
  };
  this.DoHandleException = function (aName) {
    function ShowError(aValue) {
      var Result = undefined;
      dhtmlx.message(pas.JS.New(["type","error","text",aName]));
      return Result;
    };
    pas.System.Writeln("Unhandled Exception:",aName);
    pas.dhtmlx_base.WidgetsetLoaded.then(ShowError);
  };
  var Timeout = 5000;
  this.FillEnviroment = function (aValue) {
    var Result = undefined;
    var i = 0;
    var aCell = null;
    var tmp = "";
    var aId = "";
    function FillEnviromentAfterLogin(aValue) {
      var Result = undefined;
      function ModuleLoaded(aObj) {
        console.log(aObj);
        rtl.run(aObj.target.id.split("/")[0]);
        if (!$mod.InitRouteFound) if (pas.webrouter.Router().GetHistory().$class.getHash() !== "") if (pas.webrouter.Router().FindHTTPRoute(pas.webrouter.Router().GetHistory().$class.getHash(),null) !== null) $mod.InitRouteFound = pas.webrouter.Router().Push(pas.webrouter.Router().GetHistory().$class.getHash()) === pas.webrouter.TTransitionResult.trOK;
      };
      var aRights = null;
      var aRight = "";
      if (pas.webrouter.Router().FindHTTPRoute("startpage",null) !== null) return Result;
      pas.System.Writeln("FillEnviromentAfterLogin");
      pas.Avamm.RegisterSidebarRoute(rtl.getResStr(pas.program,"strStartpage"),"startpage",$mod.LoadStartpage);
      aRights = rtl.getObject(pas.Avamm.UserOptions["rights"]);
      for (var $l1 = 0, $end2 = aRights.length - 1; $l1 <= $end2; $l1++) {
        i = $l1;
        aRight = Object.getOwnPropertyNames(rtl.getObject(aRights[i]))[0];
        try {
          if (Math.floor(rtl.getObject(aRights[i])[aRight]) > 1) pas.Avamm.AppendJS(((pas.SysUtils.LowerCase(aRight) + "\/") + pas.SysUtils.LowerCase(aRight)) + ".js",ModuleLoaded,null);
        } catch ($e) {
        };
      };
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
      function ShowError(aValue) {
        var Result = undefined;
        dhtmlx.message(pas.JS.New(["type","error","text",rtl.getResStr(pas.program,"strReconnecting"),"expire",5000]));
        return Result;
      };
      function Reconnect(aValue) {
        var Result = undefined;
        function DoCheckLogin(aValue) {
          var Result = undefined;
          pas.Avamm.CheckLogin();
          return Result;
        };
        pas.Avamm.Wait(5000 - 50).then(DoCheckLogin);
        return Result;
      };
      pas.dhtmlx_base.WidgetsetLoaded.then(ShowError).then(Reconnect);
      return Result;
    };
    pas.Avamm.OnException = $mod.DoHandleException;
    pas.Avamm.OnAddToSidebar = $mod.AddToSidebar;
    $mod.Layout = new dhtmlXLayoutObject(pas.JS.New(["parent",window.document.body,"pattern","2U"]));
    $mod.Layout.cells("a").setWidth(200);
    $mod.Layout.cells("a").setText(rtl.getResStr(pas.program,"strMenu"));
    $mod.Layout.cells("a").setCollapsedText(rtl.getResStr(pas.program,"strMenu"));
    $mod.Layout.cells("a").collapse();
    $mod.Layout.cells("b").hideHeader();
    $mod.Treeview = rtl.getObject($mod.Layout.cells("a").attachTreeView());
    $mod.TreeviewSelectionChanged = $mod.Treeview.attachEvent("onClick",$mod.TreeviewItemSelected);
    window.addEventListener("AfterLogin",FillEnviromentAfterLogin);
    window.addEventListener("AfterLogout",LoginFailed);
    window.addEventListener("ConnectionError",TryReconnect);
    pas.Avamm.CheckLogin();
    pas.webrouter.Router().FBeforeRequest = $mod.RouterBeforeRequest;
    pas.webrouter.Router().FAfterRequest = $mod.RouterAfterRequest;
    pas.webrouter.Router().GetHistory().FOnReady = $mod.OnReady;
    return Result;
  };
  this.DoGetAvammContainer = function () {
    var Result = undefined;
    Result = $mod.Layout.cells("b");
    return Result;
  };
  $mod.$resourcestrings = {strMenu: {org: "Menü"}, strStartpage: {org: "Startseite"}, strReconnecting: {org: "Verbindung zum Server fehlgeschlagen,\n\rVerbindung wird automatisch wiederhergestellt"}};
  $mod.$main = function () {
    pas.Avamm.GetAvammContainer = $mod.DoGetAvammContainer;
    if ($mod.LoadEnviroment) pas.dhtmlx_base.WidgetsetLoaded.then($mod.FillEnviroment);
    if (pas.webrouter.Router().GetHistory().$class.getHash() !== "") if (pas.webrouter.Router().FindHTTPRoute(pas.webrouter.Router().GetHistory().$class.getHash(),null) !== null) $mod.InitRouteFound = pas.webrouter.Router().Push(pas.webrouter.Router().GetHistory().$class.getHash()) === pas.webrouter.TTransitionResult.trOK;
  };
});
//# sourceMappingURL=appbase.js.map
