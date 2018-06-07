unit promet_base;

{$mode objfpc}{$H+}

interface

uses
  js, web, webrouter, classes;

type TJSValueCallback = procedure(aName : JSValue);

function LoadData(url : string;IgnoreLogin : Boolean = False;Datatype : string = 'text/json';Timeout : Integer = 4000) : TJSPromise;
procedure WaitForAssigned(name : string; callback : TJSValueCallback);

var
  AvammLogin : string;
  AvammServer : string;
  CheckLogin: TJSPromise;

implementation

procedure DoCheckLogin;
  procedure IntDoCkeckLogin(resolve, reject: TJSPromiseResolver);
    function CheckStatus(aValue: JSValue): JSValue;
    begin
      {$ifdef DEBUG}
      asm
        console.log(aValue);
      end;
      {$endif}
      reject(TJSError.new('Login failed'));
    end;
  begin
    LoadData('/configuration/status')._then(@CheckStatus);
  end;
begin
  CheckLogin := TJSPromise.new(@IntDoCkeckLogin);
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
    req.timeout:=Timeout-200;
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
    // Result is an array of resolve values of the 2 promises, so we need the second one.
    Result:=res;
  end;

var
  requestPromise : TJSPromise;
begin
  requestPromise:=TJSPromise.New(@DoRequest);
  Result:=TJSPromise.all([requestPromise])._then(@ReturnResult)
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
  DoCheckLogin;
end;

initialization
  writeln('Appbase initializing...');
  Router.InitHistory(hkHash);
  InitAvammApp;
end.

