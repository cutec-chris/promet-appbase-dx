unit promet_base;

{$mode objfpc}{$H+}

interface

uses
  js, web, webrouter, classes;

var
  Avamm : JSValue;

implementation

procedure ShowStartPage(URl : String; aRoute : TRoute; Params: TStrings);
begin
  writeln('Showing Startpage');
end;

procedure InitAvammApp;
begin
  asm
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
end;

initialization
  writeln('Appbase initializing...');
  Router.InitHistory(hkHash);
  Router.RegisterRoute('startpage',@ShowStartPage,True);
  InitAvammApp;
end.

