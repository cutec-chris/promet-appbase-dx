function goTo(url){
  var a = document.createElement("a");
  if (a.click){
    a.setAttribute("href", url);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
  } else {
    window.location = url;
  }
}
function findElementTop(obj) {
  var curtop = 0;
  if (obj){
    if (obj.offsetParent) {
      do {
        curtop += obj.offsetTop;
      } while (obj = obj.offsetParent);
    }
  }
  return [curtop];
}
function DoGet(aurl){
  var scripts = document.getElementsByTagName("script");
  for (i=0; i<scripts.length; i++) {
    var url = scripts[i].getAttribute("src");
    if(!url) continue;
    if(scripts[i].getAttribute("class")=="ownscript") {
      scripts[i].parentNode.removeChild(scripts[i]);
    }
  }
  // Anlegen und Einfügen des neuen Skripts
  var script = document.createElement("script");
  script.setAttribute("src", aurl);
  script.setAttribute("type", "text/javascript");
  script.setAttribute("class", "ownscript");
  document.body.appendChild(script);
}
function setCookie(Name,Value,ExpirationDays){
  var ExpirationDate=new Date();
  ExpirationDate.setDate(ExpirationDate.getDate() + ExpirationDays);
  var c_value=escape(Value) + ((ExpirationDays==null) ? "" : "; expires="+ExpirationDate.toUTCString());
  document.cookie=Name + "=" + c_value;
}
function getCookie(Name){
  var c_value = document.cookie;
  var c_start = c_value.indexOf(" " + Name + "=");
  if (c_start == -1){
    c_start = c_value.indexOf(Name + "=");
  }
  if (c_start == -1){
    c_value = null;
  }
  else {
    c_start = c_value.indexOf("=", c_start) + 1;
    var c_end = c_value.indexOf(";", c_start);
    if (c_end == -1) {
      c_end = c_value.length;
    }
    c_value = unescape(c_value.substring(c_start,c_end));
  }
  return c_value;
}
function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}
function storeOption(Name,Value){
  setCookie(Name,Value);
  if (getCookie(Name)!=Value){
    localStorage[Name]=Value;
  }
}
function loadOption(Name){
  var c_value = getCookie(Name);
  if (c_value==null) {
    c_value = localStorage[Name];
  }
  return c_value;
}
