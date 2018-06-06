unit promet_base;

{$mode objfpc}{$H+}

interface

uses
  js, web, webrouter, classes;

type TJSValueCallback = procedure(aName : JSValue);

procedure WaitForAssigned(name : string; callback : TJSValueCallback);

implementation

procedure InitAvammApp;
begin
{
  asm
    var Avamm;
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
}
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

initialization
  writeln('Appbase initializing...');
  Router.InitHistory(hkHash);
  InitAvammApp;
end.

