unit promet_base;

{$mode objfpc}{$H+}

interface

uses
  js, web, webrouter, classes, SysUtils, dhtmlx_base;

type TJSValueCallback = procedure(aName : JSValue);

function LoadData(url : string;IgnoreLogin : Boolean = False;Datatype : string = 'text/json';Timeout : Integer = 4000) : TJSPromise;
procedure WaitForAssigned(name : string; callback : TJSValueCallback);
function CheckLogin : TJSPromise;

type TOnLoginForm = function : TJSPromise;

var
  AvammLogin : string;
  AvammServer : string;
  OnLoginForm : TOnLoginForm = nil;

resourcestring
  strServerNotRea                = 'Server nicht erreichbar';
  strNoLoginFormA                = 'keine Login Form verfügbar';
  strLoginFailed                 = 'Login fehlgeschlagen';
  strServerMustbeConfigured      = 'Server muss konfiguriert werden';

implementation

function CheckLogin : TJSPromise;
  procedure IntDoCheckLogin(resolve, reject: TJSPromiseResolver);
    function CheckStatus(aValue: JSValue): JSValue;
    begin
      {$ifdef DEBUG}
      asm
        console.log(aValue);
      end;
      {$endif}
      case TJSXMLHttpRequest(aValue).Status of
      403:resolve(true);
      200:
        begin
          reject(TJSError.new(strServerMustbeConfigured));
          window.location.href:='config/install.html';
        end;
      0:reject(TJSError.new(strServerNotRea));
      else
        reject(TJSError.new(strServerNotRea+' '+IntToStr(TJSXMLHttpRequest(aValue).Status)));
      end;
    end;
    function GetLoginData(aValue: JSValue): JSValue;
      function DoGetLoginData(aValue: JSValue): JSValue;
        function LoginSuccessful(aValue : JSValue) : JSValue;
        begin
          if (aValue = true) then
            resolve(true)
          else
            reject(strLoginFailed);
        end;
      begin
        if OnLoginForm = nil then
          reject(TJSError.new(strNoLoginFormA))
        else
          begin
            OnLoginForm()._then(@LoginSuccessful);
          end;
      end;
    begin
      WidgetsetLoaded._then(@DoGetLoginData);
    end;
    function GetRights(aValue: JSValue): JSValue;
    begin
      reject('Cant get Rights');
    end;
  begin
    LoadData('/configuration/status')._then(@CheckStatus)
                                     ._then(@GetLoginData)
                                     ._then(@GetRights);
  end;
begin
  Result := tJSPromise.new(@IntDoCheckLogin);
end;
function GetBaseUrl : string;
begin
  if not ((AvammServer = '') and (TJSRegexp.New('/^h/').test(document.location.href))) then
    AvammServer := 'http://localhost:8085';
  Result := AvammServer;
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
    req.setRequestHeader('Authorization','Basic ' + AvammLogin);
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
    writeln('Returning...');
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
procedure InitAvammApp;
begin
  asm
    var Avamm = {};
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
      Avamm.AfterLoginEvent = createNewEvent('AfterLogin');
      Avamm.AfterLogoutEvent = createNewEvent('AfterLogout');
    } catch (err) {}
  end;
  CheckLogin;
end;

initialization
  writeln('Appbase initializing...');
  Router.InitHistory(hkHash);
  InitAvammApp;
end.

