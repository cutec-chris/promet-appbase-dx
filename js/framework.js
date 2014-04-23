var Params = {
  Server: "localhost:8086",
  Theme:"",
  User:""
  }
var FConnectionOK=false;
var BasePath = "";
window.addEventListener('submit', hideAddressBar(), true);
window.addEventListener('load', function(e) {
  window.applicationCache.addEventListener('updateready', function(e) {
    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
      console.log('Update loaded completely');
      // Browser downloaded a new app cache.
      // Swap it in and reload the page to get the new hotness.
      window.applicationCache.swapCache();
      //if (confirm('A new version of this site is available. Load it?')) {
      //  window.location.reload();
      //}
    }
  }, false);

}, false);

  function loadPage(link){
    var slink = link.substr(link.lastIndexOf("/")+1,link.length);
    if (slink == "index.html") {
        var alink = document.location.href;
        BasePath = alink.substr(0,alink.lastIndexOf("/")+1);
        document.getElementsByTagName('nav')[0].style.display="block";
        document.getElementById('main').style.display="none";
      }
    else {
        var request =  new XMLHttpRequest();
        request.onreadystatechange = function() {
          if (request.readyState == 4) {
            var mainDiv = document.getElementById('main');
            if ((request.status == 200)||((request.status == 0)&&(request.response)))
              {
                mainDiv.innerHTML = request.response;
                hideLoading();
                mainDiv.style.display="block";
                //remove all "ownscripts" from main
                var scripts = document.getElementsByTagName("script");
                for (i=0; i<scripts.length; i++) {
                  var url = scripts[i].getAttribute("src");
                  if(!url) continue;
                  var aclass=scripts[i].getAttribute("class");
                  if(aclass=="ownscript"){
                    scripts[i].parentNode.removeChild(scripts[i]);
                  }
                }
                //attatch new scripts to main
                var ob = mainDiv.getElementsByTagName("script");
                for(var i=0; i<ob.length; i++){
                  if(ob[i]){
                    var ascript = ob[i].text;
                    var asrc = ob[i].src;
                    //compile templates
                    var atype=ob[i].getAttribute("type");
                    if(atype=="text/html"){ //template
                      var atmp = template(ob[i].getAttribute("id"));
                      ascript = null;
                    }
                  // Anlegen und Einfügen des neuen Skripts
                  if ((ascript)||(asrc!="")) {
                    var script = document.createElement("script");
                    script.text=ascript;
                    if (asrc != "") script.src = asrc;
                    script.setAttribute("type", "text/javascript");
                    script.setAttribute("class", "ownscript");
                    document.body.appendChild(script);
                    }
                  }
                }
              }
            else {
                document.location = BasePath+"index.html";
                console.log('failed to fetch Page '+link+' '+request.status);
              }
          }
          };
        request.open('get', link, true);
        request.send(null);
      }
  }
  function LinkClicked(e){
    var link = this.getAttribute("href");
    if (link != "#"){
      e.preventDefault();
      loadPage(link.substr(1,link.length)+'.html');
    }
    history.pushState(null, null, link);
  }
  function hideAddressBar(){
    if(document.documentElement.scrollHeight<window.innerHeight/window.devicePixelRatio)
      document.documentElement.style.height=(window.innerHeight/window.devicePixelRatio)+'px';
    if(navigator.userAgent.match(/Android/i))
      {
      setTimeout(function(){window.scrollTo(0,1)},0);
      }
    else
      setTimeout(function(){window.scrollTo(1,1)},50);
  }
  //hide loading bar
  function hideLoading(){
    var windowWidth = window.innerWidth;
    if (windowWidth < 485) {
      anav = document.getElementsByTagName('nav')[0];
      anav.style.display="none";
      link = document.getElementsByClassName("back")[0];
      if (!link)
        link=document.createElement('a');
      link.href="#index";
      link.className="back";
      link.addEventListener('click',LinkClicked);
      link.style.display="block";
      if (document.getElementsByClassName('toolbar')[1] != null)
        document.getElementsByClassName('toolbar')[1].appendChild(link);
      document.getElementById('main').style.display="block";
    } else {
      document.getElementById('main').style.display="block";
      anav = document.getElementsByTagName('nav')[0];
      anav.style.display="block";
      link = document.getElementsByClassName("back")[0];
      if (link) link.style.display="none";
    }
    hideAddressBar();
  };
  function switchTheme(){
    function appendSheet(href){
      var sheet = document.getElementById("theme")
      if (sheet)
        sheet.parentNode.removeChild(sheet);
      link=document.createElement('link');
      link.href=href;
      link.id="theme"
      link.rel="stylesheet";
      link.type="text/css";
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    if ((loadOption("prometTheme")!=null)||(Params.Theme!="")) {
      if (loadOption("prometTheme")!=null)
        Params.Theme = loadOption("prometTheme");
      appendSheet("base/themes/"+Params.Theme+"/theme.css");
    }
    else {
    if (navigator.userAgent.match(/webOS/i) ||
        navigator.userAgent.match(/Windows Phone/i) ||
        navigator.userAgent.match(/BlackBerry/) ||
        navigator.userAgent.match(/ZuneWP7/i)
       ){ appendSheet("base/themes/jqt/theme.css");}
    else if (
        navigator.userAgent.match(/Android/i)
        ) {appendSheet("base/themes/android/theme.css");}
    else if (
        navigator.userAgent.match(/iPhone/i) ||
        navigator.userAgent.match(/iPod/i) ||
        navigator.userAgent.match(/iPad/i)
        ){appendSheet("base/themes/apple/theme.css");}
    else { appendSheet("base/themes/web/theme.css"); }
    }
  }
document.onreadystatechange = function() {
  if (document.readyState === 'complete'){
  if (loadOption("prometServer")!=null)
    Params.Server = loadOption("prometServer");
  switchTheme();
  window.addEventListener("resize",function(){hideLoading();});
  window.addEventListener("load",function(){hideAddressBar();});
  window.addEventListener("orientationchange",function(){hideLoading();});
  window.onpopstate = function(event) {
    var url = document.location;
    var sharp = String(url).indexOf("#")+1;
    var link = String(url).substr(sharp,String(url).length);
    if (link.indexOf(".html")==-1) link = link+".html";
    loadPage(link);
  };
  var links = document.getElementsByTagName('a');
  for (var i=0; i < links.length; i++){
    links[i].addEventListener('click',LinkClicked);
  }
  function ConnectionAvalibe(){
    DoGet("http://"+Params.Server+"/?action=connectionavail&random="+encodeURIComponent(Math.random()));
    ConnTestTimer = window.setTimeout("ConnectionTimeout()", 100);
  }
  if ((navigator.onLine)&&(window.applicationCache)&&(window.applicationCache.status!=0)) {
      ConnectionAvalibe();
      console.log('Were online, triggering update');
      window.applicationCache.update();
  }
}
};
function ConnectionTimeout(){
  window.clearTimeout(ConnTestTimer);
  OnDisconnected();
}
function ConnectionOK(){
  window.clearTimeout(ConnTestTimer);
  OnConnected();
  var link = "http://"+Params.Server+"/?action=checklogin&random="+encodeURIComponent(Math.random());
  var request =  new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if ((request.status == 200)) {
          IsConnectionOK();
        }
      else {
          DoGet(link);
        }
     }
    };
  request.open('get', link, true);
  request.send(null);
}
function IsConnectionOK(){
  return FConnectionOK;
}
function DoLogout(){
  DoGet("http://"+Params.Server+"/?action=logout&random="+encodeURIComponent(Math.random()));
  FConnectionOK=false;
  OnDisconnected();
  OnConnected();
}
function GetList(aName,aFilter,aSequence,aCallback){
  var link = "http://"+Params.Server+"/?action=list&name="+encodeURIComponent(aName)+"&filter="+encodeURIComponent(aFilter)+"&sequence="+aSequence+"&random="+encodeURIComponent(Math.random());
  DoGetList(link,aSequence,aCallback);
}
function SyncList(aName,aFilter,InputData,aSequence,aCallback){
  var link = "http://"+Params.Server+"/?action=sync&name="+encodeURIComponent(aName)+"&filter="+encodeURIComponent(aFilter)+"&sequence="+aSequence+"&data="+encodeURIComponent(InputData)+"&random="+encodeURIComponent(Math.random());
  DoGetList(link,aSequence,aCallback);
}
function GetQLList(aQL,aSequence,aData,aCallback){
  var link = "http://"+Params.Server+"/?action=list&ql="+encodeURIComponent(aQL)+"&sequence="+aSequence+"&random="+encodeURIComponent(Math.random())+"&data="+encodeURIComponent(aData);
  DoGetList(link,aSequence,aCallback);
}
function DoGetList(link,aSequence,aCallback){
  var request =  new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if ((request.status == 200)) {
          aCallback(aSequence,request.response);
        }
      else {
          console.log("failed to fetch List "+aSequence+" trying to attatch jsonp script");
          OnHandleList = aCallback;
          DoGet(link , true);
          ListTimer = window.setTimeout("DoHandleList("+aSequence+",[])",4000);
        }
     }
    };
  request.open('get', link, true);
  request.send(null);
}
function DoHandleList(aSequence,aData) {
  window.clearTimeout(ListTimer);
  if (OnHandleList != null)
    OnHandleList(aSequence,aData);
  OnHandleList = null;
}
function GetObject(aName,aId,aSequence,aCallback){
  var link = "http://"+Params.Server+"/?action=object&name="+encodeURIComponent(aName)+"&id="+encodeURIComponent(aId)+"&sequence="+aSequence+"&random="+encodeURIComponent(Math.random());
  var request =  new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState == 4) {
      if ((request.status == 200)) {
          aCallback(aSequence,request.response);
        }
      else {
          console.log('failed to fetch List '+aSequence+' '+aName+' trying to attatch jsonp script');
          OnHandleObject = aCallback;
          DoGet(link, true);
          ObjectTimer = window.setTimeout("DoHandleObject("+aSequence+",[])",2000);
        }
     }
    };
  request.open('get', link, true);
  request.send(null);
}
function DoHandleObject(aSequence,aData) {
  window.clearTimeout(ListTimer);
  if (OnHandleObject != null)
    OnHandleObject(aSequence,aData);
  OnHandleObject = null;
}

