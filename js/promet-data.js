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

