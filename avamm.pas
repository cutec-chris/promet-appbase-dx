unit Avamm;

{$mode objfpc}{$H+}

interface

uses
  js, web, AvammRouter,webrouter, classes, SysUtils;

type TJSValueCallback = procedure(aName : JSValue);

procedure RegisterSidebarRoute(aName,Route : string;Event : TRouteEvent;Icon : string = '');
function LoadData(url : string;IgnoreLogin : Boolean = False;Datatype : string = '';Timeout : Integer = 6000) : TJSPromise;
procedure WaitForAssigned(name : string; callback : TJSValueCallback);
function CheckLogin : TJSPromise;
function Wait(ms : NativeInt) : TJSPromise;
procedure setCookie(cname, cvalue : string;exdays : Integer = 2);varargs;
procedure deleteCookie(cname : string);
function getCookie(cname : string) : string;
procedure AppendCSS(url : string;onLoad,onError : JSValue);
procedure AppendJS(url : string;onLoad,onError : JSValue);
procedure InitWindow(aWindow : TJSWindow);
function getRight(aName : string) : Integer;
function GetBaseUrl : string;
type
  TPromiseFunction = function : TJSPromise;
  TRegisterToSidebarEvent = procedure(Name : string;Route : TRoute;Icon : string = '');
  TJSValueFunction = function : JSValue;

var
  AfterLoginEvent : TJSEvent;
  BeforeLoginEvent : TJSEvent;
  AfterLogoutEvent : TJSEvent;
  ConnectionErrorEvent : TJSEvent;
  ContainerResizedEvent : TJSEvent;
  AvammLogin : string;
  AvammServer : string;
  UserOptions : TJSObject;
  OnLoginForm : TPromiseFunction = nil;
  OnAddToSidebar : TRegisterToSidebarEvent = nil;
  GetAvammContainer : TJSValueFunction = nil;
  OnException : TJSValueCallback = nil;

resourcestring
  strServerNotRea                = 'Server nicht erreichbar';
  strNoLoginFormA                = 'keine Login Form verfügbar';
  strLoginFailed                 = 'Login fehlgeschlagen';
  strServerMustbeConfigured      = 'Server muss konfiguriert werden';

implementation

uses dhtmlx_base;

function getRight(aName : string) : Integer;
var
  aRights: TJSArray;
  aRight: String;
  i: Integer;
begin
  Result := -2;
  aRights := TJSArray(UserOptions.Properties['rights']);
  for i := 0 to aRights.Length-1 do
    begin
      aRight := string(TJSObject.getOwnPropertyNames(TJSObject(aRights[i]))[0]);
      if uppercase(aRight)=uppercase(aName) then
        begin
          Result := Integer(TJSObject(aRights[i]).Properties[aRight]);
          exit;
        end;
    end;
end;
procedure AppendCSS(url : string;onLoad,onError : JSValue);
begin
  asm
    var file = url;
    var link = document.createElement( "link" );
    link.href = file;
    link.type = "text/css";
    link.rel = "stylesheet";
    link.media = "screen,print";
    link.onload = onLoad;
    link.onerror = onError;
    document.getElementsByTagName( "head" )[0].appendChild( link );
  end;
end;
procedure AppendJS(url : string;onLoad,onError : JSValue);
begin
  asm
    if (document.getElementById(url) == null) {
      var file = url;
      var link = document.createElement( "script" );
      link.id = url;
      link.src = file;
      link.type = "text/javascript";
      link.onload = onLoad;
      link.onerror = onError;
      document.getElementsByTagName( "head" )[0].appendChild( link );
    }
  end;
end;

function CheckLogin : TJSPromise;
  procedure IntDoCheckLogin(resolve, reject: TJSPromiseResolver);
    function CheckStatus(aValue: JSValue): JSValue;
      procedure DoCheckStatus(resolve, reject: TJSPromiseResolver);
      begin
        {$ifdef DEBUG}
        writeln('CheckStatus:');
        asm
          console.log(aValue);
        end;
        {$endif}
        case TJSXMLHttpRequest(aValue).Status of
        401:resolve(TJSXMLHttpRequest(aValue).Status);
        403:resolve(TJSXMLHttpRequest(aValue).Status);
        200:
          begin
            reject(TJSError.new(strServerMustbeConfigured));
            window.location.href:='config/install.html';
          end;
        0:
          begin
            reject(TJSError.new(strServerNotRea));
            asm
              window.dispatchEvent(pas.Avamm.ConnectionErrorEvent);
            end;
          end
        else
          begin
            reject(TJSError.new(strServerNotRea+' '+IntToStr(TJSXMLHttpRequest(aValue).Status)));
            asm
              window.dispatchEvent(pas.Avamm.ConnectionErrorEvent);
            end;
          end;
        end;
      end;
    begin
      result := TJSPromise.new(@DoCheckStatus);
      {$ifdef DEBUG}
      asm
        console.log(Result);
      end;
      {$endif}
    end;
    function GetLoginData(aValue: JSValue): JSValue;
      var
        tStatusResult: JSValue;
      function DoGetLoginData(aValue: JSValue): JSValue;
        procedure DoIntGetLoginData(resolve, reject: TJSPromiseResolver);
          function LoginSuccessful(aValue : JSValue) : JSValue;
          begin
            {$ifdef DEBUG}
            writeln('GetLoginData:');
            asm
              console.log(aValue);
            end;
            {$endif}
            if (aValue = true) then
              resolve(true)
            else
              reject(strLoginFailed);
          end;
        begin
          asm
            window.dispatchEvent(pas.Avamm.BeforeLoginEvent);
          end;
          if tStatusResult = 401 then
            begin
              if OnLoginForm = nil then
                reject(TJSError.new(strNoLoginFormA))
              else
                begin
                  OnLoginForm()._then(@LoginSuccessful);
                end;
            end
          else resolve(true);
        end;
      begin
        Result := TJSPromise.new(@DoIntGetLoginData);
      end;
    begin
      tStatusResult := aValue;
      result := WidgetsetLoaded._then(@DoGetLoginData);
    end;
    function GetRights(aValue: JSValue): JSValue;
      procedure CatchRights(resolve, reject: TJSPromiseResolver);
        function CheckRightsData(aValue: JSValue): JSValue;
        begin
          if TJSXMLHttpRequest(aValue).Status=200 then
            begin
              asm
                pas.Avamm.UserOptions = JSON.parse(aValue.responseText);
              end;
              resolve(aValue)
            end
          else reject(aValue);
        end;
      begin
        LoadData('/configuration/userstatus')._then(@CheckRightsData);
      end;
      function DoLogout(aValue: JSValue): JSValue;
      begin
        writeln('Credentials wrong Logging out');
        AvammLogin:='';
        asm
          window.dispatchEvent(pas.Avamm.AfterLogoutEvent);
        end;
      end;
      function SetupUser(aValue: JSValue): JSValue;
      begin
        writeln('User Login successful...');
        asm
          window.dispatchEvent(pas.Avamm.AfterLoginEvent);
        end;
      end;
    begin
      Result := TJSPromise.new(@CatchRights)._then(@SetupUser)
                                            .catch(@DoLogout)
    end;
  begin
    Result := TJSPromise.all([LoadData('/configuration/status')._then(@CheckStatus)
                                               ._then(@GetLoginData)
                                               ._then(@GetRights)]);
  end;
begin
  Result := tJSPromise.new(@IntDoCheckLogin);
end;
function GetBaseUrl : string;
var
  IsHttpAddr : Boolean = False;
begin
  asm
    IsHttpAddr = (/^h/.test(document.location));
  end;
  if AvammServer= '' then
    begin
      if not IsHttpAddr then
        AvammServer := 'http://localhost:8085'
      else if (AvammServer = '') then
        AvammServer := document.location.protocol;
    end;
  Result := AvammServer;
end;
procedure RegisterSidebarRoute(aName, Route: string; Event: TRouteEvent;
  Icon: string);
var
  aRoute: TRoute;
begin
  aRoute := Router.RegisterRoute(Route,Event,false);
  if OnAddToSidebar <> nil then
    begin
      OnAddToSidebar(aName,aRoute,Icon);
    end;
end;

function LoadData(url: string; IgnoreLogin: Boolean; Datatype: string;
  Timeout: Integer): TJSPromise;
  // We do all the work within the constructor callback.
  procedure DoRequest(resolve,reject : TJSPromiseResolver) ;
  var
    req : TJSXMLHttpRequest;
    oTimeout: NativeInt;
    function DoOnLoad(event : TEventListenerEvent) : boolean;
    begin
      // On error we reject, otherwise we resolve
      if (req.status=200) then
        resolve(req)
      else
        reject(req);
      window.clearTimeout(oTimeout);
    end;
    function DoOnError(event : TEventListenerEvent) : boolean;
    begin
      {$ifdef DEBUG}
      writeln('Request not succesful (error)');
      {$endif}
      // On error we reject
      reject(req);
      window.clearTimeout(oTimeout);
    end;
    procedure RequestSaveTimeout;
    begin
      {$ifdef DEBUG}
      writeln('Request Timeout');
      {$endif}
      window.clearTimeout(oTimeout);
      req.abort;
      reject(req);
    end;
  begin
    req:=TJSXMLHttpRequest.new;
    req.open('get', GetBaseUrl()+url, true);
    if (Avamm.AvammLogin <> '') and (not IgnoreLogin) then
      begin
        req.setRequestHeader('Authorization','Basic ' + Avamm.AvammLogin);
      end;
    if Datatype<>'' then
      req.overrideMimeType(Datatype);
    req.timeout:=Timeout-100;
    req.addEventListener('load',@DoOnLoad);
    req.addEventListener('error',@DoOnError);
    try
      req.send();
    except
      begin
        {$ifdef DEBUG}
        writeln('Request not succesful');
        {$endif}
        reject(req);
      end;
    end;
    oTimeout := window.setTimeout(@RequestSaveTimeout,Timeout);
  end;
  function ReturnResult(res: JSValue) : JSValue;
  begin
    {$ifdef DEBUG}
    writeln('Returning... ',res);
    {$endif}
    Result:=res;
  end;

var
  requestPromise : TJSPromise;
begin
  requestPromise:=TJSPromise.New(@DoRequest);
  Result:=requestPromise._then(@ReturnResult)
                        .catch(@ReturnResult);
end;
function Wait(ms : NativeInt) : TJSPromise;
  procedure doTimeout(resolve,reject : TJSPromiseResolver) ;
  begin
    window.setTimeout(TJSTimerCallBack(resolve),ms);
  end;
begin
  Result := TJSPromise.New(@doTimeOut);
end;
procedure WaitForAssigned(name : string; callback : TJSValueCallback);
var
  interval : Integer = 10;
  procedure Check;
  begin
    if Assigned(window[name]) then
      callback(window[name])
    else
      window.setTimeout(@Check, interval);
  end;
begin
  window.setTimeout(@check,interval);
end;
function getCookie(cname : string) : string;
begin
  asm
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
    }
  end;
end;
procedure setCookie(cname, cvalue : string;exdays : Integer);varargs;
begin
  asm
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    if (pas.Avamm.getCookie(cname)=='') console.log('failed to store Cookie');
  end;
end;
procedure deleteCookie(cname : string);
begin
  asm
    document.cookie = cname + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  end;
end;
procedure InitAvammApp;
begin
  asm
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
    } catch (err) {}
  end;
  CheckLogin;
end;
function WindowError(aEvent : JSValue) : boolean;
begin
  if OnException<>nil then
    OnException(aEvent);
end;
procedure InitWindow(aWindow : TJSWindow);
begin
  asm
  aWindow.addEventListener("error",function (err) {
    return $impl.WindowError(err);
  });
  aWindow.addEventListener("unhandledrejection", function(err, promise) {
    $impl.WindowError(err);
  });
  end;
end;
initialization
  writeln('Appbase initializing...');
  InitWindow(window);
  Router.InitHistory(hkHash);
  InitAvammApp;
end.

